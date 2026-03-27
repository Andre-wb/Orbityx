"""
Walk-Forward Backtesting Engine  v6.8
=======================================
CHANGES vs v6.7:

  IMPROVEMENT #5 — Режимно-раздельные ансамбли.
                   Используем RegimeEnsemble вместо StackingEnsemble.

                   В каждом сплите:
                     1. RegimeDetector.detect() вычисляет режим каждого
                        бара ОДИН РАЗ для всего массива.
                     2. regime_arr_tr передаётся в RegimeEnsemble.fit() →
                        обучаются отдельные StackingEnsemble для каждого
                        режима у которого достаточно non-neutral баров.
                     3. В тестовом цикле regime_int = regimes_full[i]
                        передаётся в model.predict() и model.get_p_correct() →
                        используется правильная режимная модель.

                   Почему это точнее:
                     Модель в TREND_UP видит только бычьи тренды.
                     Модель в VOLATILE видит только дислокации.
                     Единая модель была вынуждена компромиссировать.

IMPROVEMENTS vs v6.6 (retained from v6.7):
  #1 Калибровка внутри каждого сплита.
  #2 Фильтр MetaClassifier p_correct.
  #3 Timestamps → G26 temporal features.
  #4 regime_aware_weights.

BUG FIXES из v6.7 (retained):
  #11 triple_barrier_labels 4 значения.
  #12 trend_factor через adx_full.
"""
import contextlib
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from features.engineer import FeatureEngineer
from features.selector import FeatureSelector
from models.labels import (
    triple_barrier_labels, forward_log_returns,
    combined_weights, regime_aware_weights,
    compute_adx_for_labels,
)
from models.regime_ensemble import RegimeEnsemble
from models.regime import RegimeDetector
from indicators.technical import atr as compute_atr, sma as compute_sma
from config import MODEL_CFG, LBL_CFG, RISK_CFG, BARS_PER_DAY, EXEC_CFG
from utils.logger import log


# ---------------------------------------------------------------------------
# Adaptive model complexity
# ---------------------------------------------------------------------------

@contextlib.contextmanager
def _adaptive_model_cfg(n_train: int):
    _orig = {k: getattr(MODEL_CFG, k) for k in [
        "lgbm_n_estimators","lgbm_max_depth","lgbm_num_leaves",
        "lgbm_min_child_samples","xgb_n_estimators","xgb_max_depth",
        "xgb_min_child_weight","cat_iterations","cat_depth",
        "gb_n_estimators","gb_max_depth","rf_n_estimators","rf_max_depth",
        "et_n_estimators","et_max_depth","meta_n_estimators",
        "reg_n_estimators","cv_n_splits","optuna_trials","min_train_bars",
    ]}
    try:
        if n_train >= 3000:
            scale, cv, opt, dd = 1.00, 8, MODEL_CFG.optuna_trials, 0
            mcs = MODEL_CFG.lgbm_min_child_samples
            mcw = MODEL_CFG.xgb_min_child_weight
        elif n_train >= 1500:
            scale, cv, opt, dd = 0.70, 5, 20, 0
            mcs = max(MODEL_CFG.lgbm_min_child_samples, 20)
            mcw = max(MODEL_CFG.xgb_min_child_weight,   20)
        elif n_train >= 800:
            scale, cv, opt, dd = 0.45, 4, 10, 1
            mcs = max(MODEL_CFG.lgbm_min_child_samples, 15)
            mcw = max(MODEL_CFG.xgb_min_child_weight,   15)
        elif n_train >= 400:
            scale, cv, opt, dd = 0.25, 3, 0, 1; mcs, mcw = 10, 10
        else:
            scale, cv, opt, dd = 0.15, 3, 0, 2; mcs, mcw = 8, 8

        def _s(b, s, lo=30): return max(int(b * s), lo)
        def _d(b, d, lo=3):  return max(b - d, lo)

        MODEL_CFG.lgbm_n_estimators      = _s(_orig["lgbm_n_estimators"],  scale, 50)
        MODEL_CFG.lgbm_max_depth         = _d(_orig["lgbm_max_depth"],  dd, 3)
        MODEL_CFG.lgbm_num_leaves        = max(int(_orig["lgbm_num_leaves"] * scale), 15)
        MODEL_CFG.lgbm_min_child_samples = mcs
        MODEL_CFG.xgb_n_estimators       = _s(_orig["xgb_n_estimators"],   scale, 50)
        MODEL_CFG.xgb_max_depth          = _d(_orig["xgb_max_depth"],   dd, 3)
        MODEL_CFG.xgb_min_child_weight   = mcw
        MODEL_CFG.cat_iterations         = _s(_orig["cat_iterations"],  scale, 50)
        MODEL_CFG.cat_depth              = _d(_orig["cat_depth"],       dd, 3)
        MODEL_CFG.gb_n_estimators        = _s(_orig["gb_n_estimators"], scale, 50)
        MODEL_CFG.gb_max_depth           = _d(_orig["gb_max_depth"],    dd, 3)
        MODEL_CFG.rf_n_estimators        = _s(_orig["rf_n_estimators"], scale, 50)
        MODEL_CFG.rf_max_depth           = _d(_orig["rf_max_depth"],    dd, 3)
        MODEL_CFG.et_n_estimators        = _s(_orig["et_n_estimators"], scale, 50)
        MODEL_CFG.et_max_depth           = _d(_orig["et_max_depth"],    dd, 3)
        MODEL_CFG.meta_n_estimators      = _s(_orig["meta_n_estimators"], scale, 30)
        MODEL_CFG.reg_n_estimators       = _s(_orig["reg_n_estimators"],  scale, 50)
        MODEL_CFG.cv_n_splits            = cv
        MODEL_CFG.optuna_trials          = opt
        MODEL_CFG.min_train_bars         = min(100, max(30, int(n_train * 0.10)))
        log.info(f"[AdaptiveCFG] n={n_train} scale={scale:.2f} cv={cv} "
                 f"lgbm={MODEL_CFG.lgbm_n_estimators}t opt={opt}")
        yield
    finally:
        for k, v in _orig.items():
            setattr(MODEL_CFG, k, v)


# ---------------------------------------------------------------------------
# Cost model
# ---------------------------------------------------------------------------

def compute_execution_cost(pos_val, price, avg_vol_usd, use_maker=False):
    fee      = EXEC_CFG.maker_fee if use_maker else EXEC_CFG.taker_fee
    slippage = EXEC_CFG.base_slippage
    impact   = 0.0
    if avg_vol_usd > 0:
        vf = pos_val / (avg_vol_usd + 1e-9)
        if vf > EXEC_CFG.impact_threshold_pct:
            impact = EXEC_CFG.impact_coeff * np.sqrt(
                max(vf - EXEC_CFG.impact_threshold_pct, 0.0))
    return fee + slippage + impact


def cap_position_by_volume(pos_val, avg_vol_usd):
    max_val = avg_vol_usd * EXEC_CFG.max_volume_pct
    if max_val > 0 and pos_val > max_val:
        return max_val
    return pos_val


# ---------------------------------------------------------------------------
# Statistics helpers
# ---------------------------------------------------------------------------

def bootstrap_sharpe(returns, ann_factor, n_boot=2000, ci=0.95):
    if len(returns) < 10:
        return float("nan"), float("nan")
    sharpes = []
    for _ in range(n_boot):
        s = np.random.choice(returns, size=len(returns), replace=True)
        sharpes.append(s.mean() / (s.std(ddof=1) + 1e-12) * np.sqrt(ann_factor))
    lo = np.quantile(sharpes, (1 - ci) / 2)
    hi = np.quantile(sharpes, 1 - (1 - ci) / 2)
    return float(lo), float(hi)


def permutation_sharpe_pvalue(returns, ann_factor, n_perm=1000):
    if len(returns) < 10:
        return 1.0
    obs   = returns.mean() / (returns.std(ddof=1) + 1e-12) * np.sqrt(ann_factor)
    count = 0
    for _ in range(n_perm):
        p = np.random.choice([-1, 1], size=len(returns)) * returns
        if p.mean() / (p.std(ddof=1) + 1e-12) * np.sqrt(ann_factor) >= obs:
            count += 1
    return count / n_perm


def monte_carlo_equity(returns, initial, n_sim=500, horizon=252):
    curves = np.zeros((n_sim, horizon))
    for i in range(n_sim):
        s          = np.random.choice(returns, size=horizon, replace=True)
        curves[i]  = initial * np.cumprod(1 + s)
    return (np.percentile(curves, 5,  axis=0),
            np.percentile(curves, 50, axis=0),
            np.percentile(curves, 95, axis=0))


def drawdown_analysis(equity):
    peak  = np.maximum.accumulate(equity)
    dd    = (equity - peak) / (peak + 1e-9)
    in_dd = dd < -1e-6
    durations, start = [], None
    for i, flag in enumerate(in_dd):
        if flag and start is None:   start = i
        elif not flag and start is not None:
            durations.append(i - start); start = None
    return {
        "max_drawdown":          float(dd.min()),
        "avg_drawdown_duration": float(np.mean(durations)) if durations else 0.0,
        "n_drawdown_periods":    len(durations),
        "time_in_drawdown_pct":  float(in_dd.sum() / len(in_dd)),
    }


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class BacktestResult:
    total_trades:           int
    winning_trades:         int
    losing_trades:          int
    win_rate:               float
    avg_win_pct:            float
    avg_loss_pct:           float
    profit_factor:          float
    sharpe_ratio:           float
    sharpe_ci_low:          float
    sharpe_ci_high:         float
    sharpe_pvalue:          float
    sortino_ratio:          float
    calmar_ratio:           float
    max_drawdown:           float
    avg_dd_duration:        float
    time_in_dd_pct:         float
    total_return:           float
    benchmark_return:       float
    cagr:                   float
    oof_logloss_avg:        float
    max_consecutive_wins:   int
    max_consecutive_losses: int
    equity_curve:   List[float] = field(default_factory=list)
    mc_p5:          List[float] = field(default_factory=list)
    mc_p50:         List[float] = field(default_factory=list)
    mc_p95:         List[float] = field(default_factory=list)
    trade_log:      List[dict]  = field(default_factory=list)

    def summary(self) -> str:
        bm = f"{self.benchmark_return:>+.1%}"
        return (
            f"\n{'='*60}\n"
            f"  OrbityxAI v6  Walk-Forward Backtest\n"
            f"{'='*60}\n"
            f"  Сделок:      {self.total_trades:>5} "
            f"(П:{self.winning_trades} / У:{self.losing_trades})\n"
            f"  Win rate:    {self.win_rate:>7.1%}\n"
            f"  Средн. выигрыш: {self.avg_win_pct:>+.3%}\n"
            f"  Средн. убыток:  {self.avg_loss_pct:>+.3%}\n"
            f"  Profit factor:  {self.profit_factor:>6.2f}\n"
            f"  Макс. серия П/У: "
            f"{self.max_consecutive_wins}/{self.max_consecutive_losses}\n"
            f"{'-'*60}\n"
            f"  Sharpe:      {self.sharpe_ratio:>6.2f}  "
            f"95%CI [{self.sharpe_ci_low:.2f}, {self.sharpe_ci_high:.2f}]  "
            f"p={self.sharpe_pvalue:.3f}\n"
            f"  Sortino:     {self.sortino_ratio:>6.2f}\n"
            f"  Calmar:      {self.calmar_ratio:>6.2f}\n"
            f"  Max DD:      {self.max_drawdown:>7.1%}  "
            f"Avg dur: {self.avg_dd_duration:.1f}  "
            f"In DD: {self.time_in_dd_pct:.1%}\n"
            f"{'-'*60}\n"
            f"  Total return:  {self.total_return:>+.1%}\n"
            f"  CAGR:          {self.cagr:>+.1%}\n"
            f"  Benchmark:     {bm}  (buy & hold)\n"
            f"  Alpha:         {self.total_return - self.benchmark_return:>+.1%}\n"
            f"  OOF log-loss:  {self.oof_logloss_avg:>6.4f}\n"
            f"{'='*60}"
        )


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class BacktestEngine:

    def __init__(
            self,
            initial_capital:        float = 10_000.0,
            risk_per_trade:         float = 0.02,
            timeframe:              str   = "1d",
            n_splits:               int   = 8,
            purge_gap:              int   = MODEL_CFG.purge_gap,
            min_confidence:         float = 0.10,
            min_train_bars:         int   = 300,
            max_acceptable_logloss: float = 0.90,
            min_p_correct:          float = 0.52,
            calibration_fraction:   float = 0.10,
    ):
        self.initial_capital        = initial_capital
        self.risk_per_trade         = risk_per_trade
        self.timeframe              = timeframe
        self.n_splits               = n_splits
        self.purge_gap              = purge_gap
        self.min_confidence         = min_confidence
        self.min_train_bars         = min_train_bars
        self.max_acceptable_logloss = max_acceptable_logloss
        self.min_p_correct          = min_p_correct
        self.calibration_fraction   = calibration_fraction
        self.fe                     = FeatureEngineer()
        self._barrier_mult          = LBL_CFG.barrier_atr_mult
        self._levels                = None  # Detected S/R levels

    def run(
            self,
            opens:      np.ndarray,
            highs:      np.ndarray,
            lows:       np.ndarray,
            closes:     np.ndarray,
            volumes:    np.ndarray,
            timestamps: Optional[np.ndarray] = None,
            on_chain:   Optional[dict]        = None,
    ) -> BacktestResult:

        n = len(closes)

        # Detect S/R levels for Gerchik-style filtering
        try:
            from levels.detector import detect_levels
            from indicators.technical import atr as compute_atr
            atr_for_levels = compute_atr(highs, lows, closes)
            self._levels = detect_levels(highs, lows, closes, volumes,
                                          atr_for_levels, swing_window=10)
            log.info(f"[Backtest] Detected {len(self._levels)} S/R levels")
        except Exception as e:
            log.warning(f"[Backtest] Level detection failed: {e}")
            self._levels = None

        log.info(
            f"Walk-forward v6.8: {n} bars tf={self.timeframe} "
            f"min_conf={self.min_confidence} "
            f"min_p_correct={self.min_p_correct} "
            f"max_ll={self.max_acceptable_logloss}"
        )

        # IMPROVEMENT #3: timestamps → G26 temporal features
        X_full      = self.fe.build(opens, highs, lows, closes, volumes,
                                    timestamps=timestamps)
        atr_full    = compute_atr(highs, lows, closes, LBL_CFG.atr_period)
        vol_usd     = closes * volumes
        avg_vol_usd = compute_sma(vol_usd, 20)

        # BUG FIX #12: ADX вычисляется один раз для всего массива.
        # trend_factor в тестовом окне берётся отсюда (не из tf_arr_tr
        # который заполнен только до train_end и равен 1.0 на тесте).
        adx_full = compute_adx_for_labels(highs, lows, closes)

        # IMPROVEMENT #5: режимы вычисляются один раз для всего массива.
        # regimes_full[i] = int{0,1,2,3} для каждого бара.
        # Используется для:
        #   1. regime_arr_tr → RegimeEnsemble.fit() (обучение режимных моделей)
        #   2. regime_int = regimes_full[i] → model.predict() (выбор модели)
        regime_detector = RegimeDetector()
        regimes_full    = regime_detector.detect(highs, lows, closes)

        equity          = self.initial_capital
        equity_curve:   List[float] = []
        all_returns:    List[float] = []
        trade_log:      List[dict]  = []
        oof_loglosses:  List[float] = []
        skipped_splits: int         = 0
        total_test_bars             = 0
        split_size                  = n // (self.n_splits + 1)

        for split in range(self.n_splits):
            train_end  = split_size * (split + 1)
            test_start = train_end + self.purge_gap
            test_end   = min(split_size * (split + 2), n)

            if train_end < self.min_train_bars or test_start >= test_end:
                log.info(
                    f"Сплит {split}: пропущен "
                    f"(train={train_end} < {self.min_train_bars})"
                )
                continue

            log.info(
                f"Сплит {split}: train[0..{train_end}] "
                f"test[{test_start}..{test_end}]"
            )

            # BUG FIX #11: правильная распаковка 4 значений
            labels_tr, _, _, _ = triple_barrier_labels(
                closes, highs, lows, end_idx=train_end)

            # IMPROVEMENT #4: режим-зависимые веса
            try:
                sw_tr = regime_aware_weights(
                    labels_tr[:train_end],
                    closes[:train_end], highs[:train_end], lows[:train_end],
                    max_holding=LBL_CFG.max_holding_bars, decay=LBL_CFG.time_decay)
            except Exception as e:
                log.warning(f"regime_aware_weights failed: {e}")
                sw_tr = combined_weights(
                    labels_tr[:train_end], LBL_CFG.max_holding_bars)

            fwd_log_tr = forward_log_returns(closes, horizon=5, end_idx=train_end)

            X_tr = X_full[:train_end]
            sel  = FeatureSelector()
            try:
                if len(np.unique(labels_tr[:train_end])) >= 2:
                    X_tr_sel = sel.fit_transform(X_tr, labels_tr[:train_end])
                else:
                    X_tr_sel = X_tr; sel = None
            except Exception as e:
                log.warning(f"Feature selection: {e}")
                X_tr_sel = X_tr; sel = None

            # IMPROVEMENT #5: обучаем RegimeEnsemble с режимными данными
            model            = RegimeEnsemble()
            regime_arr_tr    = regimes_full[:train_end]

            with _adaptive_model_cfg(train_end):
                model.fit(
                    X_tr_sel,
                    labels_tr[:train_end],
                    fwd_log_tr[:train_end],
                    sample_weight=sw_tr,
                    regime_arr=regime_arr_tr,   # IMPROVEMENT #5
                )

            oof_ll = model.oof_logloss
            oof_loglosses.append(oof_ll)

            if oof_ll > self.max_acceptable_logloss:
                log.warning(
                    f"Сплит {split}: OOF LL={oof_ll:.4f} "
                    f"> {self.max_acceptable_logloss} → skip"
                )
                skipped_splits += 1
                total_test_bars += (test_end - test_start)
                for _ in range(test_start, test_end):
                    equity_curve.append(round(equity, 2))
                continue

            total_test_bars += (test_end - test_start)

            # Логируем отчёт по режимным моделям
            log.info(model.regime_report())

            # IMPROVEMENT #1: калибровка на holdout
            calibrator = None
            if self.calibration_fraction > 0:
                h_size  = max(int(train_end * self.calibration_fraction), 20)
                h_start = train_end - h_size
                ph, yh  = [], []
                for hi in range(h_start, train_end):
                    if labels_tr[hi] == 0:
                        continue
                    fh = (sel.transform_single(X_full[hi])
                          if sel is not None and sel.selected_mask is not None
                          else X_full[hi])
                    # IMPROVEMENT #5: передаём режим при калибровке
                    hi_regime = int(regimes_full[hi])
                    _, _, pu, _ = model.predict(fh, regime_int=hi_regime)
                    ph.append(pu)
                    yh.append(1 if labels_tr[hi] == 1 else 0)
                if len(ph) >= 20:
                    try:
                        from models.calibrator import ProbabilityCalibrator
                        cal = ProbabilityCalibrator(method="combined")
                        cal.fit(np.array(ph), np.array(yh))
                        if cal._fitted:
                            calibrator = cal
                            log.info(
                                f"Сплит {split}: calibrated on {len(ph)} bars"
                            )
                    except Exception as e:
                        log.warning(f"Calibration: {e}")

            # ------ тест ──────────────────────────────────────────────
            for i in range(test_start, test_end):
                # Применяем selector (маска + feature interactions)
                if sel is not None and sel.selected_mask is not None:
                    feat = sel.transform_single(X_full[i])
                else:
                    feat = X_full[i]

                # IMPROVEMENT #5: режим текущего бара
                regime_int = int(regimes_full[i])

                conf, direction, prob_up, pred_ret = model.predict(
                    feat, regime_int=regime_int)

                # IMPROVEMENT #1: калибровка
                if calibrator is not None:
                    try:
                        pu_cal  = float(calibrator.predict(np.array([prob_up]))[0])
                        conf    = abs(pu_cal - 0.5) * 2.0
                        prob_up = pu_cal
                        if   prob_up > 0.55: direction = "LONG"
                        elif prob_up < 0.45: direction = "SHORT"
                        else:                direction = "NEUTRAL"
                    except Exception:
                        pass

                if direction == "NEUTRAL":
                    equity_curve.append(round(equity, 2)); continue
                if abs(prob_up - 0.5) < self.min_confidence / 2.0:
                    equity_curve.append(round(equity, 2)); continue

                # IMPROVEMENT #2: MetaClassifier фильтр (с режимом)
                if self.min_p_correct > 0:
                    if model.get_p_correct(
                            feat, prob_up, regime_int=regime_int) < self.min_p_correct:
                        equity_curve.append(round(equity, 2)); continue

                entry_idx = min(i + 1, n - 1)
                entry     = float(opens[entry_idx])
                atr_i     = (float(atr_full[i])
                             if not np.isnan(atr_full[i]) else closes[i] * 0.01)

                # Gerchik filter: only trade near support/resistance levels
                if self._levels is not None:
                    from levels.detector import levels_for_bar
                    near_sup, near_res, sups, ress = levels_for_bar(
                        self._levels, i, closes[i], atr_i)
                    at_level = False
                    if near_sup and abs(closes[i] - near_sup.price) < atr_i * 1.0:
                        at_level = True
                    if near_res and abs(near_res.price - closes[i]) < atr_i * 1.0:
                        at_level = True
                    if not at_level:
                        equity_curve.append(round(equity, 2)); continue

                    # Adaptive R:R: use distance to next level as TP
                    if direction == "LONG" and near_res:
                        tp_dist_level = near_res.price - entry
                    elif direction == "SHORT" and near_sup:
                        tp_dist_level = entry - near_sup.price
                    else:
                        tp_dist_level = 0

                # BUG FIX #12: trend_factor из adx_full (корректен для теста)
                adx_i        = float(adx_full[i]) if i < len(adx_full) else float("nan")
                trend_factor = 1.3 if (not np.isnan(adx_i) and adx_i > 25) else 1.0
                sl_dist      = max(
                    atr_i * self._barrier_mult * trend_factor,
                    closes[i] * LBL_CFG.min_return_thresh
                )

                # Adaptive R:R: use level distance if available, else config min_rr
                if self._levels is not None and tp_dist_level > sl_dist * 1.5:
                    tp_dist = tp_dist_level
                else:
                    tp_dist = sl_dist * RISK_CFG.min_rr

                if direction == "LONG":
                    sl_level = entry - sl_dist; tp_level = entry + tp_dist
                else:
                    sl_level = entry + sl_dist; tp_level = entry - tp_dist

                sl_pct = sl_dist / (entry + 1e-9)

                # BUG FIX #8: лимит 5% от equity
                risk_amount  = equity * self.risk_per_trade
                position_val = min(
                    risk_amount / (sl_pct + 1e-9), equity * 0.05)
                avg_v_usd    = (float(avg_vol_usd[i])
                                if not np.isnan(avg_vol_usd[i]) else 0.0)
                position_val = cap_position_by_volume(position_val, avg_v_usd)
                cost_entry   = compute_execution_cost(
                    position_val, entry, avg_v_usd)

                # BUG FIX #3: тройной барьер
                max_hold    = LBL_CFG.max_holding_bars
                exit_       = float(closes[min(entry_idx + max_hold, n - 1)])
                exit_idx    = min(entry_idx + max_hold, n - 1)
                exit_reason = "timeout"

                for j in range(entry_idx + 1, min(entry_idx + max_hold + 1, n)):
                    if direction == "LONG":
                        if lows[j]  <= sl_level:
                            exit_ = sl_level; exit_idx = j; exit_reason = "SL"; break
                        if highs[j] >= tp_level:
                            exit_ = tp_level; exit_idx = j; exit_reason = "TP"; break
                    else:
                        if highs[j] >= sl_level:
                            exit_ = sl_level; exit_idx = j; exit_reason = "SL"; break
                        if lows[j]  <= tp_level:
                            exit_ = tp_level; exit_idx = j; exit_reason = "TP"; break

                avg_v_exit = (float(avg_vol_usd[exit_idx])
                              if not np.isnan(avg_vol_usd[exit_idx]) else 0.0)
                total_cost = cost_entry + compute_execution_cost(
                    position_val, exit_, avg_v_exit)

                if direction == "LONG":
                    pnl_pct = (exit_ - entry) / (entry + 1e-9) - total_cost
                else:
                    pnl_pct = (entry - exit_) / (entry + 1e-9) - total_cost

                trade_pnl = position_val * pnl_pct
                equity   += trade_pnl
                equity    = max(equity, 1e-3)
                all_returns.append(pnl_pct)
                trade_log.append({
                    "split":      split,
                    "bar":        i,
                    "regime":     regime_int,
                    "entry_bar":  entry_idx,
                    "exit_bar":   exit_idx,
                    "exit_reason": exit_reason,
                    "direction":  direction,
                    "conf":       round(conf, 4),
                    "prob_up":    round(float(prob_up), 4),
                    "entry":      round(entry, 6),
                    "exit":       round(exit_, 6),
                    "sl_level":   round(sl_level, 6),
                    "tp_level":   round(tp_level, 6),
                    "sl_pct":     round(sl_pct, 4),
                    "pos_val":    round(position_val, 2),
                    "cost":       round(total_cost, 5),
                    "pnl_pct":    round(pnl_pct, 5),
                    "pnl_usd":    round(trade_pnl, 4),
                    "equity":     round(equity, 2),
                })
                equity_curve.append(round(equity, 2))

        avg_oof = float(np.mean(oof_loglosses)) if oof_loglosses else float("inf")
        bm_ret  = float(closes[-1] / closes[0] - 1.0)
        log.info(
            f"Done: {len(trade_log)} trades OOF_LL={avg_oof:.4f} "
            f"splits={len(oof_loglosses)-skipped_splits}/{self.n_splits} "
            f"skipped={skipped_splits}"
        )
        return self._stats(
            equity_curve, all_returns, trade_log,
            avg_oof, bm_ret, total_test_bars)

    def _stats(self, equity_curve, all_returns, trade_log,
               oof_logloss, benchmark_return, total_test_bars):

        if not trade_log:
            return BacktestResult(
                0, 0, 0, 0., 0., 0., 0., 0.,
                float("nan"), float("nan"), 1.,
                0., 0., 0., 0., 0., 0., benchmark_return, 0.,
                oof_logloss, 0, 0,
                equity_curve, [], [], [], trade_log)

        ret    = np.array(all_returns)
        wins   = ret[ret > 0]; losses = ret[ret < 0]
        win_r  = len(wins) / len(ret)
        avg_w  = float(wins.mean())   if len(wins)   > 0 else 0.0
        avg_l  = float(losses.mean()) if len(losses) > 0 else 0.0
        pf     = float(wins.sum()) / (abs(float(losses.sum())) + 1e-9)

        bpd        = BARS_PER_DAY.get(self.timeframe, 1.0)
        n_years    = max(total_test_bars / (252.0 * bpd), 1.0 / 252)
        ann_factor = max(len(ret) / n_years, 1.0)

        mu      = ret.mean(); sigma = ret.std(ddof=1) + 1e-9
        sharpe  = mu / sigma * np.sqrt(ann_factor)
        neg     = ret[ret < 0]
        down    = neg.std(ddof=1) + 1e-9 if len(neg) > 1 else sigma
        sortino = mu / down * np.sqrt(ann_factor)

        eq       = np.array(equity_curve)
        dd_info  = drawdown_analysis(eq)
        total_ret = eq[-1] / self.initial_capital - 1.0
        cagr_    = (1.0 + total_ret) ** (1.0 / n_years) - 1.0
        calmar   = abs(cagr_ / (dd_info["max_drawdown"] + 1e-9))

        max_cw = max_cl = cw = cl = 0
        for r in ret:
            if r > 0: cw += 1; cl = 0; max_cw = max(max_cw, cw)
            else:     cl += 1; cw = 0; max_cl = max(max_cl, cl)

        try:
            ci_lo, ci_hi = bootstrap_sharpe(ret, ann_factor)
            pval         = permutation_sharpe_pvalue(ret, ann_factor)
        except Exception:
            ci_lo = ci_hi = float("nan"); pval = 1.0

        mc_p5 = mc_p50 = mc_p95 = []
        try:
            p5, p50, p95 = monte_carlo_equity(ret, self.initial_capital)
            mc_p5 = p5.tolist(); mc_p50 = p50.tolist(); mc_p95 = p95.tolist()
        except Exception:
            pass

        return BacktestResult(
            total_trades=len(trade_log),
            winning_trades=int(len(wins)), losing_trades=int(len(losses)),
            win_rate=round(win_r, 4), avg_win_pct=round(avg_w, 5),
            avg_loss_pct=round(avg_l, 5), profit_factor=round(pf, 3),
            sharpe_ratio=round(float(sharpe), 3),
            sharpe_ci_low=(round(float(ci_lo), 3)
                           if not np.isnan(ci_lo) else float("nan")),
            sharpe_ci_high=(round(float(ci_hi), 3)
                            if not np.isnan(ci_hi) else float("nan")),
            sharpe_pvalue=round(float(pval), 4),
            sortino_ratio=round(float(sortino), 3),
            calmar_ratio=round(float(calmar), 3),
            max_drawdown=round(dd_info["max_drawdown"], 4),
            avg_dd_duration=round(dd_info["avg_drawdown_duration"], 1),
            time_in_dd_pct=round(dd_info["time_in_drawdown_pct"], 3),
            total_return=round(float(total_ret), 4),
            benchmark_return=round(float(benchmark_return), 4),
            cagr=round(float(cagr_), 4),
            oof_logloss_avg=round(oof_logloss, 5),
            max_consecutive_wins=int(max_cw),
            max_consecutive_losses=int(max_cl),
            equity_curve=equity_curve,
            mc_p5=mc_p5, mc_p50=mc_p50, mc_p95=mc_p95,
            trade_log=trade_log,
        )