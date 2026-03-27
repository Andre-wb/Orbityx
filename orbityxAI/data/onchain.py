"""
On-chain & Sentiment Data Fetcher  v6.2
========================================
FIXES vs v6.1:
  BUG FIX #1  — fetch() returned raw scalar values (int/float) for every field.
                 FeatureEngineer.build_with_onchain() expected np.ndarray of length n
                 for fear_greed and hash_rate.  Passing a scalar caused a
                 ValueError in np.column_stack ("dimension 0 has size 1 vs n").
                 Fix: scalar fields are now broadcast to shape-(n,) arrays inside
                 a new helper build_feature_arrays(n).

  ARCHITECTURAL NOTE — Blockchain.info / CoinGecko return CURRENT snapshots only.
                 They have no public historical endpoint for backtesting.
                 For genuine historical on-chain backtests use:
                   • Glassnode (paid)
                   • CryptoQuant (paid)
                   • Blockchain.com charts CSV export (free, manual)
                 Until historical data is wired in, on-chain features are valid
                 only in LIVE / forward-test mode where a single current reading
                 is broadcast across all bars in the current window.
"""
import numpy as np
import httpx
from typing import Optional
from config import BLOCKCHAIN_INFO_URL, COINGECKO_URL, ALTERNATIVE_ME_URL
from utils.logger import log


class OnChainFetcher:
    """
    Fetches current on-chain and sentiment snapshots.

    LIVE USE:  Call fetch() → pass the result to build_feature_arrays(n)
               to get properly shaped arrays for the feature engineer.

    BACKTEST:  On-chain data is replicated across all bars in the window
               (the current snapshot is the best available approximation).
               For real historical on-chain backtesting, replace with a
               Glassnode / CryptoQuant integration.
    """

    @staticmethod
    async def fetch(coin_id: str = "bitcoin") -> dict:
        """
        Fetch current on-chain and sentiment data.
        Returns a flat dict of SCALAR values.
        Use build_feature_arrays() to convert to ndarray for the feature engineer.
        """
        result: dict = {}

        async with httpx.AsyncClient(timeout=15) as client:

            # ── Blockchain.info ───────────────────────────────────────────
            try:
                r    = await client.get(BLOCKCHAIN_INFO_URL)
                data = r.json()
                result.update({
                    "hash_rate":              float(data.get("hash_rate",              0)),
                    "difficulty":             float(data.get("difficulty",             0)),
                    "mempool_size":           float(data.get("mempool_size",           0)),
                    "n_tx":                   float(data.get("n_tx",                   0)),
                    "minutes_between_blocks": float(data.get("minutes_between_blocks", 10)),
                })
            except Exception as e:
                log.warning(f"blockchain.info: {e}")
                result.update({
                    "hash_rate": 0.0, "difficulty": 0.0,
                    "mempool_size": 0.0, "n_tx": 0.0,
                    "minutes_between_blocks": 10.0,
                })

            # ── CoinGecko ─────────────────────────────────────────────────
            try:
                r    = await client.get(f"{COINGECKO_URL}/coins/{coin_id}")
                data = r.json()
                md   = data.get("market_data", {})
                result.update({
                    "fear_greed_proxy":   float(
                        md.get("price_change_percentage_14d_in_currency", {})
                        .get("usd", 0)
                    ),
                    "market_cap_usd":     float(md.get("market_cap",   {}).get("usd", 0)),
                    "volume_24h":         float(md.get("total_volume", {}).get("usd", 0)),
                    "circulating_supply": float(md.get("circulating_supply", 0)),
                    "ath_change_pct":     float(
                        md.get("ath_change_percentage", {}).get("usd", 0)
                    ),
                    "price_change_7d":    float(
                        md.get("price_change_percentage_7d_in_currency", {})
                        .get("usd", 0)
                    ),
                    "price_change_30d":   float(
                        md.get("price_change_percentage_30d_in_currency", {})
                        .get("usd", 0)
                    ),
                })
            except Exception as e:
                log.warning(f"CoinGecko: {e}")
                for key in [
                    "fear_greed_proxy", "market_cap_usd", "volume_24h",
                    "circulating_supply", "ath_change_pct",
                    "price_change_7d", "price_change_30d",
                ]:
                    result.setdefault(key, 0.0)

            # ── Fear & Greed index ────────────────────────────────────────
            try:
                r    = await client.get(f"{ALTERNATIVE_ME_URL}?limit=1")
                data = r.json()
                result["fear_greed_index"] = float(data["data"][0]["value"])
                result["fear_greed_class"] = data["data"][0]["value_classification"]
            except Exception as e:
                log.warning(f"Fear & Greed: {e}")
                result.setdefault("fear_greed_index", 50.0)
                result.setdefault("fear_greed_class", "Neutral")

        return result

    @staticmethod
    def build_feature_arrays(on_chain: dict, n: int) -> dict:
        """
        BUG FIX #1 — Convert the scalar dict returned by fetch() into
        shape-(n,) numpy arrays for use with FeatureEngineer.build_with_onchain().

        Each scalar is broadcast (replicated) across n bars.
        This is the correct approach for live/forward-test mode.
        For historical backtests you would pass actual historical arrays here.

        Returns a dict with the same keys as on_chain but values replaced
        by np.ndarray of shape (n,).
        """
        arrays: dict = {}
        for key, val in on_chain.items():
            if isinstance(val, str):
                # Non-numeric fields (e.g. fear_greed_class) — skip
                continue
            try:
                scalar  = float(val)
                arrays[key] = np.full(n, scalar, dtype=float)
            except (TypeError, ValueError):
                arrays[key] = np.zeros(n, dtype=float)
        return arrays

    @staticmethod
    def fear_greed_array(on_chain: dict, n: int) -> Optional[np.ndarray]:
        """
        Convenience: return the fear-greed index as a shape-(n,) array,
        using fear_greed_index if available, falling back to fear_greed_proxy.

        BUG FIX #1: previously the scalar was passed directly to build_with_onchain()
        which then tried np.column_stack([base, scalar]) → ValueError.
        """
        fg = on_chain.get("fear_greed_index") or on_chain.get("fear_greed_proxy", 50.0)
        try:
            return np.full(n, float(fg), dtype=float)
        except (TypeError, ValueError):
            return np.full(n, 50.0, dtype=float)

    @staticmethod
    def hash_rate_array(on_chain: dict, n: int) -> Optional[np.ndarray]:
        """
        Convenience: return hash_rate as a shape-(n,) array.

        BUG FIX #1: same scalar-vs-array issue as fear_greed_array.
        """
        hr = on_chain.get("hash_rate", 0.0)
        try:
            return np.full(n, float(hr), dtype=float)
        except (TypeError, ValueError):
            return np.zeros(n, dtype=float)