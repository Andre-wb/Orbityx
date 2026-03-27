from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import httpx

from backend.database import get_db
from backend.models import Instrument
from backend.services.exchange_service import exchange_service, EXCHANGE_IDS

router = APIRouter()
COINGECKO = "https://api.coingecko.com/api/v3"


@router.get("/coins")
async def get_coins(
        per_page: int = Query(50, le=250),
        page: int = Query(1),
        vs_currency: str = Query("usd"),
):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{COINGECKO}/coins/markets",
            params={
                "vs_currency": vs_currency,
                "order": "market_cap_desc",
                "per_page": per_page,
                "page": page,
                "price_change_percentage": "1h,24h,7d",
            },
        )
        r.raise_for_status()
        return r.json()


@router.get("/instruments")
def get_instruments(
        exchange: Optional[str] = Query(None, description="Фильтр по бирже"),
        quote: Optional[str] = Query(None, description="Фильтр по котировочной валюте, напр. USDT"),
        db: Session = Depends(get_db),
):
    """
    Вернуть все инструменты из БД.
    Если exchange не указан — вернуть со всех 5 бирж.
    """
    q = db.query(Instrument).filter(Instrument.active == True)
    if exchange:
        q = q.filter(Instrument.exchange == exchange.lower())
    if quote:
        q = q.filter(Instrument.quote == quote.upper())

    rows = q.order_by(Instrument.exchange, Instrument.symbol).all()

    result: dict[str, list[dict]] = {}
    for r in rows:
        result.setdefault(r.exchange, []).append({
            "symbol": r.symbol,
            "base": r.base,
            "quote": r.quote,
        })
    return {
        "exchanges": EXCHANGE_IDS,
        "total": len(rows),
        "instruments": result,
    }


@router.get("/instruments/list", response_model=list[str])
def get_instruments_flat(
        exchange: Optional[str] = Query(None),
        quote: str = Query("USDT"),
        db: Session = Depends(get_db),
):
    """Плоский список символов (удобно для UI селектора)."""
    q = db.query(Instrument.symbol).filter(
        Instrument.active == True,
        Instrument.quote == quote.upper(),
    )
    if exchange:
        q = q.filter(Instrument.exchange == exchange.lower())
    rows = q.distinct().all()
    return sorted(set(r[0] for r in rows))


@router.get("/exchanges")
def get_exchanges():
    """Список поддерживаемых бирж."""
    return {"exchanges": EXCHANGE_IDS}


@router.get("/stats/{coin_id}")
async def get_stats(coin_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{COINGECKO}/coins/{coin_id}")
        r.raise_for_status()
        data = r.json()
        market = data.get("market_data", {})
        return {
            "symbol": data.get("symbol", "").upper(),
            "name": data.get("name"),
            "current_price": market.get("current_price", {}).get("usd"),
            "high_24h": market.get("high_24h", {}).get("usd"),
            "low_24h": market.get("low_24h", {}).get("usd"),
            "volume_24h": market.get("total_volume", {}).get("usd"),
            "market_cap": market.get("market_cap", {}).get("usd"),
            "price_change_24h": market.get("price_change_percentage_24h"),
            "price_change_7d": market.get("price_change_percentage_7d"),
        }