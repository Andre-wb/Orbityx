"""
Feature Selection v6.2
====================
Улучшенный пайплайн отбора признаков:

  Stage 1 — Variance filter
  Stage 2 — Mutual Information
  Stage 3 — Correlation pruning (|corr| > 0.80)
  Stage 4 — Stability selection
  Stage 5 — SHAP top-K

НОВОЕ в v6.2:

  IMPROVEMENT #5 — Feature Interactions.
                   После SHAP отбора top-K признаков вычисляем попарные
                   произведения топ-5 по SHAP важности.
                   C(5,2) = 10 дополнительных признаков.

                   Почему это помогает:
                     Линейные модели не могут уловить взаимодействия вида
                     "высокий RSI И волатильный режим → пропустить".
                     Явные произведения дают этот сигнал без усложнения
                     архитектуры. LGBM/XGB хорошо используют такие фичи.

                   Интеракции хранятся как локальные индексы в выбранном
                   (60-мерном) пространстве признаков. Это важно: гарантирует
                   что transform_single() работает корректно при инференсе
                   даже если futures-фичи недоступны.

  BUG FIX v6.1:  np.asarray() перед fit/shap_values — убирает LightGBM
                 предупреждения о feature names.

ВАЖНО: transform_single(x) — используй при инференсе на одном векторе.
       transform(X) — для батча при обучении.
"""
import numpy as np
from typing import Optional, List, Tuple
from config import SEL_CFG
from utils.logger import log
import warnings
warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names",
    category=UserWarning,
)

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


def _mutual_info(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    try:
        from sklearn.feature_selection import mutual_info_classif
        return mutual_info_classif(X, y, random_state=42, n_neighbors=5)
    except Exception:
        n, p = X.shape
        mi   = np.zeros(p)
        for j in range(p):
            col  = X[:, j]
            rk_x = np.argsort(np.argsort(col)).astype(float)
            rk_y = np.argsort(np.argsort(y)).astype(float)
            mi[j] = abs(np.corrcoef(rk_x, rk_y)[0, 1])
        return mi


def _shap_importance(X: np.ndarray, y: np.ndarray) -> Optional[np.ndarray]:
    """SHAP важность через быстрый LightGBM или XGBoost.
    BUG FIX v6.1: np.asarray() убирает предупреждения о feature names.
    """
    if not SHAP_AVAILABLE:
        return None
    try:
        # BUG FIX v6.1: гарантируем чистый numpy — убираем имена колонок
        X_arr = np.asarray(X)

        try:
            import lightgbm as lgb
            model = lgb.LGBMClassifier(
                n_estimators=150, max_depth=5,
                learning_rate=0.05, num_leaves=25,
                n_jobs=-1, random_state=42, verbose=-1,
            )
        except ImportError:
            try:
                import xgboost as xgb
                model = xgb.XGBClassifier(
                    n_estimators=150, max_depth=5,
                    learning_rate=0.05, n_jobs=-1,
                    random_state=42, verbosity=0,
                    eval_metric="logloss",
                )
            except ImportError:
                from sklearn.ensemble import ExtraTreesClassifier
                model = ExtraTreesClassifier(
                    n_estimators=150, max_depth=6,
                    n_jobs=-1, random_state=42,
                )

        # BUG FIX v6.1: передаём X_arr без имён колонок
        model.fit(X_arr, y)
        explainer = shap.TreeExplainer(model)
        sv        = explainer.shap_values(X_arr)
        if isinstance(sv, list):
            sv = sv[1]
        return np.abs(sv).mean(axis=0)
    except Exception as e:
        log.warning(f"SHAP importance failed: {e}")
        return None


def _stability_importance(X: np.ndarray, y: np.ndarray,
                          n_subsamples: int = 10,
                          subsample_frac: float = 0.8) -> np.ndarray:
    """
    Стабильность признака: насколько часто он попадает в топ-K на разных подвыборках.
    """
    n, p        = X.shape
    vote_counts = np.zeros(p, dtype=float)
    sub_size    = max(int(n * subsample_frac), 50)
    top_k       = max(p // 3, 10)

    try:
        from sklearn.feature_selection import mutual_info_classif
        for _ in range(n_subsamples):
            idx = np.random.choice(n, size=sub_size, replace=False)
            mi  = mutual_info_classif(X[idx], y[idx], random_state=None, n_neighbors=3)
            top = np.argsort(-mi)[:top_k]
            vote_counts[top] += 1.0
        return vote_counts / n_subsamples
    except Exception:
        return np.ones(p)


class FeatureSelector:
    """
    Пятиэтапный отбор признаков + попарные взаимодействия топ-5.

    После fit() доступны:
      selected_mask         — boolean маска (p,) базовых признаков
      interaction_pairs_local — list[(i,j)] локальных индексов в selected space
      n_selected            — число отобранных базовых признаков
      n_output_features     — итоговое число признаков (включая интеракции)
    """

    def __init__(
            self,
            corr_threshold:   float = SEL_CFG.correlation_threshold,
            top_k:            int   = SEL_CFG.top_k_features,
            min_variance:     float = SEL_CFG.min_variance,
            use_shap:         bool  = SEL_CFG.use_shap,
            shap_top_k:       int   = SEL_CFG.shap_top_k,
            use_stability:    bool  = True,
            use_interactions: bool  = True,
            n_interact:       int   = 5,   # топ-N признаков для интеракций
    ):
        self.corr_threshold   = corr_threshold
        self.top_k            = top_k
        self.min_variance     = min_variance
        self.use_shap         = use_shap
        self.shap_top_k       = shap_top_k
        self.use_stability    = use_stability
        self.use_interactions = use_interactions
        self.n_interact       = n_interact

        self.selected_mask:           Optional[np.ndarray]          = None
        self.interaction_pairs_local: List[Tuple[int, int]]         = []
        self.n_selected:              int                           = 0
        self.importance_:             Optional[np.ndarray]          = None

    @property
    def n_output_features(self) -> int:
        """Итоговое число признаков после transform (selected + interactions)."""
        return self.n_selected + len(self.interaction_pairs_local)

    def fit(self, X: np.ndarray, y: np.ndarray) -> "FeatureSelector":
        # BUG FIX v6.1: гарантируем чистый numpy
        X = np.asarray(X)

        n, p = X.shape
        keep = np.ones(p, dtype=bool)

        # ── Stage 1: Variance filter ───────────────────────────────────
        variances = np.var(X, axis=0)
        low_var   = variances < self.min_variance
        keep[low_var] = False
        log.info(f"[Selector] Variance: убрано {low_var.sum()}/{p}")

        # ── Stage 2: MI scores ─────────────────────────────────────────
        X_k = X[:, keep]
        yb  = (y == 1).astype(int)
        try:
            mi = _mutual_info(X_k, yb)
        except Exception:
            mi = np.ones(X_k.shape[1])

        # ── Stage 3: Correlation pruning ───────────────────────────────
        corr = np.corrcoef(X_k.T)
        corr = np.where(np.isnan(corr), 0.0, corr)
        np.fill_diagonal(corr, 0.0)
        alive_loc = np.ones(X_k.shape[1], dtype=bool)
        order     = np.argsort(-mi)
        for idx in order:
            if not alive_loc[idx]:
                continue
            corr_hi = np.where(np.abs(corr[idx]) > self.corr_threshold)[0]
            for j in corr_hi:
                if j != idx and alive_loc[j] and mi[j] < mi[idx]:
                    alive_loc[j] = False

        removed_corr = (~alive_loc).sum()
        log.info(f"[Selector] Correlation: убрано {removed_corr}")

        keep_indices = np.where(keep)[0]
        for li, gi in enumerate(keep_indices):
            if not alive_loc[li]:
                keep[gi] = False

        # Pre-filter to 2×top_k
        surviving = np.where(keep)[0]
        mi_surv   = np.zeros(len(surviving))
        for li, gi in enumerate(surviving):
            loc = np.where(keep_indices == gi)[0]
            if len(loc) > 0 and alive_loc[loc[0]] and loc[0] < len(mi):
                mi_surv[li] = mi[loc[0]]

        pre_k = min(self.top_k * 2, len(surviving))
        if pre_k < len(surviving):
            pre_top  = np.argsort(-mi_surv)[:pre_k]
            new_keep = np.zeros(p, dtype=bool)
            for ti in pre_top:
                new_keep[surviving[ti]] = True
            keep      = new_keep
            surviving = np.where(keep)[0]

            mi_surv_new = np.zeros(len(surviving))
            for li, gi in enumerate(surviving):
                loc = np.where(keep_indices == gi)[0]
                if len(loc) > 0 and loc[0] < len(mi):
                    mi_surv_new[li] = mi[loc[0]]
            mi_surv = mi_surv_new

        # ── Stage 4: Stability selection ───────────────────────────────
        if self.use_stability and len(surviving) > self.top_k:
            try:
                X_stab      = X[:, surviving]
                stab_scores = _stability_importance(X_stab, yb, n_subsamples=8)
                stab_thresh = np.quantile(stab_scores, 0.20)
                stable_mask = stab_scores >= stab_thresh
                stab_surviving = surviving[stable_mask]
                stab_mi        = mi_surv[stable_mask]
                if len(stab_surviving) >= self.top_k:
                    surviving = stab_surviving
                    mi_surv   = stab_mi
                    new_keep  = np.zeros(p, dtype=bool)
                    for gi in surviving:
                        new_keep[gi] = True
                    keep = new_keep
                    log.info(f"[Selector] Stability: убрано {(~stable_mask).sum()}")
            except Exception as e:
                log.warning(f"[Selector] Stability failed: {e}")

        # ── Stage 5: SHAP top-K ────────────────────────────────────────
        shap_imp_local: Optional[np.ndarray] = None  # local indices in surviving

        if self.use_shap and SHAP_AVAILABLE and len(surviving) > 0:
            X_shap   = X[:, surviving]
            shap_imp = _shap_importance(X_shap, yb)
            if shap_imp is not None:
                log.info("[Selector] SHAP importance computed")
                shap_top = min(self.shap_top_k, len(surviving))
                top_loc  = np.argsort(-shap_imp)[:shap_top]
                new_keep = np.zeros(p, dtype=bool)
                for ti in top_loc:
                    new_keep[surviving[ti]] = True
                keep = new_keep

                # Сохраняем importance для всех признаков
                self.importance_ = np.zeros(p)
                for li, gi in enumerate(surviving):
                    self.importance_[gi] = shap_imp[li]

                # Сохраняем SHAP importance в порядке selected features
                shap_imp_local = shap_imp  # indexed by surviving[]
            else:
                mi_final_top = np.argsort(-mi_surv)[:self.top_k]
                new_keep = np.zeros(p, dtype=bool)
                for ti in mi_final_top:
                    new_keep[surviving[ti]] = True
                keep = new_keep
        else:
            if self.top_k > 0 and keep.sum() > self.top_k:
                surv2 = np.where(keep)[0]
                mi_s2 = np.zeros(len(surv2))
                for li, gi in enumerate(surv2):
                    loc = np.where(keep_indices == gi)[0]
                    if len(loc) > 0 and loc[0] < len(mi):
                        mi_s2[li] = mi[loc[0]]
                top_idx  = np.argsort(-mi_s2)[:self.top_k]
                new_keep = np.zeros(p, dtype=bool)
                for ti in top_idx:
                    new_keep[surv2[ti]] = True
                keep = new_keep

        # ── Stage 6: Always keep level & structural features ─────────
        # Level features (G30, last 15 of base 135) are fundamental —
        # never drop them regardless of SHAP score.
        # Also keep cross-asset (G27: 4), CVD (G28: 3), WOBV/ER/CI (G29: 3)
        priority_ranges = [
            (120, 135),  # G30: Level features (15)
            (100, 104),  # G27: Cross-asset BTC (4)
            (104, 107),  # G28: CVD / Delta Volume (3)
            (107, 110),  # G29: WOBV + ER + Choppiness (3) — approx indices
        ]
        n_forced = 0
        for start, end in priority_ranges:
            for idx in range(start, min(end, p)):
                if not keep[idx]:
                    keep[idx] = True
                    n_forced += 1
        if n_forced > 0:
            log.info(f"[Selector] Force-kept {n_forced} priority features (levels/structural)")

        self.selected_mask = keep
        self.n_selected    = int(keep.sum())
        log.info(f"[Selector] Итого: {self.n_selected}/{p} признаков")

        # ── IMPROVEMENT #5: Feature Interactions ───────────────────────
        # Вычисляем попарные произведения топ-N признаков по SHAP важности.
        # Используем ЛОКАЛЬНЫЕ индексы в selected space (0..n_selected-1),
        # это гарантирует корректность transform_single() при инференсе
        # вне зависимости от того добавлялись ли futures фичи.
        self.interaction_pairs_local = []
        if self.use_interactions and self.n_selected >= 2:
            selected_arr = np.where(self.selected_mask)[0]  # sorted global indices

            # Определяем важность для каждого selected признака
            if shap_imp_local is not None and len(surviving) > 0:
                # Map: selected feature → its importance
                sel_importance = np.zeros(self.n_selected)
                for sel_local_idx, global_idx in enumerate(selected_arr):
                    loc_in_surv = np.where(surviving == global_idx)[0]
                    if len(loc_in_surv) > 0 and loc_in_surv[0] < len(shap_imp_local):
                        sel_importance[sel_local_idx] = shap_imp_local[loc_in_surv[0]]
            elif self.importance_ is not None:
                sel_importance = self.importance_[selected_arr]
            else:
                # Fallback: все одинаковы, берём первые n_interact
                sel_importance = np.ones(self.n_selected)

            n_i = min(self.n_interact, self.n_selected)
            top_local = np.argsort(-sel_importance)[:n_i].tolist()

            self.interaction_pairs_local = [
                (int(top_local[i]), int(top_local[j]))
                for i in range(len(top_local))
                for j in range(i + 1, len(top_local))
            ]
            if self.interaction_pairs_local:
                log.info(
                    f"[Selector] Interactions: {len(self.interaction_pairs_local)} "
                    f"попарных произведений топ-{n_i} признаков"
                )

        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Применить маску и добавить интеракции. Для батчей."""
        if self.selected_mask is None:
            raise RuntimeError("Сначала вызовите fit().")
        X = np.asarray(X)
        base = X[:, self.selected_mask]
        if not self.interaction_pairs_local:
            return base
        inter_cols = [
            (base[:, i] * base[:, j]).reshape(-1, 1)
            for i, j in self.interaction_pairs_local
        ]
        return np.hstack([base] + inter_cols)

    def transform_single(self, x: np.ndarray) -> np.ndarray:
        """
        Применить маску и интеракции к одному вектору признаков.
        Используется при инференсе в engine.py и generator.py.

        Работает корректно при любом размере входного вектора:
        маска применяется к полному вектору, интеракции —
        к уже отфильтрованным признакам (local indices).
        """
        if self.selected_mask is None:
            return np.asarray(x)
        x    = np.asarray(x, dtype=float)
        base = x[self.selected_mask]
        if not self.interaction_pairs_local:
            return base
        interactions = np.array([
            base[i] * base[j]
            for i, j in self.interaction_pairs_local
        ], dtype=float)
        return np.concatenate([base, interactions])

    def fit_transform(self, X: np.ndarray, y: np.ndarray) -> np.ndarray:
        return self.fit(X, y).transform(X)