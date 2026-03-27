"""
Universal Exchange Connector v1.0
===================================
Supports Binance, Bybit, MEXC via ccxt.
Configurable at runtime — switch exchanges without code changes.
"""
import ccxt
import numpy as np
import time
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class OrderResult:
    order_id: str
    symbol: str
    side: str       # "buy" or "sell"
    price: float
    amount: float
    status: str     # "open", "closed", "canceled"
    raw: dict


SUPPORTED_EXCHANGES = {
    "binance": ccxt.binance,
    "bybit": ccxt.bybit,
    "mexc": ccxt.mexc,
}


class ExchangeConnector:
    """
    Universal exchange connector.

    Usage:
        conn = ExchangeConnector("binance", api_key="...", secret="...")
        conn = ExchangeConnector("bybit", api_key="...", secret="...", testnet=True)
    """

    def __init__(
            self,
            exchange_id: str = "binance",
            api_key: str = "",
            secret: str = "",
            testnet: bool = False,
            futures: bool = True,
    ):
        if exchange_id not in SUPPORTED_EXCHANGES:
            raise ValueError(f"Exchange '{exchange_id}' not supported. "
                             f"Use: {list(SUPPORTED_EXCHANGES.keys())}")

        cls = SUPPORTED_EXCHANGES[exchange_id]
        config = {
            "apiKey": api_key,
            "secret": secret,
            "enableRateLimit": True,
            "options": {"defaultType": "future" if futures else "spot"},
        }

        if testnet:
            config["sandbox"] = True

        self.exchange = cls(config)
        self.exchange_id = exchange_id
        self.futures = futures
        self._markets_loaded = False

    def _ensure_markets(self):
        if not self._markets_loaded:
            self.exchange.load_markets()
            self._markets_loaded = True

    # ── Market Data ─────────────────────────────────────────────

    def fetch_ohlcv(
            self,
            symbol: str,
            timeframe: str = "1h",
            limit: int = 500,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray,
               np.ndarray, np.ndarray, np.ndarray]:
        """Fetch OHLCV and return (timestamps, opens, highs, lows, closes, volumes)."""
        self._ensure_markets()
        data = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        arr = np.array(data, dtype=float)
        return arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3], arr[:, 4], arr[:, 5]

    def fetch_ticker(self, symbol: str) -> Dict:
        """Get current price, bid, ask, volume."""
        self._ensure_markets()
        return self.exchange.fetch_ticker(symbol)

    def fetch_order_book(self, symbol: str, limit: int = 20) -> Dict:
        """Get order book (bids/asks)."""
        self._ensure_markets()
        return self.exchange.fetch_order_book(symbol, limit)

    def fetch_funding_rate(self, symbol: str) -> Optional[float]:
        """Get current funding rate (futures only)."""
        try:
            info = self.exchange.fetch_funding_rate(symbol)
            return float(info.get("fundingRate", 0))
        except Exception:
            return None

    # ── All Pairs ───────────────────────────────────────────────

    def fetch_all_futures_pairs(self, quote: str = "USDT") -> List[str]:
        """Get all active futures pairs."""
        self._ensure_markets()
        pairs = []
        for symbol, market in self.exchange.markets.items():
            if (market.get("active", True)
                    and market.get("quote") == quote
                    and (market.get("future") or market.get("swap"))):
                pairs.append(symbol)
        return sorted(pairs)

    # ── Order Management ────────────────────────────────────────

    def place_limit_order(
            self,
            symbol: str,
            side: str,
            amount: float,
            price: float,
    ) -> OrderResult:
        """Place a limit order."""
        self._ensure_markets()
        order = self.exchange.create_limit_order(symbol, side, amount, price)
        return self._parse_order(order)

    def place_market_order(
            self,
            symbol: str,
            side: str,
            amount: float,
    ) -> OrderResult:
        """Place a market order."""
        self._ensure_markets()
        order = self.exchange.create_market_order(symbol, side, amount)
        return self._parse_order(order)

    def place_stop_loss(
            self,
            symbol: str,
            side: str,
            amount: float,
            stop_price: float,
    ) -> OrderResult:
        """Place a stop-loss order."""
        self._ensure_markets()
        close_side = "sell" if side == "buy" else "buy"
        # SL triggers when price moves against us
        # LONG (side=buy): SL triggers when price drops = "descending"
        # SHORT (side=sell): SL triggers when price rises = "ascending"
        trigger_dir = "descending" if side == "buy" else "ascending"
        params = {
            "stopPrice": stop_price,
            "triggerDirection": trigger_dir,
            "reduceOnly": True,
        }
        order = self.exchange.create_order(
            symbol, "market", close_side, amount, None, params
        )
        return self._parse_order(order)

    def place_take_profit(
            self,
            symbol: str,
            side: str,
            amount: float,
            tp_price: float,
    ) -> OrderResult:
        """Place a take-profit order."""
        self._ensure_markets()
        close_side = "sell" if side == "buy" else "buy"
        # TP triggers when price moves in our favor
        # LONG (side=buy): TP triggers when price rises = "ascending"
        # SHORT (side=sell): TP triggers when price drops = "descending"
        trigger_dir = "ascending" if side == "buy" else "descending"
        params = {
            "stopPrice": tp_price,
            "triggerDirection": trigger_dir,
            "reduceOnly": True,
        }
        order = self.exchange.create_order(
            symbol, "market", close_side, amount, None, params
        )
        return self._parse_order(order)

    def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an open order."""
        try:
            self.exchange.cancel_order(order_id, symbol)
            return True
        except Exception:
            return False

    def cancel_all_orders(self, symbol: str) -> int:
        """Cancel all open orders for a symbol."""
        try:
            orders = self.exchange.fetch_open_orders(symbol)
            for o in orders:
                self.exchange.cancel_order(o["id"], symbol)
            return len(orders)
        except Exception:
            return 0

    def fetch_open_orders(self, symbol: str = None) -> List[Dict]:
        """Get all open orders."""
        self._ensure_markets()
        return self.exchange.fetch_open_orders(symbol)

    def fetch_positions(self, symbol: str = None) -> List[Dict]:
        """Get open positions (futures)."""
        self._ensure_markets()
        try:
            positions = self.exchange.fetch_positions([symbol] if symbol else None)
            return [p for p in positions
                    if float(p.get("contracts", 0)) > 0
                    or abs(float(p.get("contractSize", 0) or 0)) > 0]
        except Exception:
            return []

    def fetch_balance(self) -> Dict:
        """Get account balance."""
        self._ensure_markets()
        params = {}
        if self.futures and self.exchange_id == "mexc":
            params = {"type": "swap"}
        return self.exchange.fetch_balance(params)

    def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol."""
        try:
            if self.exchange_id == "mexc":
                # MEXC requires openType (1=isolated, 2=cross) and positionType (1=long, 2=short)
                for pos_type in [1, 2]:  # set for both long and short
                    self.exchange.set_leverage(leverage, symbol, params={
                        "openType": 2,        # cross margin
                        "positionType": pos_type,
                    })
            else:
                self.exchange.set_leverage(leverage, symbol)
            return True
        except Exception:
            return False

    # ── Helpers ─────────────────────────────────────────────────

    def _parse_order(self, raw: dict) -> OrderResult:
        return OrderResult(
            order_id=str(raw.get("id", "")),
            symbol=raw.get("symbol", ""),
            side=raw.get("side", ""),
            price=float(raw.get("price", 0) or raw.get("average", 0) or 0),
            amount=float(raw.get("amount", 0) or raw.get("filled", 0) or 0),
            status=raw.get("status", "unknown"),
            raw=raw,
        )

    def get_min_amount(self, symbol: str) -> float:
        """Get minimum order amount for a symbol."""
        self._ensure_markets()
        market = self.exchange.market(symbol)
        return float(market.get("limits", {}).get("amount", {}).get("min", 0.001))

    def get_precision(self, symbol: str) -> Tuple[int, int]:
        """Get (price_precision, amount_precision) for a symbol."""
        self._ensure_markets()
        market = self.exchange.market(symbol)
        return (
            market.get("precision", {}).get("price", 2),
            market.get("precision", {}).get("amount", 3),
        )
