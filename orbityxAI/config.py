"""
OrbityxAI v6.8 — Global Configuration
Все параметры в одном месте. Настроено на максимальную точность.

CHANGES v6.8:
  barrier_atr_mult: 2.0 → 1.5  (больше не-нейтральных меток ~38% vs ~15%)
  max_holding_bars: 15 → 10     (меньше «застрявших» нейтральных из-за time barrier)
  cv_n_splits: 8 → 10           (более надёжные OOF-оценки)
  optuna_trials: 50 → 100       (лучше покрытие пространства гиперпараметров)
  correlation_threshold: 0.85 → 0.80 (строже убираем коррелированные признаки)
  top_k_features/shap_top_k: 50 → 60 (с 117 входными фичами нужно больше)
"""
from dataclasses import dataclass, field
from typing import Dict, List


TIMEFRAME_ATR_MULT: Dict[str, float] = {
    "1m": 0.2, "5m": 0.4, "15m": 0.7, "30m": 0.9,
    "1h": 1.0, "4h": 1.8, "1d": 3.0, "1w": 5.0,
}

BARS_PER_DAY: Dict[str, float] = {
    "1m": 1440, "5m": 288, "15m": 96, "30m": 48,
    "1h": 24,   "4h": 6,   "1d": 1,   "1w": 1/7,
}

# Оптимальное количество баров для каждого таймфрейма
OPTIMAL_BARS: Dict[str, int] = {
    "1m":  100_000,
    "5m":   50_000,
    "15m":  20_000,
    "30m":  15_000,
    "1h":   10_000,
    "4h":    5_000,
    "1d":    3_000,
    "1w":    1_000,
}


@dataclass
class IndicatorConfig:
    rsi_periods:        List[int]   = field(default_factory=lambda: [7, 14, 21])
    macd_fast:          int         = 12
    macd_slow:          int         = 26
    macd_signal:        int         = 9
    bb_period:          int         = 20
    bb_std:             float       = 2.0
    atr_period:         int         = 14
    sma_periods:        List[int]   = field(default_factory=lambda: [10, 20, 50, 100, 200])
    ema_periods:        List[int]   = field(default_factory=lambda: [9, 21, 55, 89, 200])
    stoch_period:       int         = 14
    stoch_smooth:       int         = 3
    cci_period:         int         = 20
    adx_period:         int         = 14
    williams_period:    int         = 14
    mfi_period:         int         = 14
    obv_smooth:         int         = 20
    vwap_period:        int         = 20
    ichimoku_tenkan:    int         = 9
    ichimoku_kijun:     int         = 26
    ichimoku_senkou:    int         = 52
    supertrend_period:  int         = 10
    supertrend_mult:    float       = 3.0
    keltner_period:     int         = 20
    keltner_mult:       float       = 2.0
    donchian_period:    int         = 20
    pivot_window:       int         = 10
    volume_bins:        int         = 24
    hv_periods:         List[int]   = field(default_factory=lambda: [10, 20, 30])
    roc_periods:        List[int]   = field(default_factory=lambda: [5, 10, 20])
    lag_returns:        List[int]   = field(default_factory=lambda: [1, 2, 3, 5, 10, 20, 40])
    rolling_windows:    List[int]   = field(default_factory=lambda: [5, 10, 20, 40])


@dataclass
class LabelConfig:
    # FIX v6.8: 1.5 вместо 2.0 — даёт ~38% не-нейтральных вместо ~15%
    # Шире = меньше сигналов, уже = больше сигналов. 1.5 — оптимальный баланс.
    barrier_atr_mult:   float = 1.5
    # 15 bars — balance between reaching TP and avoiding excess SL
    max_holding_bars:   int   = 15
    min_return_thresh:  float = 0.001
    atr_period:         int   = 14
    metalabel_min_confidence: float = 0.52
    # Временной распад: новые бары важнее старых
    time_decay:         float = 1.0


@dataclass
class SelectionConfig:
    # Stricter correlation filter to remove redundant technical indicators
    correlation_threshold:  float = 0.75
    # 45 SHAP-selected + ~25 force-kept priority features = ~70 total
    top_k_features:         int   = 45
    min_variance:           float = 1e-6
    use_shap:               bool  = True
    shap_top_k:             int   = 45


@dataclass
class ModelConfig:
    # GradientBoosting — медленный, но стабильный базовый learner
    gb_n_estimators:        int   = 500
    gb_max_depth:           int   = 4
    gb_learning_rate:       float = 0.02
    gb_min_samples_leaf:    int   = 20
    gb_subsample:           float = 0.75
    gb_max_features:        float = 0.6

    # RandomForest — хорошо работает на нестационарных рядах
    rf_n_estimators:        int   = 400
    rf_max_depth:           int   = 8
    rf_min_samples_leaf:    int   = 20
    rf_max_features:        str   = "sqrt"

    # ExtraTrees — быстрый и устойчивый к шуму
    et_n_estimators:        int   = 300
    et_max_depth:           int   = 10
    et_min_samples_leaf:    int   = 15

    # LightGBM — основной движок точности
    lgbm_n_estimators:      int   = 800
    lgbm_max_depth:         int   = 6
    lgbm_learning_rate:     float = 0.01
    lgbm_num_leaves:        int   = 40
    lgbm_min_child_samples: int   = 20
    lgbm_subsample:         float = 0.8
    lgbm_colsample:         float = 0.7
    lgbm_early_stopping:    int   = 80

    # XGBoost
    xgb_n_estimators:       int   = 800
    xgb_max_depth:          int   = 6
    xgb_learning_rate:      float = 0.01
    xgb_subsample:          float = 0.8
    xgb_colsample:          float = 0.7
    xgb_min_child_weight:   int   = 20
    xgb_early_stopping:     int   = 80

    # CatBoost
    cat_iterations:         int   = 800
    cat_depth:              int   = 6
    cat_learning_rate:      float = 0.01
    cat_l2_leaf_reg:        float = 5.0
    cat_early_stopping:     int   = 80

    # Meta-learner
    meta_n_estimators:      int   = 300
    meta_max_depth:         int   = 4
    meta_learning_rate:     float = 0.03
    meta_subsample:         float = 0.8

    # Регрессор для предсказания доходности
    reg_n_estimators:       int   = 500
    reg_max_depth:          int   = 5
    reg_learning_rate:      float = 0.02

    # FIX v6.8: cv_n_splits 8→10, optuna_trials 50→100
    min_train_bars:         int   = 300
    walk_forward_splits:    int   = 10
    purge_gap:              int   = 15
    cv_n_splits:            int   = 10
    es_inner_fraction:      float = 0.85

    optuna_trials:          int   = 100

    # Конформная предикция: 90% покрытие
    conformal_alpha:        float = 0.10

    base_weights: Dict[str, float] = field(default_factory=lambda: {
        "gb": 0.10, "rf": 0.10, "et": 0.08,
        "xgb": 0.22, "lgbm": 0.25, "cat": 0.15, "meta": 0.10,
    })
    base_weights_no_cat: Dict[str, float] = field(default_factory=lambda: {
        "gb": 0.12, "rf": 0.12, "et": 0.10,
        "xgb": 0.28, "lgbm": 0.28, "meta": 0.10,
    })
    base_weights_minimal: Dict[str, float] = field(default_factory=lambda: {
        "gb": 0.30, "rf": 0.25, "et": 0.20, "meta": 0.25,
    })


@dataclass
class RiskConfig:
    max_risk_pct:           float = 0.02
    kelly_fraction:         float = 0.25
    max_position_pct:       float = 0.20
    min_rr:                 float = 2.0
    sl_atr_fallback:        float = 1.0
    tp_rr_targets:          List[float] = field(default_factory=lambda: [1.5, 2.5, 3.5])


@dataclass
class ExecutionConfig:
    taker_fee:              float = 0.0004
    maker_fee:              float = 0.0002
    base_slippage:          float = 0.0002
    impact_threshold_pct:   float = 0.01
    impact_coeff:           float = 0.10
    max_volume_pct:         float = 0.05


BINANCE_KLINES_URL   = "https://api.binance.com/api/v3/klines"
BINANCE_FUTURES_URL  = "https://fapi.binance.com/fapi/v1/klines"
BLOCKCHAIN_INFO_URL  = "https://api.blockchain.info/stats"
COINGECKO_URL        = "https://api.coingecko.com/api/v3"
ALTERNATIVE_ME_URL   = "https://api.alternative.me/fng/"

IND_CFG   = IndicatorConfig()
LBL_CFG   = LabelConfig()
SEL_CFG   = SelectionConfig()
MODEL_CFG = ModelConfig()
RISK_CFG  = RiskConfig()
EXEC_CFG  = ExecutionConfig()