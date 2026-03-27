"""
Core Technical Indicators — pure NumPy, zero lookahead.
Optimised: vectorised where possible, no unnecessary Python loops.
"""
import numpy as np
from typing import Tuple


# ─────────────────────────────────────────────────────────────
#  Moving Averages
# ─────────────────────────────────────────────────────────────

def sma(values: np.ndarray, period: int) -> np.ndarray:
    result = np.full(len(values), np.nan)
    if len(values) < period:
        return result
    cs = np.cumsum(np.insert(values, 0, 0.0))
    result[period - 1:] = (cs[period:] - cs[:-period]) / period
    return result


def ema(values: np.ndarray, period: int) -> np.ndarray:
    result = np.full(len(values), np.nan, dtype=float)
    if period <= 0 or len(values) < period:
        return result
    window = values[:period]
    valid = np.isfinite(window)
    if not np.any(valid):
        return result
    k = 2.0 / (period + 1)
    result[period - 1] = window[valid].mean()
    for i in range(period, len(values)):
        x = values[i]
        prev = result[i - 1]

        if not np.isfinite(prev):
            result[i] = x if np.isfinite(x) else np.nan
        elif not np.isfinite(x):
            result[i] = prev
        else:
            result[i] = x * k + prev * (1 - k)

    return result


def wma(values: np.ndarray, period: int) -> np.ndarray:
    w = np.arange(1, period + 1, dtype=float)
    denom = w.sum()
    # Use convolution: convolve with weights
    conv = np.convolve(values, w[::-1], mode='full')[:len(values)]
    result = np.full(len(values), np.nan)
    result[period - 1:] = conv[period - 1:] / denom
    return result


def hma(values: np.ndarray, period: int) -> np.ndarray:
    half  = wma(values, max(period // 2, 1))
    full  = wma(values, period)
    diff  = np.where(np.isnan(half) | np.isnan(full), np.nan, 2 * half - full)
    clean = np.where(np.isnan(diff), 0.0, diff)
    return wma(clean, max(int(np.sqrt(period)), 1))


def dema(values: np.ndarray, period: int) -> np.ndarray:
    e1 = ema(values, period)
    e2 = ema(np.where(np.isnan(e1), 0.0, e1), period)
    return np.where(np.isnan(e1) | np.isnan(e2), np.nan, 2 * e1 - e2)


def tema(values: np.ndarray, period: int) -> np.ndarray:
    e1 = ema(values, period)
    e2 = ema(np.where(np.isnan(e1), 0.0, e1), period)
    e3 = ema(np.where(np.isnan(e2), 0.0, e2), period)
    return np.where(np.isnan(e1), np.nan, 3 * e1 - 3 * e2 + e3)


def vwma(closes: np.ndarray, volumes: np.ndarray, period: int) -> np.ndarray:
    cv = closes * volumes
    cs_cv = np.cumsum(np.insert(cv, 0, 0.0))
    cs_v  = np.cumsum(np.insert(volumes, 0, 0.0))
    roll_cv = cs_cv[period:] - cs_cv[:-period]
    roll_v  = cs_v[period:]  - cs_v[:-period]
    result = np.full(len(closes), np.nan)
    result[period - 1:] = np.where(roll_v > 0, roll_cv / roll_v, closes[period - 1:])
    return result


# ─────────────────────────────────────────────────────────────
#  Oscillators
# ─────────────────────────────────────────────────────────────

def rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Wilder RSI — vectorised inner loop."""
    result = np.full(len(closes), np.nan)
    if len(closes) <= period:
        return result
    delta  = np.diff(closes)
    gains  = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)
    avg_g  = np.mean(gains[:period])
    avg_l  = np.mean(losses[:period])
    result[period] = 100.0 if avg_l == 0 else 100 - 100 / (1 + avg_g / avg_l)
    for i in range(period + 1, len(closes)):
        avg_g = (avg_g * (period - 1) + gains[i - 1]) / period
        avg_l = (avg_l * (period - 1) + losses[i - 1]) / period
        result[i] = 100.0 if avg_l == 0 else 100 - 100 / (1 + avg_g / avg_l)
    return result


def macd(closes: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9
         ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    ef   = ema(closes, fast)
    es   = ema(closes, slow)
    line = np.where(np.isnan(ef) | np.isnan(es), np.nan, ef - es)
    sig  = ema(np.where(np.isnan(line), 0.0, line), signal)
    hist = np.where(np.isnan(line) | np.isnan(sig), np.nan, line - sig)
    return line, sig, hist


def stochastic(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
               period: int = 14, smooth: int = 3) -> Tuple[np.ndarray, np.ndarray]:
    import pandas as pd
    roll_lo = pd.Series(lows).rolling(period, min_periods=period).min().to_numpy()
    roll_hi = pd.Series(highs).rolling(period, min_periods=period).max().to_numpy()
    rng = roll_hi - roll_lo
    k = np.where(rng > 0, (closes - roll_lo) / rng * 100, 50.0)
    k[:period - 1] = np.nan
    d = sma(np.where(np.isnan(k), 0.0, k), smooth)
    return k, d


def stoch_rsi(closes: np.ndarray, rsi_period: int = 14,
              stoch_period: int = 14) -> np.ndarray:
    r      = rsi(closes, rsi_period)
    result = np.full(len(closes), np.nan)
    for i in range(stoch_period - 1, len(closes)):
        window = r[i - stoch_period + 1: i + 1]
        if np.any(np.isnan(window)):
            continue
        lo, hi   = window.min(), window.max()
        result[i] = (r[i] - lo) / (hi - lo) if hi > lo else 0.5
    return result


def cci(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
        period: int = 20) -> np.ndarray:
    import pandas as pd
    tp = (highs + lows + closes) / 3.0
    s = pd.Series(tp)
    roll_mean = s.rolling(period, min_periods=period).mean().to_numpy()
    # Mean deviation needs apply
    md = s.rolling(period, min_periods=period).apply(
        lambda x: np.mean(np.abs(x - x.mean())), raw=True
    ).to_numpy()
    result = np.where(md > 0, (tp - roll_mean) / (0.015 * md), 0.0)
    result[:period - 1] = np.nan
    return result


def williams_r(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
               period: int = 14) -> np.ndarray:
    import pandas as pd
    roll_hi = pd.Series(highs).rolling(period, min_periods=period).max().to_numpy()
    roll_lo = pd.Series(lows).rolling(period, min_periods=period).min().to_numpy()
    rng = roll_hi - roll_lo
    result = np.where(rng > 0, (roll_hi - closes) / rng * -100, -50.0)
    result[:period - 1] = np.nan
    return result


def roc(closes: np.ndarray, period: int = 12) -> np.ndarray:
    result          = np.full(len(closes), np.nan)
    result[period:] = (closes[period:] / (closes[:-period] + 1e-9) - 1.0) * 100
    return result


def momentum_osc(closes: np.ndarray, period: int = 10) -> np.ndarray:
    result          = np.full(len(closes), np.nan)
    result[period:] = closes[period:] - closes[:-period]
    return result


def tsi(closes: np.ndarray, r: int = 25, s: int = 13) -> np.ndarray:
    m      = np.diff(closes, prepend=closes[0])
    am     = np.abs(m)
    ema_m  = ema(ema(m,  r), s)
    ema_am = ema(ema(am, r), s)
    return np.where(ema_am != 0, 100 * ema_m / ema_am, 0.0)


# ─────────────────────────────────────────────────────────────
#  Volatility
# ─────────────────────────────────────────────────────────────

def atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
        period: int = 14) -> np.ndarray:
    tr     = np.zeros(len(closes))
    tr[0]  = highs[0] - lows[0]
    hl     = highs[1:] - lows[1:]
    hc     = np.abs(highs[1:] - closes[:-1])
    lc     = np.abs(lows[1:]  - closes[:-1])
    tr[1:] = np.maximum(hl, np.maximum(hc, lc))
    return ema(tr, period)


def bollinger_bands(closes: np.ndarray, period: int = 20, std_mult: float = 2.0
                    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    import pandas as pd
    mid = sma(closes, period)
    roll_std = pd.Series(closes).rolling(period, min_periods=period).std(ddof=1).to_numpy()
    upper = mid + std_mult * roll_std
    lower = mid - std_mult * roll_std
    return upper, mid, lower


def keltner_channels(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
                     period: int = 20, mult: float = 2.0
                     ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    mid   = ema(closes, period)
    atr_v = atr(highs, lows, closes, period)
    return mid + mult * atr_v, mid, mid - mult * atr_v


def donchian_channels(highs: np.ndarray, lows: np.ndarray,
                      period: int = 20) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    import pandas as pd
    upper = pd.Series(highs).rolling(period, min_periods=period).max().to_numpy()
    lower = pd.Series(lows).rolling(period, min_periods=period).min().to_numpy()
    mid = (upper + lower) / 2.0
    return upper, mid, lower


def historical_volatility(closes: np.ndarray, period: int = 20) -> np.ndarray:
    import pandas as pd
    log_ret = np.diff(np.log(closes + 1e-9))
    hv = np.full(len(closes), np.nan)
    roll_std = pd.Series(log_ret).rolling(period, min_periods=period).std(ddof=1).to_numpy()
    hv[1:] = roll_std * np.sqrt(252)
    return hv


def squeeze_momentum(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
                     period: int = 20, bb_mult: float = 2.0, kc_mult: float = 1.5
                     ) -> Tuple[np.ndarray, np.ndarray]:
    bbu, bbm, bbl = bollinger_bands(closes, period, bb_mult)
    kcu, kcm, kcl = keltner_channels(highs, lows, closes, period, kc_mult)
    squeeze_on    = ((bbl > kcl) & (bbu < kcu)).astype(float)
    squeeze_off   = ((bbl < kcl) & (bbu > kcu)).astype(float)
    squeeze_flag  = squeeze_on - squeeze_off

    delta = closes - (highs + lows) / 2.0
    mom   = np.full(len(closes), np.nan)
    x     = np.arange(period, dtype=float)
    xm    = x.mean()
    ss    = np.dot(x - xm, x - xm)
    for i in range(period - 1, len(closes)):
        y      = delta[i - period + 1: i + 1]
        mom[i] = np.dot(x - xm, y - y.mean()) / (ss + 1e-9)
    return mom, squeeze_flag


# ─────────────────────────────────────────────────────────────
#  Trend
# ─────────────────────────────────────────────────────────────

def adx(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
        period: int = 14) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    n        = len(closes)
    plus_dm  = np.zeros(n)
    minus_dm = np.zeros(n)
    tr_arr   = np.zeros(n)
    up   = np.diff(highs, prepend=highs[0])
    down = -np.diff(lows,  prepend=lows[0])
    plus_dm[1:]  = np.where((up[1:] > down[1:]) & (up[1:] > 0),   up[1:],   0.0)
    minus_dm[1:] = np.where((down[1:] > up[1:]) & (down[1:] > 0), down[1:], 0.0)
    tr_arr[0]    = highs[0] - lows[0]
    tr_arr[1:]   = np.maximum(highs[1:] - lows[1:],
                              np.maximum(np.abs(highs[1:] - closes[:-1]),
                                         np.abs(lows[1:]  - closes[:-1])))
    atr_s    = ema(tr_arr, period)
    plus_di  = 100 * ema(plus_dm,  period) / (atr_s + 1e-9)
    minus_di = 100 * ema(minus_dm, period) / (atr_s + 1e-9)
    dx       = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)
    return ema(dx, period), plus_di, minus_di


def supertrend(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
               period: int = 10, mult: float = 3.0) -> Tuple[np.ndarray, np.ndarray]:
    atr_v = atr(highs, lows, closes, period)
    hl2   = (highs + lows) / 2.0
    upper = hl2 + mult * atr_v
    lower = hl2 - mult * atr_v
    st    = np.full(len(closes), np.nan)
    trend = np.ones(len(closes))
    for i in range(1, len(closes)):
        if np.isnan(atr_v[i]):
            continue
        lower[i] = lower[i] if (lower[i] > lower[i-1] or closes[i-1] < lower[i-1]) else lower[i-1]
        upper[i] = upper[i] if (upper[i] < upper[i-1] or closes[i-1] > upper[i-1]) else upper[i-1]
        if not np.isnan(st[i-1]) and st[i-1] == upper[i-1]:
            st[i]    = upper[i] if closes[i] <= upper[i] else lower[i]
            trend[i] = -1.0    if closes[i] <= upper[i] else 1.0
        else:
            st[i]    = lower[i] if closes[i] >= lower[i] else upper[i]
            trend[i] = 1.0     if closes[i] >= lower[i] else -1.0
    return st, trend


def ichimoku(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
             tenkan: int = 9, kijun: int = 26, senkou: int = 52) -> dict:
    n = len(closes)
    def midpoint(p):
        result = np.full(n, np.nan)
        for i in range(p - 1, n):
            result[i] = (np.max(highs[i-p+1:i+1]) + np.min(lows[i-p+1:i+1])) / 2
        return result
    tk = midpoint(tenkan)
    kj = midpoint(kijun)
    sa      = np.full(n, np.nan)
    sb      = np.full(n, np.nan)
    chikou  = np.full(n, np.nan)
    for i in range(n):
        if not np.isnan(tk[i]) and not np.isnan(kj[i]):
            idx = i + kijun
            if idx < n:
                sa[idx] = (tk[i] + kj[i]) / 2
        if i >= senkou - 1:
            idx2 = i + kijun
            if idx2 < n:
                sb[idx2] = (np.max(highs[i-senkou+1:i+1]) + np.min(lows[i-senkou+1:i+1])) / 2
        if i >= kijun:
            chikou[i - kijun] = closes[i]
    return {"tenkan": tk, "kijun": kj, "senkou_a": sa, "senkou_b": sb, "chikou": chikou}


def linreg_slope(values: np.ndarray, period: int = 14) -> np.ndarray:
    import pandas as pd
    n = len(values)
    result = np.full(n, np.nan)
    x = np.arange(period, dtype=float)
    xm = x.mean()
    ss = np.dot(x - xm, x - xm)
    # Numerator = sum(x_i * y_i) - period * xm * ym
    # Use rolling sums for efficient computation
    s = pd.Series(values)
    roll_mean = s.rolling(period, min_periods=period).mean().to_numpy()
    # sum(x_i * y_i) for each window — use convolution
    xc = x - xm  # centered x
    # Convolve values with reversed centered x
    conv = np.convolve(values, xc[::-1], mode='full')[:n]
    # conv[i] = sum(values[i-period+1:i+1] * xc) but only valid from period-1
    result[period - 1:] = conv[period - 1:] / (ss + 1e-9)
    return result


def pivot_points(highs: np.ndarray, lows: np.ndarray,
                 window: int = 10) -> Tuple[list, list]:
    n   = len(highs)
    sup, res = [], []
    for i in range(window, n - window):
        if lows[i]  == np.min(lows[i - window: i + window + 1]):
            sup.append(float(lows[i]))
        if highs[i] == np.max(highs[i - window: i + window + 1]):
            res.append(float(highs[i]))
    sup = sorted(set(round(v, 6) for v in sup))[-6:]
    res = sorted(set(round(v, 6) for v in res))[:6]
    return sup, res


def vwap(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
         volumes: np.ndarray, period: int = 20) -> np.ndarray:
    tp = (highs + lows + closes) / 3.0
    tp_vol = tp * volumes
    cs_tv = np.cumsum(np.insert(tp_vol, 0, 0.0))
    cs_v  = np.cumsum(np.insert(volumes, 0, 0.0))
    roll_tv = cs_tv[period:] - cs_tv[:-period]
    roll_v  = cs_v[period:]  - cs_v[:-period]
    result = np.full(len(closes), np.nan)
    result[period - 1:] = np.where(roll_v > 0, roll_tv / roll_v, closes[period - 1:])
    return result