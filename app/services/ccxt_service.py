import ccxt
import time
from datetime import datetime
from app.models import OHLCV, db

class CCXTService:
    def __init__(self):
        self.exchange = ccxt.binance({'enableRateLimit': True})

        import ccxt, time
from datetime import datetime
from app.models import OHLCV, db

class CCXTService:
    def __init__(self):
        self.exchange = ccxt.binance({'enableRateLimit': True})

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=1000):
        all_candles = []
        cursor = since
        while True:
            candles = self.exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=limit)
            if not candles:
                break
            all_candles.extend(candles)
            cursor = candles[-1][0] + 1
            time.sleep(self.exchange.rateLimit / 1000)
        return all_candles

    def save_to_db(self, candles, symbol, timeframe):
        for candle in candles:
            ts, o, h, l, c, v = candle
            record = OHLCV(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=ts,
                datetime=datetime.utcfromtimestamp(ts / 1000).isoformat(),
                open=o,
                high=h,
                low=l,
                close=c,
                volume=v
            )
            db.session.add(record)
            db.session.commit()

    def load_from_db(self, symbol, timeframe, limit=1000):
        q = (OHLCV.query
             .filter_by(symbol=symbol, timeframe=timeframe)
             .order_by(OHLCV.timestamp.asc())
             .limit(limit))
        return q.all()

