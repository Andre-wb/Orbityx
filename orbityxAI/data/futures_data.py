"""
Futures Market Data — Funding Rate, OI, Long/Short Ratio  v6.2
===============================================================
FIXES vs v6.1:
  BUG FIX #1  — funding_features(): range(0, len-2, 3) silently dropped the
                 1–2 most recent funding payments — exactly the data that matters
                 most for a live signal.  Fix: range(0, len(arr), 3).
                 Slicing arr[i:i+3] already handles out-of-bounds safely in NumPy.

  BUG FIX #2  — open_interest_features(): the feature was documented as
                 "divergence" but the sign product np.sign(price_ret)*np.sign(oi_ret)
                 returns +1 when both move together (confirmation) and -1 when
                 they diverge — the opposite of the comment.
                 No code change needed (the math is right), but the docstring,
                 variable name f3 and inline comment have been corrected so
                 future readers don't misinterpret or accidentally invert the signal.

  MAX BARS    — Default limit raised to 500_000 / 500 (API caps apply).
"""
import asyncio
import numpy as np
from typing import Optional, Dict
import httpx
from utils.logger import log

# ---------------------------------------------------------------------------
# Fetcher
# ---------------------------------------------------------------------------

class FuturesDataFetcher:
    """
    Loads historical futures market data from Binance public endpoints.
    No API key required.
    """

    FUTURES_BASE = "https://fapi.binance.com"

    # Maximum history available per endpoint
    MAX_FUNDING_RECORDS    = 1_000   # Binance cap per request; loop for more
    MAX_OI_RECORDS         = 500     # Binance cap per request
    MAX_LS_RECORDS         = 500     # Binance cap per request

    @staticmethod
    async def fetch_funding_history(
            symbol: str = "BTCUSDT",
            limit:  int = MAX_FUNDING_RECORDS,
    ) -> Optional[np.ndarray]:
        """
        Historical funding rates.
        Binance pays every 8 hours (3 times per day).
        Returns array ordered oldest → newest.

        For full history: call in a loop stepping startTime / endTime.
        Single call returns up to 1 000 records (≈ 333 days).
        """
        url    = f"{FuturesDataFetcher.FUTURES_BASE}/fapi/v1/fundingRate"
        params = {"symbol": symbol.upper(), "limit": min(limit, 1_000)}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                data  = r.json()
                rates = [float(item["fundingRate"]) for item in data]
                log.info(
                    f"Funding rate {symbol}: {len(rates)} записей, "
                    f"последний: {rates[-1] * 100:.4f}%"
                )
                return np.array(rates)
        except Exception as e:
            log.warning(f"Funding rate {symbol}: {e}")
            return None

    @staticmethod
    async def fetch_funding_full(
            symbol: str = "BTCUSDT",
            max_records: int = 500_000,
    ) -> Optional[np.ndarray]:
        """
        Paginated fetch — pulls the entire available funding history.
        Each page = 1 000 records; pages backwards using endTime.
        """
        url       = f"{FuturesDataFetcher.FUTURES_BASE}/fapi/v1/fundingRate"
        all_rates = []
        end_ms    = None

        async with httpx.AsyncClient(timeout=20) as client:
            while len(all_rates) < max_records:
                params: dict = {"symbol": symbol.upper(), "limit": 1_000}
                if end_ms is not None:
                    params["endTime"] = end_ms
                try:
                    r    = await client.get(url, params=params)
                    r.raise_for_status()
                    data = r.json()
                except Exception as e:
                    log.warning(f"Funding paginated {symbol}: {e}")
                    break

                if not data:
                    break

                all_rates = data + all_rates
                end_ms    = int(data[0]["fundingTime"]) - 1

                if len(data) < 1_000:
                    break
                await asyncio.sleep(0.10)

        if not all_rates:
            return None

        rates = [float(item["fundingRate"]) for item in all_rates]
        log.info(f"Funding full {symbol}: {len(rates)} записей")
        return np.array(rates)

    @staticmethod
    async def fetch_open_interest_history(
            symbol:    str = "BTCUSDT",
            timeframe: str = "1h",
            limit:     int = MAX_OI_RECORDS,
    ) -> Optional[np.ndarray]:
        """
        Historical open interest.
        Rising OI + rising price = trend strengthening.
        Rising OI + falling price = short pressure building.
        """
        tf_map = {
            "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "4h": "4h",   "1d":  "1d",
        }
        period = tf_map.get(timeframe, "1h")
        url    = f"{FuturesDataFetcher.FUTURES_BASE}/futures/data/openInterestHist"
        params = {
            "symbol": symbol.upper(),
            "period": period,
            "limit":  min(limit, 500),
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r  = await client.get(url, params=params)
                r.raise_for_status()
                data = r.json()
                oi   = [float(item["sumOpenInterestValue"]) for item in data]
                log.info(f"Open Interest {symbol}: {len(oi)} записей")
                return np.array(oi)
        except Exception as e:
            log.warning(f"Open Interest {symbol}: {e}")
            return None

    @staticmethod
    async def fetch_liquidations_stats(symbol: str = "BTCUSDT") -> dict:
        """24-hour liquidation snapshot (current, not historical)."""
        url    = f"{FuturesDataFetcher.FUTURES_BASE}/fapi/v1/ticker/24hr"
        params = {"symbol": symbol.upper()}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r    = await client.get(url, params=params)
                r.raise_for_status()
                data = r.json()
                return {
                    "volume_24h":       float(data.get("quoteVolume", 0)),
                    "price_change_pct": float(data.get("priceChangePercent", 0)),
                    "high_24h":         float(data.get("highPrice", 0)),
                    "low_24h":          float(data.get("lowPrice", 0)),
                    "count_24h":        int(data.get("count", 0)),
                }
        except Exception as e:
            log.warning(f"Liquidations stats {symbol}: {e}")
            return {}

    @staticmethod
    async def fetch_long_short_ratio(
            symbol:    str = "BTCUSDT",
            timeframe: str = "1h",
            limit:     int = MAX_LS_RECORDS,
    ) -> Optional[np.ndarray]:
        """
        Top-trader long/short position ratio.
        > 1.0 = more longs; < 1.0 = more shorts.
        Extreme readings are contrarian signals.
        """
        tf_map = {
            "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "4h": "4h",   "1d":  "1d",
        }
        period = tf_map.get(timeframe, "1h")
        url    = f"{FuturesDataFetcher.FUTURES_BASE}/futures/data/topLongShortPositionRatio"
        params = {
            "symbol": symbol.upper(),
            "period": period,
            "limit":  min(limit, 500),
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r      = await client.get(url, params=params)
                r.raise_for_status()
                data   = r.json()
                ratios = [float(item["longShortRatio"]) for item in data]
                log.info(
                    f"L/S ratio {symbol}: {len(ratios)} записей, "
                    f"текущий: {ratios[-1]:.3f}"
                )
                return np.array(ratios)
        except Exception as e:
            log.warning(f"L/S ratio {symbol}: {e}")
            return None

    @staticmethod
    async def fetch_all(
            symbol:    str = "BTCUSDT",
            timeframe: str = "1h",
            limit:     int = 500,
    ) -> dict:
        """Load all futures data in parallel."""
        funding_limit = limit * 3   # 3 funding payments per day

        funding, oi, ls = await asyncio.gather(
            FuturesDataFetcher.fetch_funding_history(symbol, funding_limit),
            FuturesDataFetcher.fetch_open_interest_history(symbol, timeframe, limit),
            FuturesDataFetcher.fetch_long_short_ratio(symbol, timeframe, limit),
            return_exceptions=True,
        )

        return {
            "funding_rate":  funding if not isinstance(funding, Exception) else None,
            "open_interest": oi      if not isinstance(oi, Exception)      else None,
            "long_short":    ls      if not isinstance(ls, Exception)      else None,
        }


# ---------------------------------------------------------------------------
# Feature builder
# ---------------------------------------------------------------------------

class FuturesFeatureBuilder:
    """
    Builds features from futures market data.
    All outputs are normalised to ≈ [-1, 1] via tanh.
    """

    @staticmethod
    def funding_features(funding_arr: Optional[np.ndarray], n: int) -> np.ndarray:
        """
        Features derived from funding rate (3 payments per day for daily bars).

        Features:
          f1 — current daily funding level (tanh-scaled)
          f2 — z-score vs trailing 30-day mean (captures extremes)
          f3 — 7-day cumulative funding (crowded positioning signal)
          f4 — direction of change vs previous day (momentum of sentiment)

        BUG FIX #1: was range(0, len(arr)-2, 3) which silently dropped the
        1–2 most recent payments. Fixed to range(0, len(arr), 3); NumPy
        slicing arr[i:i+3] is safe even when i+3 > len(arr).
        """
        if funding_arr is None or len(funding_arr) < 4:
            return np.zeros((n, 4))

        # Aggregate 3 intra-day payments into one daily value.
        # BUG FIX #1: was range(0, len(funding_arr) - 2, 3)
        daily_funding = [
            float(np.sum(funding_arr[i: i + 3]))
            for i in range(0, len(funding_arr), 3)
        ]
        f = np.array(daily_funding)

        # Align to length n (pad with oldest value at the left)
        if len(f) < n:
            f = np.pad(f, (n - len(f), 0), mode="edge")
        else:
            f = f[-n:]

        # f1: current level
        f1 = np.tanh(f * 1_000)

        # f2: z-score (30-day window)
        mu  = np.array([np.mean(f[max(0, i - 30): i + 1]) for i in range(n)])
        std = np.array([np.std(f[max(0, i - 30): i + 1]) + 1e-9 for i in range(n)])
        f2  = np.tanh((f - mu) / std)

        # f3: 7-day cumulative (crowdedness)
        f3 = np.array([np.sum(f[max(0, i - 6): i + 1]) for i in range(n)])
        f3 = np.tanh(f3 * 200)

        # f4: day-over-day direction
        f4      = np.zeros(n)
        f4[1:]  = np.sign(f[1:] - f[:-1])

        return np.column_stack([f1, f2, f3, f4])

    @staticmethod
    def open_interest_features(
            oi_arr: Optional[np.ndarray],
            closes: np.ndarray,
            n:      int,
    ) -> np.ndarray:
        """
        Features derived from open interest.

        Features:
          f1 — OI relative to its 20-bar mean (normalised)
          f2 — OI rate of change (speed of position build/liquidation)
          f3 — OI-price confirmation score:
               +1 → OI and price move together  (trend confirmation)
               -1 → OI and price move opposite  (trend divergence / weakness)
               0  → one is flat

        BUG FIX #2: the previous docstring labelled f3 "divergence" and said
        "+1 = OI rises & price rises" was confirmation; the comment was
        contradicted by variable names.  Clarified throughout — the math is
        unchanged (sign product is the correct formula for this signal).
        """
        if oi_arr is None or len(oi_arr) < 5:
            return np.zeros((n, 3))

        if len(oi_arr) < n:
            oi = np.pad(oi_arr, (n - len(oi_arr), 0), mode="edge")
        else:
            oi = oi_arr[-n:]

        # f1: ratio to 20-bar mean
        oi_ma = np.array([np.mean(oi[max(0, i - 19): i + 1]) for i in range(n)])
        f1    = np.tanh(oi / (oi_ma + 1e-9) - 1.0)

        # f2: rate of change
        f2      = np.zeros(n)
        f2[1:]  = np.diff(oi) / (np.abs(oi[:-1]) + 1e-9)
        f2      = np.tanh(f2 * 5)

        # f3: OI-price confirmation / divergence
        # +1 = confirmation (both up or both down) → trend is healthy
        # -1 = divergence (price up but OI down, or vice-versa) → trend is weak
        price_ret       = np.zeros(n)
        price_ret[1:]   = np.diff(closes[:n]) / (closes[:n - 1] + 1e-9)
        oi_ret          = np.zeros(n)
        oi_ret[1:]      = np.diff(oi) / (np.abs(oi[:-1]) + 1e-9)
        f3              = np.sign(price_ret) * np.sign(oi_ret)   # +1=confirm, -1=diverge

        return np.column_stack([f1, f2, f3])

    @staticmethod
    def long_short_features(
            ls_arr: Optional[np.ndarray],
            n:      int,
    ) -> np.ndarray:
        """
        Features derived from top-trader L/S ratio.

        Features:
          f1 — deviation from neutral (1.0)
          f2 — z-score vs trailing 20-bar mean (contrarian extremes)
        """
        if ls_arr is None or len(ls_arr) < 5:
            return np.zeros((n, 2))

        if len(ls_arr) < n:
            ls = np.pad(ls_arr, (n - len(ls_arr), 0), mode="edge")
        else:
            ls = ls_arr[-n:]

        f1 = np.tanh((ls - 1.0) * 2)

        mu  = np.array([np.mean(ls[max(0, i - 20): i + 1]) for i in range(n)])
        std = np.array([np.std(ls[max(0, i - 20): i + 1]) + 1e-9 for i in range(n)])
        f2  = np.tanh((ls - mu) / std)

        return np.column_stack([f1, f2])

    @staticmethod
    def build_all(futures_data: dict, closes: np.ndarray) -> np.ndarray:
        """
        Build the full (n, 9) futures feature matrix:
          cols 0-3 → funding (4 features)
          cols 4-6 → open interest (3 features)
          cols 7-8 → long/short ratio (2 features)
        """
        n = len(closes)

        f_fund = FuturesFeatureBuilder.funding_features(
            futures_data.get("funding_rate"), n
        )
        f_oi = FuturesFeatureBuilder.open_interest_features(
            futures_data.get("open_interest"), closes, n
        )
        f_ls = FuturesFeatureBuilder.long_short_features(
            futures_data.get("long_short"), n
        )

        result = np.hstack([f_fund, f_oi, f_ls])
        return np.where(np.isnan(result) | np.isinf(result), 0.0, result)