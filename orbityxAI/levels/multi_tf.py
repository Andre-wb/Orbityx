"""
Multi-Timeframe Level Confluence v1.0
=======================================
A level that exists on BOTH 1h and 4h is 2-3x stronger
than a single-TF level. This module:
  1. Aggregates 1h bars into higher TF bars
  2. Detects levels on higher TF
  3. Scores confluence (1h level near 4h level = boost)
"""
import numpy as np
from typing import List, Optional, Tuple
from levels.detector import detect_levels, PriceLevel


def aggregate_bars(opens: np.ndarray, highs: np.ndarray,
                   lows: np.ndarray, closes: np.ndarray,
                   volumes: np.ndarray,
                   factor: int = 4,
                   ) -> Tuple[np.ndarray, np.ndarray, np.ndarray,
                              np.ndarray, np.ndarray]:
    """Aggregate 1h bars into higher TF (e.g. 4h with factor=4)."""
    n = len(closes)
    n_agg = n // factor

    o_agg = np.empty(n_agg)
    h_agg = np.empty(n_agg)
    l_agg = np.empty(n_agg)
    c_agg = np.empty(n_agg)
    v_agg = np.empty(n_agg)

    for i in range(n_agg):
        s = i * factor
        e = s + factor
        o_agg[i] = opens[s]
        h_agg[i] = highs[s:e].max()
        l_agg[i] = lows[s:e].min()
        c_agg[i] = closes[e - 1]
        v_agg[i] = volumes[s:e].sum()

    return o_agg, h_agg, l_agg, c_agg, v_agg


def detect_htf_levels(
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        atr_1h: np.ndarray,
        factor: int = 4,
) -> List[PriceLevel]:
    """Detect levels on higher timeframe."""
    o4, h4, l4, c4, v4 = aggregate_bars(opens, highs, lows, closes, volumes, factor)

    # Compute ATR for higher TF
    from indicators.technical import atr as compute_atr
    atr_4h = compute_atr(h4, l4, c4)

    return detect_levels(h4, l4, c4, v4, atr_4h, swing_window=10)


def confluence_score(
        level_1h: PriceLevel,
        htf_levels: List[PriceLevel],
        atr_val: float,
        tolerance: float = 1.5,
) -> float:
    """
    Score how well a 1h level aligns with higher TF levels.

    Returns 0.0 (no confluence) to 1.0 (perfect alignment).
    """
    if not htf_levels or atr_val < 1e-9:
        return 0.0

    best = 0.0
    for htf in htf_levels:
        dist = abs(level_1h.price - htf.price) / (atr_val + 1e-9)
        if dist < tolerance:
            # Closer = stronger confluence
            score = (1.0 - dist / tolerance)
            # Boost by HTF level strength
            htf_str = min(htf.strength / 300.0, 1.0)
            score *= (0.5 + 0.5 * htf_str)
            best = max(best, score)

    return best


def boost_levels_with_confluence(
        levels_1h: List[PriceLevel],
        htf_levels: List[PriceLevel],
        atr_val: float,
) -> List[PriceLevel]:
    """
    Boost 1h level strength based on HTF confluence.
    Levels with HTF confluence get 2x strength boost.
    """
    for lvl in levels_1h:
        conf = confluence_score(lvl, htf_levels, atr_val)
        if conf > 0.3:
            # Exponential boost on total_volume (affects strength via property)
            boost = 1.0 + conf ** 1.5 * 3.0  # up to 4x for perfect confluence
            lvl.total_volume *= boost
            lvl.false_breakouts = max(lvl.false_breakouts, int(conf * 3))

    # Re-sort by strength
    levels_1h.sort(key=lambda l: l.strength, reverse=True)
    return levels_1h
