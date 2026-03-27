"""
config.py — load and validate environment variables from .env
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the tests/ directory (or project root as fallback).
_ENV_PATH = Path(__file__).parent / ".env"
if not _ENV_PATH.exists():
    _ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(_ENV_PATH)


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _get_list(key: str, default: str = "") -> list[str]:
    raw = _get(key, default)
    return [v.strip() for v in raw.split(",") if v.strip()]


def _get_int(key: str, default: int) -> int:
    try:
        return int(_get(key, str(default)))
    except ValueError:
        return default


def _get_float(key: str, default: float) -> float:
    try:
        return float(_get(key, str(default)))
    except ValueError:
        return default


@dataclass
class Config:
    # Binance
    binance_base_url:   str       = field(default_factory=lambda: _get("BINANCE_BASE_URL", "https://api.binance.com/api/v3"))
    binance_api_key:    str       = field(default_factory=lambda: _get("BINANCE_API_KEY"))
    binance_api_secret: str       = field(default_factory=lambda: _get("BINANCE_API_SECRET"))

    # What to test
    test_symbols:       list[str] = field(default_factory=lambda: _get_list("TEST_SYMBOLS", "BTCUSDT,ETHUSDT,SOLUSDT"))
    test_timeframes:    list[str] = field(default_factory=lambda: _get_list("TEST_TIMEFRAMES", "1m,1h,1d"))

    # Tuning
    candle_limit:       int       = field(default_factory=lambda: _get_int("TEST_CANDLE_LIMIT", 100))
    request_timeout:    float     = field(default_factory=lambda: _get_float("REQUEST_TIMEOUT", 15.0))
    request_delay:      float     = field(default_factory=lambda: _get_float("REQUEST_DELAY", 0.25))

    # WebSocket
    binance_ws_url:     str       = field(default_factory=lambda: _get("BINANCE_WS_URL", "wss://stream.binance.com:9443/ws"))
    ws_listen_seconds:  int       = field(default_factory=lambda: _get_int("WS_LISTEN_SECONDS", 5))

    def summary(self) -> str:
        lines = [
            "── Config ──────────────────────────────────────────",
            f"  Base URL   : {self.binance_base_url}",
            f"  API key    : {'set' if self.binance_api_key else 'not set (public endpoints only)'}",
            f"  Symbols    : {', '.join(self.test_symbols)}",
            f"  Timeframes : {', '.join(self.test_timeframes)}",
            f"  Limit      : {self.candle_limit} candles",
            f"  Timeout    : {self.request_timeout}s",
            f"  WS URL     : {self.binance_ws_url}",
            f"  WS listen  : {self.ws_listen_seconds}s",
            "────────────────────────────────────────────────────",
        ]
        return "\n".join(lines)


# Module-level singleton — import and use directly.
cfg = Config()