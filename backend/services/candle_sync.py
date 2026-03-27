"""
CandleSyncService — автоматическая подгрузка и обновление свечей.

Стратегия:
  1. При старте — загрузить списки инструментов со всех 5 бирж
  2. При старте — бэкфил последних 7 дней 1h-свечей для top-200 символов
  3. Фоновый цикл — добавлять новые свечи каждые 60 с для активных символов
  4. По запросу — немедленный бэкфил если символ не найден в БД
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import func

from backend.database import SessionLocal
from backend.models import OHLCV, Instrument
from backend.services.exchange_service import exchange_service, EXCHANGE_IDS

log = logging.getLogger("candle_sync")

# Таймфреймы для фонового синка
SYNC_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "1w"]

# Сколько исторических свечей грузить при первичном бэкфиле
INITIAL_CANDLES = {
    "1m":  1440 * 3,    # 3 дня
    "5m":  288  * 7,    # 7 дней
    "15m": 96   * 14,   # 14 дней
    "30m": 48   * 30,   # 30 дней
    "1h":  24   * 90,   # 90 дней
    "4h":  6    * 180,  # 180 дней
    "12h": 2    * 365,  # 365 дней
    "1d":  365  * 3,    # 3 года
    "1w":  52   * 5,    # 5 лет
}

# Интервал обновления (секунды) для каждого таймфрейма
REFRESH_INTERVAL = {
    "1m":  60,
    "5m":  300,
    "15m": 900,
    "30m": 1800,
    "1h":  3600,
    "4h":  14400,
    "12h": 43200,
    "1d":  86400,
    "1w":  604800,
}

# Сколько топ-символов синкать при старте
TOP_SYMBOLS_STARTUP = 100


def _ts_now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _upsert_candles(db, symbol: str, timeframe: str, candles: list) -> int:
    """Insert candles, skip duplicates by timestamp. Returns count inserted."""
    if not candles:
        return 0

    existing_ts = set(
        row[0] for row in db.query(OHLCV.timestamp)
        .filter(OHLCV.symbol == symbol, OHLCV.timeframe == timeframe)
        .all()
    )

    new_rows = []
    for ts, o, h, l, c, v in candles:
        if ts in existing_ts:
            continue
        new_rows.append(OHLCV(
            symbol=symbol,
            timeframe=timeframe,
            timestamp=ts,
            datetime=datetime.utcfromtimestamp(ts / 1000).isoformat(),
            open=o, high=h, low=l, close=c, volume=v,
        ))

    if new_rows:
        db.bulk_save_objects(new_rows)
        db.commit()

    return len(new_rows)


def _save_instruments(db, exchange_id: str, markets: dict):
    """Persist instrument metadata to DB."""
    ts_now = _ts_now_ms()
    existing = {
        (r.exchange, r.symbol)
        for r in db.query(Instrument.exchange, Instrument.symbol).all()
    }

    new_instruments = []
    for sym, m in markets.items():
        if not m.get("active", True):
            continue
        quote = m.get("quote", "")
        if quote not in ("USDT", "USD", "USDC", "BTC", "ETH", "BNB"):
            continue
        key = (exchange_id, sym)
        if key in existing:
            continue
        new_instruments.append(Instrument(
            exchange=exchange_id,
            symbol=sym,
            base=m.get("base", ""),
            quote=quote,
            active=True,
            updated_at=ts_now,
        ))

    if new_instruments:
        db.bulk_save_objects(new_instruments)
        db.commit()
        log.info(f"[{exchange_id}] Saved {len(new_instruments)} new instruments")


class CandleSyncService:
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        # Символы, которые активно используются (обновлять в первую очередь)
        self._active_symbols: set[tuple[str, str]] = set()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def start(self):
        """Запустить фоновый синк. Вызывается в lifespan FastAPI."""
        self._running = True
        self._task = asyncio.create_task(self._run())
        log.info("CandleSyncService started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await exchange_service.close()
        log.info("CandleSyncService stopped")

    def mark_active(self, symbol: str, timeframe: str):
        """Отметить символ как активный (используется пользователем)."""
        self._active_symbols.add((symbol, timeframe))

    async def ensure_candles(self, symbol: str, timeframe: str) -> bool:
        """
        On-demand: убедиться что в БД есть свечи для символа.
        Вызывается из candles router если данных нет.
        Returns True если данные были подгружены.
        """
        self.mark_active(symbol, timeframe)
        max_candles = INITIAL_CANDLES.get(timeframe, 500)
        return await self._backfill_symbol(symbol, timeframe, max_candles)

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    async def _run(self):
        try:
            # Фаза 1: загрузить все рынки
            log.info("Loading markets from all exchanges...")
            await self._load_all_markets()

            # Фаза 2: первичный бэкфил топ-символов
            log.info(f"Starting initial backfill for top-{TOP_SYMBOLS_STARTUP} symbols...")
            await self._initial_backfill()

            # Фаза 3: периодическое обновление
            log.info("Starting periodic refresh loop...")
            await self._periodic_loop()

        except asyncio.CancelledError:
            pass
        except Exception as e:
            log.error(f"CandleSyncService crashed: {e}", exc_info=True)

    # ------------------------------------------------------------------
    # Phase 1: load markets
    # ------------------------------------------------------------------
    async def _load_all_markets(self):
        all_markets = await exchange_service.load_all_markets()
        db = SessionLocal()
        try:
            for exchange_id, markets in all_markets.items():
                if markets:
                    log.info(f"[{exchange_id}] {len(markets)} markets loaded")
                    _save_instruments(db, exchange_id, markets)
        finally:
            db.close()

    # ------------------------------------------------------------------
    # Phase 2: initial backfill
    # ------------------------------------------------------------------
    async def _initial_backfill(self):
        # Получить топ символы от Binance (наиболее ликвидные)
        top_symbols = exchange_service.get_top_symbols("binance", TOP_SYMBOLS_STARTUP)

        # Если у Binance нет volume данных — взять первые N из markets
        if not top_symbols:
            top_symbols = exchange_service.get_usdt_symbols("binance")[:TOP_SYMBOLS_STARTUP]

        # Fallback: хардкод основных пар
        if not top_symbols:
            top_symbols = _DEFAULT_SYMBOLS[:TOP_SYMBOLS_STARTUP]

        log.info(f"Backfilling {len(top_symbols)} symbols × {len(SYNC_TIMEFRAMES)} timeframes")

        # Сначала загружаем 1h и 1d для всех символов (меньше данных, быстрее)
        for tf in ["1h", "1d"]:
            for symbol in top_symbols:
                if not self._running:
                    return
                await self._backfill_symbol(symbol, tf, INITIAL_CANDLES[tf])
                await asyncio.sleep(0.05)  # небольшая пауза между запросами

        # Потом 4h для топ-50
        for symbol in top_symbols[:50]:
            if not self._running:
                return
            await self._backfill_symbol(symbol, "4h", INITIAL_CANDLES["4h"])
            await asyncio.sleep(0.05)

        log.info("Initial backfill complete")

    # ------------------------------------------------------------------
    # Phase 3: periodic refresh
    # ------------------------------------------------------------------
    async def _periodic_loop(self):
        last_refresh: dict[tuple[str, str], float] = {}

        while self._running:
            await asyncio.sleep(30)
            now = datetime.now(timezone.utc).timestamp()

            # Приоритет: активные символы
            to_refresh = list(self._active_symbols)

            # Добавляем топ символы с 1h таймфреймом
            top = exchange_service.get_top_symbols("binance", 50) or _DEFAULT_SYMBOLS[:50]
            for sym in top:
                to_refresh.append((sym, "1h"))

            for symbol, timeframe in to_refresh:
                if not self._running:
                    return
                interval = REFRESH_INTERVAL.get(timeframe, 60)
                key = (symbol, timeframe)
                if now - last_refresh.get(key, 0) < interval:
                    continue

                await self._refresh_latest(symbol, timeframe)
                last_refresh[key] = now
                await asyncio.sleep(0.1)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _backfill_symbol(self, symbol: str, timeframe: str, max_candles: int) -> bool:
        """Заполнить пробел в данных для символа. Returns True при успехе."""
        db = SessionLocal()
        try:
            max_ts = (
                db.query(func.max(OHLCV.timestamp))
                .filter(OHLCV.symbol == symbol, OHLCV.timeframe == timeframe)
                .scalar()
            )
            since = (max_ts + 1) if max_ts else None

            # Если данные уже свежие — пропустить
            if since:
                age_s = (_ts_now_ms() - max_ts) / 1000
                refresh_s = REFRESH_INTERVAL.get(timeframe, 60)
                if age_s < refresh_s * 0.9:
                    return True

            exchange_id, candles = await exchange_service.fetch_ohlcv_best(
                symbol, timeframe, since=since, max_candles=max_candles
            )

            if not candles:
                return False

            inserted = _upsert_candles(db, symbol, timeframe, candles)
            if inserted:
                log.debug(f"[{exchange_id}] {symbol} {timeframe}: +{inserted} candles")
            return True

        except Exception as e:
            log.warning(f"_backfill_symbol {symbol} {timeframe}: {e}")
            return False
        finally:
            db.close()

    async def _refresh_latest(self, symbol: str, timeframe: str):
        """Подгрузить только самые новые свечи."""
        await self._backfill_symbol(symbol, timeframe, max_candles=100)


# ---------------------------------------------------------------------------
# Default symbol list (fallback when exchange markets not loaded yet)
# ---------------------------------------------------------------------------
_DEFAULT_SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
    "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "DOT/USDT",
    "MATIC/USDT", "UNI/USDT", "LTC/USDT", "BCH/USDT", "ATOM/USDT",
    "FIL/USDT", "APT/USDT", "ARB/USDT", "OP/USDT", "NEAR/USDT",
    "INJ/USDT", "TIA/USDT", "SUI/USDT", "TON/USDT", "PEPE/USDT",
    "WIF/USDT", "BONK/USDT", "FLOKI/USDT", "SHIB/USDT", "FTM/USDT",
    "AAVE/USDT", "MKR/USDT", "CRV/USDT", "SNX/USDT", "COMP/USDT",
    "SAND/USDT", "MANA/USDT", "AXS/USDT", "ENJ/USDT", "GALA/USDT",
    "TRX/USDT", "XLM/USDT", "ALGO/USDT", "ICP/USDT", "HBAR/USDT",
    "VET/USDT", "EOS/USDT", "XMR/USDT", "ZEC/USDT", "DASH/USDT",
    "ETH/BTC", "BNB/BTC", "SOL/BTC", "XRP/BTC", "ADA/BTC",
]


# Module-level singleton
candle_sync = CandleSyncService()
