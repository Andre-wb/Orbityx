"""
binance_client.py — thin Python mirror of BinanceProvider (binance.ts).

Calls the exact same Binance REST endpoints so test results reflect what
the TypeScript provider will receive in the browser.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import requests

from config import cfg

# ── Timeframe → Binance interval map (mirrors TF_INTERVAL in binance.ts) ─────
TF_INTERVAL: dict[str, str] = {
    "1m": "1m",   "5m": "5m",   "15m": "15m", "30m": "30m",
    "1h": "1h",   "4h": "4h",   "12h": "12h",
    "1d": "1d",   "3d": "3d",   "1w": "1w",   "2w": "1w",
    "1month": "1M", "3month": "1M", "6month": "1M", "1y": "1M",
}

# ── Default candle limits per timeframe (mirrors TF_LIMIT in binance.ts) ──────
TF_LIMIT: dict[str, int] = {
    "1m": 500, "5m": 500, "15m": 400, "30m": 300,
    "1h": 500, "4h": 500, "12h": 365,
    "1d": 500, "3d": 365, "1w": 200,
    "1month": 60, "3month": 60, "6month": 60, "1y": 60,
}


# ─────────────────────────────────────────────────────────────────────────────
# Data classes (match the TypeScript Candle / MarketStats interfaces)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Candle:
    timestamp:  int    # epoch ms
    open:       float
    high:       float
    low:        float
    close:      float
    volume:     float

    @property
    def is_bullish(self) -> bool:
        return self.close >= self.open

    def __repr__(self) -> str:
        direction = "▲" if self.is_bullish else "▼"
        return (
            f"Candle({direction} O={self.open:.4f} H={self.high:.4f} "
            f"L={self.low:.4f} C={self.close:.4f} V={self.volume:.2f})"
        )


@dataclass
class MarketStats:
    high_24h:            float
    low_24h:             float
    volume_24h:          float
    price_change_24h:    float
    price_change_pct_24h: float
    market_cap:          float | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Client
# ─────────────────────────────────────────────────────────────────────────────

class BinanceClient:
    """
    Thin wrapper around the public Binance v3 REST API.
    Mirrors exactly what BinanceProvider (binance.ts) calls so Python tests
    validate the same data the library will consume.
    """

    def __init__(self) -> None:
        self.base    = cfg.binance_base_url.rstrip("/")
        self.timeout = cfg.request_timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "OrbityxTest/1.0",
        })
        if cfg.binance_api_key:
            self.session.headers["X-MBX-APIKEY"] = cfg.binance_api_key

    # ── Internal ─────────────────────────────────────────────────────────────

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base}{path}"
        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ── Public API (same endpoints as binance.ts) ─────────────────────────────

    def ping(self) -> bool:
        """GET /api/v3/ping — returns True when Binance is reachable."""
        try:
            self._get("/ping")
            return True
        except Exception:
            return False

    def server_time(self) -> int:
        """GET /api/v3/time — returns server epoch ms."""
        data = self._get("/time")
        return int(data["serverTime"])

    def exchange_info(self, symbol: str) -> dict[str, Any]:
        """GET /api/v3/exchangeInfo — returns symbol metadata."""
        return self._get("/exchangeInfo", {"symbol": symbol})  # type: ignore[return-value]

    def fetch_candles(
            self,
            symbol:    str,
            timeframe: str,
            limit:     int | None = None,
            start_ms:  int | None = None,
            end_ms:    int | None = None,
    ) -> list[Candle]:
        """
        GET /api/v3/klines — mirrors BinanceProvider.fetchCandles().

        Returns normalised Candle objects identical to what the TypeScript
        provider would return after parseFloat() on each field.
        """
        interval = TF_INTERVAL.get(timeframe, "1d")
        n        = limit or cfg.candle_limit

        params: dict[str, Any] = {
            "symbol":   symbol,
            "interval": interval,
            "limit":    n,
        }
        if start_ms is not None:
            params["startTime"] = start_ms
        if end_ms is not None:
            params["endTime"] = end_ms

        rows: list[list[Any]] = self._get("/klines", params)

        return [
            Candle(
                timestamp = int(row[0]),
                open      = float(row[1]),
                high      = float(row[2]),
                low       = float(row[3]),
                close     = float(row[4]),
                volume    = float(row[5]),
            )
            for row in rows
        ]

    def fetch_market_stats(self, symbol: str) -> MarketStats:
        """
        GET /api/v3/ticker/24hr — mirrors BinanceProvider.fetchMarketStats().
        """
        data = self._get("/ticker/24hr", {"symbol": symbol})
        return MarketStats(
            high_24h             = float(data["highPrice"]),
            low_24h              = float(data["lowPrice"]),
            volume_24h           = float(data["quoteVolume"]),
            price_change_24h     = float(data["priceChange"]),
            price_change_pct_24h = float(data["priceChangePercent"]),
        )

    def fetch_ticker_price(self, symbol: str) -> float:
        """GET /api/v3/ticker/price — latest trade price."""
        data = self._get("/ticker/price", {"symbol": symbol})
        return float(data["price"])

    def fetch_order_book(self, symbol: str, depth: int = 5) -> dict[str, Any]:
        """GET /api/v3/depth — order book snapshot."""
        return self._get("/depth", {"symbol": symbol, "limit": depth})  # type: ignore[return-value]


# Module-level singleton.
client = BinanceClient()