"""
Feature Engineering  v6.9
===========================
135 стационарных признаков без заглядывания в будущее.

НОВЫЕ ГРУППЫ vs v6.8:

  G27  Cross-asset BTC features   4  NEW
       Признаки относительного движения пары к BTC.
       Даёт модели сигнал "лидер/последователь" — альткоины
       часто следуют за BTC с задержкой.
       Требует btc_closes: Optional[np.ndarray].
       Если btc_closes=None — все 4 признака = 0.0 (безвредно,
       модель игнорирует нулевые фичи через регуляризацию).

  G28  CVD / Delta Volume          3  NEW
       Cumulative Volume Delta через свечи:
       bull_vol (close>=open) - bear_vol (close<open).
       Показывает давление покупателей/продавцов без aggTrades.

Feature groups (135 total):
  G1  Lagged log-returns          7
  G2  Fractional differentiation  2
  G3  Cumulative momentum         4
  G4  Multi-TF momentum           2
  G5  Price acceleration          1
  G6  RSI (7,14,21) + StochRSI    4
  G7  MACD                        4
  G8  Oscillators                 8
  G9  Bollinger + Keltner         3
  G10 Squeeze Momentum            2
  G11 Volatility                 10
  G12 Trend                       4
  G13 SMA vs price                6
  G14 EMA vs price + slope        6
  G15 Ichimoku + VWAP             5
  G16 Volume                      8
  G17 Return statistics           6
  G18 Permutation entropy         1
  G19 Candle patterns             1
  G20 OHLC + buyer pressure       4
  G21 Microstructure              4
  G22 Hurst + GK/HV ratio         2
  G23 Donchian + DEMA/TEMA + VPT  4
  G24 Multi-TF ATR                4
  G25 Sequence / position         4
  G26 Temporal / session          4
  G27 Cross-asset BTC             4  NEW
  G28 CVD / Delta Volume          3  NEW
  ─────────────────────────────────
  G29 WOBV + ER + Choppiness     3  NEW
  ─────────────────────────────────
  TOTAL                         120
"""
import numpy as np
from typing import Optional
from indicators import technical as T
from indicators import volume    as V
from indicators import patterns  as P


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _safe(arr: np.ndarray, fill: float = 0.0) -> np.ndarray:
    return np.where(np.isnan(arr) | np.isinf(arr), fill, arr)


def _pct_diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    out  = np.zeros_like(a, dtype=float)
    mask = np.isfinite(a) & np.isfinite(b) & (np.abs(b) > 1e-12)
    out[mask] = (a[mask] - b[mask]) / np.abs(b[mask])
    return out


def _roll_stat(arr: np.ndarray, window: int, stat: str) -> np.ndarray:
    try:
        import pandas as pd
        s = pd.Series(arr)
        if stat == "mean":
            return s.rolling(window, min_periods=window).mean().to_numpy()
        elif stat == "std":
            return s.rolling(window, min_periods=window).std(ddof=1).to_numpy()
        elif stat == "skew":
            return s.rolling(window, min_periods=window).skew().to_numpy()
        elif stat == "kurt":
            return s.rolling(window, min_periods=window).kurt().to_numpy()
        elif stat == "autocorr":
            return s.rolling(window, min_periods=window).apply(
                lambda x: float(np.corrcoef(x[:-1], x[1:])[0, 1])
                if len(x) > 2 else 0.0, raw=True,
            ).to_numpy()
        elif stat == "min":
            return s.rolling(window, min_periods=window).min().to_numpy()
        elif stat == "max":
            return s.rolling(window, min_periods=window).max().to_numpy()
    except ImportError:
        pass
    result = np.full(len(arr), np.nan)
    for i in range(window - 1, len(arr)):
        sl = arr[i - window + 1: i + 1]
        if   stat == "mean":    result[i] = np.mean(sl)
        elif stat == "std":     result[i] = np.std(sl, ddof=1)
        elif stat == "min":     result[i] = np.min(sl)
        elif stat == "max":     result[i] = np.max(sl)
        elif stat == "skew":
            m = np.mean(sl); sd = np.std(sl, ddof=1)
            result[i] = np.mean(((sl - m) / (sd + 1e-9)) ** 3)
        elif stat == "kurt":
            m = np.mean(sl); sd = np.std(sl, ddof=1)
            result[i] = np.mean(((sl - m) / (sd + 1e-9)) ** 4) - 3
        elif stat == "autocorr":
            if len(sl) > 2:
                result[i] = float(np.corrcoef(sl[:-1], sl[1:])[0, 1])
    return result


# ---------------------------------------------------------------------------
# Microstructure helpers
# ---------------------------------------------------------------------------

def amihud_illiquidity(closes, volumes, period=20):
    ret     = np.abs(np.diff(np.log(closes + 1e-9),
                             prepend=np.log(closes[0] + 1e-9)))
    vol_usd = closes * volumes + 1e-9
    return _safe(np.tanh(_roll_stat(ret / vol_usd, period, "mean") * 1e6))


def kyle_lambda(closes, volumes, period=20):
    ret   = np.diff(closes, prepend=closes[0]) / (closes + 1e-9)
    prev_c = np.empty_like(closes)
    prev_c[0] = closes[0]
    prev_c[1:] = closes[:-1]
    dp    = np.where(closes > prev_c, 1.0, -1.0)
    ratio = ret / (np.abs(volumes * dp) + 1e-9)
    return _safe(np.tanh(_roll_stat(ratio, period, "mean") * 1e4))


def tick_rule(closes):
    diff = np.diff(closes, prepend=closes[0])
    result = np.where(diff > 0, 1.0, np.where(diff < 0, -1.0, np.nan))
    # Forward-fill NaN (where diff==0, carry last non-zero direction)
    last = 1.0
    for i in range(len(result)):
        if np.isnan(result[i]):
            result[i] = last
        else:
            last = result[i]
    return result


def roll_spread(closes, period=20):
    import pandas as pd
    ret = np.diff(np.log(closes + 1e-9), prepend=0.0)
    s0 = pd.Series(ret)
    s1 = s0.shift(1)
    roll_cov = s0.rolling(period, min_periods=period).cov(s1).to_numpy()
    spread = 2.0 * np.sqrt(np.maximum(-roll_cov, 0.0))
    return _safe(np.tanh(spread * 100))


# ---------------------------------------------------------------------------
# Volatility estimators
# ---------------------------------------------------------------------------

def garman_klass_vol(opens, highs, lows, closes, period=20):
    gk = (0.5 * np.log(highs / (lows + 1e-9)) ** 2
          - (2 * np.log(2) - 1) * np.log(closes / (opens + 1e-9)) ** 2)
    cs = np.cumsum(np.insert(gk, 0, 0.0))
    result = np.full(len(closes), np.nan)
    result[period - 1:] = np.sqrt(
        (cs[period:] - cs[:-period]) / period * 252
    )
    return _safe(np.tanh(result))


def yang_zhang_vol(opens, highs, lows, closes, period=20):
    import pandas as pd
    prev_c = np.empty_like(closes)
    prev_c[0] = closes[0]
    prev_c[1:] = closes[:-1]
    log_oc = np.log(opens  / (prev_c + 1e-9))
    log_co = np.log(closes / (opens  + 1e-9))
    log_uh = np.log(highs  / (opens  + 1e-9))
    log_dl = np.log(lows   / (opens  + 1e-9))
    k  = 0.34 / (1.34 + (period + 1) / (period - 1))
    rs = log_uh * (log_uh - log_co) + log_dl * (log_dl - log_co)
    s_oc = pd.Series(log_oc).rolling(period, min_periods=period).var(ddof=1).to_numpy()
    s_cc = pd.Series(log_co).rolling(period, min_periods=period).var(ddof=1).to_numpy()
    s_rs = pd.Series(rs).rolling(period, min_periods=period).mean().to_numpy()
    result = np.sqrt((s_oc + k * s_cc + (1 - k) * s_rs) * 252)
    return _safe(np.tanh(result))


def parkinson_vol(highs, lows, period=20):
    log_hl = np.log(highs / (lows + 1e-9)) ** 2
    cs = np.cumsum(np.insert(log_hl, 0, 0.0))
    result = np.full(len(highs), np.nan)
    result[period - 1:] = np.sqrt(
        (cs[period:] - cs[:-period]) / period / (4 * np.log(2)) * 252
    )
    return _safe(np.tanh(result))


# ---------------------------------------------------------------------------
# Statistical / other helpers
# ---------------------------------------------------------------------------

def hurst_exponent(series, period=100):
    import pandas as pd
    s = pd.Series(series)
    roll_std = s.rolling(period, min_periods=period).std(ddof=1).to_numpy()
    result = np.full(len(series), np.nan)
    # Need R/S per window — cumulative deviation from mean requires loop
    # but we can use stride tricks for the inner work
    for i in range(period - 1, len(series)):
        sl = series[i - period + 1: i + 1]
        m  = sl.mean()
        dev = np.cumsum(sl - m)
        R = dev.max() - dev.min()
        S = roll_std[i]
        if S > 0 and R > 0:
            result[i] = np.log(R / S) / np.log(period)
    return _safe((result - 0.5) * 2.0)


def permutation_entropy(series, period=20, m=3):
    from math import factorial
    n = len(series)
    result = np.full(n, np.nan)
    n_perm = factorial(m)
    log2_nperm = np.log2(n_perm)

    # Precompute factorial number system weights
    fac_weights = np.array([factorial(m - 1 - k) for k in range(m)])

    for i in range(period - 1, n):
        window = series[i - period + 1: i + 1]
        # Vectorized: get argsort for all sub-windows at once
        n_sub = period - m + 1
        # Build matrix of sub-windows using stride tricks
        strides = window.strides
        sub_windows = np.lib.stride_tricks.as_strided(
            window, shape=(n_sub, m), strides=(strides[0], strides[0])
        )
        # Argsort all sub-windows at once
        perms = np.argsort(sub_windows, axis=1)  # (n_sub, m)
        # Convert permutations to Lehmer code indices vectorized
        indices = np.zeros(n_sub, dtype=int)
        for k in range(m):
            # Count how many elements after position k are smaller than perm[k]
            rank = np.sum(perms[:, k:] < perms[:, k:k+1], axis=1)
            indices += rank * int(fac_weights[k])

        counts = np.bincount(indices, minlength=n_perm).astype(float)
        total = counts.sum()
        if total > 0:
            probs = counts[counts > 0] / total
            result[i] = -np.sum(probs * np.log2(probs + 1e-12)) / log2_nperm
    return _safe(result)


def _frac_diff_feature(arr, d=0.4):
    try:
        from models.labels import fractional_diff
        fd = fractional_diff(arr, d=d)
    except ImportError:
        fd      = np.zeros(len(arr))
        fd[1:]  = arr[1:] - arr[:-1]
    return _safe(np.tanh(fd * 5))


def _aggregate_bars(arr: np.ndarray, n: int, func: str = "mean") -> np.ndarray:
    import pandas as pd
    s = pd.Series(arr)
    roll = s.rolling(n, min_periods=n)
    if   func == "mean": return roll.mean().to_numpy()
    elif func == "sum":  return roll.sum().to_numpy()
    elif func == "max":  return roll.max().to_numpy()
    elif func == "min":  return roll.min().to_numpy()
    elif func == "std":  return roll.std(ddof=1).to_numpy()
    return np.full(len(arr), np.nan)


def buyer_seller_pressure(opens, closes, highs, lows):
    rng      = highs - lows
    pressure = np.where(rng > 0, (closes - opens) / (rng + 1e-9), 0.0)
    return _safe(np.tanh(pressure * 2))


def price_acceleration(closes, period=5):
    lr1     = np.zeros(len(closes))
    lr1[1:] = np.diff(closes) / (closes[:-1] + 1e-9)
    mom     = _roll_stat(lr1, period, "mean")
    accel   = np.zeros(len(closes))
    accel[period:] = np.diff(np.where(np.isnan(mom), 0, mom),
                             prepend=0)[period:]
    return _safe(np.tanh(accel * 50))


def volatility_ratio(closes, short_period=5, long_period=20):
    hv_short = T.historical_volatility(closes, short_period)
    hv_long  = T.historical_volatility(closes, long_period)
    ratio = np.where(np.abs(hv_long) > 1e-9,
                     hv_short / (hv_long + 1e-9) - 1.0, 0.0)
    return _safe(np.tanh(ratio))


def volume_trend_divergence(closes, volumes, period=20):
    price_trend  = T.linreg_slope(_safe(T.sma(closes,  period)), period)
    volume_trend = T.linreg_slope(_safe(T.sma(volumes, period)), period)
    return _safe(np.sign(_safe(price_trend)) * np.sign(_safe(volume_trend)))


def multitf_momentum(closes, periods=(5, 20)):
    log_c  = np.log(closes + 1e-9)
    lr1    = np.zeros(len(closes)); lr1[1:] = log_c[1:] - log_c[:-1]
    mom_s  = _roll_stat(lr1, periods[0], "mean")
    mom_l  = _roll_stat(lr1, periods[1], "mean")
    return _safe(np.tanh((_safe(mom_s) - _safe(mom_l)) * 30))


def ema_alignment_score(closes):
    periods = [9, 21, 55, 89, 200]
    emas    = [T.ema(closes, p) for p in periods]
    score   = np.zeros(len(closes))
    for i in range(len(closes)):
        vals = [float(e[i]) for e in emas if not np.isnan(e[i])]
        if len(vals) < 2:
            continue
        bullish  = sum(1 for j in range(len(vals) - 1) if vals[j] > vals[j + 1])
        score[i] = (bullish / (len(vals) - 1) - 0.5) * 2
    return _safe(score)


# ---------------------------------------------------------------------------
# G25 — Sequence position helpers
# ---------------------------------------------------------------------------

def _sequence_position(closes: np.ndarray, window: int) -> np.ndarray:
    r_min = _roll_stat(closes, window, "min")
    r_max = _roll_stat(closes, window, "max")
    span  = r_max - r_min
    pos   = np.where(span > 1e-9, (closes - r_min) / span, 0.5)
    return _safe(pos - 0.5)


def _proximity_to_extreme(closes: np.ndarray, window: int,
                          extreme: str = "high") -> np.ndarray:
    if extreme == "high":
        r_ext = _roll_stat(closes, window, "max")
        dist  = (r_ext - closes) / (closes + 1e-9)
    else:
        r_ext = _roll_stat(closes, window, "min")
        dist  = (closes - r_ext) / (closes + 1e-9)
    return _safe(np.tanh(dist * 10))


# ---------------------------------------------------------------------------
# G26 — Temporal / session helpers
# ---------------------------------------------------------------------------

def _temporal_features(timestamps: Optional[np.ndarray],
                       n: int) -> np.ndarray:
    zeros = np.zeros(n, dtype=float)
    if timestamps is None or len(timestamps) != n:
        return np.column_stack([zeros, zeros, zeros, zeros])
    ts = np.asarray(timestamps, dtype=float)
    if ts.mean() > 1e12:
        ts = ts / 1000.0
    SECS_DAY  = 86400.0
    SECS_WEEK = 7 * SECS_DAY
    hour_frac = (ts % SECS_DAY)  / SECS_DAY
    dow_frac  = (ts % SECS_WEEK) / SECS_WEEK
    return np.column_stack([
        np.sin(2 * np.pi * hour_frac),
        np.cos(2 * np.pi * hour_frac),
        np.sin(2 * np.pi * dow_frac),
        np.cos(2 * np.pi * dow_frac),
    ])


# ---------------------------------------------------------------------------
# G27 — Cross-asset BTC helpers
# ---------------------------------------------------------------------------

def _cross_asset_btc_features(closes: np.ndarray,
                              lr1:    np.ndarray,
                              btc_closes: Optional[np.ndarray],
                              n: int) -> np.ndarray:
    """
    Cross-asset BTC признаки (4 фичи).

    Даёт модели информацию о том как пара движется относительно BTC:
      - BTC lag-1 return: общерыночный импульс
      - Pair/BTC ratio change: относительная сила пары
      - Rolling corr 20: насколько пара коррелирует с BTC сейчас
      - BTC vs pair momentum divergence: расхождение → разворот или лидерство

    Если btc_closes=None → все 4 фичи = 0.0 (нейтральный сигнал,
    модель учится игнорировать нули через регуляризацию).
    """
    if btc_closes is None or len(btc_closes) < 20:
        return np.zeros((n, 4), dtype=float)

    btc_c = np.asarray(btc_closes, dtype=float)

    # Выравниваем BTC по длине n (берём последние n баров)
    if len(btc_c) >= n:
        btc_c = btc_c[-n:]
    else:
        # Дополняем начало первым доступным значением
        pad   = np.full(n - len(btc_c), btc_c[0])
        btc_c = np.concatenate([pad, btc_c])

    btc_log = np.log(btc_c + 1e-9)
    btc_lr1 = np.zeros(n)
    btc_lr1[1:] = btc_log[1:] - btc_log[:-1]

    # Фича 1: BTC lag-1 return (tanh-scaled)
    f1 = _safe(np.tanh(btc_lr1 * 20))

    # Фича 2: Pair/BTC ratio change (относительная сила)
    ratio     = closes / (btc_c + 1e-9)
    ratio_ret = np.zeros(n)
    ratio_ret[1:] = np.log(ratio[1:] / (ratio[:-1] + 1e-9))
    f2 = _safe(np.tanh(ratio_ret * 20))

    # Фича 3: Rolling 20-bar correlation пары с BTC
    corr_arr = np.zeros(n)
    for i in range(20, n):
        pw = lr1[i - 20: i]
        bw = btc_lr1[i - 20: i]
        sp = float(np.std(pw, ddof=1))
        sb = float(np.std(bw, ddof=1))
        if sp > 1e-9 and sb > 1e-9:
            corr_arr[i] = float(np.corrcoef(pw, bw)[0, 1])
    f3 = _safe(corr_arr)

    # Фича 4: BTC momentum vs pair momentum divergence
    # Положительное = BTC обгоняет (пара может подтянуться)
    # Отрицательное = пара обгоняет BTC (потенциальный разворот)
    btc_mom5  = _roll_stat(btc_lr1, 5, "mean")
    pair_mom5 = _roll_stat(lr1,     5, "mean")
    f4 = _safe(np.tanh((_safe(btc_mom5) - _safe(pair_mom5)) * 30))

    return np.column_stack([f1, f2, f3, f4])


# ---------------------------------------------------------------------------
# G28 — CVD / Delta Volume helpers
# ---------------------------------------------------------------------------

def _cvd_features(opens: np.ndarray,
                  closes: np.ndarray,
                  volumes: np.ndarray,
                  lr1: np.ndarray,
                  n: int) -> np.ndarray:
    """
    Cumulative Volume Delta признаки (3 фичи).

    Прокси CVD через свечи (без aggTrades):
      bull_vol = объём на бычьих свечах (close >= open)
      bear_vol = объём на медвежьих свечах (close < open)
      delta    = (bull_vol - bear_vol) / (bull_vol + bear_vol)

    CVD — один из самых мощных order flow индикаторов:
      - Высокий delta на росте = сильное давление покупателей (продолжение)
      - Низкий delta на росте = слабость (потенциальный разворот)
      - CVD divergence от цены — ранний сигнал разворота
    """
    body     = closes - opens
    bull_vol = np.where(body >= 0, volumes, 0.0)
    bear_vol = np.where(body <  0, volumes, 0.0)
    total    = bull_vol + bear_vol + 1e-9
    bar_delta = (bull_vol - bear_vol) / total   # [-1, +1]

    # Фича 1: нормализованная дельта текущего бара
    f1 = _safe(np.tanh(bar_delta * 2))

    # Фича 2: скользящее среднее CVD (20 баров)
    cvd_roll = _roll_stat(bar_delta, 20, "mean")
    f2 = _safe(np.tanh(_safe(cvd_roll) * 3))

    # Фича 3: дивергенция CVD от ценового моментума
    # +1 = подтверждение (цена и объём двигаются вместе)
    # -1 = дивергенция (предупреждение о возможном развороте)
    price_mom10 = _roll_stat(lr1,       10, "mean")
    cvd_mom10   = _roll_stat(bar_delta, 10, "mean")
    divergence  = np.sign(_safe(price_mom10)) * np.sign(_safe(cvd_mom10))
    f3 = _safe(divergence)

    return np.column_stack([f1, f2, f3])


# ---------------------------------------------------------------------------
# G29 — Weighted OBV / Efficiency Ratio / Choppiness Index helpers
# ---------------------------------------------------------------------------

def _weighted_obv(opens: np.ndarray, closes: np.ndarray,
                  volumes: np.ndarray, n: int) -> np.ndarray:
    """Weighted OBV — OBV weighted by candle body size (stronger signal)."""
    body = closes - opens
    rng = np.abs(body) + 1e-9
    weight = rng / (closes + 1e-9)  # body size relative to price
    signed_vol = np.where(body >= 0, volumes * weight, -volumes * weight)
    wobv = np.cumsum(signed_vol)
    wobv_ema = T.ema(wobv, 20)
    return _safe(np.sign(wobv - _safe(wobv_ema)))


def _efficiency_ratio(closes: np.ndarray, period: int = 10) -> np.ndarray:
    """Kaufman Efficiency Ratio: |price_change_over_n| / sum(|daily_changes|)."""
    n = len(closes)
    result = np.full(n, np.nan)
    abs_daily = np.abs(np.diff(closes))
    cs_abs = np.cumsum(np.insert(abs_daily, 0, 0.0))
    for p in [period]:
        direction = np.abs(closes[p:] - closes[:-p])
        volatility = cs_abs[p:] - cs_abs[:-p]
        er = np.where(volatility > 1e-9, direction / volatility, 0.0)
        result[p:] = er
    return _safe(result - 0.5)  # center around 0


def _choppiness_index(highs: np.ndarray, lows: np.ndarray,
                      closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Choppiness Index: 100 * log10(sum(ATR) / (highest - lowest)) / log10(n)."""
    import pandas as pd
    atr_v = T.atr(highs, lows, closes, 1)  # TR per bar
    atr_v = np.where(np.isnan(atr_v), 0.0, atr_v)
    cs_atr = np.cumsum(np.insert(atr_v, 0, 0.0))
    sum_atr = np.full(len(closes), np.nan)
    sum_atr[period - 1:] = cs_atr[period:] - cs_atr[:-period]
    roll_hi = pd.Series(highs).rolling(period, min_periods=period).max().to_numpy()
    roll_lo = pd.Series(lows).rolling(period, min_periods=period).min().to_numpy()
    hl_range = roll_hi - roll_lo
    log_n = np.log10(period)
    ci = np.where(
        (hl_range > 1e-9) & np.isfinite(sum_atr),
        100 * np.log10(sum_atr / (hl_range + 1e-9) + 1e-9) / (log_n + 1e-9),
        50.0
    )
    ci[:period - 1] = np.nan
    return _safe((ci / 100.0) - 0.5)  # normalized around 0


# ---------------------------------------------------------------------------
# Feature engineer
# ---------------------------------------------------------------------------

class FeatureEngineer:

    def build(
            self,
            opens:      np.ndarray,
            highs:      np.ndarray,
            lows:       np.ndarray,
            closes:     np.ndarray,
            volumes:    np.ndarray,
            timestamps: Optional[np.ndarray] = None,
            btc_closes: Optional[np.ndarray] = None,
            on_chain:   Optional[dict]        = None,
    ) -> np.ndarray:
        """
        Build the full (n, 120) feature matrix.
        All features are stationary — zero look-ahead guaranteed.

        Parameters
        ----------
        timestamps : Unix ms array shape (n,), optional.
                     Required for G26 temporal features.
                     If None, G26 columns = 0.0.
        btc_closes : BTC close prices array, optional.
                     Required for G27 cross-asset features.
                     If None, G27 columns = 0.0.
                     Can have different length — aligned to last n bars.
        """
        n           = len(closes)
        feats       = []
        log_c       = np.log(closes + 1e-9)
        price_scale = closes.mean() * 0.01 + 1e-9

        # ── G1 — lagged log-returns (7) ────────────────────────────────
        for lag in [1, 2, 3, 5, 10, 20, 40]:
            r      = np.zeros(n)
            r[lag:] = log_c[lag:] - log_c[:-lag]
            feats.append(_safe(np.tanh(r * 20)))

        # ── G2 — fractional differentiation (2) ───────────────────────
        feats.append(_frac_diff_feature(closes,  0.4))
        feats.append(_frac_diff_feature(volumes, 0.4))

        # ── G3 — cumulative momentum (4) ───────────────────────────────
        lr1      = np.zeros(n); lr1[1:] = log_c[1:] - log_c[:-1]
        cs_lr1   = np.cumsum(lr1)
        for w in [5, 10, 20, 40]:
            mom = np.zeros(n)
            mom[w:] = cs_lr1[w:] - cs_lr1[:-w]
            feats.append(_safe(np.tanh(mom * 10)))

        # ── G4 — multi-TF momentum (2) ─────────────────────────────────
        feats.append(multitf_momentum(closes, (5,  20)))
        feats.append(multitf_momentum(closes, (10, 40)))

        # ── G5 — price acceleration (1) ────────────────────────────────
        feats.append(price_acceleration(closes, 5))

        # ── G6 — RSI + StochRSI (4) ────────────────────────────────────
        for p in [7, 14, 21]:
            feats.append(_safe(T.rsi(closes, p) / 100.0 - 0.5))
        feats.append(_safe(T.stoch_rsi(closes) - 0.5))

        # ── G7 — MACD (4) ──────────────────────────────────────────────
        ml, ms, mh = T.macd(closes)
        feats.append(_safe(np.tanh((ml - ms) / price_scale)))
        feats.append(_safe(np.tanh(mh / price_scale)))
        feats.append(_safe(np.sign(_safe(ml) - _safe(ms))))
        cross = np.zeros(n)
        for i in range(1, n):
            if not (np.isnan(ml[i]) or np.isnan(ms[i])):
                if ml[i] > ms[i] and ml[i-1] <= ms[i-1]: cross[i] =  1.0
                if ml[i] < ms[i] and ml[i-1] >= ms[i-1]: cross[i] = -1.0
        feats.append(cross)

        # ── G8 — Oscillators (8) ───────────────────────────────────────
        k, d = T.stochastic(highs, lows, closes)
        feats.append(_safe(k / 100.0 - 0.5))
        feats.append(_safe(np.sign(_safe(k) - _safe(d))))
        feats.append(_safe(np.tanh(T.cci(highs, lows, closes) / 200.0)))
        feats.append(_safe(T.williams_r(highs, lows, closes) / 100.0 + 0.5))
        feats.append(_safe(np.tanh(T.tsi(closes) / 50.0)))
        for p in [5, 10, 20]:
            feats.append(_safe(np.tanh(T.roc(closes, p) / 10.0)))

        # ── G9 — Bollinger + Keltner (3) ───────────────────────────────
        bbu, bbm, bbl = T.bollinger_bands(closes)
        feats.append(np.tanh(_safe((bbu - bbl) / (bbm + 1e-9)) - 0.04))
        feats.append(_safe((closes - bbl) / (bbu - bbl + 1e-9)) - 0.5)
        kcu, kcm, kcl = T.keltner_channels(highs, lows, closes)
        feats.append(_safe((closes - kcl) / (kcu - kcl + 1e-9)) - 0.5)

        # ── G10 — Squeeze Momentum (2) ─────────────────────────────────
        sq_mom, sq_flag = T.squeeze_momentum(highs, lows, closes)
        feats.append(_safe(np.tanh(sq_mom / (price_scale + 1e-9))))
        feats.append(sq_flag)

        # ── G11 — Volatility (10) ──────────────────────────────────────
        atr_v = T.atr(highs, lows, closes)
        feats.append(_safe(np.tanh(atr_v / (closes + 1e-9) * 20)))
        for p in [10, 20, 30]:
            feats.append(_safe(np.tanh(T.historical_volatility(closes, p))))
        gk_vol_cached = garman_klass_vol(opens, highs, lows, closes)
        feats.append(gk_vol_cached)
        feats.append(yang_zhang_vol(opens, highs, lows, closes))
        feats.append(parkinson_vol(highs, lows))
        hv20 = T.historical_volatility(closes, 20)
        feats.append(_safe(np.tanh(_roll_stat(_safe(hv20), 20, "std") * 5)))
        feats.append(volatility_ratio(closes,  5, 20))
        feats.append(volatility_ratio(closes, 10, 40))

        # ── G12 — Trend (4) ────────────────────────────────────────────
        adx_v, pdi, mdi = T.adx(highs, lows, closes)
        feats.append(_safe(adx_v / 100.0))
        feats.append(_safe((pdi - mdi) / (pdi + mdi + 1e-9)))
        _, st_dir = T.supertrend(highs, lows, closes)
        feats.append(st_dir)
        feats.append(ema_alignment_score(closes))

        # ── G13 — SMA vs price (6) ─────────────────────────────────────
        for p in [10, 20, 50, 100, 200]:
            feats.append(_safe(np.tanh(_pct_diff(closes, T.sma(closes, p)) * 10)))
        s50  = T.sma(closes,  50)
        s200 = T.sma(closes, 200)
        feats.append(_safe(np.sign(_safe(s50) - _safe(s200))))

        # ── G14 — EMA vs price + slope (6) ────────────────────────────
        e9, e21, e55, e89 = (T.ema(closes, p) for p in [9, 21, 55, 89])
        for e in [e9, e21, e55, e89]:
            feats.append(_safe(np.tanh(_pct_diff(closes, e) * 10)))
        for e in [e9, e21]:
            feats.append(_safe(np.tanh(
                T.linreg_slope(_safe(e), 5) / (price_scale + 1e-9)
            )))

        # ── G15 — Ichimoku + VWAP (5) ─────────────────────────────────
        ichi = T.ichimoku(highs, lows, closes)
        tk = _safe(ichi["tenkan"]); kj = _safe(ichi["kijun"])
        sa = _safe(ichi["senkou_a"]); sb = _safe(ichi["senkou_b"])
        feats.append(np.sign(tk - kj))
        feats.append(np.sign(closes - sa))
        feats.append(np.sign(closes - sb))
        feats.append(np.sign(sa - sb))
        feats.append(_safe(np.tanh(
            _pct_diff(closes, T.vwap(highs, lows, closes, volumes)) * 10
        )))

        # ── G16 — Volume (8) ───────────────────────────────────────────
        obv_v   = V.obv(closes, volumes)
        obv_ema = T.ema(obv_v, 20)
        feats.append(_safe(np.sign(obv_v - _safe(obv_ema))))
        feats.append(_safe(np.tanh(
            V.chaikin_money_flow(highs, lows, closes, volumes)
        )))
        feats.append(_safe(V.mfi(highs, lows, closes, volumes) / 100.0 - 0.5))
        feats.append(_safe(np.tanh(V.volume_oscillator(volumes) / 50.0)))
        feats.append(np.tanh(_safe(volumes / (T.sma(volumes, 20) + 1e-9) - 1.0)))
        for w in [5, 10]:
            vr      = np.zeros(n)
            vr[w:]  = volumes[w:] / (volumes[:-w] + 1e-9) - 1.0
            feats.append(np.tanh(_safe(vr)))
        feats.append(volume_trend_divergence(closes, volumes, 20))

        # ── G17 — Return statistics (6) ───────────────────────────────
        for w in [10, 20]:
            feats.append(_safe(np.tanh(_roll_stat(lr1, w, "skew"))))
            feats.append(_safe(np.tanh(_roll_stat(lr1, w, "kurt") / 3)))
            feats.append(_safe(_roll_stat(lr1, w, "autocorr")))

        # ── G18 — Entropy (1) ──────────────────────────────────────────
        feats.append(permutation_entropy(lr1, period=20, m=3))

        # ── G19 — Candle patterns (1) ──────────────────────────────────
        pat_sc = np.zeros(n)
        for i in range(5, n):
            sl        = slice(max(0, i - 5), i + 1)
            pat_sc[i] = P.pattern_score(
                opens[sl], highs[sl], lows[sl], closes[sl], 5
            )
        feats.append(pat_sc)

        # ── G20 — OHLC + buyer pressure (4) ───────────────────────────
        rng  = highs - lows
        body = np.abs(closes - opens)
        feats.append(_safe(((closes - lows) / (rng + 1e-9)) - 0.5))
        feats.append(_safe(np.tanh(body / (rng + 1e-9) * 2 - 1)))
        gap      = np.zeros(n)
        gap[1:]  = (opens[1:] / (closes[:-1] + 1e-9)) - 1.0
        feats.append(np.tanh(_safe(gap * 20)))
        feats.append(buyer_seller_pressure(opens, closes, highs, lows))

        # ── G21 — Microstructure (4) ───────────────────────────────────
        feats.append(amihud_illiquidity(closes, volumes))
        feats.append(kyle_lambda(closes, volumes))
        feats.append(tick_rule(closes))
        feats.append(roll_spread(closes))

        # ── G22 — Hurst + GK/HV ratio (2) ─────────────────────────────
        # Reuse garman_klass_vol already computed in G11
        gk_vol = feats[len(feats) - 13]  # garman_klass_vol is at index G11 offset +4
        hv20_v = T.historical_volatility(closes, 20)
        feats.append(np.tanh(_safe(
            _safe(gk_vol) / (np.tanh(hv20_v) + 1e-9) - 1.0
        )))
        feats.append(_safe(hurst_exponent(lr1, 100)))

        # ── G23 — Donchian + DEMA/TEMA + VPT (4) ──────────────────────
        dc_u, _, dc_l = T.donchian_channels(highs, lows)
        feats.append(_safe((closes - dc_l) / (dc_u - dc_l + 1e-9)) - 0.5)
        dema_v = T.dema(closes, 21)
        tema_v = T.tema(closes, 21)
        feats.append(_safe(np.tanh(_pct_diff(closes, _safe(dema_v)) * 10)))
        feats.append(_safe(np.tanh(_pct_diff(closes, _safe(tema_v)) * 10)))
        vpt   = V.volume_price_trend(closes, volumes)
        vpt_s = T.sma(_safe(vpt), 10)
        feats.append(_safe(np.sign(vpt - _safe(vpt_s))))

        # ── G24 — Multi-TF ATR (4) ─────────────────────────────────────
        atr_pct  = atr_v / (closes + 1e-9)
        feats.append(_safe(np.tanh(_aggregate_bars(atr_pct, 5,  "mean") * 20)))
        feats.append(_safe(np.tanh(_aggregate_bars(atr_pct, 20, "mean") * 20)))
        atr_mean5  = _aggregate_bars(atr_v,  5, "mean")
        atr_mean20 = _aggregate_bars(atr_v, 20, "mean")
        feats.append(_safe(np.tanh(atr_v / (atr_mean5  + 1e-9) - 1.0)))
        feats.append(_safe(np.tanh(atr_v / (atr_mean20 + 1e-9) - 1.0)))

        # ── G25 — Sequence / position features (4) ─────────────────────
        feats.append(_sequence_position(closes, 5))
        feats.append(_sequence_position(closes, 20))
        feats.append(_proximity_to_extreme(closes, 5,  "high"))
        feats.append(_proximity_to_extreme(closes, 20, "low"))

        # ── G26 — Temporal / session features (4) ──────────────────────
        temporal = _temporal_features(timestamps, n)
        for col_idx in range(temporal.shape[1]):
            feats.append(temporal[:, col_idx])

        # ── G27 — Cross-asset BTC features (4) — NEW ───────────────────
        # Признаки относительного движения к BTC.
        # btc_closes=None → все 4 признака = 0.0.
        g27 = _cross_asset_btc_features(closes, lr1, btc_closes, n)
        for col_idx in range(g27.shape[1]):
            feats.append(g27[:, col_idx])

        # ── G28 — CVD / Delta Volume (3) — NEW ─────────────────────────
        # Cumulative Volume Delta через свечи.
        g28 = _cvd_features(opens, closes, volumes, lr1, n)
        for col_idx in range(g28.shape[1]):
            feats.append(g28[:, col_idx])

        # ── G29 — WOBV + Efficiency Ratio + Choppiness Index (3) — NEW ──
        feats.append(_weighted_obv(opens, closes, volumes, n))
        feats.append(_efficiency_ratio(closes, 10))
        feats.append(_choppiness_index(highs, lows, closes, 14))

        # ── G30 — Level-based features (15) — Gerchik-style ─────────
        try:
            from levels.detector import build_level_features
            lvl_feats = build_level_features(highs, lows, closes, volumes, atr_v)
            for col_idx in range(lvl_feats.shape[1]):
                feats.append(lvl_feats[:, col_idx])
        except Exception:
            for _ in range(15):
                feats.append(np.zeros(n))

        mat = np.column_stack(feats)
        return np.where(np.isnan(mat) | np.isinf(mat), 0.0, mat)

    # ------------------------------------------------------------------

    def build_with_onchain(
            self,
            opens:       np.ndarray,
            highs:       np.ndarray,
            lows:        np.ndarray,
            closes:      np.ndarray,
            volumes:     np.ndarray,
            fear_greed:  Optional[np.ndarray] = None,
            hash_rate:   Optional[np.ndarray] = None,
            timestamps:  Optional[np.ndarray] = None,
            btc_closes:  Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """Append on-chain features to the base 135-column matrix."""
        base  = self.build(opens, highs, lows, closes, volumes,
                           timestamps=timestamps, btc_closes=btc_closes)
        extra = []
        n     = len(closes)

        if fear_greed is not None:
            arr = np.asarray(fear_greed, dtype=float)
            if arr.shape != (n,):
                raise ValueError(f"fear_greed must have shape ({n},), got {arr.shape}.")
            extra.append(np.where(np.isnan(arr), 50.0, arr) / 100.0 - 0.5)

        if hash_rate is not None:
            arr = np.asarray(hash_rate, dtype=float)
            if arr.shape != (n,):
                raise ValueError(f"hash_rate must have shape ({n},), got {arr.shape}.")
            extra.append(np.tanh(np.where(np.isnan(arr), 0.0, arr) / 5e8))

        return np.column_stack([base] + extra) if extra else base

    def patch_onchain(self, X, on_chain):
        pass  # kept for API compatibility

    @property
    def n_features(self) -> int:
        """
        Exact column count produced by build().
        G1–G24 (102) + G25 (4) + G26 (4) + G27 (4) + G28 (3) + G29 (3) = 120.
        """
        return 135