import time
import ccxt
from datetime import datetime
from backend.config import settings


class CCXTService:
    def __init__(self):
        self.exchange = ccxt.binance({
            "enableRateLimit": True,
            "apiKey": settings.BINANCE_API_KEY,
            "secret": settings.BINANCE_API_SECRET,
        })

    def fetch_ohlcv(self, symbol: str, timeframe: str, since=None, limit: int = 1000):
        all_candles = []
        cursor = since
        while True:
            candles = self.exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=limit)
            if not candles:
                break
            all_candles.extend(candles)
            cursor = candles[-1][0] + 1
            time.sleep(self.exchange.rateLimit / 1000)
            if len(candles) < limit:
                break
        return all_candles