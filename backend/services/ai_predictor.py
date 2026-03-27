"""
AI Predictor service — thin wrapper around orbityxAI.predictor.OrbityxPredictor.

sys.path is extended to include the orbityxAI package directory so that its
relative imports (from features.engineer import ...) resolve correctly.
"""
import sys
import os

# Make orbityxAI imports work (they use package-relative paths without prefix)
_AI_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'orbityxAI')
_AI_DIR = os.path.abspath(_AI_DIR)
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

import httpx
from typing import Optional


# ---------------------------------------------------------------------------
# Real predictor from orbityxAI
# ---------------------------------------------------------------------------
try:
    from predictor import OrbityxPredictor                   # type: ignore[import]
    from signals.generator import TradingSignal               # type: ignore[import]
    _USE_REAL = True
except Exception as _import_err:
    import warnings
    warnings.warn(
        f"[ai_predictor] Failed to import orbityxAI ({_import_err}). "
        "Falling back to built-in lightweight predictor.",
        stacklevel=1,
    )
    _USE_REAL = False


# ---------------------------------------------------------------------------
# Fallback: lightweight built-in predictor (used if orbityxAI deps missing)
# ---------------------------------------------------------------------------
if not _USE_REAL:
    import numpy as np
    from dataclasses import dataclass, field

    @dataclass
    class TradingSignal:                                      # type: ignore[no-redef]
        symbol: str; timeframe: str; current_price: float; predicted_price: float
        predicted_return: float = 0.0; pred_reliable: bool = False
        direction: str = "NEUTRAL"; signal: str = "HOLD"
        confidence: float = 0.0; prob_up: float = 0.5
        conformal_include_up: bool = True; conformal_include_down: bool = True
        conformal_certain: bool = False
        stop_loss: float = 0.0; take_profit_1: float = 0.0
        take_profit_2: float = 0.0; take_profit_3: float = 0.0
        risk_reward: float = 0.0; is_valid_trade: bool = False
        invalid_reason: str = ""; support_levels: list = field(default_factory=list)
        resistance_levels: list = field(default_factory=list)
        rsi: float = 50.0; rsi_fast: float = 50.0; macd_signal: str = "neutral"
        adx: float = 0.0; trend: str = "sideways"; regime: str = "Range / Sideways"
        bb_position: float = 0.5; atr_pct: float = 0.01; pattern_score: float = 0.0
        supertrend_dir: float = 1.0; oof_logloss: float = 0.0
        oof_brier: float = 0.0; reg_rmse: float = 0.0
        on_chain: dict = field(default_factory=dict)
        position_sizing: dict = field(default_factory=dict)

    class OrbityxPredictor:                                   # type: ignore[no-redef]
        """Minimal fallback predictor using simple TA scoring."""

        @staticmethod
        def _ema(arr, period):
            result = np.full(len(arr), np.nan)
            if len(arr) < period:
                return result
            k = 2 / (period + 1)
            result[period - 1] = np.mean(arr[:period])
            for i in range(period, len(arr)):
                result[i] = arr[i] * k + result[i - 1] * (1 - k)
            return result

        def analyze(self, symbol, timeframe, opens, highs, lows, closes, volumes,
                    on_chain=None, auto_train=True):
            c = np.array(closes, dtype=float)
            h = np.array(highs, dtype=float)
            l = np.array(lows, dtype=float)
            v = np.array(volumes, dtype=float)
            price = float(c[-1])
            atr_val = float(np.mean(h[-14:] - l[-14:])) if len(c) >= 14 else price * 0.01

            # RSI
            deltas = np.diff(c)
            gains = np.where(deltas > 0, deltas, 0.0)
            losses = np.where(deltas < 0, -deltas, 0.0)
            if len(gains) >= 14:
                ag = np.mean(gains[:14]); al = np.mean(losses[:14])
                for g, lo in zip(gains[14:], losses[14:]):
                    ag = (ag * 13 + g) / 14; al = (al * 13 + lo) / 14
                rsi_val = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
            else:
                rsi_val = 50.0

            score = (1.0 if rsi_val < 40 else -1.0 if rsi_val > 60 else 0.0)
            direction = "LONG" if score > 0 else "SHORT" if score < 0 else "NEUTRAL"
            confidence = min(abs(score), 1.0)
            sl = round(price - atr_val * 2 if direction == "LONG" else price + atr_val * 2, 4)
            tp1 = round(price + atr_val * 3 if direction == "LONG" else price - atr_val * 3, 4)
            tp2 = round(price + atr_val * 5 if direction == "LONG" else price - atr_val * 5, 4)
            tp3 = round(price + atr_val * 8 if direction == "LONG" else price - atr_val * 8, 4)
            risk = abs(price - sl)
            rr = round(abs(tp1 - price) / risk, 2) if risk > 0 else 0.0

            return TradingSignal(
                symbol=symbol, timeframe=timeframe,
                current_price=round(price, 4),
                predicted_price=round(tp1, 4),
                direction=direction, signal="BUY" if direction == "LONG" else "SELL" if direction == "SHORT" else "HOLD",
                confidence=round(confidence, 3),
                stop_loss=sl, take_profit_1=tp1, take_profit_2=tp2, take_profit_3=tp3,
                risk_reward=rr, rsi=round(rsi_val, 2),
                on_chain=on_chain or {},
            )


# ---------------------------------------------------------------------------
# On-chain data fetcher (used by the AI router)
# ---------------------------------------------------------------------------
class OnChainFetcher:
    BLOCKCHAIN_API = "https://api.blockchain.info/stats"
    COINGECKO_API = "https://api.coingecko.com/api/v3"

    @staticmethod
    async def fetch_bitcoin_onchain() -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                r = await client.get(OnChainFetcher.BLOCKCHAIN_API)
                data = r.json()
                return {
                    "hash_rate": data.get("hash_rate", 0),
                    "difficulty": data.get("difficulty", 0),
                    "mempool_size": data.get("mempool_size", 0),
                    "n_tx": data.get("n_tx", 0),
                    "total_fees_btc": data.get("total_fees_btc", 0),
                    "minutes_between_blocks": data.get("minutes_between_blocks", 10),
                }
            except Exception:
                return {}

    @staticmethod
    async def fetch_coingecko_metrics(coin_id: str = "bitcoin") -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                r = await client.get(f"{OnChainFetcher.COINGECKO_API}/coins/{coin_id}")
                data = r.json()
                md = data.get("market_data", {})
                return {
                    "fear_greed_proxy": md.get("price_change_percentage_14d_in_currency", {}).get("usd", 0),
                    "market_cap_usd": md.get("market_cap", {}).get("usd", 0),
                    "volume_24h": md.get("total_volume", {}).get("usd", 0),
                    "btc_dominance": data.get("market_cap_rank", 1),
                    "circulating_supply": md.get("circulating_supply", 0),
                    "ath_change_pct": md.get("ath_change_percentage", {}).get("usd", 0),
                }
            except Exception:
                return {}


predictor = OrbityxPredictor()
