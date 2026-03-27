# OrbityxAI

![Version](https://img.shields.io/badge/version-7.3-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Exchange](https://img.shields.io/badge/exchange-Bybit%20%7C%20MEXC-orange.svg)
![Strategy](https://img.shields.io/badge/strategy-CHECKLIST%20S%2FR-purple.svg)
![Status](https://img.shields.io/badge/status-production-success.svg)

**OrbityxAI** is a professional-grade crypto futures trading bot powered by a 5-step CHECKLIST strategy built on Support/Resistance level analysis. It supports live and paper trading on Bybit and MEXC exchanges via the `ccxt` library, integrates machine learning ensemble models for signal validation, and includes a full Telegram bot interface for remote monitoring and control.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Key Features](#2-key-features)
3. [Architecture](#3-architecture)
4. [Installation](#4-installation)
   - [4.1 Prerequisites](#41-prerequisites)
   - [4.2 Clone and Setup](#42-clone-and-setup)
   - [4.3 Environment Variables](#43-environment-variables)
   - [4.4 Dependencies](#44-dependencies)
5. [Quickstart](#5-quickstart)
6. [Configuration Reference](#6-configuration-reference)
   - [6.1 CLI Parameters](#61-cli-parameters)
   - [6.2 Parameter Examples](#62-parameter-examples)
7. [The CHECKLIST Strategy — Deep Dive](#7-the-checklist-strategy--deep-dive)
   - [7.1 Step 1: CONTEXT — Level Validation](#71-step-1-context--level-validation)
   - [7.2 Step 2: SIGNAL — Entry Patterns](#72-step-2-signal--entry-patterns)
   - [7.3 Step 3: FILTERS — Trade Quality Gates](#73-step-3-filters--trade-quality-gates)
   - [7.4 Step 4: SL — Stop Loss Placement](#74-step-4-sl--stop-loss-placement)
   - [7.5 Step 5: TP — Take Profit Targeting](#75-step-5-tp--take-profit-targeting)
8. [Level Detection Algorithm](#8-level-detection-algorithm)
   - [8.1 Swing Point Identification](#81-swing-point-identification)
   - [8.2 Clustering](#82-clustering)
   - [8.3 Level Strength Scoring](#83-level-strength-scoring)
   - [8.4 Multi-Timeframe Level Merging](#84-multi-timeframe-level-merging)
   - [8.5 Volume Profile Integration](#85-volume-profile-integration)
9. [Entry Patterns](#9-entry-patterns)
   - [9.1 Retest Pattern](#91-retest-pattern)
   - [9.2 Breakout + Pause + Confirmation Pattern](#92-breakout--pause--confirmation-pattern)
10. [Indicators Reference](#10-indicators-reference)
11. [Risk Management](#11-risk-management)
    - [11.1 Position Sizing](#111-position-sizing)
    - [11.2 Stop Loss Rules](#112-stop-loss-rules)
    - [11.3 Portfolio-Level Controls](#113-portfolio-level-controls)
12. [Machine Learning Module](#12-machine-learning-module)
    - [12.1 Feature Engineering](#121-feature-engineering)
    - [12.2 Labeling](#122-labeling)
    - [12.3 Ensemble Models](#123-ensemble-models)
    - [12.4 Calibration](#124-calibration)
    - [12.5 Training Workflow](#125-training-workflow)
13. [Exchange Connectors](#13-exchange-connectors)
    - [13.1 Bybit](#131-bybit)
    - [13.2 MEXC](#132-mexc)
    - [13.3 Known Exchange Quirks](#133-known-exchange-quirks)
14. [Telegram Bot Interface](#14-telegram-bot-interface)
    - [14.1 Setup](#141-setup)
    - [14.2 Commands](#142-commands)
    - [14.3 Notifications](#143-notifications)
15. [Backtesting](#15-backtesting)
    - [15.1 Running a Backtest](#151-running-a-backtest)
    - [15.2 Backtest Output](#152-backtest-output)
    - [15.3 Performance Metrics](#153-performance-metrics)
    - [15.4 Sample Results](#154-sample-results)
16. [Market Scanning](#16-market-scanning)
17. [File Structure Reference](#17-file-structure-reference)
18. [Server Deployment](#18-server-deployment)
    - [18.1 VPS Requirements](#181-vps-requirements)
    - [18.2 systemd Service](#182-systemd-service)
    - [18.3 Docker Deployment](#183-docker-deployment)
    - [18.4 Monitoring and Logging](#184-monitoring-and-logging)
19. [Security Notes](#19-security-notes)
20. [Troubleshooting](#20-troubleshooting)
    - [20.1 Common Errors](#201-common-errors)
    - [20.2 Exchange-Specific Issues](#202-exchange-specific-issues)
    - [20.3 Strategy Debugging](#203-strategy-debugging)
21. [Version History](#21-version-history)
22. [Known Limitations](#22-known-limitations)
23. [FAQ](#23-faq)
24. [Glossary](#24-glossary)
25. [Contributing Guidelines](#25-contributing-guidelines)
26. [License](#26-license)
27. [Disclaimer](#27-disclaimer)

---

## 1. Overview

OrbityxAI v7.3 is a systematic, rule-based trading bot for cryptocurrency futures markets. It is designed around a disciplined 5-step trade selection process called the **CHECKLIST**, which evaluates every potential trade against structural, signal, filter, risk, and reward criteria before placing an order.

The bot continuously scans up to 220 trading pairs across Bybit and MEXC, identifies significant support and resistance levels, waits for confirmed retest or breakout setups, and enters trades with precisely calculated stop losses and take profit targets — all while enforcing strict risk management rules at both the trade and portfolio level.

### Design Philosophy

- **Rule-based first, ML-assisted second.** Every trade must pass the 5-step CHECKLIST. Machine learning models provide an additional confidence score but do not override the structural rules.
- **S/R levels are the foundation.** All entries, exits, and risk calculations are anchored to detected support and resistance levels.
- **Risk before reward.** Position sizing is calculated from the stop loss first, ensuring that maximum loss per trade never exceeds the configured percentage of capital.
- **No guessing in ranging markets.** The ADX filter explicitly prevents trading when the market is in a choppy, directionless phase.

---

## 2. Key Features

- **5-Step CHECKLIST** — Structured, disciplined trade selection with zero ambiguity
- **Automated S/R Level Detection** — Swing point analysis with clustering and strength scoring
- **Multi-Timeframe Analysis** — D1 context, H1 trend, M5 entries
- **Two Entry Patterns** — Retest and Breakout+Pause+Confirmation
- **ADX Trending Filter** — Prevents entries in ranging markets (ADX H1 < 15)
- **Volume Confirmation** — Signal bar volume must be 1.2x or more the 20-bar average
- **Chop Index Filter** — Maximum chop score of 2
- **ATR-Based SL/TP** — All risk calculations relative to Daily ATR
- **Min R:R 3:1** — Enforced minimum reward-to-risk ratio
- **ML Ensemble** — LightGBM + XGBoost + CatBoost ensemble with SHAP explainability
- **Live and Paper Trading** — Test strategies risk-free before going live
- **Bybit and MEXC Support** — Full futures trading via ccxt
- **Telegram Bot** — Real-time notifications, status checks, and remote control
- **Systemd Integration** — Production-ready server deployment
- **Full Backtesting** — Historical performance validation with detailed metrics
- **Market Scanner** — On-demand scan of all configured pairs

---

## 3. Architecture

### High-Level System Diagram

```
+---------------------------------------------------------------+
|                         OrbityxAI v7.3                        |
|                                                               |
|  +--------------+     +--------------+     +--------------+  |
|  | run_live.py  |     | run_backtest |     | run_scan_now |  |
|  | (main entry) |     |    .py       |     |    .py       |  |
|  +------+-------+     +------+-------+     +------+-------+  |
|         |                   |                     |          |
|         v                   v                     v          |
|  +-------------------------------------------------------+   |
|  |                    LiveEngine                          |   |
|  |              (trading/live_engine.py)                  |   |
|  +------+---------------+-------------------+------------+   |
|         |               |                   |                |
|         v               v                   v                |
|  +-----------+  +---------------+  +----------------+        |
|  | Connector |  |   CHECKLIST   |  | LevelDetector  |        |
|  | (ccxt)    |  |  (strategy/)  |  | (levels/)      |        |
|  +-----+-----+  +-------+-------+  +-------+--------+        |
|        |                |                  |                 |
|        v                v                  v                 |
|  +-----------+  +---------------+  +----------------+        |
|  |  Bybit    |  |  Indicators   |  |  Multi-TF      |        |
|  |  MEXC     |  |  (technical)  |  |  Volume Prof.  |        |
|  +-----------+  +---------------+  +----------------+        |
|                         |                                     |
|                         v                                     |
|                +----------------+                             |
|                |  ML Ensemble   |                             |
|                | LGB+XGB+CatBst |                             |
|                +-------+--------+                             |
|                        |                                      |
|                        v                                      |
|                +----------------+                             |
|                | Telegram Bot   |                             |
|                | Notifications  |                             |
|                +----------------+                             |
+---------------------------------------------------------------+
```

### Data Flow Diagram

```
Exchange API
    |
    v
DataFetcher --> OHLCV candles (M5, H1, D1)
    |
    v
LevelDetector
    |  +-- Swing point detection (lookback=5)
    |  +-- Cluster merging (radius=0.3%)
    |  +-- Strength scoring (touches x log(1+vol) x breakout_factor)
    |  +-- Multi-TF merging
    |
    v
ChecklistStrategy
    |
    +-- STEP 1: CONTEXT
    |   +-- Level proximity <= 20% ATR D1
    |   +-- No blocking levels between price and TP
    |
    +-- STEP 2: SIGNAL
    |   +-- Retest pattern (M5)
    |   +-- Breakout + pause + confirmation (M5)
    |
    +-- STEP 3: FILTERS
    |   +-- Chop index <= 2
    |   +-- Volatility within bounds
    |   +-- H1 trend alignment
    |   +-- ADX H1 > 15
    |   +-- Volume >= 1.2x avg (20-bar)
    |
    +-- STEP 4: SL
    |   +-- LONG: SL below level
    |   +-- SHORT: SL above level
    |   +-- SL distance: 8-30% ATR D1
    |
    +-- STEP 5: TP
        +-- Next S/R level
        +-- Min R:R = 3:1
            |
            v
       TradeSetup --> Sizing --> LiveEngine --> Exchange Order
                                    |
                                    +--> Telegram Notification
```

### Module Dependency Graph

```
run_live.py
+-- trading/live_engine.py
|   +-- trading/connector.py          (ccxt exchange wrapper)
|   +-- strategy/checklist.py         (5-step pipeline)
|   |   +-- levels/detector.py        (S/R detection)
|   |   |   +-- levels/multi_tf.py    (multi-TF merging)
|   |   |   +-- levels/volume_profile.py
|   |   +-- indicators/technical.py   (ATR, ADX, chop, etc.)
|   |   +-- setups/sizing.py          (position sizing)
|   +-- ml/ensemble.py                (LGB+XGB+CatBoost)
|   |   +-- ml/features.py
|   |   +-- ml/labeling.py
|   |   +-- ml/calibration.py
|   +-- bot/telegram_bot.py
+-- data/fetcher_binance.py           (historical data)
```

---

## 4. Installation

### 4.1 Prerequisites

- **Python** 3.10 or higher
- **pip** 23.0+
- **Git**
- A server or local machine with stable internet connection
- Accounts on Bybit and/or MEXC with API keys generated
- A Telegram bot token (from @BotFather)

Verify your Python version:

```bash
python3 --version
# Python 3.10.x or higher required
```

### 4.2 Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/OrbityxAI.git
cd OrbityxAI

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows

# Upgrade pip
pip install --upgrade pip
```

### 4.3 Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
nano .env
```

Required `.env` variables:

```ini
# Exchange API credentials
EXCHANGE_KEY=your_api_key_here
EXCHANGE_SECRET=your_api_secret_here

# Telegram bot configuration
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_IDS=123456789,987654321

# Optional: secondary exchange override
# EXCHANGE_NAME=mexc
```

#### Getting Your API Keys

**Bybit:**
1. Log in at bybit.com
2. Navigate to Account > API Management
3. Click "Create New Key"
4. Enable: Read, Unified Trade (for futures), no IP restriction for testing (add IP for production)
5. Save key and secret immediately — the secret is shown only once

**MEXC:**
1. Log in at mexc.com
2. Navigate to Account > API Management
3. Create API key with Trade permissions
4. Note: MEXC futures use a separate key from spot

**Telegram Bot:**
1. Open Telegram, search for @BotFather
2. Send `/newbot` and follow the prompts
3. Copy the token provided
4. Start a chat with your bot
5. Get your chat ID via `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 4.4 Dependencies

Install all required packages:

```bash
pip install -r requirements.txt
```

Full dependency list with purposes:

| Package | Version | Purpose |
|---------|---------|---------|
| `numpy` | >=1.24 | Numerical computation, array operations |
| `scipy` | >=1.10 | Statistical functions, clustering |
| `scikit-learn` | >=1.3 | ML utilities, preprocessing, metrics |
| `pandas` | >=2.0 | OHLCV data manipulation |
| `lightgbm` | >=4.0 | Gradient boosting model 1 |
| `xgboost` | >=2.0 | Gradient boosting model 2 |
| `catboost` | >=1.2 | Gradient boosting model 3 |
| `ccxt` | >=4.2 | Exchange API connector |
| `python-dotenv` | >=1.0 | Environment variable loading |
| `requests` | >=2.31 | HTTP requests |
| `httpx` | >=0.25 | Async HTTP client |
| `joblib` | >=1.3 | Model serialization, parallel jobs |
| `optuna` | >=3.3 | Hyperparameter optimization |
| `shap` | >=0.43 | ML explainability |
| `matplotlib` | >=3.7 | Chart generation for reports |

Install directly without requirements file:

```bash
pip install numpy scipy scikit-learn pandas lightgbm xgboost catboost \
            ccxt python-dotenv requests httpx joblib optuna shap matplotlib
```

---

## 5. Quickstart

The fastest way to get OrbityxAI running in paper trading mode:

```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Ensure .env is configured
cat .env

# 3. Run in paper mode (safe, no real orders)
python run_live.py --mode paper --exchange bybit

# 4. Run with custom capital
python run_live.py --mode paper --exchange bybit --capital 10000

# 5. Run live (real money -- ensure you understand the risks)
python run_live.py --mode live --exchange bybit --capital 5000 --leverage 3
```

Expected startup output:

```
[2026-03-26 10:00:00] OrbityxAI v7.3 starting...
[2026-03-26 10:00:00] Mode: PAPER | Exchange: bybit | Capital: $10000.00
[2026-03-26 10:00:00] Leverage: 5x | Risk/trade: 1.0% | Min R:R: 3.0
[2026-03-26 10:00:00] Scanning 220 pairs every 14400s
[2026-03-26 10:00:01] Connected to Bybit successfully
[2026-03-26 10:00:02] Telegram bot initialized
[2026-03-26 10:00:03] Loading ML ensemble models...
[2026-03-26 10:00:05] Models loaded: LGB, XGB, CatBoost
[2026-03-26 10:00:06] Starting scan cycle #1...
```

---

## 6. Configuration Reference

### 6.1 CLI Parameters

All configuration is passed via command-line arguments. There are no separate configuration files for the main bot parameters — everything is explicit on launch.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `--mode` | `{live,paper}` | `paper` | Trading mode. `paper` simulates orders without real money. `live` places real orders. |
| `--exchange` | `{bybit,mexc}` | `bybit` | Target exchange. Must match the API keys in `.env`. |
| `--capital` | `FLOAT` | `0` | Trading capital in USDT. `0` means auto-detect from account balance. |
| `--leverage` | `INT` | `5` | Futures leverage multiplier. Applied to all positions. |
| `--tf` | `{5m,15m,1h,4h}` | `4h` | Primary scan timeframe for context analysis. |
| `--interval` | `INT` | `14400` | Seconds between full scan cycles. Default is 4 hours (14400s). |
| `--risk-per-trade` | `FLOAT` | `0.01` | Fraction of capital to risk per trade (0.01 = 1%). |
| `--min-rr` | `FLOAT` | `3.0` | Minimum reward-to-risk ratio required for trade entry. |
| `--max-pairs` | `INT` | `220` | Maximum number of pairs to scan per cycle. |
| `--max-positions` | `INT` | `3` | Maximum number of simultaneously open positions. |

### 6.2 Parameter Examples

**Conservative setup — small account, tight risk:**
```bash
python run_live.py \
  --mode paper \
  --exchange bybit \
  --capital 1000 \
  --leverage 2 \
  --risk-per-trade 0.005 \
  --min-rr 4.0 \
  --max-positions 2
```

**Standard setup — balanced risk/reward:**
```bash
python run_live.py \
  --mode live \
  --exchange bybit \
  --capital 5000 \
  --leverage 5 \
  --risk-per-trade 0.01 \
  --min-rr 3.0 \
  --max-positions 3
```

**Aggressive setup — larger position count:**
```bash
python run_live.py \
  --mode live \
  --exchange bybit \
  --capital 10000 \
  --leverage 5 \
  --risk-per-trade 0.015 \
  --min-rr 3.0 \
  --max-positions 5 \
  --max-pairs 200
```

**Quick hourly scan:**
```bash
python run_live.py \
  --mode paper \
  --exchange mexc \
  --interval 3600 \
  --tf 1h
```

**High-frequency M5 mode:**
```bash
python run_live.py \
  --mode paper \
  --exchange bybit \
  --tf 5m \
  --interval 300
```

---

## 7. The CHECKLIST Strategy — Deep Dive

The CHECKLIST is OrbityxAI's core trading methodology. Every potential trade must sequentially pass all five steps. Failure at any step immediately disqualifies the trade — there are no exceptions and no partial passes.

```
+-----------------------------------------------------------+
|                   CHECKLIST PIPELINE                      |
|                                                           |
|  Price near S/R?                                          |
|       |                                                   |
|       v                                                   |
|  [STEP 1: CONTEXT] ---- FAIL ---- Skip symbol            |
|       | PASS                                              |
|       v                                                   |
|  [STEP 2: SIGNAL] ----- FAIL ---- Skip symbol            |
|       | PASS                                              |
|       v                                                   |
|  [STEP 3: FILTERS] ---- FAIL ---- Skip symbol            |
|       | PASS                                              |
|       v                                                   |
|  [STEP 4: SL] --------- FAIL ---- Skip symbol            |
|       | PASS                                              |
|       v                                                   |
|  [STEP 5: TP] --------- FAIL ---- Skip symbol            |
|       | PASS                                              |
|       v                                                   |
|  EXECUTE TRADE                                            |
+-----------------------------------------------------------+
```

### 7.1 Step 1: CONTEXT — Level Validation

**Purpose:** Confirm that price is at or near a significant, actionable support or resistance level and that the structural context is clean.

**Criteria:**
- Current price is within 20% or less of ATR D1 distance from a detected S/R level
- The level has passed minimum strength scoring (strength >= 3.0)
- There are **no blocking levels** between current price and the intended take profit zone
- The level is structurally significant: identified on H1 or higher timeframe

**ATR D1 Proximity Rule:**

The 20% ATR D1 threshold is not arbitrary. A daily ATR represents the typical price range for the asset in a single day. Being within 20% of that distance from a level means the price is close enough to the level to be considered "at" it — but not so close that slippage eats into the R:R calculation.

```
Example: BTC/USDT
  Daily ATR = 1200 USDT
  20% of ATR = 240 USDT
  Detected level: 65,000 USDT
  Current price: 64,820 USDT
  Distance: 180 USDT < 240 USDT => PASS
```

**Blocking Level Check:**

Before proceeding, the algorithm scans for any S/R levels between the current price and the intended TP. If a significant level exists within that range, it would likely act as resistance (for longs) or support (for shorts), reducing the probability of reaching TP. Such trades are skipped.

```
Example:
  Price: 64,820 (at support)
  Intended TP: 66,500 (next resistance)
  Intermediate level found at 65,200 (strength=4.2)
  => FAIL: blocking level detected => skip trade
```

---

### 7.2 Step 2: SIGNAL — Entry Patterns

**Purpose:** Confirm that there is a specific, high-quality entry signal on the M5 timeframe indicating that the level is holding or that a valid breakout has occurred.

OrbityxAI recognizes two primary entry patterns (detailed in Section 9):

1. **Retest Pattern** — Price previously broke away from the level, returns to test it, and shows rejection
2. **Breakout + Pause + Confirmation** — Price breaks through the level, consolidates (pause), then confirms the new direction

Both patterns are evaluated exclusively on the **M5 timeframe** to provide precise entry timing while maintaining structural context from higher timeframes.

**Signal Validation Requirements:**
- Candle pattern must complete cleanly (no overlapping bodies with prior rejection)
- Signal candle must not be a doji in the context of a retest (body must show directional conviction)
- Pattern must appear within the proximity window defined in Step 1

---

### 7.3 Step 3: FILTERS — Trade Quality Gates

**Purpose:** Apply a set of market condition filters to ensure the trade is occurring in a favorable environment.

#### Filter 1: Chop Index <= 2

The chop index measures the "choppiness" or sideways nature of recent price action. A high chop score indicates a ranging, directionless market unsuitable for trend-following S/R trades.

- **Threshold:** <= 2
- **Calculation:** Based on the ratio of total price range to sum of individual candle ranges over a lookback window
- **Interpretation:** 0 = trending strongly; 3+ = extremely choppy

#### Filter 2: Volatility OK

Volatility must be within acceptable bounds:
- Not too low: insufficient volatility means the market is compressed and TP may not be reachable
- Not too high: extreme volatility increases slippage risk and makes S/R levels unreliable

Bounds are calculated relative to ATR D1 percentiles over the trailing 30 days.

#### Filter 3: H1 Trend Alignment

The H1 (1-hour) timeframe must show trend alignment with the proposed trade direction:
- **LONG trades:** H1 price must be above the H1 EMA (typically 21-period)
- **SHORT trades:** H1 price must be below the H1 EMA
- Counter-trend trades at S/R levels are not taken even if other criteria pass

#### Filter 4: ADX H1 > 15 — Ranging Market Filter

The Average Directional Index (ADX) on the H1 timeframe must exceed **15** to confirm that a trend exists.

This is one of the most critical filters introduced in v7.3. ADX measures trend strength regardless of direction:
- **ADX < 15:** Market is ranging/consolidating => **SKIP trade**
- **ADX 15-25:** Weak trend forming => PASS
- **ADX 25-50:** Strong trend => PASS
- **ADX > 50:** Very strong trend (possible overextension — still PASS)

```
ADX Filter Logic:
  adx_h1 = calculate_adx(h1_candles, period=14)
  if adx_h1 < 15:
      return FAIL  # "Market ranging, skip"
```

#### Filter 5: Volume >= 1.2x Average (20-bar)

The signal candle's volume on M5 must be at least **1.2 times** the 20-bar rolling average volume.

This confirms that real market participants are engaged at the level — not just noise. Low-volume retests often fail; high-volume confirmations have significantly better follow-through.

```
Volume Filter Logic:
  avg_volume_20 = mean(m5_candles[-20:].volume)
  signal_bar_volume = m5_candles[-1].volume
  if signal_bar_volume < avg_volume_20 * 1.2:
      return FAIL  # "Insufficient volume on signal bar"
```

---

### 7.4 Step 4: SL — Stop Loss Placement

**Purpose:** Determine the optimal stop loss location that is logically placed beyond the S/R level with acceptable risk parameters.

#### SL Placement Rules (v7.3)

Stop loss placement follows a strict directional rule introduced to fix a critical bug in earlier versions:

- **LONG trades:** `SL price MUST be < level price`
- **SHORT trades:** `SL price MUST be > level price`

This ensures the stop loss is always on the "other side" of the level from the entry, making it structurally meaningful. A stop loss that is between the entry and the level is logically inconsistent and was a source of errors in pre-v7.3 versions.

#### SL Distance Constraints

The stop loss distance (in price units) must fall within:
- **Minimum:** 8% of ATR D1
- **Maximum:** 30% of ATR D1

```
sl_distance_pct_of_atr = abs(entry_price - sl_price) / atr_d1

if sl_distance_pct_of_atr < 0.08:
    return FAIL  # SL too tight -- likely to be stopped out by noise

if sl_distance_pct_of_atr > 0.30:
    return FAIL  # SL too wide -- R:R will not meet minimum 3:1
```

#### Logical SL Candidates

The "shortest logical candidate" is selected from:
1. The low/high of the most recent significant swing before the level (for retests)
2. A structure candle low/high within the consolidation zone (for breakout-pause patterns)
3. The cluster boundary of the S/R zone plus or minus a small buffer

The algorithm evaluates all candidates and selects the one closest to the entry price that still satisfies the directional constraint and distance bounds.

---

### 7.5 Step 5: TP — Take Profit Targeting

**Purpose:** Identify the next S/R level in the trade's direction that offers a minimum 3:1 reward-to-risk ratio.

#### TP Selection

1. Scan all detected S/R levels in the direction of the trade
2. Filter to levels beyond the entry price (not between entry and SL)
3. For each candidate TP level, calculate: `R:R = (TP - Entry) / (Entry - SL)` for longs
4. Select the nearest level where R:R >= min_rr (default 3.0)
5. If no such level exists, the trade is **skipped**

```
TP Selection Example (LONG):
  Entry: 65,000
  SL: 64,600 (distance: 400 USDT)
  Min TP distance for 3:1: 400 x 3 = 1,200 USDT => TP must be >= 66,200

  Detected levels above entry:
    65,400 => R:R = 1.0 => too low
    65,800 => R:R = 2.0 => too low
    66,500 => R:R = 3.75 => PASS

  TP = 66,500, Final R:R = 3.75:1
```

#### TP Adjustment

If the optimal TP level produces an R:R significantly above the minimum (e.g., 6:1+), the system does not automatically scale down the TP. Instead, it may use partial take-profit orders at intermediate levels if that feature is enabled, with the remainder targeting the full TP.

---

## 8. Level Detection Algorithm

Level detection is the foundation of the entire CHECKLIST strategy. A robust level detection system directly translates to better trade quality.

### 8.1 Swing Point Identification

The first step is identifying swing highs and lows in the price data.

**Algorithm:**
```
For each candle at index i:
  Is it a swing HIGH?
    => high[i] > max(high[i-lookback : i]) AND
       high[i] > max(high[i+1 : i+lookback+1])
    => lookback = 5 candles (configurable)

  Is it a swing LOW?
    => low[i] < min(low[i-lookback : i]) AND
       low[i] < min(low[i+1 : i+lookback+1])
    => lookback = 5 candles (configurable)
```

With `lookback=5`, a swing high must be the highest point in a window of 11 candles (5 before + candle itself + 5 after). This eliminates minor wicks and ensures only significant structural pivots are captured.

**Applied Timeframes:**
- D1 (Daily): Macro levels — strongest, longest-lasting
- H4 (4-hour): Intermediate levels
- H1 (1-hour): Local levels — most relevant for entry timing
- M5 (5-minute): Entry confirmation only, not for level detection

### 8.2 Clustering

Raw swing points often appear very close together. Clustering merges nearby pivots into a single level.

**Algorithm:**
```
radius = 0.3% of price   (configurable)

1. Sort all swing points by price
2. For consecutive points where:
   abs(price_a - price_b) / price_a <= radius
   => Merge into a single cluster
   => Cluster price = weighted average of all member pivots

3. Repeat until no more merges occur
```

**Why 0.3%?**

At 0.3%, for a $65,000 asset, the clustering radius is $195. This captures the natural "zone" nature of support and resistance — price rarely respects a single exact value; it tends to react within a narrow band.

### 8.3 Level Strength Scoring

Each detected level receives a strength score that quantifies its significance:

```
strength = touches x log(1 + volume_sum) x (1 + false_breakouts x 0.5)
```

Where:
- `touches` = number of times price came within the cluster radius without significantly breaking through
- `volume_sum` = total volume of all candles that touched the level
- `false_breakouts` = number of times price briefly broke the level but then reversed back

**Minimum Strength:** 3.0

Levels with strength < 3.0 are discarded as statistically insignificant.

**Strength Score Interpretation:**

| Score | Significance | Typical Character |
|-------|-------------|-------------------|
| 3.0 to 5.0 | Minor level | Short-lived, often breaks on first strong test |
| 5.0 to 10.0 | Moderate level | Reliable for 1-3 retests |
| 10.0 to 20.0 | Strong level | High-probability zone, multiple tests |
| Above 20.0 | Major level | Key structural level, often weekly/monthly significance |

### 8.4 Multi-Timeframe Level Merging

After detecting levels independently on each timeframe, the multi-timeframe merger (`levels/multi_tf.py`) combines them:

1. D1 levels receive a weight multiplier of 3.0 (highest significance)
2. H4 levels receive a weight multiplier of 2.0
3. H1 levels receive a weight multiplier of 1.0
4. Levels within 0.5% of each other across timeframes are merged into a single "confluent" level with combined strength

Confluent levels (confirmed on multiple timeframes) are the highest-priority targets for CHECKLIST setups.

### 8.5 Volume Profile Integration

`levels/volume_profile.py` adds an additional layer of level validation by analyzing where the most trading volume occurred historically:

- High-volume nodes (HVN) are regions where price has historically traded the most volume — these become strong S/R zones
- Low-volume nodes (LVN) represent price levels where little trading occurred — price tends to move through these quickly
- HVNs that coincide with swing-based S/R levels receive a strength bonus of +2.0

---

## 9. Entry Patterns

### 9.1 Retest Pattern

The retest pattern is the primary entry pattern. It occurs when:
1. Price was previously at the S/R level and moved away strongly
2. Price returns to the level (retest)
3. The M5 candle at the level shows rejection (reversal confirmation)

**Visual Representation:**

```
LONG Retest at Support:

Price
  |
  |         * <- Signal bar (bullish rejection candle at support)
  |        /|
  |       / |  <- Previous bounce away from level
  |      /  |
  |-----+----------- Support Level ------------------------------
  |           ^ Retest area
  |
Time ---------------------------------------------------------->
```

**Candle Pattern Requirements for Retest:**
- Signal bar must close above the level (for LONG) or below the level (for SHORT)
- Lower wick (for LONG) must penetrate the level but close back above
- Signal bar body must be bullish (close > open) for LONG
- Signal bar body must be bearish (close < open) for SHORT
- Volume on signal bar >= 1.2x 20-bar average (Filter 5 from Step 3)

**False Retest Rejection Criteria:**
- Signal bar closes on the wrong side of the level => invalid
- Signal bar is a doji (body < 10% of total range) => insufficient conviction => skip
- Three or more consecutive retests without rejection => level likely broken => skip

---

### 9.2 Breakout + Pause + Confirmation Pattern

This pattern captures continuation moves after a level is successfully broken:

1. **Breakout:** Price closes a M5 candle clearly beyond the level (by at least 0.1% of price)
2. **Pause:** 1-5 M5 candles consolidate near the broken level (retest from the other side)
3. **Confirmation:** A M5 candle closes in the direction of the breakout with volume >= 1.2x average

**Visual Representation:**

```
SHORT Breakout from Resistance:

Price
  |
  |-----+----------- Resistance Level -------------------------
  |           v Breakout candle closes below
  |          *
  |    [PAUSE] *** <- consolidation candles near broken level
  |               v Confirmation candle (bearish, high volume)
  |                *
  |
Time ---------------------------------------------------------->
```

**Pause Requirements:**
- 1 to 5 M5 candles
- Candles must stay within 0.5% ATR D1 of the broken level
- No candle may close back through the level (invalidates pattern)

**Confirmation Requirements:**
- Candle closes in the breakout direction
- Volume >= 1.2x 20-bar M5 average
- Candle body >= 40% of total candle range (shows conviction)

---

## 10. Indicators Reference

All indicators are implemented in `indicators/technical.py`.

| Indicator | Parameters | Usage in CHECKLIST |
|-----------|-----------|-------------------|
| **ATR** | Period=14, D1 timeframe | SL/TP distance calculation; level proximity threshold |
| **ADX** | Period=14, H1 timeframe | Step 3 filter: must be >15 to allow entries |
| **+DI / -DI** | Period=14, H1 | Directional component for trend direction confirmation |
| **EMA** | Period=21, H1 | H1 trend direction (Step 3, Filter 3) |
| **EMA** | Period=50, H1 | Secondary trend confirmation |
| **EMA** | Period=200, D1 | Macro trend filter (optional) |
| **Volume MA** | Period=20, M5 | Volume comparison for signal bar confirmation |
| **Chop Index** | Period=14 | Step 3 filter: must be <=2 |
| **RSI** | Period=14 | Used in ML feature engineering only |
| **MACD** | 12/26/9 | ML feature only |
| **Bollinger Bands** | 20/2.0 | Volatility assessment (Filter 2) |
| **Stochastic** | 14/3/3 | ML feature only |
| **OBV** | N/A | ML feature — volume trend confirmation |
| **VWAP** | Daily | ML feature and optional filter |

### ATR Calculation Detail

```python
# True Range for each candle:
TR = max(
    high - low,
    abs(high - prev_close),
    abs(low - prev_close)
)

# ATR = Wilder's smoothed average of TR over N periods
ATR[0] = mean(TR[:N])
ATR[i] = ATR[i-1] * (N-1)/N + TR[i] * 1/N
```

### ADX Calculation Detail

```python
# Directional Movement
+DM = high - prev_high if (high - prev_high) > (prev_low - low) else 0
-DM = prev_low - low   if (prev_low - low) > (high - prev_high) else 0

# Smoothed over N periods (Wilder's method)
+DI = 100 * EMA(+DM, N) / ATR(N)
-DI = 100 * EMA(-DM, N) / ATR(N)

# DX and ADX
DX = 100 * abs(+DI - -DI) / (+DI + -DI)
ADX = EMA(DX, N)
```

### Chop Index Calculation

```python
chop = log(sum(TR[i] for i in range(N)) / (highest_high - lowest_low)) / log(N)
# Normalized to 0-3 range
# 0 = perfectly trending
# 3 = perfectly choppy
```

---

## 11. Risk Management

Risk management in OrbityxAI operates at two levels: the individual trade level and the portfolio level. Both must be satisfied for a trade to execute.

### 11.1 Position Sizing

Position size is calculated to risk exactly the configured percentage of capital on each trade, based on the stop loss distance.

**Formula:**

```
risk_amount = capital x risk_per_trade
sl_distance = abs(entry_price - sl_price)
sl_distance_pct = sl_distance / entry_price

position_size_usd = risk_amount / sl_distance_pct
position_size_contracts = position_size_usd / entry_price
```

**Example Calculation:**

```
Capital: $10,000
Risk per trade: 1% => Risk amount: $100
Entry: $65,000
SL: $64,500 => SL distance: $500 => SL %: 0.769%

Position size (USD) = $100 / 0.00769 = $13,004
Contracts = $13,004 / $65,000 = 0.2 BTC

With 5x leverage:
  Margin required = $13,004 / 5 = $2,601
  Max loss if SL hits = $100 (as intended)
```

**Implementation in `setups/sizing.py`:**

```python
def calculate_position_size(
    capital: float,
    entry_price: float,
    sl_price: float,
    risk_fraction: float = 0.01,
    leverage: int = 5
) -> float:
    risk_amount = capital * risk_fraction
    sl_distance = abs(entry_price - sl_price)
    sl_pct = sl_distance / entry_price
    position_usd = risk_amount / sl_pct
    return position_usd
```

### 11.2 Stop Loss Rules

Key rules enforced in v7.3:

**Directional Constraint (CRITICAL):**
```python
if direction == "LONG":
    assert sl_price < level_price, "SL must be below level for LONG"
    assert sl_price < entry_price, "SL must be below entry for LONG"

if direction == "SHORT":
    assert sl_price > level_price, "SL must be above level for SHORT"
    assert sl_price > entry_price, "SL must be above entry for SHORT"
```

**Distance Constraint:**
```python
sl_distance_atr_pct = abs(entry_price - sl_price) / atr_d1
assert 0.08 <= sl_distance_atr_pct <= 0.30, \
    f"SL distance {sl_distance_atr_pct:.2%} outside 8-30% ATR bounds"
```

**No Moving Stop Loss Backward:** Once placed, stop losses are only moved in the direction of the trade (trailing stop behavior) — never widened against the trade.

### 11.3 Portfolio-Level Controls

| Control | Default | Description |
|---------|---------|-------------|
| Max simultaneous positions | 3 | Hard cap on open trades |
| Max leverage | 5x | Applied at order execution |
| Risk per trade | 1% | Maximum loss per trade as % of capital |
| Minimum R:R | 3:1 | No trade taken below this ratio |
| ADX filter | >15 | No new entries in ranging markets |
| Chop filter | <=2 | No entries in choppy conditions |

**Portfolio Heat Calculation:**

```
portfolio_heat = sum of (risk_pct for each open position)

Example with 3 open positions at 1% risk each:
  portfolio_heat = 3%

Max theoretical loss scenario = 3% of total capital
```

This means with default settings, the absolute worst-case loss if all three positions hit their stop losses simultaneously is 3% of total capital.

---

## 12. Machine Learning Module

The ML module provides an additional confidence layer on top of the rule-based CHECKLIST. It does not replace the CHECKLIST — it is an advisory signal only.

### 12.1 Feature Engineering

**File:** `ml/features.py`

Features are calculated for each potential trade setup:

**Price Action Features:**
- Candle body ratio (body / total range)
- Upper and lower wick ratios
- Position within daily range
- Gap from previous close

**Indicator Features:**
- RSI (5, 14, 21 period)
- MACD histogram normalized
- ADX with +DI and -DI
- ATR relative to 30-day ATR mean
- Bollinger Band position (where is price within the bands)
- Stochastic %K and %D

**Volume Features:**
- Volume relative to 20-bar average
- OBV trend direction (slope of 10-bar)
- Volume spike score

**S/R Level Features:**
- Level strength score
- Level age (bars since formation)
- Number of previous touches
- Distance from level (in ATR units)
- Whether level has been false-broken before

**Multi-Timeframe Features:**
- H1 trend score
- D1 trend score
- Confluence count (how many TFs agree on level)
- H4 momentum

**Total feature count:** 47 features per sample

### 12.2 Labeling

**File:** `ml/labeling.py`

Labels are assigned using forward-looking price data:

```python
def label_trade(
    entry_price: float,
    sl_price: float,
    tp_price: float,
    future_candles: pd.DataFrame,
    max_bars: int = 200
) -> int:
    """
    Returns:
      1  if TP hit before SL within max_bars
      0  if SL hit before TP within max_bars
     -1  if neither hit within max_bars (timeout)
    """
    for candle in future_candles[:max_bars]:
        if direction == "LONG":
            if candle.low <= sl_price:
                return 0
            if candle.high >= tp_price:
                return 1
    return -1  # timeout
```

Timeout samples (label=-1) are excluded from training to avoid ambiguous signals.

### 12.3 Ensemble Models

**File:** `ml/ensemble.py`

Three gradient boosting models are trained independently:

**Model 1: LightGBM**
- Optimized for speed and large feature sets
- Key hyperparameters (tuned via Optuna):
  - `n_estimators`: 500-2000
  - `learning_rate`: 0.01-0.1
  - `max_depth`: 4-8
  - `num_leaves`: 31-127
  - `min_child_samples`: 20-100

**Model 2: XGBoost**
- Strong general-purpose performance
- Key hyperparameters:
  - `n_estimators`: 500-2000
  - `learning_rate`: 0.01-0.1
  - `max_depth`: 4-7
  - `subsample`: 0.7-1.0
  - `colsample_bytree`: 0.6-1.0

**Model 3: CatBoost**
- Excellent handling of categorical features
- Key hyperparameters:
  - `iterations`: 500-2000
  - `learning_rate`: 0.01-0.1
  - `depth`: 4-8
  - `l2_leaf_reg`: 1-10

**Ensemble Combination:**

```python
# Simple average of calibrated probabilities
ensemble_prob = (lgb_prob + xgb_prob + cat_prob) / 3

# Trade proceeds if ensemble_prob >= threshold (default: 0.55)
if ensemble_prob >= ml_threshold:
    proceed_with_trade()
else:
    log("ML confidence below threshold, skipping")
```

### 12.4 Calibration

**File:** `ml/calibration.py`

Raw model probabilities from gradient boosting models are often poorly calibrated (overconfident or underconfident). Isotonic regression calibration is applied post-hoc:

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_model = CalibratedClassifierCV(
    base_model,
    method='isotonic',
    cv='prefit'
)
calibrated_model.fit(X_val, y_val)
```

After calibration, a predicted probability of 0.65 means the model has historically been correct approximately 65% of the time on similar setups.

### 12.5 Training Workflow

**File:** `run_training.py`

```bash
# Full training pipeline
python run_training.py \
  --exchange bybit \
  --symbols BTC/USDT ETH/USDT SOL/USDT \
  --lookback 365 \
  --optimize-hyperparams \
  --n-trials 100
```

**Training Steps:**
1. Fetch historical data for all specified symbols
2. Run level detection on historical data
3. Generate trade setups that would have passed the CHECKLIST
4. Label each setup with the outcome (win/loss/timeout)
5. Split into train (70%), validation (15%), test (15%)
6. Hyperparameter optimization via Optuna on validation set
7. Train final models on train + validation combined
8. Calibrate on test set
9. Evaluate final performance on held-out test set
10. Save models to `models/` directory

**Saved Model Files:**
```
models/
+-- lgb_model.pkl
+-- xgb_model.pkl
+-- cat_model.pkl
+-- lgb_calibrated.pkl
+-- xgb_calibrated.pkl
+-- cat_calibrated.pkl
+-- feature_scaler.pkl
+-- training_metadata.json
```

---

## 13. Exchange Connectors

### 13.1 Bybit

**File:** `trading/connector.py`

Bybit is the primary supported exchange, using the Unified Trading Account (UTA) API via ccxt.

**Connection Setup:**
```python
import ccxt

exchange = ccxt.bybit({
    'apiKey': os.getenv('EXCHANGE_KEY'),
    'secret': os.getenv('EXCHANGE_SECRET'),
    'options': {
        'defaultType': 'future',
        'adjustForTimeDifference': True,
    }
})
```

**Supported Order Types:**
- Market orders (primary for entries to ensure fill)
- Limit orders (optional, for precise entries)
- Stop-market orders (for SL placement)
- Take-profit market orders (for TP placement)

**Bybit-Specific Notes:**
- Uses USDT-margined linear perpetual contracts
- Leverage is set per-position before order placement
- Position mode must be set to "One-Way" (not hedge mode) for compatibility
- API rate limits: 10 requests/second; the connector includes automatic rate limiting

### 13.2 MEXC

MEXC is supported as an alternative exchange:

```python
exchange = ccxt.mexc({
    'apiKey': os.getenv('EXCHANGE_KEY'),
    'secret': os.getenv('EXCHANGE_SECRET'),
    'options': {
        'defaultType': 'swap',
    }
})
```

**MEXC Notes:**
- Futures API uses "swap" type in ccxt
- Some pairs available on Bybit may not be available on MEXC
- Lower liquidity on some pairs — review slippage carefully
- Rate limits are more restrictive: 5 requests/second

### 13.3 Known Exchange Quirks

#### Bybit: Tick Size as Float

**Critical fix in v7.3:** `_tick_to_decimals()`

Bybit returns tick size (minimum price increment) as a float like `0.000001`, not as an integer representing decimal places. Pre-v7.3 code incorrectly treated this as an integer, causing precision errors in price rounding.

```python
# WRONG (pre-v7.3):
decimals = market['precision']['price']  # returns 6 (wrong interpretation)

# CORRECT (v7.3):
def _tick_to_decimals(tick_size: float) -> int:
    """Convert float tick size to decimal places count."""
    if tick_size >= 1:
        return 0
    tick_str = f"{tick_size:.10f}".rstrip('0')
    return len(tick_str.split('.')[1]) if '.' in tick_str else 0

# Example: tick_size=0.000001 => 6 decimal places
# Example: tick_size=0.1 => 1 decimal place
# Example: tick_size=1.0 => 0 decimal places
```

#### Error Handling Fix in v7.3

**Critical fix:** `_execute_checklist_trade` was previously nested inside the outer `try/except` block of the main scan loop, causing all trade execution errors to be silently swallowed. This made debugging impossible and potentially prevented valid trades from executing.

```python
# WRONG (pre-v7.3):
try:
    for symbol in symbols:
        setup = checklist.evaluate(symbol)
        if setup:
            _execute_checklist_trade(setup)  # errors silently swallowed
except Exception as e:
    log(f"Scan error: {e}")

# CORRECT (v7.3):
for symbol in symbols:
    try:
        setup = checklist.evaluate(symbol)
    except Exception as e:
        log(f"Evaluation error for {symbol}: {e}")
        continue

    if setup:
        _execute_checklist_trade(setup)  # now has its own error propagation
```

---

## 14. Telegram Bot Interface

### 14.1 Setup

**File:** `bot/telegram_bot.py`

The Telegram bot provides a real-time interface to monitor and interact with OrbityxAI while it runs on a server.

**Configuration:**
```ini
# .env
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_IDS=123456789,987654321
```

Multiple chat IDs are supported — useful for sending notifications to both a personal chat and a team group.

**Starting the bot:**
The Telegram bot starts automatically when OrbityxAI launches. No separate process is needed.

### 14.2 Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot session and display welcome message |
| `/status` | Show current bot status, mode, connected exchange |
| `/positions` | List all currently open positions with P&L |
| `/balance` | Show account balance and available margin |
| `/scan` | Trigger an immediate scan cycle (outside normal interval) |
| `/history` | Show the last 10 closed trades with results |
| `/stats` | Display performance statistics (win rate, avg R:R, etc.) |
| `/pause` | Pause new trade entries (existing positions continue) |
| `/resume` | Resume new trade entries after pause |
| `/stop` | Gracefully stop the bot (closes nothing, just stops new scans) |
| `/levels SYMBOL` | Show detected S/R levels for a specific symbol |
| `/checklist SYMBOL` | Run CHECKLIST on a symbol and show detailed step results |
| `/settings` | Display current configuration |
| `/help` | Show all available commands |

**Example: /positions output:**
```
Open Positions (2/3)

1. BTC/USDT LONG
   Entry: $65,000.00
   Current: $65,840.00
   SL: $64,500.00
   TP: $67,200.00
   Size: 0.2 BTC
   P&L: +$168.00 (+1.68%)
   R Progress: 0.48R

2. ETH/USDT SHORT
   Entry: $3,450.00
   Current: $3,380.00
   SL: $3,520.00
   TP: $3,240.00
   Size: 1.5 ETH
   P&L: +$105.00 (+2.03%)
   R Progress: 0.33R
```

### 14.3 Notifications

The bot sends automatic notifications for all key events:

**Trade Entry Notification:**
```
NEW LONG TRADE -- BTC/USDT

Entry: $65,000.00
SL: $64,500.00 (-0.77%)
TP: $67,200.00 (+3.38%)
R:R: 4.4:1
Size: 0.2 BTC ($13,000)
Risk: $100 (1.0%)

Signal: Retest at H1 support
Level strength: 8.4
ADX H1: 28.3
Volume: 1.45x avg
```

**Trade Closed — Win:**
```
TRADE CLOSED -- WIN
BTC/USDT LONG

Entry: $65,000 -> Exit: $67,200
Gain: +$440 (+4.4R)
Duration: 8h 23m
```

**Trade Closed — Loss:**
```
TRADE CLOSED -- LOSS
ETH/USDT SHORT

Entry: $3,450 -> Exit: $3,520 (SL hit)
Loss: -$100 (-1.0R)
Duration: 2h 11m
```

**Scan Cycle Summary:**
```
Scan #47 Complete
Pairs scanned: 220
Setups found: 3
Trades entered: 1 (ETH/USDT SHORT)
Skipped by ADX: 12
Skipped by volume: 28
Skipped by R:R: 7
```

---

## 15. Backtesting

### 15.1 Running a Backtest

**File:** `run_setup_backtest.py`

```bash
# Basic backtest -- last 90 days on BTC/USDT
python run_setup_backtest.py \
  --exchange bybit \
  --symbol BTC/USDT \
  --start 2025-01-01 \
  --end 2025-03-26

# Multi-symbol backtest
python run_setup_backtest.py \
  --exchange bybit \
  --symbols BTC/USDT ETH/USDT SOL/USDT BNB/USDT \
  --start 2025-01-01 \
  --end 2025-03-26 \
  --capital 10000

# Full parameter backtest
python run_setup_backtest.py \
  --exchange bybit \
  --symbols BTC/USDT ETH/USDT SOL/USDT \
  --start 2024-07-01 \
  --end 2025-03-26 \
  --capital 10000 \
  --leverage 5 \
  --risk-per-trade 0.01 \
  --min-rr 3.0 \
  --output-dir results/backtest_q1_2025
```

### 15.2 Backtest Output

The backtest generates a detailed HTML report and CSV files:

```
results/backtest_q1_2025/
+-- summary.html              # Full HTML report with charts
+-- trades.csv                # All individual trades
+-- equity_curve.png          # Equity curve chart
+-- monthly_returns.png       # Monthly P&L breakdown
+-- heatmap.png               # Win rate by symbol and month
+-- level_quality.csv         # Level detection quality metrics
+-- stats.json                # Machine-readable summary statistics
```

### 15.3 Performance Metrics

The backtest calculates the following metrics:

| Metric | Description |
|--------|-------------|
| **Total Return** | Net % gain/loss over the period |
| **CAGR** | Compound Annual Growth Rate |
| **Win Rate** | % of trades that hit TP |
| **Average R:R** | Mean reward-to-risk of winning trades |
| **Profit Factor** | Gross profit / Gross loss |
| **Max Drawdown** | Largest peak-to-trough equity decline |
| **Sharpe Ratio** | Risk-adjusted return (annualized) |
| **Calmar Ratio** | CAGR / Max Drawdown |
| **Average Trade Duration** | Mean time from entry to exit |
| **Best Month** | Highest monthly return |
| **Worst Month** | Lowest monthly return |
| **Total Trades** | Number of completed trades |
| **SL Hit Rate** | % of trades stopped out |
| **TP Hit Rate** | % of trades that reached TP |
| **Timeout Rate** | % of trades that expired without resolution |

### 15.4 Sample Results

The following results are from a historical backtest on BTC/USDT, ETH/USDT, and SOL/USDT using the CHECKLIST strategy with default parameters. These are for illustration purposes and **do not guarantee future performance**.

**Period:** January 2024 to March 2025 (15 months)
**Capital:** $10,000 USDT
**Risk per trade:** 1%
**Leverage:** 5x
**Min R:R:** 3:1

```
+------------------------------------------------------------+
|               BACKTEST RESULTS SUMMARY                     |
+------------------------------------------------------------+
| Total Return:           +87.3%                             |
| CAGR:                   +69.8%                             |
| Total Trades:           143                                |
| Win Rate:               42.7% (61/143)                     |
| Average Winner R:R:     4.2R                               |
| Average Loser:          -1.0R                              |
| Profit Factor:          3.08                               |
| Max Drawdown:           -12.4%                             |
| Sharpe Ratio:           2.31                               |
| Calmar Ratio:           5.63                               |
| Average Trade Duration: 18h 42m                            |
| Best Month:             +22.1% (Oct 2024)                  |
| Worst Month:            -5.8% (Dec 2024)                   |
+------------------------------------------------------------+
| By Symbol:                                                 |
|   BTC/USDT: 52 trades, 44.2% WR, +38.2% return            |
|   ETH/USDT: 48 trades, 41.7% WR, +29.4% return            |
|   SOL/USDT: 43 trades, 41.9% WR, +19.7% return            |
+------------------------------------------------------------+
| Filter Rejection Stats:                                    |
|   Rejected by ADX (<15):       18.3%                      |
|   Rejected by Volume (<1.2x):  22.1%                      |
|   Rejected by Chop (>2):       9.4%                        |
|   Rejected by R:R (<3:1):      31.2%                      |
|   Rejected by SL distance:     7.8%                        |
|   Passed all filters:          11.2%                      |
+------------------------------------------------------------+
```

**Key Insight:** Only approximately 11% of scanned setups pass all CHECKLIST steps. This high selectivity is by design — the bot waits for only the highest-quality setups rather than trading every potential signal.

---

## 16. Market Scanning

**File:** `run_scan_now.py`

Run an immediate, one-time scan without starting the full trading engine:

```bash
# Scan all pairs and print results without trading
python run_scan_now.py --exchange bybit

# Scan specific symbols
python run_scan_now.py --exchange bybit --symbols BTC/USDT ETH/USDT

# Verbose output showing CHECKLIST results for each symbol
python run_scan_now.py --exchange bybit --verbose

# Save scan results to file
python run_scan_now.py --exchange bybit --output scan_results.json
```

**Sample Scan Output:**

```
[2026-03-26 10:00:00] Starting market scan -- 220 pairs
[2026-03-26 10:00:15] Scan complete in 15.2s

RESULTS:
  PASS  BTC/USDT   -- LONG setup | Entry: 65,000 | SL: 64,500 | TP: 67,200 | R:R: 4.4
  PASS  ETH/USDT   -- SHORT setup | Entry: 3,450 | SL: 3,520 | TP: 3,240 | R:R: 3.6
  FAIL  SOL/USDT   -- FAIL at STEP 3 (ADX=11.2 < 15, ranging market)
  FAIL  BNB/USDT   -- FAIL at STEP 2 (no valid signal pattern)
  FAIL  MATIC/USDT -- FAIL at STEP 5 (R:R=2.1 < 3.0 minimum)
  ...

Summary: 2 valid setups from 220 scanned (0.91%)
```

---

## 17. File Structure Reference

```
OrbityxAI/
|
+-- run_live.py                    # Main entry point for live/paper trading
+-- run_setup_backtest.py          # Backtesting engine
+-- run_scan_now.py                # One-time market scanner
+-- run_training.py                # ML model training pipeline
|
+-- strategy/
|   +-- checklist.py               # 5-step CHECKLIST implementation
|
+-- levels/
|   +-- detector.py                # Core S/R level detection (swing+cluster)
|   +-- multi_tf.py                # Multi-timeframe level merging
|   +-- volume_profile.py          # Volume profile analysis
|
+-- setups/
|   +-- sizing.py                  # Position sizing calculations
|
+-- trading/
|   +-- live_engine.py             # Main trading loop and order management
|   +-- connector.py               # ccxt exchange connector (Bybit/MEXC)
|
+-- bot/
|   +-- telegram_bot.py            # Telegram bot interface
|
+-- data/
|   +-- fetcher_binance.py         # Historical data fetching
|
+-- indicators/
|   +-- technical.py               # ATR, ADX, chop, EMA, volume MA, etc.
|
+-- ml/
|   +-- features.py                # Feature engineering (47 features)
|   +-- labeling.py                # Trade outcome labeling
|   +-- ensemble.py                # LGB + XGB + CatBoost ensemble
|   +-- calibration.py             # Probability calibration
|
+-- models/
|   +-- lgb_model.pkl
|   +-- xgb_model.pkl
|   +-- cat_model.pkl
|   +-- lgb_calibrated.pkl
|   +-- xgb_calibrated.pkl
|   +-- cat_calibrated.pkl
|   +-- feature_scaler.pkl
|   +-- training_metadata.json
|
+-- logs/
|   +-- trading.log                # Main trading log
|   +-- errors.log                 # Error-only log
|   +-- trades.log                 # Trade execution log
|
+-- results/                       # Backtest results directory
|
+-- .env                           # API keys and secrets (never commit!)
+-- .env.example                   # Template for .env
+-- requirements.txt               # Python dependencies
+-- README.md                      # This file
```

---

## 18. Server Deployment

### 18.1 VPS Requirements

**Minimum Specifications:**
- CPU: 2 vCPU
- RAM: 4 GB
- Storage: 20 GB SSD
- Network: 100 Mbps, low latency to exchange servers
- OS: Ubuntu 22.04 LTS (recommended)

**Recommended Specifications:**
- CPU: 4 vCPU
- RAM: 8 GB (needed if running ML training on same server)
- Storage: 50 GB SSD
- Network: 1 Gbps

**Recommended VPS Providers:**
- DigitalOcean (Singapore or Frankfurt data centers for low latency to Bybit)
- Vultr
- Hetzner (excellent price/performance ratio)
- AWS EC2 (t3.medium or t3.large)

### 18.2 systemd Service

Create a systemd service file for automatic startup and recovery:

```bash
sudo nano /etc/systemd/system/orbityxai.service
```

```ini
[Unit]
Description=OrbityxAI Crypto Trading Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/OrbityxAI
ExecStart=/home/ubuntu/OrbityxAI/venv/bin/python run_live.py \
    --mode live \
    --exchange bybit \
    --capital 0 \
    --leverage 5 \
    --risk-per-trade 0.01 \
    --min-rr 3.0 \
    --max-positions 3
Restart=always
RestartSec=60
StandardOutput=append:/home/ubuntu/OrbityxAI/logs/trading.log
StandardError=append:/home/ubuntu/OrbityxAI/logs/errors.log
EnvironmentFile=/home/ubuntu/OrbityxAI/.env

[Install]
WantedBy=multi-user.target
```

**Enable and start the service:**

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable orbityxai

# Start the service
sudo systemctl start orbityxai

# Check status
sudo systemctl status orbityxai

# View live logs
sudo journalctl -u orbityxai -f

# Stop the service
sudo systemctl stop orbityxai

# Restart the service (e.g., after code update)
sudo systemctl restart orbityxai
```

**Log Rotation Setup:**

```bash
sudo nano /etc/logrotate.d/orbityxai
```

```
/home/ubuntu/OrbityxAI/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
    postrotate
        systemctl restart orbityxai > /dev/null 2>&1 || true
    endscript
}
```

### 18.3 Docker Deployment

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs results models

# Run as non-root user
RUN useradd -m botuser && chown -R botuser:botuser /app
USER botuser

CMD ["python", "run_live.py", "--mode", "paper", "--exchange", "bybit"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  orbityxai:
    build: .
    container_name: orbityxai
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./logs:/app/logs
      - ./models:/app/models
      - ./results:/app/results
    command: >
      python run_live.py
        --mode live
        --exchange bybit
        --capital 0
        --leverage 5
        --risk-per-trade 0.01
        --min-rr 3.0
        --max-positions 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

**Docker commands:**

```bash
# Build image
docker-compose build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild and restart after code changes
docker-compose down && docker-compose build && docker-compose up -d
```

### 18.4 Monitoring and Logging

**Viewing logs in real-time:**

```bash
# All logs
tail -f logs/trading.log

# Errors only
tail -f logs/errors.log

# Trade executions only
tail -f logs/trades.log

# Filter for specific symbol
grep "BTC/USDT" logs/trading.log | tail -50
```

**Log Level Configuration:**

The bot uses Python's `logging` module with the following levels:
- `DEBUG`: Detailed calculation steps (only enable for debugging — very verbose)
- `INFO`: Normal operation events (default)
- `WARNING`: Non-critical issues (filter rejections, rate limit hits)
- `ERROR`: Trade execution failures, API errors

```bash
# Enable debug logging
python run_live.py --mode paper --log-level DEBUG
```

**Health Check Script:**

Create `scripts/health_check.sh`:

```bash
#!/bin/bash
# Check if the bot process is running
if ! pgrep -f "run_live.py" > /dev/null; then
    echo "Bot not running! Sending alert..."
    curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
         -d "chat_id=${TELEGRAM_CHAT_ID}" \
         -d "text=ALERT: OrbityxAI process not detected!"
    # Optionally restart
    systemctl restart orbityxai
fi

# Check last log entry is recent (within 5 minutes)
LAST_LOG_TIME=$(stat -c %Y logs/trading.log)
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_LOG_TIME))

if [ $TIME_DIFF -gt 300 ]; then
    echo "Log file not updated in ${TIME_DIFF}s -- possible hang"
fi
```

```bash
# Add to crontab for 5-minute health checks
crontab -e
# Add: */5 * * * * /home/ubuntu/OrbityxAI/scripts/health_check.sh
```

---

## 19. Security Notes

### API Key Security

- **Never commit `.env` to version control.** The `.gitignore` file must exclude `.env`.
- Use IP whitelisting on exchange API keys when running on a fixed-IP server.
- Enable only the minimum required permissions on API keys:
  - Read access (always)
  - Trade access (futures only)
  - **Never enable withdrawal permissions on trading bot keys**
- Rotate API keys periodically (recommended: every 90 days).
- Store API keys encrypted at rest if your VPS provider supports it.

### Server Security

```bash
# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Enable firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow out 443  # HTTPS to exchanges
sudo ufw allow out 80   # HTTP (if needed)
sudo ufw deny in        # Block all incoming except SSH

# Keep system updated
sudo apt update && sudo apt upgrade -y

# Install fail2ban to protect against brute force
sudo apt install fail2ban -y
```

### Environment File Permissions

```bash
# Restrict .env to owner only
chmod 600 .env
chown ubuntu:ubuntu .env

# Verify
ls -la .env
# Should show: -rw------- 1 ubuntu ubuntu ...
```

### Telegram Bot Security

- Restrict your Telegram bot to authorized chat IDs only (configured in `.env`)
- The bot validates sender chat_id against `TELEGRAM_CHAT_IDS` for all commands
- Do not share your bot token publicly
- Sensitive commands (like `/stop`) should require additional confirmation

### Code Integrity

```bash
# Verify no unexpected changes before deployment
git diff
git status

# Keep a SHA256 hash of your production version
sha256sum run_live.py strategy/checklist.py > checksums.txt
```

---

## 20. Troubleshooting

### 20.1 Common Errors

#### AuthenticationError: Invalid API key

```
ccxt.base.errors.AuthenticationError: bybit Invalid API key...
```

**Solutions:**
1. Verify API key and secret in `.env` are correct (copy-paste from exchange, no spaces)
2. Check that API key has the correct permissions (Trade for futures)
3. Verify IP whitelist includes your server's IP if IP restriction is enabled
4. Ensure the key is for the correct account type (Unified vs. Standard)

```bash
# Test connectivity
python -c "
import ccxt, os
from dotenv import load_dotenv
load_dotenv()
ex = ccxt.bybit({'apiKey': os.getenv('EXCHANGE_KEY'), 'secret': os.getenv('EXCHANGE_SECRET')})
print(ex.fetch_balance())
"
```

#### No models found in models/ directory

```
FileNotFoundError: Model file models/lgb_calibrated.pkl not found
```

**Solution:** Run the training pipeline first:

```bash
python run_training.py --exchange bybit --symbols BTC/USDT ETH/USDT SOL/USDT
```

#### ccxt.base.errors.RateLimitExceeded

```
ccxt.base.errors.RateLimitExceeded: Rate limit exceeded...
```

**Solutions:**
1. The connector has built-in rate limiting — if this error persists, reduce `--max-pairs`
2. Check if multiple instances are running simultaneously
3. Add delay between requests in connector config:
   ```python
   exchange.rateLimit = 200  # ms between requests
   ```

#### KeyError: 'precision'

```
KeyError: 'precision' in market info for SYMBOL
```

**Solution:** Market data may be incomplete. Filter symbols to only include those with full market info:

```bash
python run_scan_now.py --exchange bybit --verbose 2>&1 | grep KeyError
```

Remove problematic symbols from your scan list or add error handling for specific pairs.

#### Memory Error During Backtest

```
MemoryError: Unable to allocate array for historical data
```

**Solutions:**
1. Reduce backtest date range
2. Process symbols sequentially rather than loading all in memory
3. Add `--max-symbols 10` flag to limit concurrent symbol processing
4. Upgrade server RAM

#### ImportError: No module named 'lightgbm'

```
ImportError: No module named 'lightgbm'
```

**Solution:**
```bash
source venv/bin/activate
pip install lightgbm xgboost catboost
```

On some systems, LightGBM requires an additional library:
```bash
# macOS
brew install libomp

# Ubuntu
sudo apt install libgomp1
```

### 20.2 Exchange-Specific Issues

#### Bybit: leverage not set error

```
bybit {"retCode":10006,"retMsg":"leverage not set"}
```

**Solution:** Leverage must be set before placing orders. The connector does this automatically, but if it fails:

```python
# Manual leverage setup
exchange.set_leverage(
    leverage=5,
    symbol='BTC/USDT',
    params={'buyLeverage': '5', 'sellLeverage': '5'}
)
```

#### Bybit: Position mode mismatch

```
bybit {"retCode":10028,"retMsg":"position idx not match position mode"}
```

**Solution:** Switch to one-way position mode in Bybit settings:
- Bybit Dashboard > Derivatives > Settings > Position Mode > One-Way Mode

#### MEXC: Symbol name format

MEXC uses different symbol naming conventions:
- Bybit: `BTC/USDT:USDT`
- MEXC: `BTC_USDT`

The connector handles this automatically via ccxt's unified symbol format, but if you encounter symbol errors:

```python
# Check available symbols
markets = exchange.load_markets()
print([s for s in markets.keys() if 'BTC' in s])
```

#### MEXC: Minimum order size

MEXC has higher minimum order sizes on some pairs. If you get:

```
MEXC {"code":30005,"msg":"less than min qty"}
```

Increase position size or capital, or skip that symbol:

```bash
python run_live.py --exchange mexc --capital 5000
```

### 20.3 Strategy Debugging

#### Trade not taken despite valid setup

1. Enable verbose logging: `--log-level DEBUG`
2. Run one-time checklist: `python run_scan_now.py --verbose --symbols BTC/USDT`
3. Check each step result in output
4. Common causes:
   - ADX below 15 (market ranging)
   - Volume below 1.2x average
   - R:R does not meet minimum
   - Blocking level detected

#### Levels not detected for a symbol

```bash
python run_scan_now.py --exchange bybit --symbols SYMBOL/USDT --show-levels
```

If no levels are shown:
- Pair may have insufficient history (new listing)
- Volatility too low for meaningful S/R zones
- Try adjusting lookback or strength threshold in `levels/detector.py`

#### ADX always filtering trades

If the ADX filter is rejecting everything:
1. Confirm period is 14 (matches standard settings)
2. Check H1 candles are being fetched correctly
3. Market may genuinely be ranging — wait for trend development

#### SL placement failures after v7.3 upgrade

If you see repeated SL validation errors after upgrading:

```
AssertionError: SL must be below level for LONG
```

This is the v7.3 fix working correctly — earlier code had reversed SL logic. Check that:
- `strategy/checklist.py` is fully updated
- No cached/old bytecode files: `find . -name "*.pyc" -delete`

---

## 21. Version History

### v7.3 (Current) — 2026-03-26

**Critical Bug Fixes:**
- **SL directional constraint:** Enforced that LONG SL is always below level_price and SHORT SL is always above level_price. Previous versions had inverted logic that could place stops on the wrong side of the level.
- **Error handling fix:** `_execute_checklist_trade()` moved outside the outer `try/except` scan block. Previously, all trade execution errors were silently swallowed, making debugging impossible and potentially causing valid trades to fail silently.
- **Tick size precision fix:** `_tick_to_decimals()` now correctly handles Bybit's float tick size format (e.g., `0.000001`) instead of treating it as integer decimal places.

**New Features:**
- **ADX filter:** Added ADX H1 > 15 requirement to Step 3. Trades are no longer entered in ranging markets.
- **Volume confirmation:** Added M5 signal bar volume >= 1.2x 20-bar average requirement to Step 3.

### v7.2 — 2026-02-10

- Added MEXC exchange support
- Improved multi-timeframe level merging with confluent level detection
- Enhanced Telegram bot with `/checklist SYMBOL` command
- Added optuna hyperparameter optimization for ML models
- Fixed SHAP value calculation for ensemble explainability

### v7.1 — 2026-01-15

- Added CatBoost to the ML ensemble (previously LGB + XGB only)
- Added SHAP explainability module
- Implemented isotonic regression probability calibration
- Added volume profile integration to level detection
- Performance improvements: scan cycle time reduced by 40%

### v7.0 — 2025-12-01

- Complete rewrite of the CHECKLIST strategy (replaced previous momentum strategy)
- New level detection algorithm with clustering
- R:R enforcement moved to dedicated Step 5 (was previously in Step 3)
- Added paper trading mode
- New systemd service template

### v6.x — 2025 Q3

- Original momentum-based strategy
- Bybit-only support
- Basic level detection
- No ML integration

---

## 22. Known Limitations

### Strategy Limitations

1. **Trending markets only.** The CHECKLIST strategy is specifically designed for trending markets. In extended sideways/consolidating markets, the ADX filter will correctly prevent entries, but the bot will generate few or no signals. This is expected behavior, not a bug.

2. **News events.** The bot has no awareness of scheduled economic events (central bank announcements, major CPI releases, etc.) or sudden news (exchange hacks, regulatory announcements). Consider implementing a news-aware pause feature for high-impact event periods.

3. **Correlated positions.** The max-positions limit (default: 3) does not account for correlation between positions. Three LONG positions in BTC, ETH, and SOL are highly correlated and will all be profitable or unprofitable together, effectively compounding risk beyond the 1% per trade figure.

4. **Level decay.** S/R levels are re-detected each scan cycle, but their "age" is not fully tracked. A level that was strong 6 months ago but has since been repeatedly broken may still score highly based on historical touches.

5. **Slippage in backtest.** The backtester assumes fills at the entry price. In live trading, slippage may result in worse fills, particularly for larger positions or less liquid pairs. Always add a 0.05-0.1% slippage buffer when evaluating backtest results.

### Technical Limitations

6. **Single exchange per instance.** Each bot instance is configured for one exchange. To trade on both Bybit and MEXC simultaneously, run two separate instances.

7. **No cross-position trailing stop.** Trailing stop functionality is not implemented in v7.3. All SL orders are fixed at the original calculated level.

8. **ML models require retraining.** The ML ensemble models are trained on historical data up to the training cutoff date. Markets evolve, and model performance may degrade over time. Retraining every 30-90 days is recommended.

9. **M5 data fetching latency.** Fetching M5 candles for 220 pairs adds latency to each scan cycle. On slower VPS connections, the first scan cycle may take 30-60 seconds.

10. **No partial take-profit.** The current version does not support partial TP orders (e.g., close 50% at 2R, let remainder run to 3R). All positions are closed in full at the TP level.

### Exchange Limitations

11. **MEXC rate limits.** MEXC's API rate limits are more restrictive than Bybit's. Scanning 220 pairs on MEXC may result in rate limit errors. Use `--max-pairs 100` when running on MEXC.

12. **Bybit minimum order sizes.** Very small accounts (under $500) may find that calculated position sizes fall below Bybit's minimum order size for some pairs. The connector will skip these orders with a warning.

---

## 23. FAQ

**Q: Is this bot profitable?**

A: Past backtested performance does not guarantee future results. The CHECKLIST strategy has shown positive results in backtests, but live performance depends on market conditions, execution quality, and proper capital management. Always test in paper mode first and only use capital you can afford to lose.

---

**Q: Why does the bot skip so many pairs?**

A: This is by design. The CHECKLIST strategy is highly selective — only approximately 11% of scanned setups pass all five steps. The bot is designed to wait for only the highest-quality setups rather than over-trading. A typical scan of 220 pairs may result in 0-3 valid setups.

---

**Q: The bot ran for hours and did not take any trades. Is something wrong?**

A: Not necessarily. During ranging market conditions, the ADX filter (Step 3) will reject most or all setups. Check the scan logs to see which step is rejecting trades most frequently. If ADX < 15 is the primary rejection reason, the market is genuinely choppy — patience is required.

---

**Q: Can I run the bot on multiple exchanges simultaneously?**

A: Yes, by running two separate instances with different `.env` files or by passing different credentials via environment variables. Name your `.env` files accordingly (`.env.bybit`, `.env.mexc`) and reference them accordingly.

---

**Q: What happens if the bot crashes mid-trade?**

A: The stop loss order is placed on the exchange immediately upon trade entry. If the bot crashes, the stop loss order remains active on the exchange, protecting your position. Upon restart, the bot detects open positions from the exchange API and resumes monitoring them.

---

**Q: How often should I retrain the ML models?**

A: Every 30-90 days in normal conditions. If market structure changes significantly (e.g., a major market regime change), retrain sooner. The training metadata file (`models/training_metadata.json`) includes the training cutoff date for reference.

---

**Q: Can I use a smaller R:R than 3:1?**

A: The minimum is enforced via `--min-rr`. You can set it lower (e.g., `--min-rr 2.0`), but this is not recommended. At a 42% win rate, a 3:1 R:R system has a positive expectancy. Reducing to 2:1 significantly narrows the margin for profitability and makes the system sensitive to execution quality.

---

**Q: Does the bot work on spot markets?**

A: No. OrbityxAI is designed exclusively for futures/perpetual swap markets. Spot market support would require different order types, different position sizing (no leverage), and different risk calculations.

---

**Q: Can I add custom S/R levels manually?**

A: Not in the current version. All levels are detected algorithmically. Adding a manual level override feature is on the roadmap for v7.4.

---

**Q: Why does the bot use 5x leverage by default?**

A: The default leverage of 5x combined with 1% risk per trade means each position uses approximately 5-20% of account capital as margin (depending on SL size). Leverage itself does not increase risk when position sizing is done correctly from the risk amount — the SL determines your maximum loss, not the leverage.

---

**Q: What is "paper" mode exactly?**

A: In paper mode, the bot goes through the full CHECKLIST pipeline, calculates trade setups, and logs them as if they were executed — but no actual orders are placed on the exchange. Paper P&L is tracked in memory and reported via Telegram. This allows full strategy testing without financial risk.

---

**Q: Does OrbityxAI support stop-limit orders instead of stop-market?**

A: By default, stop-market orders are used for SL to guarantee fill during fast-moving markets. Stop-limit orders can result in missed fills if price gaps through the limit price. This is configurable in `trading/connector.py` but changing it is not recommended.

---

**Q: How do I know when the ML models are being used vs. ignored?**

A: The logs show ML probability scores for every evaluated setup. If the ML score is below the threshold (0.55 by default), the setup is noted but the ML recommendation is logged. The CHECKLIST filters are always the primary gate; ML is secondary and advisory only.

---

## 24. Glossary

**ADX (Average Directional Index)** — A technical indicator measuring trend strength, independent of direction. Ranges from 0 to 100. Values above 25 indicate strong trending conditions; below 15 indicates ranging/choppy markets.

**ATR (Average True Range)** — A measure of market volatility expressed as the average price range over a given period. Used extensively in OrbityxAI for SL/TP calculations and level proximity thresholds.

**Blocking Level** — An S/R level that exists between the current price and the intended TP target. A blocking level reduces the probability of the trade reaching TP and is grounds for rejecting a setup in Step 1 of the CHECKLIST.

**Breakout** — When price closes a candle convincingly beyond an S/R level, suggesting the level has been overcome and a new directional move is underway.

**Chop Index** — A custom indicator measuring the degree of sideways/ranging behavior in recent price action. Ranges from 0 (strongly trending) to 3 (highly choppy). CHECKLIST requires score of 2 or less.

**CHECKLIST** — OrbityxAI's 5-step trade selection framework. All five steps must pass for a trade to be executed.

**Clustering** — The algorithm that merges nearby S/R swing points into a single price zone. Uses a 0.3% price radius to determine if two points belong to the same cluster.

**Confluent Level** — An S/R level identified on multiple timeframes (e.g., both H1 and H4). Confluent levels receive higher weight and are higher-priority targets.

**D1 / H4 / H1 / M5** — Timeframe designations: Daily (D1), 4-hour (H4), 1-hour (H1), 5-minute (M5).

**DI+ / DI-** — Directional Indicator components of the ADX system. DI+ measures upward directional movement; DI- measures downward directional movement. Used to determine trend direction.

**Drawdown** — The peak-to-trough decline in account equity during a losing period. Max drawdown is the largest such decline over the backtest period.

**Ensemble** — A combination of multiple ML models (LightGBM, XGBoost, CatBoost) whose predictions are averaged to produce a final probability score.

**HVN (High Volume Node)** — A price level where historically high trading volume occurred, as identified by volume profile analysis. HVNs are strong S/R candidates.

**LVN (Low Volume Node)** — A price level where historically low trading volume occurred. Price tends to move quickly through LVNs.

**Paper Trading** — Simulated trading without real money. Bot follows the full strategy pipeline but places no real orders on the exchange.

**Portfolio Heat** — The total percentage of capital at risk across all open positions simultaneously. With default settings, max portfolio heat is 3% (3 positions at 1% each).

**R:R (Reward-to-Risk Ratio)** — The ratio of potential profit to potential loss for a trade. A 3:1 R:R means the target profit is 3 times the maximum loss. CHECKLIST requires minimum 3:1.

**Retest** — When price returns to a previously identified S/R level after having moved away. A retest that holds (shows rejection) is a high-probability entry signal.

**S/R Levels (Support/Resistance)** — Price zones where buying (support) or selling (resistance) is historically concentrated. These are the structural foundation of the CHECKLIST strategy.

**SHAP (SHapley Additive exPlanations)** — A method for explaining ML model predictions by quantifying each feature's contribution to a specific output. Used to understand why the ML ensemble approved or rejected a setup.

**SL (Stop Loss)** — The price level at which a losing trade is automatically closed to prevent further losses. In OrbityxAI, always placed on the other side of the S/R level from entry.

**Strength Score** — A numerical measure of an S/R level's historical significance. Calculated as: `touches x log(1 + volume) x (1 + false_breakouts x 0.5)`. Minimum 3.0 required.

**Swing Point** — A local price high or low where price reversed direction. Identified using a lookback window of 5 candles in OrbityxAI.

**Tick Size** — The minimum price increment for a trading pair on an exchange. Example: for BTC/USDT on Bybit, tick size is 0.1 USDT.

**TP (Take Profit)** — The target price at which a winning trade is closed to lock in profits. Always placed at the next S/R level in the trade direction.

**Unified Trading Account (UTA)** — Bybit's account type that consolidates spot, futures, and options under a single margin pool.

**VWAP (Volume Weighted Average Price)** — A price indicator that weights each candle's price by its volume. Used as an ML feature in OrbityxAI.

**Wilder's Smoothing** — A specific exponential moving average method developed by J. Welles Wilder, used in ATR and ADX calculations. Equivalent to EMA with alpha = 1/N.

---

## 25. Contributing Guidelines

Contributions to OrbityxAI are welcome. Please follow these guidelines to maintain code quality and consistency.

### Development Setup

```bash
# Fork the repository and clone your fork
git clone https://github.com/YOUR_USERNAME/OrbityxAI.git
cd OrbityxAI

# Create a virtual environment
python3 -m venv venv-dev
source venv-dev/bin/activate

# Install development dependencies
pip install -r requirements.txt
pip install pytest black flake8 mypy pre-commit

# Install pre-commit hooks
pre-commit install
```

### Code Style

- **Formatter:** `black` with default settings (88-character line length)
- **Linter:** `flake8` — no errors allowed
- **Type hints:** All function signatures must include type hints
- **Docstrings:** All public functions must have docstrings in Google style

```python
def calculate_position_size(
    capital: float,
    entry_price: float,
    sl_price: float,
    risk_fraction: float = 0.01,
    leverage: int = 5
) -> float:
    """Calculate position size based on risk parameters.

    Args:
        capital: Total trading capital in USDT.
        entry_price: Intended entry price in USDT.
        sl_price: Stop loss price in USDT.
        risk_fraction: Fraction of capital to risk (0.01 = 1%).
        leverage: Futures leverage multiplier.

    Returns:
        Position size in USDT (notional value).

    Raises:
        ValueError: If SL price equals entry price.
    """
    if sl_price == entry_price:
        raise ValueError("SL price cannot equal entry price")
    ...
```

### Testing

All contributions must include tests:

```bash
# Run tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
```

- New strategy logic: unit tests in `tests/test_checklist.py`
- New indicators: unit tests in `tests/test_indicators.py`
- Exchange connector changes: integration tests in `tests/test_connector.py` (requires API keys)

### Branch Strategy

- `main` — production-ready code, protected
- `develop` — integration branch for new features
- `feature/description` — feature branches
- `fix/description` — bug fix branches
- `release/vX.Y` — release preparation

```bash
# Create a feature branch
git checkout develop
git checkout -b feature/adx-dynamic-threshold

# After development
git add <specific files>
git commit -m "feat: add dynamic ADX threshold based on asset volatility"
git push origin feature/adx-dynamic-threshold
# Open a Pull Request to develop
```

### Pull Request Requirements

1. All tests pass (CI enforced)
2. Code coverage does not decrease
3. No new linting errors
4. Includes a clear description of the change and motivation
5. For strategy changes: includes backtest comparison (before/after metrics)
6. For exchange connector changes: tested manually on paper mode

### Reporting Issues

When reporting bugs, include:
1. OrbityxAI version
2. Python version (`python --version`)
3. Exchange (`bybit` or `mexc`)
4. Full error traceback from `logs/errors.log`
5. The command used to launch the bot
6. Relevant portion of `logs/trading.log` (last 50 lines before the error)

**Issue Template:**
```markdown
## Bug Description
[Clear description of the bug]

## Steps to Reproduce
1. Launch bot with: `python run_live.py --mode paper ...`
2. Wait for scan cycle
3. Error occurs when: [describe]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Version: v7.3
- Python: 3.11.2
- Exchange: bybit
- OS: Ubuntu 22.04

## Error Log
[paste error traceback here]
```

### Feature Requests

Feature requests are tracked as GitHub Issues with the `enhancement` label. Before opening a feature request:
1. Check existing issues to avoid duplicates
2. Describe the use case, not just the implementation
3. Explain how it fits with the existing CHECKLIST philosophy

---

## 26. License

MIT License

Copyright (c) 2026 OrbityxAI

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 27. Disclaimer

**IMPORTANT — READ CAREFULLY BEFORE USE**

Trading cryptocurrency futures involves substantial risk of loss and is not suitable for all investors. Leveraged trading can result in losses exceeding your initial investment.

OrbityxAI is a trading tool, not a financial advisor. Nothing in this documentation or the software itself constitutes investment advice. Past performance shown in backtests does not guarantee future results. Backtested results have inherent limitations including look-ahead bias, survivorship bias, and assumption of perfect fills.

Before using OrbityxAI with real funds:
- Thoroughly test in paper mode for a minimum of 30 days
- Understand all risks associated with leveraged crypto futures trading
- Only trade with capital you can afford to lose in its entirety
- Consult with a qualified financial advisor if you are unsure
- Ensure that automated trading is legal in your jurisdiction

The authors and contributors of OrbityxAI are not responsible for any financial losses incurred through the use of this software.

---

*OrbityxAI v7.3 — Documentation last updated: 2026-03-26*

*For support, open an issue on GitHub or contact the development team via Telegram.*
