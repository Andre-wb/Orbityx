"""
Level Detector v1.0 — Gerchik-style Support/Resistance
========================================================
Finds key price levels where real money is clustered:
  - Swing highs/lows (local extrema)
  - Volume-weighted clustering
  - Strength scoring (touches × volume × recency)
  - False breakout detection

Used by FeatureEngineer to generate level-based features
instead of pure technical indicator noise.
"""
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class PriceLevel:
    price: float
    touches: int
    total_volume: float
    last_touch_idx: int
    first_touch_idx: int
    is_support: bool      # True=support, False=resistance
    false_breakouts: int  # times price crossed and came back

    @property
    def strength(self) -> float:
        """Level strength score. Higher = stronger level."""
        return self.touches * np.log1p(self.total_volume) * (1.0 + self.false_breakouts * 0.5)


def find_swing_points(highs: np.ndarray, lows: np.ndarray,
                      volumes: np.ndarray, window: int = 10
                      ) -> Tuple[List[Tuple[int, float, float]],
                                 List[Tuple[int, float, float]]]:
    """Find swing highs (resistance) and swing lows (support)."""
    n = len(highs)
    swing_highs = []  # (index, price, volume)
    swing_lows = []

    for i in range(window, n - window):
        # Swing high: highest high in 2*window+1 neighborhood
        local_highs = highs[i - window:i + window + 1]
        if highs[i] >= np.max(local_highs):
            swing_highs.append((i, float(highs[i]), float(volumes[i])))

        # Swing low: lowest low in 2*window+1 neighborhood
        local_lows = lows[i - window:i + window + 1]
        if lows[i] <= np.min(local_lows):
            swing_lows.append((i, float(lows[i]), float(volumes[i])))

    return swing_highs, swing_lows


def cluster_levels(points: List[Tuple[int, float, float]],
                   merge_pct: float = 0.003,
                   is_support: bool = True) -> List[PriceLevel]:
    """Cluster nearby price points into levels."""
    if not points:
        return []

    # Sort by price
    sorted_pts = sorted(points, key=lambda x: x[1])

    clusters: List[List[Tuple[int, float, float]]] = []
    current = [sorted_pts[0]]

    for pt in sorted_pts[1:]:
        # Merge if within merge_pct of cluster mean
        cluster_mean = np.mean([p[1] for p in current])
        if abs(pt[1] - cluster_mean) / (cluster_mean + 1e-9) < merge_pct:
            current.append(pt)
        else:
            clusters.append(current)
            current = [pt]
    clusters.append(current)

    levels = []
    for cluster in clusters:
        if len(cluster) < 2:  # Need at least 2 touches
            continue
        price = np.median([p[1] for p in cluster])
        touches = len(cluster)
        total_vol = sum(p[2] for p in cluster)
        last_idx = max(p[0] for p in cluster)
        first_idx = min(p[0] for p in cluster)

        levels.append(PriceLevel(
            price=price,
            touches=touches,
            total_volume=total_vol,
            last_touch_idx=last_idx,
            first_touch_idx=first_idx,
            is_support=is_support,
            false_breakouts=0,
        ))

    return levels


def count_false_breakouts(levels: List[PriceLevel],
                          highs: np.ndarray,
                          lows: np.ndarray,
                          closes: np.ndarray,
                          atr: np.ndarray) -> None:
    """Count unique false breakout events (not repeated wick taps)."""
    for lvl in levels:
        fb_count = 0
        last_fb_idx = -5
        start = lvl.first_touch_idx
        for i in range(start, len(closes)):
            tol = atr[i] * 0.3 if not np.isnan(atr[i]) else lvl.price * 0.002
            if lvl.is_support:
                if lows[i] < lvl.price - tol and closes[i] > lvl.price:
                    if i - last_fb_idx > 3:  # unique event (>3 bars apart)
                        fb_count += 1
                        last_fb_idx = i
            else:
                if highs[i] > lvl.price + tol and closes[i] < lvl.price:
                    if i - last_fb_idx > 3:
                        fb_count += 1
                        last_fb_idx = i
        lvl.false_breakouts = fb_count


def detect_levels(highs: np.ndarray, lows: np.ndarray,
                  closes: np.ndarray, volumes: np.ndarray,
                  atr: np.ndarray,
                  swing_window: int = 10,
                  merge_pct: float = 0.003,
                  min_strength: float = 0.0,
                  ) -> List[PriceLevel]:
    """
    Full level detection pipeline.

    Returns sorted list of PriceLevels (strongest first).
    """
    swing_highs, swing_lows = find_swing_points(highs, lows, volumes, swing_window)

    resistance = cluster_levels(swing_highs, merge_pct, is_support=False)
    support = cluster_levels(swing_lows, merge_pct, is_support=True)

    all_levels = resistance + support
    count_false_breakouts(all_levels, highs, lows, closes, atr)

    # Filter by minimum strength and sort by strength
    all_levels = [l for l in all_levels if l.strength >= min_strength]
    all_levels.sort(key=lambda l: l.strength, reverse=True)

    return all_levels


def levels_for_bar(levels: List[PriceLevel], bar_idx: int,
                   price: float, atr_val: float,
                   max_levels: int = 20,
                   max_age: int = 2000,
                   ) -> Tuple[Optional[PriceLevel], Optional[PriceLevel],
                              List[PriceLevel], List[PriceLevel]]:
    """
    Find relevant levels for a given bar.

    Returns:
        nearest_support, nearest_resistance,
        all_supports_below, all_resistances_above
    """
    supports = []
    resistances = []

    for lvl in levels:
        # Skip levels that haven't been formed yet (no look-ahead)
        if lvl.last_touch_idx > bar_idx:
            continue
        # Skip very old levels
        if bar_idx - lvl.last_touch_idx > max_age:
            continue

        if lvl.price < price:
            supports.append(lvl)
        elif lvl.price > price:
            resistances.append(lvl)
        else:
            # Price is exactly at level — classify by type
            if lvl.is_support:
                supports.append(lvl)
            else:
                resistances.append(lvl)

    # Sort supports descending (nearest first)
    supports.sort(key=lambda l: l.price, reverse=True)
    # Sort resistances ascending (nearest first)
    resistances.sort(key=lambda l: l.price)

    nearest_sup = supports[0] if supports else None
    nearest_res = resistances[0] if resistances else None

    return nearest_sup, nearest_res, supports[:max_levels], resistances[:max_levels]


def build_level_features(highs: np.ndarray, lows: np.ndarray,
                         closes: np.ndarray, volumes: np.ndarray,
                         atr: np.ndarray,
                         swing_window: int = 10,
                         ) -> np.ndarray:
    """
    Build level-based feature matrix (n, 15).

    Features:
      0: dist_to_support / ATR      (how far from support)
      1: dist_to_resistance / ATR   (how far from resistance)
      2: support_strength           (normalized)
      3: resistance_strength        (normalized)
      4: at_support                 (1 if within 0.5*ATR of support)
      5: at_resistance              (1 if within 0.5*ATR of resistance)
      6: support_touches            (normalized)
      7: resistance_touches         (normalized)
      8: support_false_breakouts    (normalized)
      9: resistance_false_breakouts
     10: level_squeeze              (close supports and resistances = squeeze)
     11: position_in_range          (where price is between sup and res)
     12: volume_vs_level_avg        (current vol vs avg vol at level touches)
     13: nearest_level_recency      (how recent was the nearest level touched)
     14: breakout_risk              (approaching level with high volume = breakout risk)
    """
    n = len(closes)
    feats = np.zeros((n, 15), dtype=float)

    # Detect levels using data up to each point (expanding window)
    # For efficiency, detect once and filter by bar_idx in levels_for_bar
    all_levels = detect_levels(highs, lows, closes, volumes, atr,
                               swing_window=swing_window)

    if not all_levels:
        return feats

    max_strength = max(l.strength for l in all_levels) + 1e-9
    max_touches = max(l.touches for l in all_levels) + 1e-9
    max_fb = max(l.false_breakouts for l in all_levels) + 1e-9

    # Volume at level touches (for feature 12)
    level_avg_vol = np.mean([l.total_volume / (l.touches + 1e-9) for l in all_levels])

    for i in range(swing_window * 2, n):
        price = closes[i]
        atr_i = atr[i] if not np.isnan(atr[i]) else price * 0.01

        nearest_sup, nearest_res, sups, ress = levels_for_bar(
            all_levels, i, price, atr_i
        )

        # Feature 0-1: Distance to nearest levels (ATR-normalized)
        if nearest_sup is not None:
            feats[i, 0] = (price - nearest_sup.price) / (atr_i + 1e-9)
            feats[i, 2] = nearest_sup.strength / max_strength
            feats[i, 6] = nearest_sup.touches / max_touches
            feats[i, 8] = nearest_sup.false_breakouts / max_fb
            # At support?
            if abs(price - nearest_sup.price) < atr_i * 0.5:
                feats[i, 4] = 1.0

        if nearest_res is not None:
            feats[i, 1] = (nearest_res.price - price) / (atr_i + 1e-9)
            feats[i, 3] = nearest_res.strength / max_strength
            feats[i, 7] = nearest_res.touches / max_touches
            feats[i, 9] = nearest_res.false_breakouts / max_fb
            # At resistance?
            if abs(nearest_res.price - price) < atr_i * 0.5:
                feats[i, 5] = 1.0

        # Feature 10: Level squeeze (tight range between sup/res)
        if nearest_sup is not None and nearest_res is not None:
            range_atr = (nearest_res.price - nearest_sup.price) / (atr_i + 1e-9)
            feats[i, 10] = np.clip(1.0 - range_atr / 10.0, 0, 1)

            # Feature 11: Position in range
            total_range = nearest_res.price - nearest_sup.price
            if total_range > 1e-9:
                feats[i, 11] = (price - nearest_sup.price) / total_range - 0.5

        # Feature 12: Current volume vs level average
        if level_avg_vol > 0:
            feats[i, 12] = np.tanh(volumes[i] / (level_avg_vol + 1e-9) - 1.0)

        # Feature 13: Recency of nearest level
        nearest_lvl = nearest_sup or nearest_res
        if nearest_lvl is not None:
            age = i - nearest_lvl.last_touch_idx
            feats[i, 13] = np.exp(-age / 500.0)  # exponential decay

        # Feature 14: Breakout risk (high volume approaching level)
        if nearest_sup is not None and feats[i, 0] < 1.5:  # near support
            feats[i, 14] = -np.tanh(volumes[i] / (level_avg_vol + 1e-9) - 1.5)
        elif nearest_res is not None and feats[i, 1] < 1.5:  # near resistance
            feats[i, 14] = np.tanh(volumes[i] / (level_avg_vol + 1e-9) - 1.5)

    return feats


def find_stop_and_targets(price: float, direction: str,
                          nearest_sup: Optional[PriceLevel],
                          nearest_res: Optional[PriceLevel],
                          atr_val: float,
                          min_rr: float = 3.0,
                          supports: Optional[List[PriceLevel]] = None,
                          resistances: Optional[List[PriceLevel]] = None,
                          ) -> Tuple[float, float, float, float, float]:
    """
    Gerchik-style risk management: stop behind level, TP at next level.

    Returns: (stop_loss, tp1, tp2, tp3, risk_reward)
    """
    sl_buffer = atr_val * 0.3  # Small buffer behind level

    if direction == "LONG":
        # Stop behind support level
        if nearest_sup is not None:
            stop = nearest_sup.price - sl_buffer
        else:
            stop = price - atr_val * 1.5

        risk = price - stop
        if risk <= 0:
            risk = atr_val

        # TP at resistance levels
        tp1 = price + risk * min_rr
        tp2 = price + risk * min_rr * 1.5
        tp3 = price + risk * min_rr * 2.0

        if resistances:
            # Use actual resistance levels as targets
            for res in resistances:
                if res.price > price + risk * min_rr:
                    tp1 = res.price
                    break
            for res in resistances:
                if res.price > tp1:
                    tp2 = res.price
                    break

    elif direction == "SHORT":
        # Stop behind resistance level
        if nearest_res is not None:
            stop = nearest_res.price + sl_buffer
        else:
            stop = price + atr_val * 1.5

        risk = stop - price
        if risk <= 0:
            risk = atr_val

        tp1 = price - risk * min_rr
        tp2 = price - risk * min_rr * 1.5
        tp3 = price - risk * min_rr * 2.0

        if supports:
            for sup in supports:
                if sup.price < price - risk * min_rr:
                    tp1 = sup.price
                    break
            for sup in supports:
                if sup.price < tp1:
                    tp2 = sup.price
                    break
    else:
        return price, price, price, price, 0.0

    rr = abs(tp1 - price) / (abs(price - stop) + 1e-9)

    return stop, tp1, tp2, tp3, rr
