"""
Volume-based indicators.
"""
import numpy as np
from indicators.technical import ema, sma


def obv(closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    result = np.zeros(len(closes))
    for i in range(1, len(closes)):
        if   closes[i] > closes[i - 1]: result[i] = result[i - 1] + volumes[i]
        elif closes[i] < closes[i - 1]: result[i] = result[i - 1] - volumes[i]
        else:                            result[i] = result[i - 1]
    return result


def mfi(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
        volumes: np.ndarray, period: int = 14) -> np.ndarray:
    tp = (highs + lows + closes) / 3.0
    mf = tp * volumes
    result = np.full(len(closes), np.nan)
    for i in range(period, len(closes)):
        s = slice(i - period + 1, i + 1)
        tp_s = tp[s]; mf_s = mf[s]
        diff = np.diff(tp_s, prepend=tp_s[0])
        pos = np.sum(mf_s[diff >= 0])
        neg = np.sum(mf_s[diff <  0])
        result[i] = 100.0 if neg == 0 else 100 - 100 / (1 + pos / neg)
    return result


def chaikin_money_flow(highs: np.ndarray, lows: np.ndarray,
                       closes: np.ndarray, volumes: np.ndarray,
                       period: int = 20) -> np.ndarray:
    clv = np.where(highs != lows,
                   ((closes - lows) - (highs - closes)) / (highs - lows + 1e-9),
                   0.0)
    mf_vol = clv * volumes
    result = np.full(len(closes), np.nan)
    for i in range(period - 1, len(closes)):
        vs = volumes[i - period + 1: i + 1].sum()
        result[i] = mf_vol[i - period + 1: i + 1].sum() / vs if vs > 0 else 0.0
    return result


def accumulation_distribution(highs: np.ndarray, lows: np.ndarray,
                              closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    clv = np.where(highs != lows,
                   ((closes - lows) - (highs - closes)) / (highs - lows + 1e-9), 0.0)
    return np.cumsum(clv * volumes)


def volume_oscillator(volumes: np.ndarray, fast: int = 5, slow: int = 10) -> np.ndarray:
    f = ema(volumes, fast)
    s = ema(volumes, slow)
    return np.where(s != 0, (f - s) / (s + 1e-9) * 100, 0.0)


def volume_price_trend(closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    vpt = np.zeros(len(closes))
    for i in range(1, len(closes)):
        vpt[i] = vpt[i-1] + volumes[i] * (closes[i] - closes[i-1]) / (closes[i-1] + 1e-9)
    return vpt


def ease_of_movement(highs: np.ndarray, lows: np.ndarray,
                     volumes: np.ndarray, period: int = 14) -> np.ndarray:
    hl2   = (highs + lows) / 2.0
    dm    = np.diff(hl2, prepend=hl2[0])
    box_r = volumes / (highs - lows + 1e-9)
    emv   = dm / (box_r + 1e-9)
    return sma(emv, period)


def volume_profile(closes: np.ndarray, volumes: np.ndarray,
                   bins: int = 24) -> dict:
    """Full Volume Profile: POC, VAH, VAL."""
    p_min, p_max = closes.min(), closes.max()
    if p_max == p_min:
        return {"poc": float(p_min), "vah": float(p_max), "val": float(p_min)}

    edges = np.linspace(p_min, p_max, bins + 1)
    vol_bins = np.zeros(bins)
    for i, c in enumerate(closes):
        idx = min(int((c - p_min) / (p_max - p_min) * bins), bins - 1)
        vol_bins[idx] += volumes[i]

    poc_idx  = int(np.argmax(vol_bins))
    poc      = (edges[poc_idx] + edges[poc_idx + 1]) / 2.0
    total    = vol_bins.sum()
    target   = total * 0.70

    vah_i, val_i = poc_idx, poc_idx
    accum = vol_bins[poc_idx]
    while accum < target:
        can_up   = vah_i < bins - 1
        can_down = val_i > 0
        if can_up and can_down:
            if vol_bins[vah_i + 1] >= vol_bins[val_i - 1]:
                vah_i += 1; accum += vol_bins[vah_i]
            else:
                val_i -= 1; accum += vol_bins[val_i]
        elif can_up:
            vah_i += 1; accum += vol_bins[vah_i]
        elif can_down:
            val_i -= 1; accum += vol_bins[val_i]
        else:
            break

    return {
        "poc": float(poc),
        "vah": float((edges[vah_i] + edges[vah_i + 1]) / 2),
        "val": float((edges[val_i] + edges[val_i + 1]) / 2),
    }