"""
Utility to backfill/append OHLCV candles into the database using ccxt (Binance).

Usage:
- Run directly to fetch batches until up-to-date (see __main__).
- `load_next_batch` fetches the next page after the max timestamp per symbol/timeframe.

Notes:
- Comments only; no functional changes.
"""
from backend import create_app, db
from backend.models import OHLCV
import ccxt
from datetime import datetime
from sqlalchemy import func

# Fetch one page of candles newer than the latest stored record
def load_next_batch(symbol='BTC/USDT', timeframe='1m', batch_size=1000):
    """Load the next `batch_size` candles after the current max timestamp.

    Args:
        symbol: Market symbol, e.g. 'BTC/USDT'.
        timeframe: ccxt timeframe string (e.g. '1m', '1h').
        batch_size: Page size passed to ccxt.fetch_ohlcv.
    Returns:
        Number of candles inserted in this batch.
    """
    # App factory + push application context for DB access
    app = create_app()
    ctx = app.app_context()
    ctx.push()

    try:
        # Find the latest stored candle timestamp for this symbol/timeframe
        max_ts = db.session.query(func.max(OHLCV.timestamp)) \
            .filter_by(symbol=symbol, timeframe=timeframe) \
            .scalar()
        # If no data yet, start from epoch (0); else continue after last ts
        if max_ts is None:
            since = 0
        else:
            since = max_ts + 1
        print(f"Загружаем свечи с {datetime.utcfromtimestamp(since/1000)} (ts={since})")

        # Initialize ccxt exchange client (rate-limited)
        exchange = ccxt.binance({'enableRateLimit': True,})
        # Fetch OHLCV page; `since` is in **milliseconds** per ccxt contract
        candles = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=batch_size)
        count = len(candles)
        print(f"Получили {count} свечей")

        # Nothing new returned → stop and report 0
        if count == 0:
            print("Новых свечей нет.")
            return 0

        for ts, o, h, l, c, v in candles:
            # Map ccxt tuple [ts, o, h, l, c, v] into ORM model
            record = OHLCV(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=ts,
                open=o,
                high=h,
                low=l,
                close=c,
                volume=v,
                datetime=datetime.utcfromtimestamp(ts / 1000)
            )
            db.session.add(record)
        # Commit the batch as a single transaction
        db.session.commit()
        print(f"Сохранили {count} свечей в базе.")
        return count

    finally:
        # Always pop application context to avoid leaks in repeated calls
        ctx.pop()


# Keep calling `load_next_batch` until exchange returns no more candles
def load_all(symbol='BTC/USDT', timeframe='1m', batch_size=1000):
    """Backfill all missing candles, in batches, until up to date.

    Returns:
        None; prints progress to stdout.
    """
    total = 0
    batch_num = 0
    # Loop until a batch returns 0 newly inserted rows
    while True:
        batch_num += 1
        count = load_next_batch(symbol, timeframe, batch_size)
        if count == 0:
            print("Новых свечей не нашлось — всё подгружено.")
            break
        total += count
        print(f"Партия #{batch_num}: добавлено {count} свечей, всего {total}.")
    print(f"Всё: добавлено {total} новых свечей.")


# CLI entry: run full backfill when executed directly
if __name__ == "__main__":
    # Default: BTC/USDT, 1m timeframe; adjust via params or modify call
    load_all()
