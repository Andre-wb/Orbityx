"""
Volume Profile Level Detection v1.0
=====================================
Finds Point of Control (POC) and Value Area levels from volume distribution.
These are the strongest levels — where the most trading actually happened.
"""
import numpy as np
from typing import List, Tuple
from levels.detector import PriceLevel


def compute_volume_profile(
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        n_bins: int = 50,
        lookback: int = 500,
) -> Tuple[np.ndarray, np.ndarray, float, float, float]:
    """
    Compute volume profile over lookback period.

    Returns:
        prices: bin center prices
        vol_at_price: volume at each price bin
        poc: Point of Control (highest volume price)
        vah: Value Area High (70% of volume above this)
        val_: Value Area Low (70% of volume below this)
    """
    n = len(closes)
    start = max(0, n - lookback)

    price_min = lows[start:].min()
    price_max = highs[start:].max()
    if price_max - price_min < 1e-9:
        mid = closes[-1]
        return np.array([mid]), np.array([1.0]), mid, mid, mid

    bin_edges = np.linspace(price_min, price_max, n_bins + 1)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    vol_at_price = np.zeros(n_bins)

    # Distribute volume across price bins each bar touched
    for i in range(start, n):
        lo, hi, vol = lows[i], highs[i], volumes[i]
        for b in range(n_bins):
            if bin_edges[b + 1] >= lo and bin_edges[b] <= hi:
                # Portion of bar that overlaps this bin
                overlap = min(hi, bin_edges[b + 1]) - max(lo, bin_edges[b])
                total = hi - lo + 1e-9
                vol_at_price[b] += vol * (overlap / total)

    # POC = price with highest volume
    poc_idx = np.argmax(vol_at_price)
    poc = bin_centers[poc_idx]

    # Value Area: 70% of total volume around POC
    total_vol = vol_at_price.sum()
    target = total_vol * 0.70
    accumulated = vol_at_price[poc_idx]
    lo_idx = poc_idx
    hi_idx = poc_idx

    while accumulated < target and (lo_idx > 0 or hi_idx < n_bins - 1):
        expand_lo = vol_at_price[lo_idx - 1] if lo_idx > 0 else 0
        expand_hi = vol_at_price[hi_idx + 1] if hi_idx < n_bins - 1 else 0

        if expand_lo >= expand_hi and lo_idx > 0:
            lo_idx -= 1
            accumulated += vol_at_price[lo_idx]
        elif hi_idx < n_bins - 1:
            hi_idx += 1
            accumulated += vol_at_price[hi_idx]
        else:
            break

    val_ = bin_centers[lo_idx]
    vah = bin_centers[hi_idx]

    return bin_centers, vol_at_price, poc, vah, val_


def volume_profile_levels(
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        lookback: int = 500,
) -> List[PriceLevel]:
    """
    Create PriceLevel objects from volume profile.
    POC and Value Area boundaries become strong levels.
    """
    _, vol_at_price, poc, vah, val_ = compute_volume_profile(
        highs, lows, closes, volumes, n_bins=50, lookback=lookback
    )

    total_vol = vol_at_price.sum() + 1e-9
    n = len(closes)
    levels = []

    # POC touches scaled by dominance
    poc_pct = vol_at_price[poc_idx] / total_vol if total_vol > 0 else 0.1
    poc_touches = max(int(5 + poc_pct * 30), 5)

    levels.append(PriceLevel(
        price=poc, touches=poc_touches,
        total_volume=float(total_vol * 0.15),
        last_touch_idx=n - 1, first_touch_idx=max(0, n - lookback),
        is_support=closes[-1] > poc, false_breakouts=2,
    ))

    # Value Area High = resistance
    vah_touches = max(int(3 + (1 - poc_pct) * 10), 3)
    if abs(vah - poc) / (poc + 1e-9) > 0.002:
        levels.append(PriceLevel(
            price=vah, touches=vah_touches,
            total_volume=float(total_vol * 0.08),
            last_touch_idx=n - 1, first_touch_idx=max(0, n - lookback),
            is_support=False, false_breakouts=1,
        ))

    # Value Area Low = support
    if abs(val_ - poc) / (poc + 1e-9) > 0.002:
        levels.append(PriceLevel(
            price=val_, touches=vah_touches,
            total_volume=float(total_vol * 0.08),
            last_touch_idx=n - 1, first_touch_idx=max(0, n - lookback),
            is_support=True, false_breakouts=1,
        ))

    return levels
