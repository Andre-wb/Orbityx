"""
Stacking Ensemble  v5.8  — Zero Leakage · Maximum Accuracy
============================================================

NEW in v5.8  (v6.8.1):

  BUG FIX — compute_sample_weight('balanced') перемножался с внешним sw
             (uniqueness × time_decay), который настолько перекошен что
             балансировка не помогала. Optuna LGBM LL = 5.7 каждый раз.

  Исправление:
    Для LGBM fit() используем ТОЛЬКО compute_sample_weight('balanced', y)
    без умножения на внешний sw. Внешний sw (uniqueness × decay) остаётся
    только для XGB, CatBoost, GB, RF, ET — там он правильно работает.

    Три места:
      1. _optuna_lgbm()   — sw_balanced = compute_sample_weight('balanced', yt)
      2. _oof_fold()      — sw_in_balanced = compute_sample_weight('balanced', ...)
      3. _fit_final_base() — sw_balanced = compute_sample_weight('balanced', yc)

  Ожидаемый результат:
    Optuna LGBM best LL = 0.6X  (было 5.7X)
    OOF log-loss        = 0.6X  (было 1.04)

NEW in v5.7 (retained):
  BUG FIX — class_weight='balanced' игнорируется LightGBM когда
             sample_weight передан (задокументированное поведение).
  Решение v5.7: _balanced_sw() = sw * compute_sample_weight('balanced').
  Решение v5.8: только compute_sample_weight, без sw — чище.

NEW in v5.6 (retained):
  BUG FIX — Дисбаланс классов в Optuna и OOF фолдах.
  XGB: scale_pos_weight = sum(sw[y==0]) / sum(sw[y==1])
  CatBoost: auto_class_weights='Balanced'

NEW in v5.5 (retained):
  IMPROVEMENT #6 — Режимно-зависимый конформный предиктор.
  BUG FIX v5.5  — np.asarray() убирает LightGBM feature names предупреждения.

BUG FIXES v5.4 (retained):
  BUG #10 — LGBM crash monotone_constraints.size() mismatch.
"""
from __future__ import annotations

import numpy as np
from typing import Optional, Tuple, Dict, Iterator
from config import MODEL_CFG
from utils.logger import log
from models.meta_classifier import MetaClassifier, build_meta_labels

try:
    from sklearn.ensemble import (GradientBoostingClassifier,
                                  RandomForestClassifier,
                                  ExtraTreesClassifier,
                                  GradientBoostingRegressor)
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import RobustScaler
    from sklearn.metrics import log_loss, mean_squared_error, brier_score_loss
    from sklearn.utils.class_weight import compute_sample_weight
    SKLEARN = True
except ImportError:
    SKLEARN = False

try:
    import lightgbm as lgb; LGBM = True
except ImportError:
    LGBM = False

try:
    import xgboost as xgb; XGB = True
except ImportError:
    XGB = False

try:
    from catboost import CatBoostClassifier; CATBOOST = True
except ImportError:
    CATBOOST = False

try:
    import optuna; optuna.logging.set_verbosity(optuna.logging.WARNING); OPTUNA = True
except ImportError:
    OPTUNA = False

try:
    import joblib; JOBLIB = True
except ImportError:
    JOBLIB = False
import warnings
warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names",
    category=UserWarning,
)


# ─────────────────────────────────────────────────────────────
#  Purged expanding-window CV
# ─────────────────────────────────────────────────────────────

class PurgedTimeSeriesSplit:
    def __init__(self, n_splits: int = 5, gap: int = 10):
        self.n_splits = n_splits
        self.gap      = gap

    def split(self, X, y=None) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        n         = len(X)
        fold_size = n // (self.n_splits + 1)
        for k in range(self.n_splits):
            train_end  = fold_size * (k + 1)
            test_start = train_end + self.gap
            test_end   = min(fold_size * (k + 2), n)
            if test_start >= test_end:
                continue
            yield np.arange(0, train_end), np.arange(test_start, test_end)


# ─────────────────────────────────────────────────────────────
#  Conformal Predictor — Regime-Aware (v5.5)
# ─────────────────────────────────────────────────────────────

class ConformalPredictor:
    """
    Mondrian split-conformal с per-regime квантилями.
    P(Y in C(X)) >= 1-alpha гарантировано глобально.
    """

    N_REGIMES = 4  # TREND_UP=0, TREND_DOWN=1, VOLATILE=2, RANGE=3

    def __init__(self, alpha: float = 0.10):
        self.alpha = alpha
        self.q_up_global   = 0.5
        self.q_down_global = 0.5
        self.q_up_regime:   Dict[int, float] = {}
        self.q_down_regime: Dict[int, float] = {}
        self._fitted            = False
        self._per_regime_fitted = False

    def calibrate(self,
                  proba:      np.ndarray,
                  y:          np.ndarray,
                  regime_arr: Optional[np.ndarray] = None) -> None:
        proba = np.clip(proba, 1e-9, 1 - 1e-9)

        for cls, attr in [(1, "q_up_global"), (0, "q_down_global")]:
            mask = y == cls
            if mask.sum() < 5:
                continue
            scores = (1.0 - proba[mask]) if cls == 1 else proba[mask]
            n      = len(scores)
            level  = np.ceil((n + 1) * (1 - self.alpha)) / n
            setattr(self, attr, float(np.quantile(scores, min(level, 1.0))))

        if regime_arr is not None and len(regime_arr) == len(proba):
            self._per_regime_fitted = True
            for r in range(self.N_REGIMES):
                mask_r = regime_arr == r
                n_r    = int(mask_r.sum())
                if n_r < 10:
                    self.q_up_regime[r]   = self.q_up_global
                    self.q_down_regime[r] = self.q_down_global
                    continue
                proba_r = proba[mask_r]
                y_r     = y[mask_r]
                for cls, regime_dict in [(1, self.q_up_regime),
                                         (0, self.q_down_regime)]:
                    mask_cls = y_r == cls
                    if mask_cls.sum() < 5:
                        regime_dict[r] = (self.q_up_global if cls == 1
                                          else self.q_down_global)
                        continue
                    scores = (1.0 - proba_r[mask_cls]) if cls == 1 else proba_r[mask_cls]
                    n_s    = len(scores)
                    level  = np.ceil((n_s + 1) * (1 - self.alpha)) / n_s
                    regime_dict[r] = float(np.quantile(scores, min(level, 1.0)))
            log.info(f"[Conformal] Per-regime calibrated for {self.N_REGIMES} regimes")

        self._fitted = True

    def predict_set(self, proba: float,
                    regime: Optional[int] = None) -> dict:
        if (regime is not None
                and self._per_regime_fitted
                and regime in self.q_up_regime):
            q_up   = self.q_up_regime[regime]
            q_down = self.q_down_regime[regime]
        else:
            q_up   = self.q_up_global
            q_down = self.q_down_global

        inc_up   = proba >= (1.0 - q_up)
        inc_down = (1.0 - proba) >= (1.0 - q_down)
        return {
            "include_up":   bool(inc_up),
            "include_down": bool(inc_down),
            "uncertain":    bool(inc_up and inc_down),
            "certain":      bool(inc_up != inc_down),
            "p_up":         float(proba),
        }


# ─────────────────────────────────────────────────────────────
#  Fallbacks
# ─────────────────────────────────────────────────────────────

class _MomentumFallback:
    def prob(self, x): return float(np.clip(np.mean(x[:6] > 0), 0, 1))

class _MeanReversionFallback:
    def prob(self, x): return float(np.clip(0.5 + np.mean(x < -0.35) * 0.5, 0, 1))

class _TrendFallback:
    def prob(self, x):
        p = np.sum(x > 0.10); q = np.sum(x < -0.10)
        return float(np.clip(p / (p + q + 1e-9), 0, 1))


# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def _compute_scale_pos_weight(yt: np.ndarray,
                              sw: Optional[np.ndarray] = None) -> float:
    """
    Вычислить scale_pos_weight для XGBoost.
    Учитывает sample_weight если передан:
      spw = sum(sw[yt==0]) / sum(sw[yt==1])
    """
    if sw is not None:
        w_pos = float(sw[yt == 1].sum())
        w_neg = float(sw[yt == 0].sum())
    else:
        w_pos = float((yt == 1).sum())
        w_neg = float((yt == 0).sum())
    if w_pos < 1e-9:
        return 1.0
    return float(np.clip(w_neg / w_pos, 0.5, 5.0))


# ─────────────────────────────────────────────────────────────
#  Optuna HPO
# ─────────────────────────────────────────────────────────────

def _optuna_lgbm(Xt, yt, Xe, ye, sw, n_trials):
    """
    BUG FIX v5.8: используем ТОЛЬКО compute_sample_weight('balanced', yt).
    Внешний sw (uniqueness × decay) перекошен и подавляет балансировку.
    BUG FIX #10: exact sklearn-API parameter names.
    """
    if not (OPTUNA and LGBM): return {}

    # BUG FIX v5.8: только balanced, без внешнего sw
    sw_balanced = compute_sample_weight('balanced', yt)

    def obj(t):
        m = lgb.LGBMClassifier(
            n_estimators      = t.suggest_int  ("n_estimators",    200, 1200),
            max_depth         = t.suggest_int  ("max_depth",          3,    7),
            learning_rate     = t.suggest_float("learning_rate",  0.005, 0.08, log=True),
            num_leaves        = t.suggest_int  ("num_leaves",         15,   63),
            min_child_samples = t.suggest_int  ("min_child_samples",  10,   40),
            subsample         = t.suggest_float("subsample",         0.6, 0.95),
            colsample_bytree  = t.suggest_float("colsample_bytree",  0.5, 0.95),
            reg_lambda        = t.suggest_float("reg_lambda",       1e-3,   10, log=True),
            n_jobs=-1, random_state=42, verbose=-1,
        )
        m.fit(np.asarray(Xt), yt,
              sample_weight=sw_balanced,
              eval_set=[(np.asarray(Xe), ye)],
              callbacks=[lgb.early_stopping(30, verbose=False),
                         lgb.log_evaluation(-1)])
        return log_loss(ye, np.clip(m.predict_proba(np.asarray(Xe))[:, 1],
                                    1e-7, 1 - 1e-7))
    s = optuna.create_study(direction="minimize",
                            sampler=optuna.samplers.TPESampler(seed=42))
    s.optimize(obj, n_trials=n_trials, show_progress_bar=False)
    log.info(f"Optuna LGBM best LL={s.best_value:.4f}")
    return s.best_params


def _optuna_xgb(Xt, yt, Xe, ye, sw, n_trials):
    """
    BUG FIX v5.6: scale_pos_weight вычисляется из обучающих данных.
    BUG FIX #10: exact sklearn-API parameter names.
    """
    if not (OPTUNA and XGB): return {}
    spw = _compute_scale_pos_weight(yt, sw)
    log.debug(f"Optuna XGB scale_pos_weight={spw:.2f}")
    def obj(t):
        m = xgb.XGBClassifier(
            n_estimators     = t.suggest_int  ("n_estimators",   200, 1200),
            max_depth        = t.suggest_int  ("max_depth",         3,    7),
            learning_rate    = t.suggest_float("learning_rate", 0.005, 0.08, log=True),
            subsample        = t.suggest_float("subsample",       0.6, 0.95),
            colsample_bytree = t.suggest_float("colsample_bytree",0.5, 0.95),
            min_child_weight = t.suggest_int  ("min_child_weight",  5,   40),
            reg_lambda       = t.suggest_float("reg_lambda",      1e-3,  10, log=True),
            reg_alpha        = t.suggest_float("reg_alpha",       1e-4,   5, log=True),
            scale_pos_weight = spw,
            eval_metric="logloss", early_stopping_rounds=30,
            n_jobs=-1, random_state=42, verbosity=0,
        )
        m.fit(Xt, yt, sample_weight=sw, eval_set=[(Xe, ye)], verbose=False)
        return log_loss(ye, np.clip(m.predict_proba(Xe)[:, 1], 1e-7, 1 - 1e-7))
    s = optuna.create_study(direction="minimize",
                            sampler=optuna.samplers.TPESampler(seed=42))
    s.optimize(obj, n_trials=n_trials, show_progress_bar=False)
    log.info(f"Optuna XGB best LL={s.best_value:.4f}")
    return s.best_params


# ─────────────────────────────────────────────────────────────
#  StackingEnsemble
# ─────────────────────────────────────────────────────────────

class StackingEnsemble:

    def __init__(self):
        self.scaler     = None
        self.gb         = None
        self.rf         = None
        self.et         = None
        self.xgb_model  = None
        self.lgbm       = None
        self.cat        = None
        self.meta       = None
        self.meta2      = MetaClassifier(meta_threshold=0.52)
        self.regressor  = None
        self.conformal  = ConformalPredictor(alpha=MODEL_CFG.conformal_alpha)
        self._trained   = False
        self._use_xgb   = False
        self._use_lgbm  = False
        self._use_cat   = False
        self._oof_logloss  = float("inf")
        self._oof_brier    = float("inf")
        self._reg_rmse     = float("inf")
        self._lgbm_params: dict = {}
        self._xgb_params:  dict = {}
        self._fb_mom = _MomentumFallback()
        self._fb_mr  = _MeanReversionFallback()
        self._fb_tf  = _TrendFallback()

    # ── model factories ──────────────────────────────────────

    def _gb(self):
        return GradientBoostingClassifier(
            n_estimators=MODEL_CFG.gb_n_estimators, max_depth=MODEL_CFG.gb_max_depth,
            learning_rate=MODEL_CFG.gb_learning_rate,
            min_samples_leaf=MODEL_CFG.gb_min_samples_leaf,
            subsample=MODEL_CFG.gb_subsample, max_features=MODEL_CFG.gb_max_features,
            random_state=42)

    def _rf(self):
        return RandomForestClassifier(
            n_estimators=MODEL_CFG.rf_n_estimators, max_depth=MODEL_CFG.rf_max_depth,
            min_samples_leaf=MODEL_CFG.rf_min_samples_leaf,
            max_features=MODEL_CFG.rf_max_features, n_jobs=-1, random_state=42)

    def _et(self):
        return ExtraTreesClassifier(
            n_estimators=MODEL_CFG.et_n_estimators, max_depth=MODEL_CFG.et_max_depth,
            min_samples_leaf=MODEL_CFG.et_min_samples_leaf, n_jobs=-1, random_state=42)

    def _xgb(self, extra=None, scale_pos_weight=1.0):
        p = dict(n_estimators=MODEL_CFG.xgb_n_estimators,
                 max_depth=MODEL_CFG.xgb_max_depth,
                 learning_rate=MODEL_CFG.xgb_learning_rate,
                 subsample=MODEL_CFG.xgb_subsample,
                 colsample_bytree=MODEL_CFG.xgb_colsample,
                 min_child_weight=MODEL_CFG.xgb_min_child_weight,
                 scale_pos_weight=scale_pos_weight,
                 eval_metric="logloss",
                 early_stopping_rounds=MODEL_CFG.xgb_early_stopping,
                 n_jobs=-1, random_state=42, verbosity=0)
        if extra:
            p.update(extra)
        return xgb.XGBClassifier(**p)

    def _lgbm(self, extra=None):
        """
        BUG FIX v5.8: class_weight убран из конструктора.
        Балансировка делается через compute_sample_weight('balanced')
        непосредственно перед fit() — без умножения на внешний sw.
        """
        p = dict(n_estimators=MODEL_CFG.lgbm_n_estimators,
                 max_depth=MODEL_CFG.lgbm_max_depth,
                 learning_rate=MODEL_CFG.lgbm_learning_rate,
                 num_leaves=MODEL_CFG.lgbm_num_leaves,
                 min_child_samples=MODEL_CFG.lgbm_min_child_samples,
                 subsample=MODEL_CFG.lgbm_subsample,
                 colsample_bytree=MODEL_CFG.lgbm_colsample,
                 n_jobs=-1, random_state=42, verbose=-1)
        if extra:
            safe_extra = {k: v for k, v in extra.items()
                          if k != "monotone_constraints"}
            p.update(safe_extra)
        return lgb.LGBMClassifier(**p)

    def _cat(self):
        return CatBoostClassifier(
            iterations=MODEL_CFG.cat_iterations, depth=MODEL_CFG.cat_depth,
            learning_rate=MODEL_CFG.cat_learning_rate,
            l2_leaf_reg=MODEL_CFG.cat_l2_leaf_reg,
            early_stopping_rounds=MODEL_CFG.cat_early_stopping,
            auto_class_weights='Balanced',
            random_seed=42, verbose=False)

    # ── OOF fold ─────────────────────────────────────────────

    def _oof_fold(self, Xs, yc, sw, tr_idx, val_idx) -> dict:
        n_tr  = len(tr_idx)
        es_c  = int(n_tr * MODEL_CFG.es_inner_fraction)
        tr_in = tr_idx[:es_c]
        es_in = tr_idx[es_c:]
        sw_tr = sw[tr_idx]
        sw_in = sw[tr_in]
        out   = {}

        for name, make in [("gb", self._gb), ("rf", self._rf), ("et", self._et)]:
            try:
                m = make()
                m.fit(Xs[tr_idx], yc[tr_idx], sample_weight=sw_tr)
                out[name] = m.predict_proba(Xs[val_idx])[:, 1]
            except Exception as e:
                log.warning(f"{name} fold: {e}")
                out[name] = np.full(len(val_idx), 0.5)

        if self._use_xgb:
            try:
                spw = _compute_scale_pos_weight(yc[tr_in], sw_in)
                m = self._xgb(self._xgb_params, scale_pos_weight=spw)
                m.fit(Xs[tr_in], yc[tr_in], sample_weight=sw_in,
                      eval_set=[(Xs[es_in], yc[es_in])], verbose=False)
                out["xgb"] = m.predict_proba(Xs[val_idx])[:, 1]
            except Exception as e:
                log.warning(f"xgb fold: {e}"); out["xgb"] = np.full(len(val_idx), 0.5)

        if self._use_lgbm:
            try:
                sw_lgbm = compute_sample_weight('balanced', yc[tr_in])
                m = self._lgbm(self._lgbm_params)
                m.fit(np.asarray(Xs[tr_in]), yc[tr_in],
                      sample_weight=sw_lgbm,
                      eval_set=[(np.asarray(Xs[es_in]), yc[es_in])],
                      callbacks=[lgb.early_stopping(MODEL_CFG.lgbm_early_stopping,
                                                    verbose=False),
                                 lgb.log_evaluation(-1)])
                out["lgbm"] = m.predict_proba(np.asarray(Xs[val_idx]))[:, 1]
            except Exception as e:
                log.warning(f"lgbm fold: {e}"); out["lgbm"] = np.full(len(val_idx), 0.5)

        if self._use_cat:
            try:
                m = self._cat()
                m.fit(Xs[tr_in], yc[tr_in], sample_weight=sw_in,
                      eval_set=(Xs[es_in], yc[es_in]))
                out["cat"] = m.predict_proba(Xs[val_idx])[:, 1]
            except Exception as e:
                log.warning(f"cat fold: {e}"); out["cat"] = np.full(len(val_idx), 0.5)

        return out

    # ── final base models ─────────────────────────────────────

    def _fit_final_base(self, Xs, yc, sw, Xs_cal, yc_cal):
        log.info("Training final base learners…")
        for attr, make in [("gb", self._gb), ("rf", self._rf), ("et", self._et)]:
            try:
                m = make(); m.fit(Xs, yc, sample_weight=sw); setattr(self, attr, m)
            except Exception as e:
                log.error(f"Final {attr}: {e}")

        if self._use_xgb:
            try:
                spw = _compute_scale_pos_weight(yc, sw)
                self.xgb_model = self._xgb(self._xgb_params, scale_pos_weight=spw)
                self.xgb_model.fit(Xs, yc, sample_weight=sw,
                                   eval_set=[(Xs_cal, yc_cal)], verbose=False)
            except Exception as e:
                log.warning(f"Final XGB: {e}"); self._use_xgb = False

        if self._use_lgbm:
            try:
                sw_lgbm_final = compute_sample_weight('balanced', yc)
                self.lgbm = self._lgbm(self._lgbm_params)
                self.lgbm.fit(np.asarray(Xs), yc,
                              sample_weight=sw_lgbm_final,
                              eval_set=[(np.asarray(Xs_cal), yc_cal)],
                              callbacks=[lgb.early_stopping(
                                  MODEL_CFG.lgbm_early_stopping, verbose=False),
                                  lgb.log_evaluation(-1)])
            except Exception as e:
                log.warning(f"Final LGBM: {e}"); self._use_lgbm = False

        if self._use_cat:
            try:
                self.cat = self._cat()
                self.cat.fit(Xs, yc, sample_weight=sw, eval_set=(Xs_cal, yc_cal))
            except Exception as e:
                log.warning(f"Final Cat: {e}"); self._use_cat = False

    # ── helper ───────────────────────────────────────────────

    def _avg_proba_batch(self, Xs_batch):
        ps = []
        ws = []
        w_cfg = MODEL_CFG.base_weights
        for m, flag, name in [(self.gb, True, "gb"), (self.rf, True, "rf"),
                               (self.et, True, "et"),
                               (self.xgb_model, self._use_xgb, "xgb"),
                               (self.lgbm,      self._use_lgbm, "lgbm"),
                               (self.cat,       self._use_cat, "cat")]:
            if flag and m is not None:
                try:
                    ps.append(m.predict_proba(np.asarray(Xs_batch))[:, 1])
                    ws.append(w_cfg.get(name, 0.1))
                except Exception: pass
        if not ps:
            return np.full(len(Xs_batch), 0.5)
        ws = np.array(ws); ws /= ws.sum()
        return np.average(ps, axis=0, weights=ws)

    # ── MAIN FIT ─────────────────────────────────────────────

    def fit(self, X: np.ndarray, labels: np.ndarray,
            fwd_ret: np.ndarray,
            sample_weight: Optional[np.ndarray] = None,
            regime_arr:    Optional[np.ndarray] = None) -> "StackingEnsemble":

        if not SKLEARN:
            log.warning("sklearn missing — fallback only."); self._trained = False; return self

        self._use_xgb  = XGB
        self._use_lgbm = LGBM
        self._use_cat  = CATBOOST

        NEUTRAL_WEIGHT   = 0.30
        yc               = (labels == 1).astype(int)
        non_neutral_mask = labels != 0
        sw               = (sample_weight.copy() if sample_weight is not None
                            else np.ones(len(labels), dtype=float))
        sw[labels == 0] *= NEUTRAL_WEIGHT

        n_total = len(labels)
        n_nn    = int(non_neutral_mask.sum())

        if n_nn < MODEL_CFG.min_train_bars:
            log.warning(f"Only {n_nn} non-neutral samples — skipping ML.")
            self._trained = False; return self

        n_up   = int((labels == 1).sum())
        n_down = int((labels == -1).sum())
        n_neut = int((labels == 0).sum())
        spw_global = _compute_scale_pos_weight(yc, sw)
        log.info(f"Ensemble v5.8: {n_total} bars, {n_nn} non-neutral | "
                 f"UP={n_up} DOWN={n_down} NEUT={n_neut} | "
                 f"XGB={self._use_xgb} LGBM={self._use_lgbm} CAT={self._use_cat} | "
                 f"scale_pos_weight={spw_global:.2f}")

        self.scaler = RobustScaler()
        Xs = np.asarray(self.scaler.fit_transform(X))

        # Phase 0: Optuna HPO
        if MODEL_CFG.optuna_trials > 0 and (OPTUNA and (LGBM or XGB)):
            spl = list(PurgedTimeSeriesSplit(n_splits=2,
                                             gap=MODEL_CFG.purge_gap).split(Xs, yc))
            if spl:
                tr0, _ = spl[0]
                ec     = int(len(tr0) * MODEL_CFG.es_inner_fraction)
                Xt, yt, st = Xs[tr0[:ec]], yc[tr0[:ec]], sw[tr0[:ec]]
                Xe, ye     = Xs[tr0[ec:]], yc[tr0[ec:]]
                if LGBM:
                    log.info(f"Optuna LGBM ({MODEL_CFG.optuna_trials} trials)…")
                    self._lgbm_params = _optuna_lgbm(Xt, yt, Xe, ye, st,
                                                     MODEL_CFG.optuna_trials)
                if XGB:
                    log.info(f"Optuna XGB ({MODEL_CFG.optuna_trials} trials)…")
                    self._xgb_params = _optuna_xgb(Xt, yt, Xe, ye, st,
                                                   MODEL_CFG.optuna_trials)

        # Phase A: purged OOF
        cv         = PurgedTimeSeriesSplit(n_splits=MODEL_CFG.cv_n_splits,
                                           gap=MODEL_CFG.purge_gap)
        all_splits = list(cv.split(Xs, yc))
        if not all_splits:
            log.warning("No valid CV splits."); self._trained = False; return self

        oof_splits = all_splits[:-1]
        _, cal_idx = all_splits[-1]

        oof       = {k: np.full(n_total, 0.5)
                     for k in ["gb","rf","et","xgb","lgbm","cat"]}
        oof_reg   = np.zeros(n_total)
        oof_reg_m = np.zeros(n_total, dtype=bool)
        oof_fold_m= np.zeros(n_total, dtype=bool)

        from models.labels import winsorize
        fwd_clean = winsorize(fwd_ret, quantile=0.005)

        for fi, (tr_idx, val_idx) in enumerate(oof_splits):
            if not len(val_idx): continue
            log.info(f"  Fold {fi}: train[0..{len(tr_idx)}] "
                     f"val[{val_idx[0]}..{val_idx[-1]}]")
            probs = self._oof_fold(Xs, yc, sw, tr_idx, val_idx)
            for k, v in probs.items():
                oof[k][val_idx] = v
            oof_fold_m[val_idx] = True

            try:
                ec  = int(len(tr_idx) * MODEL_CFG.es_inner_fraction)
                ti  = tr_idx[:ec]; ei = tr_idx[ec:]
                swr = sw[ti]
                if self._use_xgb:
                    rg = xgb.XGBRegressor(
                        n_estimators=MODEL_CFG.reg_n_estimators,
                        max_depth=MODEL_CFG.reg_max_depth,
                        learning_rate=MODEL_CFG.reg_learning_rate,
                        subsample=0.8, n_jobs=-1,
                        early_stopping_rounds=30, eval_metric="rmse", verbosity=0)
                    rg.fit(Xs[ti], fwd_clean[ti], sample_weight=swr,
                           eval_set=[(Xs[ei], fwd_clean[ei])], verbose=False)
                else:
                    rg = GradientBoostingRegressor(
                        n_estimators=MODEL_CFG.reg_n_estimators,
                        max_depth=MODEL_CFG.reg_max_depth,
                        learning_rate=MODEL_CFG.reg_learning_rate,
                        subsample=0.8, random_state=42)
                    rg.fit(Xs[tr_idx], fwd_clean[tr_idx], sample_weight=sw[tr_idx])
                oof_reg[val_idx]  = rg.predict(Xs[val_idx])
                oof_reg_m[val_idx]= True
            except Exception as e:
                log.warning(f"OOF regressor fold {fi}: {e}")

        # OOF metrics
        nn_oof = non_neutral_mask & oof_fold_m
        if nn_oof.sum() > 0:
            keys  = [k for k in ["gb","rf","et","xgb","lgbm","cat"] if k in oof]
            # Weighted average using config weights for more accurate OOF estimate
            w_cfg = MODEL_CFG.base_weights
            w_arr = np.array([w_cfg.get(k, 0.1) for k in keys])
            w_arr /= w_arr.sum()
            avg_p = np.average([oof[k][nn_oof] for k in keys], axis=0, weights=w_arr)
            self._oof_logloss = log_loss(yc[nn_oof],
                                         np.clip(avg_p, 1e-7, 1-1e-7))
            self._oof_brier   = brier_score_loss(yc[nn_oof], avg_p)
            log.info(f"OOF log-loss: {self._oof_logloss:.4f} | "
                     f"Brier: {self._oof_brier:.4f}")

        valid_reg = oof_reg_m & oof_fold_m
        if valid_reg.sum() > 0:
            self._reg_rmse = float(np.sqrt(mean_squared_error(
                fwd_clean[valid_reg], oof_reg[valid_reg])))
            log.info(f"OOF Reg RMSE: {self._reg_rmse:.6f}")

        # Phase B: L1 meta-stacker
        stack_cols  = [oof[k][nn_oof] for k in ["gb","rf","et"] if k in oof]
        for k in ["xgb","lgbm","cat"]:
            use = getattr(self, f"_use_xgb" if k=="xgb" else f"_use_{k}")
            if use and k in oof:
                stack_cols.append(oof[k][nn_oof])
        oof_stack = np.column_stack(stack_cols)
        sw_meta   = sw[nn_oof]
        if XGB:
            self.meta = xgb.XGBClassifier(
                n_estimators=MODEL_CFG.meta_n_estimators,
                max_depth=MODEL_CFG.meta_max_depth,
                learning_rate=MODEL_CFG.meta_learning_rate,
                subsample=MODEL_CFG.meta_subsample,
                eval_metric="logloss", n_jobs=-1, random_state=42, verbosity=0)
            self.meta.fit(oof_stack, yc[nn_oof], sample_weight=sw_meta)
        else:
            self.meta = LogisticRegression(C=0.1, max_iter=1000, random_state=42)
            self.meta.fit(oof_stack, yc[nn_oof], sample_weight=sw_meta)

        # Phase A2: Secondary MetaClassifier
        log.info("Building meta-labels for SecondaryMetaClassifier…")
        if nn_oof.sum() >= 50:
            keys       = [k for k in ["gb","rf","et","xgb","lgbm","cat"] if k in oof]
            avg_proba  = np.mean([oof[k] for k in keys], axis=0)
            ml_arr     = build_meta_labels(avg_proba[nn_oof], labels[nn_oof])
            rg_oof     = regime_arr[nn_oof] if regime_arr is not None else None
            self.meta2.fit(
                Xs_oof        = Xs[nn_oof],
                proba_oof     = avg_proba[nn_oof],
                meta_labels   = ml_arr,
                sample_weight = sw[nn_oof],
                regime_oof    = rg_oof)
        else:
            log.warning("Too few OOF samples for MetaClassifier.")

        # Phase C: final base learners
        cal_mask   = np.zeros(n_total, dtype=bool); cal_mask[cal_idx] = True
        tr_all     = np.where(~cal_mask)[0]
        self._fit_final_base(Xs[tr_all], yc[tr_all], sw[tr_all],
                             Xs[cal_idx], yc[cal_idx])

        # Phase D: final regressor
        try:
            if self._use_xgb:
                ec = int(len(tr_all) * MODEL_CFG.es_inner_fraction)
                tf = tr_all[:ec]; ef = tr_all[ec:]
                self.regressor = xgb.XGBRegressor(
                    n_estimators=MODEL_CFG.reg_n_estimators,
                    max_depth=MODEL_CFG.reg_max_depth,
                    learning_rate=MODEL_CFG.reg_learning_rate,
                    subsample=0.8, n_jobs=-1,
                    early_stopping_rounds=30, eval_metric="rmse", verbosity=0)
                self.regressor.fit(Xs[tf], fwd_clean[tf],
                                   sample_weight=sw[tf],
                                   eval_set=[(Xs[ef], fwd_clean[ef])], verbose=False)
            else:
                self.regressor = GradientBoostingRegressor(
                    n_estimators=MODEL_CFG.reg_n_estimators,
                    max_depth=MODEL_CFG.reg_max_depth,
                    learning_rate=MODEL_CFG.reg_learning_rate,
                    subsample=0.8, random_state=42)
                self.regressor.fit(Xs[tr_all], fwd_clean[tr_all],
                                   sample_weight=sw[tr_all])
        except Exception as e:
            log.error(f"Final regressor: {e}")

        # Phase E: conformal calibration — per-regime
        try:
            cal_nn_mask = labels[cal_idx] != 0
            n_cal_nn    = int(cal_nn_mask.sum())
            if n_cal_nn >= 10:
                cal_nn_idx  = cal_idx[cal_nn_mask]
                cal_avg_nn  = self._avg_proba_batch(Xs[cal_nn_idx])
                yc_cal_nn   = (labels[cal_nn_idx] == 1).astype(int)
                regime_cal  = None
                if regime_arr is not None:
                    regime_cal = regime_arr[cal_nn_idx]
                self.conformal.calibrate(cal_avg_nn, yc_cal_nn,
                                         regime_arr=regime_cal)
                log.info(f"Conformal calibrated: {n_cal_nn} non-neutral bars, "
                         f"per_regime={regime_cal is not None}")
            else:
                log.warning(f"Too few non-neutral calibration bars ({n_cal_nn})")
        except Exception as e:
            log.warning(f"Conformal calibration: {e}")

        self._trained = True
        log.info("StackingEnsemble v5.8 ready.")
        return self

    # ── PREDICT ──────────────────────────────────────────────

    def predict(self, X_row: np.ndarray,
                weights:    Optional[Dict[str, float]] = None,
                regime_int: Optional[int] = None,
                ) -> Tuple[float, str, float, float]:
        """(confidence, direction, prob_up, pred_log_return)"""
        X2d = X_row.reshape(1, -1)
        if not (self._trained and self.scaler is not None):
            return self._fallback(X_row)

        try:
            Xs = np.asarray(self.scaler.transform(X2d))

            p_gb   = float(self.gb.predict_proba(Xs)[0,1])  if self.gb        else 0.5
            p_rf   = float(self.rf.predict_proba(Xs)[0,1])  if self.rf        else 0.5
            p_et   = float(self.et.predict_proba(Xs)[0,1])  if self.et        else 0.5
            p_xgb  = (float(self.xgb_model.predict_proba(Xs)[0,1])
                      if self._use_xgb  and self.xgb_model else 0.5)
            p_lgbm = (float(self.lgbm.predict_proba(Xs)[0,1])
                      if self._use_lgbm and self.lgbm      else 0.5)
            p_cat  = (float(self.cat.predict_proba(Xs)[0,1])
                      if self._use_cat  and self.cat       else 0.5)

            meta_in = [[p_gb, p_rf, p_et]
                       + ([p_xgb]  if self._use_xgb  else [])
                       + ([p_lgbm] if self._use_lgbm else [])
                       + ([p_cat]  if self._use_cat  else [])]
            p_meta   = float(self.meta.predict_proba(np.array(meta_in))[0,1])
            pred_ret = float(self.regressor.predict(Xs)[0]) if self.regressor else 0.0

        except Exception as e:
            log.warning(f"predict error: {e}")
            return self._fallback(X_row)

        if weights is None:
            if self._use_xgb and self._use_lgbm and self._use_cat:
                weights = MODEL_CFG.base_weights
            elif self._use_xgb and self._use_lgbm:
                weights = MODEL_CFG.base_weights_no_cat
            else:
                weights = MODEL_CFG.base_weights_minimal

        tw = sum(weights.values()) + 1e-9
        prob_up = (weights.get("gb",0)*p_gb + weights.get("rf",0)*p_rf +
                   weights.get("et",0)*p_et + weights.get("xgb",0)*p_xgb +
                   weights.get("lgbm",0)*p_lgbm + weights.get("cat",0)*p_cat +
                   weights.get("meta",0)*p_meta) / tw
        prob_up = float(np.clip(prob_up, 0, 1))

        if self.conformal._fitted:
            cset = self.conformal.predict_set(prob_up, regime=regime_int)
            if cset["uncertain"]:
                prob_up = 0.5 + (prob_up - 0.5) * 0.6

        base_conf = abs(prob_up - 0.5) * 2.0
        adj_conf, p_correct, _ = self.meta2.modulate_confidence(
            base_conf, prob_up, Xs, regime_int)

        adj_conf = float(np.clip(adj_conf, 0.0, 1.0))
        direction_sign = 1.0 if prob_up >= 0.5 else -1.0
        prob_up_final  = float(np.clip(
            0.5 + direction_sign * adj_conf / 2.0, 0.0, 1.0))

        return self._finalise(prob_up_final, pred_ret)

    def _fallback(self, x):
        p = (self._fb_mom.prob(x)*0.40
             + self._fb_mr.prob(x)*0.20
             + self._fb_tf.prob(x)*0.40)
        return self._finalise(float(np.clip(p, 0, 1)), 0.0)

    @staticmethod
    def _finalise(prob_up, pred_ret):
        conf = abs(prob_up - 0.5) * 2.0
        if   prob_up > 0.55: d = "LONG"
        elif prob_up < 0.45: d = "SHORT"
        else:                d = "NEUTRAL"
        return conf, d, prob_up, pred_ret

    # ── Persistence ──────────────────────────────────────────

    def save(self, path):
        if not JOBLIB: log.warning("joblib missing."); return
        state = {k: getattr(self, k) for k in [
            "scaler","gb","rf","et","xgb_model","lgbm","cat",
            "meta","regressor","conformal",
            "_trained","_use_xgb","_use_lgbm","_use_cat",
            "_oof_logloss","_oof_brier","_reg_rmse",
            "_lgbm_params","_xgb_params"]}
        state["meta2_state"] = self.meta2.state_dict()
        joblib.dump(state, path, compress=3)
        log.info(f"Model saved → {path}")

    @classmethod
    def load(cls, path):
        if not JOBLIB: raise RuntimeError("joblib missing.")
        state    = joblib.load(path)
        obj      = cls()
        meta2_sd = state.pop("meta2_state", None)
        for k, v in state.items(): setattr(obj, k, v)
        if meta2_sd: obj.meta2 = MetaClassifier.from_state(meta2_sd)
        log.info(f"Model loaded ← {path}")
        return obj

    # ── Diagnostics ──────────────────────────────────────────

    @property
    def oof_logloss(self): return self._oof_logloss
    @property
    def oof_brier(self):   return self._oof_brier
    @property
    def reg_rmse(self):    return self._reg_rmse

    def feature_importance(self) -> Optional[np.ndarray]:
        for m in [self.xgb_model, self.lgbm, self.gb]:
            fi = getattr(m, "feature_importances_", None) if m else None
            if fi is not None: return fi
        return None

    def shap_values(self, X_sample: np.ndarray) -> Optional[np.ndarray]:
        try:
            import shap
            Xs = np.asarray(self.scaler.transform(X_sample))
            for m in [self.xgb_model, self.lgbm, self.gb]:
                if m is None: continue
                sv = shap.TreeExplainer(m).shap_values(Xs)
                return sv if not isinstance(sv, list) else sv[1]
        except Exception as e: log.warning(f"SHAP: {e}")
        return None

    def get_p_correct(self, X_row: np.ndarray, prob_up: float,
                      regime_int: Optional[int] = None) -> float:
        if not (self._trained and self.scaler is not None):
            return 0.5
        try:
            Xs = np.asarray(self.scaler.transform(X_row.reshape(1, -1)))
            base_conf = abs(prob_up - 0.5) * 2.0
            _, p_correct, _ = self.meta2.modulate_confidence(
                base_conf, prob_up, Xs, regime_int)
            return float(p_correct)
        except Exception as e:
            log.warning(f"get_p_correct: {e}")
            return 0.5