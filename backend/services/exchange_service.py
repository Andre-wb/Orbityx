"""
Multi-exchange CCXT service.
Supports: Binance, Bybit, OKX, Coinbase Advanced, Kraken.

Uses ccxt.async_support for non-blocking I/O.
"""
import asyncio
import logging
from typing import Optional

import ccxt.async_support as ccxt_async

log = logging.getLogger("exchange_service")

# ---------------------------------------------------------------------------
# Exchange registry
# ---------------------------------------------------------------------------
EXCHANGE_IDS = ["binance", "bybit", "okx", "coinbaseadvanced", "kraken"]

_EXCHANGE_CONFIG: dict[str, dict] = {
    "binance":          {"enableRateLimit": True},
    "bybit":            {"enableRateLimit": True},
    "okx":              {"enableRateLimit": True, "options": {"defaultType": "spot", "fetchMarkets": ["spot"]}},
    "coinbaseadvanced": {"enableRateLimit": True},
    "kraken":           {"enableRateLimit": True},
}

# Priority order for fetching a symbol (try in this order until one works)
EXCHANGE_PRIORITY = ["binance", "bybit", "okx", "coinbaseadvanced", "kraken"]


class ExchangeService:
    """Thin async wrapper around ccxt for multiple exchanges."""

    def __init__(self):
        self._exchanges: dict[str, ccxt_async.Exchange] = {}
        # Cache: exchange_id → {symbol → market_info}
        self._markets: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def _exchange(self, exchange_id: str) -> ccxt_async.Exchange:
        if exchange_id not in self._exchanges:
            cls = getattr(ccxt_async, exchange_id, None)
            if cls is None:
                raise ValueError(f"Unknown exchange: {exchange_id}")
            self._exchanges[exchange_id] = cls(_EXCHANGE_CONFIG[exchange_id])
        return self._exchanges[exchange_id]

    async def close(self):
        for ex in self._exchanges.values():
            try:
                await ex.close()
            except Exception:
                pass
        self._exchanges.clear()

    # ------------------------------------------------------------------
    # Market discovery
    # ------------------------------------------------------------------
    async def load_markets(self, exchange_id: str) -> dict:
        """Return raw ccxt markets dict. Results are cached."""
        if exchange_id in self._markets:
            return self._markets[exchange_id]
        ex = self._exchange(exchange_id)
        try:
            markets = await ex.load_markets()
            self._markets[exchange_id] = markets
            return markets
        except Exception as e:
            log.warning(f"[{exchange_id}] load_markets failed: {e}")
            return {}

    async def load_all_markets(self) -> dict[str, dict]:
        """Load markets from all exchanges concurrently."""
        tasks = {eid: asyncio.create_task(self.load_markets(eid))
                 for eid in EXCHANGE_IDS}
        results: dict[str, dict] = {}
        for eid, task in tasks.items():
            try:
                results[eid] = await task
            except Exception as e:
                log.warning(f"[{eid}] market load error: {e}")
                results[eid] = {}
        return results

    def get_usdt_symbols(self, exchange_id: str, min_volume: float = 0) -> list[str]:
        """Return USDT/USD-quoted spot symbols available on the exchange."""
        markets = self._markets.get(exchange_id, {})
        result = []
        for sym, m in markets.items():
            if not m.get("active", True):
                continue
            quote = m.get("quote", "")
            if quote not in ("USDT", "USD", "USDC"):
                continue
            if m.get("type", "spot") not in ("spot", "future", "swap"):
                continue
            result.append(sym)
        return result

    def get_all_symbols(self) -> dict[str, list[str]]:
        """Return {exchange_id: [symbol, ...]} for all loaded exchanges."""
        return {eid: self.get_usdt_symbols(eid)
                for eid in EXCHANGE_IDS
                if eid in self._markets}

    # ------------------------------------------------------------------
    # OHLCV fetching
    # ------------------------------------------------------------------
    async def fetch_ohlcv(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str,
        since: Optional[int] = None,
        limit: int = 1000,
    ) -> list[list]:
        """
        Fetch OHLCV from a specific exchange.
        Returns list of [timestamp, open, high, low, close, volume].
        """
        ex = self._exchange(exchange_id)
        try:
            candles = await ex.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
            return candles or []
        except Exception as e:
            log.debug(f"[{exchange_id}] fetch_ohlcv {symbol} {timeframe}: {e}")
            return []

    async def fetch_ohlcv_paginated(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str,
        since: Optional[int] = None,
        max_candles: int = 5000,
    ) -> list[list]:
        """Paginated fetch up to max_candles bars."""
        ex = self._exchange(exchange_id)
        all_candles: list[list] = []
        cursor = since
        limit = 1000

        while len(all_candles) < max_candles:
            try:
                chunk = await ex.fetch_ohlcv(symbol, timeframe, since=cursor, limit=limit)
            except Exception as e:
                log.warning(f"[{exchange_id}] paginated fetch error {symbol}: {e}")
                break
            if not chunk:
                break
            all_candles.extend(chunk)
            if len(chunk) < limit:
                break
            cursor = chunk[-1][0] + 1
            await asyncio.sleep(ex.rateLimit / 1000)

        return all_candles[:max_candles]

    async def fetch_ohlcv_best(
        self,
        symbol: str,
        timeframe: str,
        since: Optional[int] = None,
        max_candles: int = 5000,
    ) -> tuple[str, list[list]]:
        """
        Try exchanges in priority order and return data from the first one
        that has this symbol. Returns (exchange_id, candles).
        """
        for eid in EXCHANGE_PRIORITY:
            # Check if symbol is known on this exchange (if markets loaded)
            markets = self._markets.get(eid, {})
            if markets and symbol not in markets:
                continue
            candles = await self.fetch_ohlcv_paginated(eid, symbol, timeframe, since, max_candles)
            if candles:
                return eid, candles
        return "", []

    # ------------------------------------------------------------------
    # Volume-sorted top symbols
    # ------------------------------------------------------------------
    def get_top_symbols(self, exchange_id: str = "binance", n: int = 200) -> list[str]:
        """Return top-N USDT symbols sorted by quote volume (desc)."""
        markets = self._markets.get(exchange_id, {})
        scored: list[tuple[float, str]] = []
        for sym, m in markets.items():
            if not m.get("active", True):
                continue
            if m.get("quote") not in ("USDT", "USD"):
                continue
            vol = m.get("info", {}).get("volume", 0)
            try:
                vol = float(vol)
            except (TypeError, ValueError):
                vol = 0.0
            scored.append((vol, sym))
        scored.sort(reverse=True)
        return [sym for _, sym in scored[:n]]


# Module-level singleton
exchange_service = ExchangeService()
