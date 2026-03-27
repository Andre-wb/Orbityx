"""
Setup Detector v1.0 — Gerchik-style Setup Detection
=====================================================
Detects high-probability trading setups based on:
  1. Price at strong S/R level
  2. Volume confirmation
  3. Candle pattern confirmation (pin bar, engulfing)
  4. RSI extreme at level
  5. Momentum alignment

A "setup" = all conditions met → worth trading.
No setup = skip bar → no trade.
"""
import numpy as np
from typing import List, Optional, Tuple
from dataclasses import dataclass
from levels.detector import (
    detect_levels, levels_for_bar, PriceLevel
)


@dataclass
class TradingSetup:
    bar_idx: int
    direction: str          # "LONG" or "SHORT"
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float

    # Setup quality scores
    level_strength: float   # how strong the S/R level is
    volume_score: float     # volume confirmation (0-1)
    candle_score: float     # rejection candle score (0-1)
    rsi_score: float        # RSI extreme score (0-1)
    momentum_score: float   # momentum alignment (0-1)

    # Combined confidence
    confidence: float       # weighted sum of scores (0-1)

    # Meta (set by caller)
    symbol: str = ""

    # Outcome (filled during backtesting)
    outcome: int = -1       # 1=TP hit, 0=SL hit, -1=unknown
    pnl_pct: float = 0.0

    @property
    def n_confirmations(self) -> int:
        """Count how many confirmations are active (score > 0.3)."""
        return sum(1 for s in [self.volume_score, self.candle_score,
                               self.rsi_score, self.momentum_score,
                               self.confidence]  # confidence acts as aggregate
                   if s > 0.3)


def _session_score(bar_idx: int, n_bars: int, tf_hours: float = 1.0) -> float:
    """
    Score based on trading session (UTC).
    London+US overlap (13:00-17:00 UTC) = best for levels.
    Asian session (00:00-08:00 UTC) = lower volatility, weaker levels.
    """
    # Estimate hour from bar index (assume bars are sequential hours)
    hour_utc = (bar_idx * tf_hours) % 24

    if 13 <= hour_utc < 17:     # London-US overlap
        return 1.0
    elif 8 <= hour_utc < 13:    # London session
        return 0.7
    elif 17 <= hour_utc < 22:   # US afternoon
        return 0.5
    elif 0 <= hour_utc < 8:     # Asian session
        return 0.3
    return 0.4


def _pin_bar_score(o: float, h: float, l: float, c: float,
                   direction: str) -> float:
    """Score how much the candle looks like a rejection/pin bar."""
    body = abs(c - o)
    total = h - l
    if total < 1e-9:
        return 0.0

    body_ratio = body / total
    if body_ratio > 0.4:  # body too large — not a pin bar
        return 0.0

    if direction == "LONG":
        # Long pin bar: long lower wick, small body at top
        lower_wick = min(o, c) - l
        upper_wick = h - max(o, c)
        if lower_wick < upper_wick:
            return 0.0
        return min(lower_wick / (total + 1e-9), 1.0)
    else:
        # Short pin bar: long upper wick, small body at bottom
        upper_wick = h - max(o, c)
        lower_wick = min(o, c) - l
        if upper_wick < lower_wick:
            return 0.0
        return min(upper_wick / (total + 1e-9), 1.0)


def _engulfing_score(o_prev: float, c_prev: float,
                     o_curr: float, c_curr: float,
                     direction: str) -> float:
    """Score for bullish/bearish engulfing pattern."""
    prev_body = c_prev - o_prev  # positive = bullish, negative = bearish
    curr_body = c_curr - o_curr

    if direction == "LONG":
        # Bullish engulfing: previous bearish, current bullish, body covers
        if prev_body >= 0 or curr_body <= 0:
            return 0.0
        if curr_body > abs(prev_body):
            return min(curr_body / (abs(prev_body) + 1e-9), 2.0) / 2.0
    else:
        # Bearish engulfing
        if prev_body <= 0 or curr_body >= 0:
            return 0.0
        if abs(curr_body) > prev_body:
            return min(abs(curr_body) / (prev_body + 1e-9), 2.0) / 2.0
    return 0.0


def detect_setups(
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        atr: np.ndarray,
        rsi: np.ndarray,
        levels: List[PriceLevel],
        level_tolerance_atr: float = 1.0,
        min_rr: float = 2.0,
        min_confirmations: int = 2,
        vol_lookback: int = 20,
        funding_rate: Optional[np.ndarray] = None,
        oi_change: Optional[np.ndarray] = None,
        trend_filter: bool = True,
        sma_period: int = 100,
) -> List[TradingSetup]:
    """
    Scan all bars and detect valid trading setups.

    A setup requires:
      1. Price within level_tolerance_atr × ATR of a strong level
      2. At least min_confirmations additional signals
      3. R:R >= min_rr

    Returns list of TradingSetup objects.
    """
    n = len(closes)
    setups: List[TradingSetup] = []

    # Precompute rolling volume average
    vol_avg = np.full(n, np.nan)
    cs_vol = np.cumsum(np.insert(volumes, 0, 0.0))
    vol_avg[vol_lookback:] = (cs_vol[vol_lookback + 1:] - cs_vol[1:-vol_lookback]) / vol_lookback

    # Short-term momentum (5-bar return)
    momentum = np.zeros(n)
    momentum[5:] = (closes[5:] - closes[:-5]) / (closes[:-5] + 1e-9)

    # Trend filter: SMA for direction bias
    sma = np.full(n, np.nan)
    if trend_filter and n > sma_period:
        cs_c = np.cumsum(np.insert(closes, 0, 0.0))
        sma[sma_period - 1:] = (cs_c[sma_period:] - cs_c[:-sma_period]) / sma_period

    start_bar = max(vol_lookback, 20, sma_period if trend_filter else 0)

    for i in range(start_bar, n - 1):
        price = closes[i]
        atr_i = atr[i] if not np.isnan(atr[i]) else price * 0.01
        if atr_i < 1e-9:
            continue

        # Find nearest levels
        near_sup, near_res, sups, ress = levels_for_bar(
            levels, i, price, atr_i)

        # Funding rate context
        fr_val = 0.0
        if funding_rate is not None and i < len(funding_rate):
            fr_val = funding_rate[i] if not np.isnan(funding_rate[i]) else 0.0

        # OI change context
        oi_val = 0.0
        if oi_change is not None and i < len(oi_change):
            oi_val = oi_change[i] if not np.isnan(oi_change[i]) else 0.0

        # Trend direction
        trend_up = not trend_filter or (not np.isnan(sma[i]) and price > sma[i])
        trend_down = not trend_filter or (not np.isnan(sma[i]) and price < sma[i])

        # Check LONG setup: price near support
        if near_sup is not None and trend_up:
            dist = price - near_sup.price
            if 0 <= dist < atr_i * level_tolerance_atr:
                setup = _evaluate_setup(
                    i, "LONG", opens, highs, lows, closes, volumes,
                    atr_i, rsi, near_sup, near_res, ress,
                    vol_avg, momentum, min_rr, fr_val, oi_val)
                if setup and setup.n_confirmations >= min_confirmations:
                    setups.append(setup)

        # Check SHORT setup: price near resistance
        if near_res is not None and trend_down:
            dist = near_res.price - price
            if 0 <= dist < atr_i * level_tolerance_atr:
                setup = _evaluate_setup(
                    i, "SHORT", opens, highs, lows, closes, volumes,
                    atr_i, rsi, near_sup, near_res, sups,
                    vol_avg, momentum, min_rr, fr_val, oi_val)
                if setup and setup.n_confirmations >= min_confirmations:
                    setups.append(setup)

    return setups


def _evaluate_setup(
        i: int, direction: str,
        opens: np.ndarray, highs: np.ndarray,
        lows: np.ndarray, closes: np.ndarray,
        volumes: np.ndarray,
        atr_i: float, rsi: np.ndarray,
        near_sup: Optional[PriceLevel],
        near_res: Optional[PriceLevel],
        target_levels: List[PriceLevel],
        vol_avg: np.ndarray,
        momentum: np.ndarray,
        min_rr: float,
        funding_rate: float = 0.0,
        oi_change: float = 0.0,
) -> Optional[TradingSetup]:
    """Evaluate a potential setup and score it."""
    price = closes[i]
    sl_buffer = max(atr_i * 0.7, price * 0.005)  # min 0.5% or 0.7×ATR behind level

    # --- Stop Loss ---
    if direction == "LONG":
        if near_sup is None:
            return None
        stop = near_sup.price - sl_buffer
        risk = price - stop
        level = near_sup
    else:
        if near_res is None:
            return None
        stop = near_res.price + sl_buffer
        risk = stop - price
        level = near_res

    if risk <= 0 or risk < price * 0.001:
        return None

    # --- Take Profit (next level) ---
    tp = None
    if direction == "LONG":
        for lvl in (target_levels or []):
            dist_to_tp = lvl.price - price
            if dist_to_tp >= risk * min_rr:
                tp = lvl.price
                break
        if tp is None:
            tp = price + risk * min_rr
    else:
        for lvl in (target_levels or []):
            dist_to_tp = price - lvl.price
            if dist_to_tp >= risk * min_rr:
                tp = lvl.price
                break
        if tp is None:
            tp = price - risk * min_rr

    rr = abs(tp - price) / (risk + 1e-9)
    if rr < min_rr:
        return None

    # --- Score confirmations ---

    # 1. Level strength (normalized 0-1)
    level_strength = min(level.strength / 500.0, 1.0)

    # 2. Volume confirmation
    v_avg = vol_avg[i] if not np.isnan(vol_avg[i]) else volumes[i]
    vol_ratio = volumes[i] / (v_avg + 1e-9)
    volume_score = min(max(vol_ratio - 1.0, 0.0) / 1.0, 1.0)

    # 3. Candle pattern
    pin = _pin_bar_score(opens[i], highs[i], lows[i], closes[i], direction)
    eng = 0.0
    if i > 0:
        eng = _engulfing_score(opens[i-1], closes[i-1],
                               opens[i], closes[i], direction)
    candle_score = max(pin, eng)

    # 4. RSI extreme (tiered: extreme > moderate)
    rsi_val = rsi[i] if not np.isnan(rsi[i]) else 50.0
    rsi_score = 0.0
    if direction == "LONG":
        if rsi_val < 20:
            rsi_score = 1.0       # extreme oversold
        elif rsi_val < 30:
            rsi_score = 0.7       # strong oversold
        elif rsi_val < 40:
            rsi_score = max(0, (40 - rsi_val) / 20.0)
    else:
        if rsi_val > 80:
            rsi_score = 1.0       # extreme overbought
        elif rsi_val > 70:
            rsi_score = 0.7       # strong overbought
        elif rsi_val > 60:
            rsi_score = max(0, (rsi_val - 60) / 20.0)

    # 5. Momentum alignment (with dead-band to ignore noise)
    mom = momentum[i]
    momentum_score = 0.0
    if direction == "LONG":
        if mom < -0.005:  # meaningful downward momentum (>0.5%)
            momentum_score = min(-mom * 20, 1.0)
    else:
        if mom > 0.005:   # meaningful upward momentum
            momentum_score = min(mom * 20, 1.0)

    # 6. Funding rate confirmation (contrarian)
    # Extreme positive funding → too many longs → good for SHORT
    # Extreme negative funding → too many shorts → good for LONG
    funding_score = 0.0
    if direction == "LONG" and funding_rate < -0.0001:
        funding_score = min(abs(funding_rate) / 0.001, 1.0)
    elif direction == "SHORT" and funding_rate > 0.0001:
        funding_score = min(funding_rate / 0.001, 1.0)

    # 7. Multi-bar rejection: count unique rejection events in last 10 bars
    rejection_score = 0.0
    if i >= 5:
        rejections = 0
        last_rej_k = -5
        for k in range(max(i - 10, 0), i):
            if direction == "LONG" and near_sup:
                if lows[k] <= near_sup.price * 1.002 and closes[k] > near_sup.price:
                    if k - last_rej_k >= 2:  # unique events only
                        rejections += 1
                        last_rej_k = k
            elif direction == "SHORT" and near_res:
                if highs[k] >= near_res.price * 0.998 and closes[k] < near_res.price:
                    if k - last_rej_k >= 2:
                        rejections += 1
                        last_rej_k = k
        rejection_score = min(rejections / 3.0, 1.0)

    # --- Combined confidence ---
    weights = {
        'level': 0.25,
        'volume': 0.20,
        'candle': 0.15,
        'rsi': 0.10,
        'momentum': 0.08,
        'funding': 0.12,
        'rejection': 0.10,
    }
    confidence = (
        weights['level'] * level_strength +
        weights['volume'] * volume_score +
        weights['candle'] * candle_score +
        weights['rsi'] * rsi_score +
        weights['momentum'] * momentum_score +
        weights['funding'] * funding_score +
        weights['rejection'] * rejection_score
    )

    return TradingSetup(
        bar_idx=i,
        direction=direction,
        entry_price=price,
        stop_loss=stop,
        take_profit=tp,
        risk_reward=rr,
        level_strength=level_strength,
        volume_score=volume_score,
        candle_score=candle_score,
        rsi_score=rsi_score,
        momentum_score=momentum_score,
        confidence=confidence,
    )


def simulate_setup_outcome(
        setup: TradingSetup,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        opens: np.ndarray,
        max_holding: int = 15,
        use_trailing: bool = True,
        trail_activation: float = 1.0,
        trail_step: float = 0.5,
) -> TradingSetup:
    """
    Simulate trade outcome with optional trailing stop.

    Trailing logic:
      - Activates when price moves trail_activation × risk in profit
      - Trails at trail_step × risk behind the best price
      - Allows capturing big moves (5-10%) while protecting profits
    """
    n = len(closes)
    entry_idx = min(setup.bar_idx + 1, n - 1)
    entry = opens[entry_idx]

    if setup.direction == "LONG":
        sl = setup.stop_loss
        risk = entry - sl
        tp = setup.take_profit
    else:
        sl = setup.stop_loss
        risk = sl - entry
        tp = setup.take_profit

    if risk <= 0:
        setup.outcome = 0
        setup.pnl_pct = -0.01
        return setup

    # Trailing stop state
    trailing_active = False
    best_price = entry
    current_sl = sl
    trail_dist = risk * trail_step

    for j in range(entry_idx + 1, min(entry_idx + max_holding + 1, n)):
        if setup.direction == "LONG":
            # Update best price
            if highs[j] > best_price:
                best_price = highs[j]

            # Activate trailing after price moves enough in profit
            if use_trailing and not trailing_active:
                if best_price >= entry + risk * trail_activation:
                    trailing_active = True
                    current_sl = max(current_sl, best_price - trail_dist)

            # Update trailing stop
            if trailing_active:
                new_sl = best_price - trail_dist
                current_sl = max(current_sl, new_sl)

            # Check SL (original or trailing)
            if lows[j] <= current_sl:
                setup.outcome = 1 if current_sl > entry else 0
                setup.pnl_pct = (current_sl - entry) / (entry + 1e-9)
                return setup

            # Check TP (still respect hard TP)
            if highs[j] >= tp:
                setup.outcome = 1
                setup.pnl_pct = (tp - entry) / (entry + 1e-9)
                return setup
        else:
            # SHORT
            if lows[j] < best_price:
                best_price = lows[j]

            if use_trailing and not trailing_active:
                if best_price <= entry - risk * trail_activation:
                    trailing_active = True
                    current_sl = min(current_sl, best_price + trail_dist)

            if trailing_active:
                new_sl = best_price + trail_dist
                current_sl = min(current_sl, new_sl)

            if highs[j] >= current_sl:
                setup.outcome = 1 if current_sl < entry else 0
                setup.pnl_pct = (entry - current_sl) / (entry + 1e-9)
                return setup

            if lows[j] <= tp:
                setup.outcome = 1
                setup.pnl_pct = (entry - tp) / (entry + 1e-9)
                return setup

    # Timeout
    exit_price = closes[min(entry_idx + max_holding, n - 1)]
    if setup.direction == "LONG":
        setup.pnl_pct = (exit_price - entry) / (entry + 1e-9)
    else:
        setup.pnl_pct = (entry - exit_price) / (entry + 1e-9)
    setup.outcome = 1 if setup.pnl_pct > 0 else 0
    return setup
