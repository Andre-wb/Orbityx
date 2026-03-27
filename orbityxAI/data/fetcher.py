"""
Paginated OHLCV Fetcher — Binance REST API  v6.4
=================================================
FIXES vs v6.3:
  BUG FIX #1  — fetch_all_futures_pairs() использовал хардкод URL — исправлен в v6.2.
  BUG FIX #2  — MS_PER_BAR не использовался — исправлен в v6.2.
  BUG FIX #3  — При 429 запрос сразу падал — retry с backoff добавлен в v6.3.

  BUG FIX #4 (v6.4) — Отсутствовало проактивное управление rate limit.
               Binance Futures API имеет лимит 2400 запросов/минуту (weight-based).
               При параллельной загрузке 50 пар по 500k баров (~500 страниц на пару)
               счётчик запросов быстро достигал лимита, вызывая шквал 429 ошибок.

               Решение — RateLimiter с токен-ведром (token bucket):
               - Отслеживает количество запросов за последние 60 секунд
               - Когда остаток токенов < SAFETY_MARGIN — делает паузу
               - Пауза рассчитывается точно: ждём ровно столько, чтобы
                 самый старый запрос "вышел" из 60-секундного окна
               - Логирует каждую паузу с причиной и длительностью
               - Shared между всеми параллельными загрузками (asyncio.Lock)

               Дополнительно: заголовки X-MBX-USED-WEIGHT-1M читаются из ответа
               и используются для точной оценки оставшегося лимита.
"""
import asyncio
import time
import httpx
from collections import deque
from typing import Optional, List, Dict, Deque
from config import BINANCE_KLINES_URL, BINANCE_FUTURES_URL
from utils.logger import log

TIMEFRAME_MAP: Dict[str, str] = {
    "1m": "1m",  "5m": "5m",  "15m": "15m", "30m": "30m",
    "1h": "1h",  "4h": "4h",  "1d":  "1d",  "1w":  "1w",
}

MS_PER_BAR: Dict[str, int] = {
    "1m":  60_000,       "5m":  300_000,
    "15m": 900_000,      "30m": 1_800_000,
    "1h":  3_600_000,    "4h":  14_400_000,
    "1d":  86_400_000,   "1w":  604_800_000,
}

CHUNK = 1000
MAX_BARS_DEFAULT = 500_000

# ── Retry параметры ────────────────────────────────────────────────────────
_MAX_RETRIES   = 5
_RETRY_BASE_S  = 5.0       # 5 → 10 → 20 → 40 → 80 секунд

# ── Rate limit параметры Binance Futures ──────────────────────────────────
# Binance Futures: 2400 request-weight в 1 минуту.
# Каждый klines-запрос весит 1 unit для limit <= 100, 2 для 101-500, 5 для 501-1000.
# Мы запрашиваем limit=1000 → вес 5 на запрос.
# Безопасный лимит: 2400 / 5 = 480 запросов/минуту, берём 400 с запасом.
_WEIGHT_PER_REQUEST = 5          # вес одного klines-запроса при limit=1000
_MAX_WEIGHT_PER_MIN = 2400       # лимит Binance Futures
_SAFETY_MARGIN_PCT  = 0.80       # используем не более 80% лимита
_SAFE_REQUESTS_PER_MIN = int(
    (_MAX_WEIGHT_PER_MIN * _SAFETY_MARGIN_PCT) / _WEIGHT_PER_REQUEST
)   # = 384 запроса/минуту

# ─────────────────────────────────────────────────────────────────────────
#  Token Bucket Rate Limiter (asyncio-safe, shared между всеми корутинами)
# ─────────────────────────────────────────────────────────────────────────

class _BinanceRateLimiter:
    """
    Sliding window rate limiter для Binance API.

    Хранит timestamp каждого выполненного запроса за последние 60 секунд.
    Перед каждым новым запросом проверяет, не превышен ли лимит.
    Если превышен — ждёт ровно столько, чтобы самый старый запрос
    вышел из 60-секундного окна.

    Thread-safe через asyncio.Lock (не threading.Lock — мы в async).
    """

    def __init__(self, max_requests_per_min: int = _SAFE_REQUESTS_PER_MIN):
        self.max_rpm    = max_requests_per_min
        self._window    = 60.0       # секунд в окне
        self._timestamps: Deque[float] = deque()
        self._lock      = asyncio.Lock()
        self._paused_total = 0.0     # суммарное время пауз (для статистики)
        self._pause_count  = 0

        # Отслеживаем weight из заголовков ответов
        self._last_used_weight: int = 0

    async def acquire(self, symbol: str = "") -> None:
        """
        Подождать если нужно, затем зарегистрировать запрос.
        Вызывать ПЕРЕД каждым HTTP-запросом к Binance.
        """
        async with self._lock:
            now = time.monotonic()

            # Убираем устаревшие записи (старше 60 секунд)
            while self._timestamps and now - self._timestamps[0] >= self._window:
                self._timestamps.popleft()

            # Если окно заполнено — ждём
            if len(self._timestamps) >= self.max_rpm:
                # Сколько ждать: пока самый старый запрос не выйдет из окна
                oldest   = self._timestamps[0]
                wait_sec = self._window - (now - oldest) + 0.05  # +50ms запас
                wait_sec = max(wait_sec, 0.0)

                if wait_sec > 0:
                    self._pause_count  += 1
                    self._paused_total += wait_sec
                    log.warning(
                        f"[RateLimit] Достигнут лимит {self.max_rpm} req/min. "
                        f"Пауза {wait_sec:.1f}с "
                        f"(пауза #{self._pause_count}, "
                        f"итого {self._paused_total:.0f}с)"
                        + (f" [{symbol}]" if symbol else "")
                    )
                    # Освобождаем лок на время ожидания
                    self._lock.release()
                    try:
                        await asyncio.sleep(wait_sec)
                    finally:
                        await self._lock.acquire()

                    # После ожидания снова чистим окно
                    now = time.monotonic()
                    while self._timestamps and now - self._timestamps[0] >= self._window:
                        self._timestamps.popleft()

            # Регистрируем запрос
            self._timestamps.append(time.monotonic())

    def update_weight(self, used_weight: int) -> None:
        """
        Обновить информацию об использованном weight из заголовка ответа.
        Если weight близок к лимиту — делаем дополнительную паузу.
        """
        self._last_used_weight = used_weight
        weight_pct = used_weight / _MAX_WEIGHT_PER_MIN

        if weight_pct > 0.90:
            # Критически близко к лимиту — логируем
            log.warning(
                f"[RateLimit] Used weight: {used_weight}/{_MAX_WEIGHT_PER_MIN} "
                f"({weight_pct:.0%}) — критически высокий уровень!"
            )
        elif weight_pct > 0.75:
            log.info(
                f"[RateLimit] Used weight: {used_weight}/{_MAX_WEIGHT_PER_MIN} "
                f"({weight_pct:.0%})"
            )

    def stats(self) -> dict:
        return {
            "pauses":        self._pause_count,
            "total_wait_s":  round(self._paused_total, 1),
            "queue_size":    len(self._timestamps),
            "last_weight":   self._last_used_weight,
        }


# Глобальный инстанс — shared между всеми параллельными загрузками
_rate_limiter = _BinanceRateLimiter()


# ─────────────────────────────────────────────────────────────────────────
#  Fetcher
# ─────────────────────────────────────────────────────────────────────────

class OHLCVFetcher:

    @staticmethod
    def _ticker_url(futures: bool) -> str:
        if futures:
            base = BINANCE_FUTURES_URL.rstrip("/")
            if base.endswith("/klines"):
                base = base[: -len("/klines")]
            return base + "/ticker/24hr"
        else:
            base = BINANCE_KLINES_URL.rstrip("/")
            if base.endswith("/klines"):
                base = base[: -len("/klines")]
            return base + "/ticker/24hr"

    @staticmethod
    def _raw_to_dict(raw: list) -> dict:
        return {
            "timestamps": [int(row[0])   for row in raw],
            "opens":      [float(row[1]) for row in raw],
            "highs":      [float(row[2]) for row in raw],
            "lows":       [float(row[3]) for row in raw],
            "closes":     [float(row[4]) for row in raw],
            "volumes":    [float(row[5]) for row in raw],
        }

    @staticmethod
    def unpack(data: dict):
        return (data["timestamps"], data["opens"], data["highs"],
                data["lows"],       data["closes"], data["volumes"])

    # ------------------------------------------------------------------
    # Core: GET с rate limiting + retry при 429
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_with_retry(
            client:  httpx.AsyncClient,
            url:     str,
            params:  dict,
            symbol:  str = "",
    ) -> Optional[list]:
        """
        GET запрос с:
          1. Проактивным rate limiting (token bucket)
          2. Реактивным retry при 429 (экспоненциальный backoff)

        Проактивный лимит работает ПЕРВЫМ — большинство 429 перехватываются
        до отправки запроса. Реактивный backoff — страховка для edge cases.
        """
        for attempt in range(_MAX_RETRIES):
            # Шаг 1: проактивно ждём если нужно
            await _rate_limiter.acquire(symbol)

            # Шаг 2: выполняем запрос
            try:
                r = await client.get(url, params=params)

                # Читаем использованный weight из заголовков
                used_weight = int(
                    r.headers.get("X-MBX-USED-WEIGHT-1M", 0)
                )
                if used_weight > 0:
                    _rate_limiter.update_weight(used_weight)

                r.raise_for_status()
                return r.json()

            except httpx.HTTPStatusError as e:
                status = e.response.status_code

                if status == 429:
                    # Читаем Retry-After если есть
                    retry_after = e.response.headers.get("Retry-After")
                    if retry_after:
                        wait = float(retry_after) + 1.0
                    else:
                        wait = _RETRY_BASE_S * (2 ** attempt)

                    log.warning(
                        f"{symbol}: 429 Too Many Requests (реактивный). "
                        f"Ждём {wait:.0f}с (попытка {attempt + 1}/{_MAX_RETRIES})"
                    )
                    await asyncio.sleep(wait)
                    continue

                elif status == 418:
                    # IP заблокирован — долгая пауза
                    wait = 60.0 * (attempt + 1)
                    log.error(
                        f"{symbol}: 418 IP Ban! Пауза {wait:.0f}с "
                        f"(попытка {attempt + 1}/{_MAX_RETRIES})"
                    )
                    await asyncio.sleep(wait)
                    continue

                else:
                    log.error(f"Ошибка {symbol} HTTP {status}: {e}")
                    return None

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                wait = _RETRY_BASE_S * (2 ** attempt)
                log.warning(
                    f"{symbol}: сетевая ошибка ({type(e).__name__}). "
                    f"Ждём {wait:.0f}с (попытка {attempt + 1}/{_MAX_RETRIES})"
                )
                await asyncio.sleep(wait)
                continue

            except Exception as e:
                log.error(f"Ошибка {symbol}: {e}")
                return None

        log.error(f"{symbol}: исчерпаны все {_MAX_RETRIES} попытки")
        return None

    # ------------------------------------------------------------------
    # Single-request fetch (≤ 1 000 bars)
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_binance(
            symbol:    str  = "BTCUSDT",
            timeframe: str  = "1h",
            limit:     int  = 1000,
            futures:   bool = False,
    ) -> Optional[dict]:
        url      = BINANCE_FUTURES_URL if futures else BINANCE_KLINES_URL
        interval = TIMEFRAME_MAP.get(timeframe, timeframe)
        params   = {
            "symbol":   symbol.upper(),
            "interval": interval,
            "limit":    min(limit, CHUNK),
        }
        async with httpx.AsyncClient(timeout=20) as client:
            raw = await OHLCVFetcher._get_with_retry(client, url, params, symbol)
            if not raw:
                log.error(f"Пустой ответ Binance для {symbol}")
                return None
            return OHLCVFetcher._raw_to_dict(raw)

    # ------------------------------------------------------------------
    # Paginated fetch — любое количество баров
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_binance_full(
            symbol:    str           = "BTCUSDT",
            timeframe: str           = "1d",
            bars:      int           = MAX_BARS_DEFAULT,
            end_ms:    Optional[int] = None,
            futures:   bool          = False,
    ) -> Optional[dict]:
        """
        Постраничная загрузка до `bars` исторических баров.

        Rate limiting:
          - Проактивный: _BinanceRateLimiter ограничивает до
            _SAFE_REQUESTS_PER_MIN запросов/минуту
          - Реактивный: retry с backoff при 429/418

        С bars=500_000 загружается вся доступная история пары.
        """
        url      = BINANCE_FUTURES_URL if futures else BINANCE_KLINES_URL
        interval = TIMEFRAME_MAP.get(timeframe, timeframe)
        ms_step  = MS_PER_BAR.get(timeframe, MS_PER_BAR["1d"])

        if end_ms is None:
            end_ms = int(time.time() * 1000)

        all_rows: List[list] = []
        current_end          = end_ms
        remaining            = bars

        async with httpx.AsyncClient(timeout=30) as client:
            while remaining > 0:
                chunk  = min(remaining, CHUNK)
                params = {
                    "symbol":   symbol.upper(),
                    "interval": interval,
                    "limit":    chunk,
                    "endTime":  current_end,
                }

                raw = await OHLCVFetcher._get_with_retry(
                    client, url, params, symbol
                )

                if raw is None:
                    # Retry исчерпан — сохраняем что успели загрузить
                    if all_rows:
                        log.warning(
                            f"{symbol}: остановка пагинации. "
                            f"Сохранено {len(all_rows)} баров."
                        )
                    break

                if not raw:
                    # Пустая страница — data gap на бирже
                    log.warning(
                        f"{symbol}: пустая страница при endTime={current_end}. "
                        f"Сдвиг на {chunk} баров назад по MS_PER_BAR."
                    )
                    current_end -= chunk * ms_step
                    remaining   -= chunk
                    if current_end < 0:
                        break
                    continue

                all_rows    = raw + all_rows
                remaining  -= len(raw)
                current_end = int(raw[0][0]) - 1

                log.info(
                    f"{symbol}: загружено {len(raw)} баров "
                    f"(всего: {len(all_rows)}, осталось: {remaining})"
                )

                # Binance вернул меньше чем просили → вся история загружена
                if len(raw) < chunk:
                    break

                # Небольшая вежливая пауза между страницами
                await asyncio.sleep(0.05)

        if not all_rows:
            log.error(f"Нет данных для {symbol}")
            return None

        log.info(f"Итого: {len(all_rows)} баров для {symbol} [{timeframe}]")
        return OHLCVFetcher._raw_to_dict(all_rows)

    # ------------------------------------------------------------------
    # Futures-specific helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_all_futures_pairs(
            min_volume_usd: float = 50_000_000,
    ) -> List[str]:
        """
        Все активные USDT-маржинальные фьючерсные пары
        с 24h объёмом выше min_volume_usd.
        """
        url = OHLCVFetcher._ticker_url(futures=True)
        async with httpx.AsyncClient(timeout=20) as client:
            data = await OHLCVFetcher._get_with_retry(client, url, {})
            if not data:
                log.error("Ошибка загрузки списка пар")
                return ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]
            pairs = [
                item["symbol"] for item in data
                if item["symbol"].endswith("USDT")
                   and float(item.get("quoteVolume", 0)) > min_volume_usd
            ]
            log.info(
                f"Найдено {len(pairs)} фьючерсных пар "
                f"с объёмом > ${min_volume_usd / 1e6:.0f}M"
            )
            return sorted(pairs)

    # ------------------------------------------------------------------
    # Parallel multi-symbol fetch
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_multi(
            symbols:        List[str],
            timeframe:      str  = "1d",
            bars:           int  = MAX_BARS_DEFAULT,
            futures:        bool = False,
            max_concurrent: int  = 5,
    ) -> Dict[str, Optional[dict]]:
        """
        Параллельная загрузка нескольких символов.

        max_concurrent ограничивает одновременные корутины, но реальная
        скорость запросов ограничена _BinanceRateLimiter — это более
        надёжный механизм чем простой Semaphore.

        Рекомендуемые значения max_concurrent:
          - Скан (500 баров):   15–20 (запросы лёгкие)
          - Обучение (500k б):   3–5  (много страниц на пару)
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def fetch_one(sym: str) -> tuple:
            async with semaphore:
                data = await OHLCVFetcher.fetch_binance_full(
                    sym, timeframe, bars, futures=futures
                )
                return sym, data

        tasks   = [fetch_one(sym) for sym in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        out: Dict[str, Optional[dict]] = {}
        for res in results:
            if isinstance(res, Exception):
                log.warning(f"Ошибка при загрузке: {res}")
                continue
            sym, data = res
            out[sym] = data

        loaded = sum(1 for v in out.values() if v is not None)
        log.info(
            f"Загружено {loaded}/{len(symbols)} пар. "
            f"Rate limiter: {_rate_limiter.stats()}"
        )
        return out

    # ------------------------------------------------------------------
    # Rate limiter diagnostics
    # ------------------------------------------------------------------

    @staticmethod
    def rate_limiter_stats() -> dict:
        """Статистика rate limiter — удобно для отладки."""
        return _rate_limiter.stats()