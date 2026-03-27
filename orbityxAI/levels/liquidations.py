"""
Liquidation Level Estimator v1.0
=================================
Estimates where liquidation clusters sit based on:
  - Recent swing highs/lows (where traders entered)
  - Typical leverage levels (10x, 25x, 50x, 100x)
  - Volume-weighted entry price estimation

For live trading: use real Binance forceOrder WebSocket.
For backtesting: estimate from price history.
"""
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class LiquidationCluster:
    price: float
    side: str           # "LONG_LIQ" or "SHORT_LIQ"
    leverage: int       # estimated leverage
    strength: float     # estimated volume at this level
    distance_pct: float # distance from current price in %


LEVERAGE_LEVELS = [5, 10, 25, 50, 100]
# Maintenance margin rates by leverage (Binance Futures approx)
MAINT_MARGIN = {5: 0.04, 10: 0.05, 25: 0.05, 50: 0.05, 100: 0.05}


def estimate_liquidation_price(entry: float, leverage: int,
                               side: str) -> float:
    """Estimate liquidation price for a position."""
    mm = MAINT_MARGIN.get(leverage, 0.05)
    if side == "LONG":
        # Long liq = entry * (1 - 1/leverage + mm)
        return entry * (1.0 - 1.0 / leverage + mm)
    else:
        # Short liq = entry * (1 + 1/leverage - mm)
        return entry * (1.0 + 1.0 / leverage - mm)


def estimate_liquidation_clusters(
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        lookback: int = 200,
        swing_window: int = 10,
) -> List[LiquidationCluster]:
    """
    Estimate where liquidation clusters are based on recent price action.

    Logic: traders enter at swing points. Their liquidation prices
    depend on leverage. High-volume swing points = more positions = bigger clusters.
    """
    n = len(closes)
    if n < lookback:
        lookback = n

    start = n - lookback
    clusters: List[LiquidationCluster] = []
    current_price = closes[-1]

    # Find swing highs (where shorts entered) and swing lows (where longs entered)
    for i in range(start + swing_window, n - swing_window):
        # Swing high — shorts entered here
        local_highs = highs[i - swing_window:i + swing_window + 1]
        if highs[i] >= np.max(local_highs):
            entry_price = highs[i]
            vol_weight = volumes[i] / (np.mean(volumes[start:n]) + 1e-9)
            # Recency weight (more recent = more likely still open)
            recency = np.exp(-(n - i) / 100.0)
            strength = vol_weight * recency

            for lev in LEVERAGE_LEVELS:
                liq_price = estimate_liquidation_price(entry_price, lev, "SHORT")
                dist = (liq_price / current_price - 1.0) * 100
                clusters.append(LiquidationCluster(
                    price=liq_price, side="SHORT_LIQ", leverage=lev,
                    strength=strength, distance_pct=dist
                ))

        # Swing low — longs entered here
        local_lows = lows[i - swing_window:i + swing_window + 1]
        if lows[i] <= np.min(local_lows):
            entry_price = lows[i]
            vol_weight = volumes[i] / (np.mean(volumes[start:n]) + 1e-9)
            recency = np.exp(-(n - i) / 100.0)
            strength = vol_weight * recency

            for lev in LEVERAGE_LEVELS:
                liq_price = estimate_liquidation_price(entry_price, lev, "LONG")
                dist = (liq_price / current_price - 1.0) * 100
                clusters.append(LiquidationCluster(
                    price=liq_price, side="LONG_LIQ", leverage=lev,
                    strength=strength, distance_pct=dist
                ))

    # Merge nearby clusters (within 0.3%)
    clusters.sort(key=lambda c: c.price)
    merged: List[LiquidationCluster] = []
    i = 0
    while i < len(clusters):
        group = [clusters[i]]
        j = i + 1
        while j < len(clusters) and abs(clusters[j].price - group[0].price) / (group[0].price + 1e-9) < 0.003:
            group.append(clusters[j])
            j += 1
        avg_price = np.mean([c.price for c in group])
        total_strength = sum(c.strength for c in group)
        side = max(set(c.side for c in group), key=lambda s: sum(c.strength for c in group if c.side == s))
        avg_lev = int(np.mean([c.leverage for c in group]))
        dist = (avg_price / current_price - 1.0) * 100
        merged.append(LiquidationCluster(
            price=avg_price, side=side, leverage=avg_lev,
            strength=total_strength, distance_pct=dist
        ))
        i = j

    merged.sort(key=lambda c: c.strength, reverse=True)
    return merged


def liquidation_features(
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        atr: np.ndarray,
        lookback: int = 200,
) -> np.ndarray:
    """
    Build liquidation-based features per bar (n, 6).

    Features:
      0: nearest_long_liq_dist (ATR-normalized, negative = below)
      1: nearest_short_liq_dist (ATR-normalized, positive = above)
      2: long_liq_strength (normalized)
      3: short_liq_strength (normalized)
      4: liq_magnet_bias (-1 to +1, where is the bigger cluster)
      5: liq_squeeze (clusters close on both sides)
    """
    n = len(closes)
    feats = np.zeros((n, 6), dtype=float)

    for i in range(max(lookback, 30), n):
        atr_i = atr[i] if not np.isnan(atr[i]) else closes[i] * 0.01
        price = closes[i]

        # Use data up to bar i only (no look-ahead)
        clusters = estimate_liquidation_clusters(
            highs[:i+1], lows[:i+1], closes[:i+1], volumes[:i+1],
            lookback=min(lookback, i), swing_window=5
        )

        if not clusters:
            continue

        # Separate above and below
        above = [c for c in clusters if c.price > price]  # short liqs
        below = [c for c in clusters if c.price < price]  # long liqs

        # Nearest long liquidation (below price)
        if below:
            nearest_long = max(below, key=lambda c: c.price)
            feats[i, 0] = (price - nearest_long.price) / (atr_i + 1e-9)
            feats[i, 2] = min(sum(c.strength for c in below) / 5.0, 1.0)

        # Nearest short liquidation (above price)
        if above:
            nearest_short = min(above, key=lambda c: c.price)
            feats[i, 1] = (nearest_short.price - price) / (atr_i + 1e-9)
            feats[i, 3] = min(sum(c.strength for c in above) / 5.0, 1.0)

        # Magnet bias: where is the bigger cluster?
        str_below = sum(c.strength for c in below) if below else 0
        str_above = sum(c.strength for c in above) if above else 0
        total = str_below + str_above + 1e-9
        feats[i, 4] = (str_above - str_below) / total  # +1 = magnet above, -1 = below

        # Squeeze: clusters close on both sides
        if below and above:
            dist_below = feats[i, 0]
            dist_above = feats[i, 1]
            feats[i, 5] = np.clip(1.0 - (dist_below + dist_above) / 20.0, 0, 1)

    return feats
