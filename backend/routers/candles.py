from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from backend.database import get_db
from backend.models import OHLCV
from backend.schemas import CandleOut

router = APIRouter()

# Минимум свечей для ответа без доп. загрузки
_MIN_CANDLES = 50


@router.get("/candles", response_model=list[CandleOut])
async def get_candles(
        background_tasks: BackgroundTasks,
        symbol: str = Query("BTC/USDT"),
        timeframe: str = Query("1m"),
        limit: int = Query(500, le=5000),
        to: Optional[int] = Query(None),
        db: Session = Depends(get_db),
):
    q = db.query(OHLCV).filter(
        OHLCV.symbol == symbol,
        OHLCV.timeframe == timeframe,
    )
    if to is not None:
        q = q.filter(OHLCV.timestamp < to)

    rows = q.order_by(OHLCV.timestamp.desc()).limit(limit).all()
    rows = list(reversed(rows))

    result = [
        CandleOut(
            timestamp=r.timestamp,
            open=r.open,
            high=r.high,
            low=r.low,
            close=r.close,
            volume=r.volume or 0.0,
        )
        for r in rows
        if None not in (r.timestamp, r.open, r.high, r.low, r.close)
    ]

    # Если данных мало — запустить бэкфил в фоне
    if len(result) < _MIN_CANDLES:
        background_tasks.add_task(_trigger_backfill, symbol, timeframe)

    return result


@router.post("/candles/backfill")
def backfill(
        background_tasks: BackgroundTasks,
        symbol: str = Query("BTC/USDT"),
        timeframe: str = Query("1m"),
):
    background_tasks.add_task(_trigger_backfill, symbol, timeframe)
    return {"message": f"Backfill запущен для {symbol} {timeframe}"}


@router.get("/candles/symbols", response_model=list[str])
def get_available_symbols(db: Session = Depends(get_db)):
    """Вернуть все символы, для которых есть свечи в БД."""
    rows = db.query(OHLCV.symbol).distinct().all()
    return sorted(set(r[0] for r in rows))


def _trigger_backfill(symbol: str, timeframe: str):
    """Запустить бэкфил через CandleSyncService (sync wrapper для background task)."""
    import asyncio
    try:
        from backend.services.candle_sync import candle_sync
        loop = asyncio.new_event_loop()
        loop.run_until_complete(candle_sync.ensure_candles(symbol, timeframe))
        loop.close()
    except Exception as e:
        import logging
        logging.getLogger("candles").warning(f"backfill {symbol} {timeframe}: {e}")
