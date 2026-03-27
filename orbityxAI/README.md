# OrbityxAI v5 — Professional Crypto Trading Signal System

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)]()
[![scikit-learn](https://img.shields.io/badge/sklearn-1.4+-orange.svg)]()
[![XGBoost](https://img.shields.io/badge/xgboost-2.0+-green.svg)]()
[![LightGBM](https://img.shields.io/badge/lightgbm-4.0+-red.svg)]()

A **methodologically rigorous** ML trading system with zero information leakage, three-stage stacking ensemble, conformal prediction guarantees, and Lopez de Prado meta-labelling.

---

## Architecture

```
orbityxAI/
├── predictor.py          ← Entry point: OrbityxPredictor
├── config.py             ← All parameters (MODEL_CFG, RISK_CFG, …)
├── requirements.txt
│
├── data/
│   ├── fetcher.py        ← Binance OHLCV REST API
│   └── onchain.py        ← Blockchain.info / CoinGecko / Fear&Greed
│
├── indicators/
│   ├── technical.py      ← 30+ indicators, pure NumPy, zero lookahead
│   ├── volume.py         ← OBV / MFI / CMF / VolumeProfile
│   └── patterns.py       ← 12 candlestick patterns
│
├── features/
│   ├── engineer.py       ← 115+ features: micro-structure, fractal diff, Hurst
│   └── selector.py       ← Variance → Corr → SHAP → Top-K pipeline
│
├── models/
│   ├── ensemble.py       ← 3-stage ensemble (6 base + L1 stacker + meta2)
│   ├── meta_classifier.py← Lopez de Prado secondary MetaClassifier
│   ├── labels.py         ← Triple-barrier + fractional diff + combined weights
│   └── regime.py         ← 4 market regime detector
│
├── signals/
│   ├── generator.py      ← TradingSignal with conformal prediction set
│   └── risk.py           ← S/R-anchored stops, Kelly sizing
│
├── backtest/
│   └── engine.py         ← Walk-forward + benchmark + bootstrap CI + Monte Carlo
│
└── utils/
    └── logger.py
```

---

## Quick Start

```bash
pip install -r requirements.txt
```

```python
from predictor import OrbityxPredictor
import asyncio

p = OrbityxPredictor(portfolio_size=10_000)

# Live signal from Binance
signal = asyncio.run(p.analyze_live("BTCUSDT", "1h", limit=700))
print(signal.summary())

# Walk-forward backtest
result = asyncio.run(p.backtest_live("BTCUSDT", "1d", limit=1000))
print(result.summary())
```

---

## 3-Stage Ensemble Architecture

### Stage 1 — Primary Base Learners (Level 0)
Six diverse classifiers, each trained via `PurgedTimeSeriesSplit`:
- `GradientBoostingClassifier` (sklearn)
- `RandomForestClassifier` (sklearn)
- `ExtraTreesClassifier` (sklearn)
- `XGBClassifier` (XGBoost)
- `LGBMClassifier` (LightGBM)
- `CatBoostClassifier` (CatBoost)

### Stage 2 — Primary Meta-Learner (Level 1 Stacker)
`XGBClassifier` trained on **pure OOF** stacked probabilities. No calibration is applied on the same fold used for OOF predictions — zero leakage.

### Stage 2b — Secondary MetaClassifier (Lopez de Prado)
A second LightGBM that answers: *"Is the primary ensemble correct on this bar?"*

- **Training input:** `[scaled_features ‖ primary_proba ‖ regime_onehot]`
- **Target:** `meta_label = 1` if primary was correct, else `0`
- **Effect:** precision ↑, false positives ↓, sharper trade selection

### Stage 3 — Conformal Predictor
Mondrian split-conformal on a dedicated calibration holdout.
**Guarantee:** `P(Y ∈ C(X)) ≥ 1 − α = 90%` (finite-sample, distribution-free).

---

## Zero-Leakage Protocol

```
PurgedTimeSeriesSplit(n_splits=5, gap=10)

For each fold k ∈ {0 … n-2}:
  tr_inner (85% of tr_idx) → model training
  es_inner (15% of tr_idx) → early-stopping ONLY (boosting models)
  val_idx  (next fold)     → OOF predictions (NEVER touched during fit)

Last fold val_idx → reserved as conformal calibration holdout
                    (not included in OOF metrics)
```

**Every bug from v4 is fixed:**

| Bug | v4 | v5 |
|---|---|---|
| Calibration leakage | `cal.fit(val)` → `cal.predict(val)` | Raw OOF proba, no in-fold calibration |
| Boosting ES leakage | `eval_set=val_idx` (same as OOF) | `eval_set=es_inner` (separate inner split) |
| Final model calibration | `fit(Xs_all)` → `calibrate(Xs_all)` | Dedicated `cal_idx` holdout |
| OOF Regressor RMSE | In-sample on training data | Always on held-out val_idx |
| Neutral samples | Discarded (`labels != 0` filter) | Kept with weight 0.30 |

---

## Feature Engineering (115+ features)

| Group | Features |
|---|---|
| Log returns | 7 lags × tanh compression |
| Fractional diff | `d=0.4` price & volume (preserves memory, stationary) |
| Momentum | Cumulative returns, 4 windows |
| RSI | 3 periods (7, 14, 21) |
| MACD | Line, signal, histogram, crossover |
| Stochastic / CCI / Williams %R / TSI | Standard |
| Bollinger / Keltner / Squeeze | %B, bandwidth, momentum |
| Multiple volatility estimators | HV(10,20,30), Garman-Klass, Yang-Zhang, Parkinson |
| ADX + DI / SuperTrend | Trend strength |
| Price vs SMA(10,20,50,100,200) | 5 distances |
| EMA alignment | 4 EMAs, 2 slopes |
| Ichimoku | 4 signal features |
| VWAP | Price distance |
| Volume | OBV, CMF, MFI, VolumeOscillator, volume ratio |
| **Microstructure** | Amihud illiquidity, Kyle's λ, tick rule, Roll spread |
| **Hurst exponent** | Trend vs mean-reversion detector |
| Rolling statistics | Skew, kurtosis, autocorrelation (2 windows) |
| Candlestick patterns | 12 patterns, composite score |
| OHLC body | Body ratio, gap, shadow |
| On-chain (inference only) | Fear&Greed, ATH%, hash rate, FG proxy |

---

## Feature Selection Pipeline

```
Variance filter  →  Remove near-constant features
Mutual Information ranking  →  Score all surviving features
Correlation cluster pruning →  Remove redundant features (keep highest-MI per cluster)
Pre-filter 2×top_k  →  Speed up SHAP computation
SHAP importance  →  Tree-based importance (more accurate than MI for non-linear models)
Top-K by SHAP  →  Final selection (default: top 60)
```

---

## Configuration

All parameters in `config.py`. Key settings:

```python
MODEL_CFG.optuna_trials   = 0    # Set to 30+ to enable Optuna HPO (slow but powerful)
MODEL_CFG.cv_n_splits     = 5    # Walk-forward folds
MODEL_CFG.purge_gap       = 10   # Bars between train end and val start
MODEL_CFG.min_train_bars  = 600  # Minimum non-neutral bars to train
MODEL_CFG.conformal_alpha = 0.10 # 90% conformal coverage
SEL_CFG.use_shap          = True # SHAP-based feature selection
SEL_CFG.top_k_features    = 60   # Final feature count
```

---

## Backtest Output

```
════════════════════════════════════════════════════════════
  OrbityxAI v5  Walk-Forward Backtest
════════════════════════════════════════════════════════════
  Trades:       123 (W:72 / L:51)
  Win rate:    58.5%
  Avg win:    +1.234%
  Avg loss:   -0.821%
  Profit factor:  2.10
  Max consec W/L: 8/5
────────────────────────────────────────────────────────────
  Sharpe:     1.42  95%CI [0.91, 1.93]  p=0.012
  Sortino:    1.87
  Calmar:     2.31
  Max DD:     -12.3%  Avg dur: 4.2 bars  Time in DD: 28%
────────────────────────────────────────────────────────────
  Total return:   +34.2%
  CAGR:           +18.7%
  Benchmark:      +22.1%  (buy & hold)
  Alpha:          +12.1%
  OOF log-loss:   0.6831
════════════════════════════════════════════════════════════
```

---

## Signal Output

```
════════════════════════════════════════════════════════════
  OrbityxAI v5  ·  BTCUSDT  [1h]
════════════════════════════════════════════════════════════
  Signal:        STRONG BUY     Direction: LONG
  Confidence:    74.2%        P(up): 87.1%
  Conformal set: CERTAIN
  Current price:      84,231.500000
  Pred. return:        +0.8341%
  Pred. price:        85,034.000000
────────────────────────────────────────────────────────────
  Regime:        Trending Up
  ...
```

---

## Requirements

```
numpy>=1.24.0
scipy>=1.11.0
scikit-learn>=1.4.0
httpx>=0.26.0
pandas>=2.1.0
joblib>=1.3.0
lightgbm>=4.0.0
xgboost>=2.0.0
catboost>=1.2.0
optuna>=3.4.0        # optional: Bayesian HPO
shap>=0.44.0         # optional: SHAP feature selection
```

---

## Theoretical Grounding

- **Triple-barrier labels:** Lopez de Prado, *Advances in Financial Machine Learning*, ch. 3
- **Sample weights by uniqueness:** AFML ch. 4
- **Purged walk-forward CV:** AFML ch. 7
- **Meta-labelling:** AFML ch. 3.6
- **Fractional differentiation:** AFML ch. 5
- **Mondrian split-conformal:** Angelopoulos & Bates (2023), *Conformal Risk Control*
- **Amihud illiquidity:** Amihud (2002), *Journal of Financial Markets*
- **Garman-Klass / Yang-Zhang volatility:** Original papers 1980/2000
- **Hurst exponent:** Peters (1994), *Fractal Market Analysis*
- **Optuna TPE sampler:** Bergstra et al. (2011)

---

## Honest Performance Expectations

Crypto directional prediction on 1h bars typically achieves:
- **OOF accuracy:** 53–57% (vs 50% random baseline)
- **OOF log-loss:** 0.67–0.69 (vs 0.693 for 50/50 guess)
- **Sharpe (backtest):** 0.5–1.5 depending on regime and market
- **Real OOS Sharpe:** typically 30–50% lower than backtest Sharpe

The system is designed to produce calibrated, uncertainty-aware signals with:
1. Conformal prediction sets (theoretical coverage guarantee)
2. MetaClassifier filtering (fewer but higher-quality signals)
3. Bootstrap Sharpe CI to quantify estimation uncertainty
4. Permutation p-value to test significance against chance
