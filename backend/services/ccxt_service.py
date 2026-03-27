"""
CCXT data service: fetches OHLCV candles from exchanges and persists them.

Design notes:
- Uses ccxt with enableRateLimit for polite API usage.
- Paginates using `since` cursor and exchange.rateLimit sleeps.
- Saves/loads records via SQLAlchemy models (OHLCV, db).
- This patch adds documentation only; logic intentionally unchanged.
"""

# External exchange wrapper (https://github.com/ccxt/ccxt)
import ccxt
# Sleep between paginated requests based on exchange.rateLimit
import time
# UTC datetime formatting for human-readable ISO strings
from datetime import datetime
# SQLAlchemy model and session handle
from app.models import OHLCV, db

class CCXTService:
    """Lightweight facade over ccxt for fetching and persisting OHLCV."""
    def __init__(self):
        """Initialize a Binance exchange instance with builtin rate limiting."""
        self.exchange = ccxt.binance({'enableRateLimit': True})

# NOTE: Duplicate import block retained intentionally (no behavioral changes requested)
        import ccxt, time
from datetime import datetime
from app.models import OHLCV, db

class CCXTService:
    """Service providing OHLCV fetch/save/load operations."""
    def __init__(self):
        """Initialize a Binance exchange instance with API-friendly defaults."""
        self.exchange = ccxt.binance({'enableRateLimit': True})

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=1000):
        """
        Fetch historical OHLCV from the exchange with pagination.
        Args:
            symbol (str): Market symbol, e.g. 'BTC/USDT'.
            timeframe (str): ccxt timeframe, e.g. '1m', '1h'.
            since (int|None): Unix ms timestamp to start from (inclusive).
            limit (int): Max items per page (exchange-imposed cap typically ≤ 1000).
        Returns:
            list[list]: Raw candles [ts, open, high, low, close, volume].
        """
        # Accumulator for all pages
        all_candles = []
        # Cursor (ms) advanced to the last received candle + 1ms per page
        cursor = since
        # Loop until the exchange returns an empty page
        while True:
            # Request one page; ccxt returns a list of [t, o, h, l, c, v]
            candles = self.exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=limit)
            # Empty page → no more data available
            if not candles:
                break
            # Append page to the accumulator
            all_candles.extend(candles)
            # Advance since-cursor by 1ms to avoid re-fetching the last candle
            cursor = candles[-1][0] + 1
            # Be polite: honor the exchange's recommended rate limit
            time.sleep(self.exchange.rateLimit / 1000)
        return all_candles

    def save_to_db(self, candles, symbol, timeframe):
        """
        Persist raw candle rows into the OHLCV table via SQLAlchemy.
        Note: current implementation commits per row (simple but slower); batch
        commits can be implemented later if needed for performance.
        """
        # Iterate rows and map to ORM fields
        for candle in candles:
            # Unpack ccxt tuple (timestamp ms, OHLC, volume)
            ts, o, h, l, c, v = candle
            # Construct ORM entity for the current row
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
            # Stage record for insertion
            db.session.add(record)
            # Commit each row (could be batched for throughput)
            db.session.commit()

    def load_from_db(self, symbol, timeframe, limit=1000):
        """
        Load persisted candles from the database ordered by ascending timestamp.
        Args:
            symbol (str): Market symbol
            timeframe (str): Stored timeframe key
            limit (int): Max number of rows to return
        Returns:
            list[OHLCV]: ORM objects for downstream processing.
        """
        # Build a simple filtered query in ascending time order
        q = (OHLCV.query
             .filter_by(symbol=symbol, timeframe=timeframe)
             .order_by(OHLCV.timestamp.asc())
             # Apply a hard cap to avoid loading too many rows at once
             .limit(limit))
        # Materialize results as a list
        return q.all()

