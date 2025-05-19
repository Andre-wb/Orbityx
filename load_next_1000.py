# load_next_1000.py

from app import create_app, db
from app.models import OHLCV
import ccxt
from datetime import datetime
from sqlalchemy import func

def load_next_batch(symbol='BTC/USDT', timeframe='1m', batch_size=1000):
    # 1) Создаём приложение и контекст
    app = create_app()
    ctx = app.app_context()
    ctx.push()

    try:
        # 2) Находим максимальный timestamp уже в базе
        max_ts = db.session.query(func.max(OHLCV.timestamp)) \
            .filter_by(symbol=symbol, timeframe=timeframe) \
            .scalar()
        if max_ts is None:
            raise ValueError("В базе нет записей по этому символу/таймфрейму")

        since = max_ts + 1  # старт со следующей миллисекунды
        print(f"Загружаем свечи с {datetime.utcfromtimestamp(since/1000)} (ts={since})")

        # 3) Инициализируем Binance и запрашиваем следующую тысячу
        exchange = ccxt.binance()
        candles = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=batch_size)
        print(f"Получили {len(candles)} свечей")

        if not candles:
            print("Новых свечей нет.")
            return

        # 4) Сохраняем их в БД
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
        print(f"Сохранили {len(candles)} свечей в базе.")

    finally:
        # 5) Закрываем контекст
        ctx.pop()

if __name__ == "__main__":
    load_next_batch()
