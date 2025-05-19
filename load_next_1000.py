from app import create_app, db
from app.models import OHLCV
import ccxt
from datetime import datetime
from sqlalchemy import func

def load_next_batch(symbol='BTC/USDT', timeframe='1m', batch_size=1000):
    app = create_app()
    ctx = app.app_context()
    ctx.push()

    try:
        max_ts = db.session.query(func.max(OHLCV.timestamp)) \
            .filter_by(symbol=symbol, timeframe=timeframe) \
            .scalar()
        if max_ts is None:
            since = 0
        else:
            since = max_ts + 1
        print(f"Загружаем свечи с {datetime.utcfromtimestamp(since/1000)} (ts={since})")

        exchange = ccxt.binance({'enableRateLimit': True,})
        candles = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=batch_size)
        count = len(candles)
        print(f"Получили {count} свечей")

        if count == 0:
            print("Новых свечей нет.")
            return 0

        for ts, o, h, l, c, v in candles:
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
        db.session.commit()
        print(f"Сохранили {count} свечей в базе.")
        return count

    finally:
        ctx.pop()


def load_all(symbol='BTC/USDT', timeframe='1m', batch_size=1000):
    total = 0
    batch_num = 0
    while True:
        batch_num += 1
        count = load_next_batch(symbol, timeframe, batch_size)
        if count == 0:
            print("Новых свечей не нашлось — всё подгружено.")
            break
        total += count
        print(f"Партия #{batch_num}: добавлено {count} свечей, всего {total}.")
    print(f"Всё: добавлено {total} новых свечей.")


if __name__ == "__main__":
    load_all()
