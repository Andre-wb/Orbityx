"""
Candlestick pattern recognition — 12 patterns.
Returns +1 (bullish), -1 (bearish), 0 (none) per bar.

BUG FIX #13: `max(o, c)` and `min(o, c)` in _u() and _l() used Python's
built-in max/min which fail on arrays ("truth value of array is ambiguous").
Fixed to np.maximum() / np.minimum() for element-wise array operations.
"""
import numpy as np


def _b(o, c):     return np.abs(c - o)
def _u(o, h, c):  return h - np.maximum(o, c)   # BUG FIX #13
def _l(o, lo, c): return np.minimum(o, c) - lo  # BUG FIX #13


def doji(o, h, lo, c, thresh=0.10):
    r = h - lo
    return np.where((r > 0) & (_b(o, c) / (r + 1e-9) < thresh), 1, 0).astype(int)


def hammer(o, h, lo, c):
    b = _b(o, c); u = _u(o, h, c); l = _l(o, lo, c)
    return np.where((b > 0) & (l >= 2*b) & (u <= 0.1*b), 1, 0).astype(int)


def shooting_star(o, h, lo, c):
    b = _b(o, c); u = _u(o, h, c); l = _l(o, lo, c)
    return np.where((b > 0) & (u >= 2*b) & (l <= 0.1*b), -1, 0).astype(int)


def engulfing(o, h, lo, c):
    n = len(c)
    result = np.zeros(n, dtype=int)
    for i in range(1, n):
        pb = float(_b(o[i-1], c[i-1])); cb = float(_b(o[i], c[i]))
        if pb == 0 or cb == 0: continue
        if c[i-1] < o[i-1] and c[i] > o[i] and o[i] <= c[i-1] and c[i] >= o[i-1]:
            result[i] = 1
        elif c[i-1] > o[i-1] and c[i] < o[i] and o[i] >= c[i-1] and c[i] <= o[i-1]:
            result[i] = -1
    return result


def morning_star(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(2, n):
        b0 = float(_b(o[i-2], c[i-2])); b1 = float(_b(o[i-1], c[i-1])); b2 = float(_b(o[i], c[i]))
        if b0 > 0 and b2 > 0 and b1 < 0.3*b0:
            if c[i-2] < o[i-2] and c[i] > o[i] and c[i] > (o[i-2]+c[i-2])/2:
                result[i] = 1
    return result


def evening_star(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(2, n):
        b0 = float(_b(o[i-2], c[i-2])); b1 = float(_b(o[i-1], c[i-1])); b2 = float(_b(o[i], c[i]))
        if b0 > 0 and b2 > 0 and b1 < 0.3*b0:
            if c[i-2] > o[i-2] and c[i] < o[i] and c[i] < (o[i-2]+c[i-2])/2:
                result[i] = -1
    return result


def three_white_soldiers(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(2, n):
        if all(c[i-j] > o[i-j] for j in range(3)):
            if c[i] > c[i-1] > c[i-2] and o[i] > o[i-1] > o[i-2]:
                result[i] = 1
    return result


def three_black_crows(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(2, n):
        if all(c[i-j] < o[i-j] for j in range(3)):
            if c[i] < c[i-1] < c[i-2]:
                result[i] = -1
    return result


def harami(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(1, n):
        hi_p = max(float(o[i-1]), float(c[i-1]))
        lo_p = min(float(o[i-1]), float(c[i-1]))
        hi_c = max(float(o[i]),   float(c[i]))
        lo_c = min(float(o[i]),   float(c[i]))
        if hi_c <= hi_p and lo_c >= lo_p:
            result[i] = 1 if c[i-1] < o[i-1] else (-1 if c[i-1] > o[i-1] else 0)
    return result


def piercing_line(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(1, n):
        if c[i-1] < o[i-1] and c[i] > o[i]:
            mid = (o[i-1] + c[i-1]) / 2
            if o[i] < c[i-1] and c[i] > mid:
                result[i] = 1
    return result


def dark_cloud_cover(o, h, lo, c):
    n = len(c); result = np.zeros(n, dtype=int)
    for i in range(1, n):
        if c[i-1] > o[i-1] and c[i] < o[i]:
            mid = (o[i-1] + c[i-1]) / 2
            if o[i] > c[i-1] and c[i] < mid:
                result[i] = -1
    return result


def marubozu(o, h, lo, c, thresh=0.02):
    r = h - lo
    u = _u(o, h, c); l = _l(o, lo, c)
    bull = (c > o) & (u/(r+1e-9) < thresh) & (l/(r+1e-9) < thresh)
    bear = (c < o) & (u/(r+1e-9) < thresh) & (l/(r+1e-9) < thresh)
    return np.where(bull, 1, np.where(bear, -1, 0)).astype(int)


def all_patterns(o: np.ndarray, h: np.ndarray, lo: np.ndarray,
                 c: np.ndarray) -> dict:
    return {
        "doji":            doji(o, h, lo, c),
        "hammer":          hammer(o, h, lo, c),
        "shooting_star":   shooting_star(o, h, lo, c),
        "engulfing":       engulfing(o, h, lo, c),
        "morning_star":    morning_star(o, h, lo, c),
        "evening_star":    evening_star(o, h, lo, c),
        "three_soldiers":  three_white_soldiers(o, h, lo, c),
        "three_crows":     three_black_crows(o, h, lo, c),
        "harami":          harami(o, h, lo, c),
        "piercing":        piercing_line(o, h, lo, c),
        "dark_cloud":      dark_cloud_cover(o, h, lo, c),
        "marubozu":        marubozu(o, h, lo, c),
    }


def pattern_score(o: np.ndarray, h: np.ndarray, lo: np.ndarray,
                  c: np.ndarray, lookback: int = 5) -> float:
    """Aggregate pattern score over last `lookback` bars → [-1, 1]."""
    pats  = all_patterns(o, h, lo, c)
    n     = len(c)
    score = sum(float(np.sum(arr[max(0, n - lookback):])) for arr in pats.values())
    return float(np.clip(score / (len(pats) * lookback + 1e-9), -1.0, 1.0))