"""
Risk Management & Position Sizing v5
======================================
Preserves all v4 fixes, minor cleanups.
"""
from typing import Tuple, List
from config import RISK_CFG, TIMEFRAME_ATR_MULT


class RiskManager:

    def compute_stops(self, price: float, atr_val: float, direction: str,
                      supports: List[float], resistances: List[float],
                      timeframe: str, sl_atr_mult: float = RISK_CFG.sl_atr_fallback,
                      ) -> Tuple[float, float, float, float, float]:
        tf_m       = TIMEFRAME_ATR_MULT.get(timeframe, 2.0)
        raw_sl     = atr_val * tf_m * sl_atr_mult
        tp_targets = RISK_CFG.tp_rr_targets

        if direction == "LONG":
            sl  = price - raw_sl
            below = [s for s in supports if s < price * 0.9985]
            if below:
                sl = min(sl, max(below) * 0.9940)
            sl  = min(sl, price * 0.997)

            tp1 = price + atr_val * tf_m * tp_targets[0]
            tp2 = price + atr_val * tf_m * tp_targets[1]
            tp3 = price + atr_val * tf_m * tp_targets[2]

            above = [r for r in resistances if r > price * 1.0015]
            if len(above) >= 1:
                cand = above[0] * 0.9970
                if cand > price: tp1 = min(tp1, cand)
            if len(above) >= 2:
                cand = above[1] * 0.9970
                if cand > tp1:   tp2 = min(tp2, cand)
            if len(above) >= 3:
                cand = above[2] * 0.9970
                if cand > tp2:   tp3 = min(tp3, cand)

        else:  # SHORT
            sl  = price + raw_sl
            above = [r for r in resistances if r > price * 1.0015]
            if above:
                sl = max(sl, min(above) * 1.0060)
            sl  = max(sl, price * 1.003)

            tp1 = price - atr_val * tf_m * tp_targets[0]
            tp2 = price - atr_val * tf_m * tp_targets[1]
            tp3 = price - atr_val * tf_m * tp_targets[2]

            below = [s for s in supports if s < price * 0.9985]
            if len(below) >= 1:
                cand = below[-1] * 1.0030
                if cand < price: tp1 = max(tp1, cand)
            if len(below) >= 2:
                cand = below[-2] * 1.0030
                if cand < tp1:   tp2 = max(tp2, cand)
            if len(below) >= 3:
                cand = below[-3] * 1.0030
                if cand < tp2:   tp3 = max(tp3, cand)

        risk   = abs(price - sl)
        reward = abs(tp1 - price)
        rr     = round(reward / risk, 3) if risk > 0 else 0.0
        return round(sl, 8), round(tp1, 8), round(tp2, 8), round(tp3, 8), rr

    def risk_based_size(self, price: float, stop_loss: float,
                        portfolio_size: float = 10_000.0,
                        position_scale: float = 1.0) -> dict:
        risk_per_unit = abs(price - stop_loss)
        if risk_per_unit < 1e-12:
            return {"position_units": 0.0, "risk_amount": 0.0, "position_value": 0.0}
        max_risk  = portfolio_size * RISK_CFG.max_risk_pct
        raw_units = max_risk / risk_per_unit * position_scale
        raw_value = raw_units * price
        cap       = portfolio_size * RISK_CFG.max_position_pct
        if raw_value > cap:
            raw_units = cap / price
            raw_value = cap
        return {
            "position_units": round(raw_units, 8),
            "risk_amount":    round(raw_units * risk_per_unit, 4),
            "position_value": round(raw_value, 2),
        }

    def kelly_size(self, win_rate: float, avg_win_loss: float,
                   portfolio_size: float = 10_000.0) -> float:
        if avg_win_loss <= 0 or win_rate <= 0:
            return portfolio_size * 0.01
        kelly = (win_rate * avg_win_loss - (1.0 - win_rate)) / avg_win_loss
        kelly = max(kelly, 0.0) * RISK_CFG.kelly_fraction
        kelly = min(kelly, RISK_CFG.max_position_pct)
        return round(portfolio_size * kelly, 2)

    def validate(self, rr: float, confidence: float,
                 min_confidence: float) -> Tuple[bool, str]:
        if rr < RISK_CFG.min_rr:
            return False, f"R:R {rr:.2f} below minimum {RISK_CFG.min_rr}"
        if confidence < min_confidence:
            return False, f"Confidence {confidence:.1%} below threshold {min_confidence:.1%}"
        return True, "OK"