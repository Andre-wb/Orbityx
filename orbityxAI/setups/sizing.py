"""
Dynamic Position Sizing v1.0
==============================
Kelly Criterion adapted for setup-based trading.
Adjusts position size based on:
  - Setup confidence (more confirmations = bigger position)
  - Recent win rate (hot hand = scale up, cold streak = scale down)
  - Drawdown protection (reduce size in drawdown)
"""
import numpy as np
from typing import List


def kelly_fraction(win_rate: float, avg_win: float, avg_loss: float,
                   fraction: float = 0.25) -> float:
    """
    Half-Kelly position sizing.

    Kelly% = (WR * avg_win - (1-WR) * avg_loss) / avg_win
    We use fraction * Kelly for safety (default 25% Kelly).
    """
    if avg_win <= 0 or avg_loss <= 0:
        return 0.01  # minimum

    kelly = (win_rate * avg_win - (1 - win_rate) * avg_loss) / (avg_win + 1e-9)
    kelly = max(kelly, 0.0)
    return max(min(kelly * fraction, 0.03), 0.005)  # cap 0.5% to 3%


def adaptive_risk(
        base_risk: float,
        n_confirmations: int,
        confidence: float,
        recent_wr: float,
        current_dd_pct: float,
        consecutive_losses: int,
) -> float:
    """
    Adapt risk per trade based on context.

    Returns adjusted risk fraction (0.005 to 0.02).
    """
    risk = base_risk

    # Scale up for high-quality setups
    if n_confirmations >= 4:
        risk *= 1.5
    elif n_confirmations >= 3:
        risk *= 1.2

    # Scale by confidence
    risk *= (0.7 + confidence * 0.6)  # range: 0.7x to 1.3x

    # Scale down in drawdown
    if current_dd_pct < -0.05:  # >5% drawdown
        risk *= 0.5
    elif current_dd_pct < -0.03:  # >3% drawdown
        risk *= 0.7

    # Scale down after consecutive losses
    if consecutive_losses >= 5:
        risk *= 0.3
    elif consecutive_losses >= 3:
        risk *= 0.6

    # Scale up if recent WR is good
    if recent_wr > 0.35:
        risk *= 1.1
    elif recent_wr < 0.20:
        risk *= 0.7

    return max(min(risk, 0.02), 0.003)  # 0.3% to 2%


def compute_position_value(
        equity: float,
        risk_fraction: float,
        entry_price: float,
        stop_price: float,
        max_position_pct: float = 0.05,
) -> float:
    """Compute position value from risk and stop distance."""
    sl_pct = abs(entry_price - stop_price) / (entry_price + 1e-9)
    if sl_pct < 1e-6:
        return 0.0

    risk_amount = equity * risk_fraction
    position = risk_amount / sl_pct
    max_pos = equity * max_position_pct
    return min(position, max_pos)
