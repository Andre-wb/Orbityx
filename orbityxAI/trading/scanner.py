"""
Multi-Asset Scanner  v6.8.1
============================
BUG FIXES vs v6.0:

  BUG FIX #VOL_NORM (v6.8.1, NEW):
    vol_usd вычислялся как объём одного бара (closes × volumes за последние 20 баров),
    но сравнивался с MIN_VOLUME_USD = $50M/день.

    На 1h-барах:  реальный дневной объём = bar_vol × 24
    На 4h-барах:  реальный дневной объём = bar_vol × 6
    На 1d-барах:  всё правильно (bar_vol × 1)

    Это приводило к тому что:
    - На 1h: пары с объёмом $3M/час ($72M/день) → filtered out (фактически ок)
    - На 4h: пары с объёмом $10M/4h ($60M/день) → filtered out (фактически ок)
    - Фильтр работал некорректно, отсеивая хорошие пары

    Исправление:
      score_pair() принимает timeframe (default "1h").
      vol_usd нормализуется к дневному через BARS_PER_DAY.
      scan() передаёт timeframe в score_pair().

Алгоритм отбора:
  1. Загрузка всех пар с объёмом > $50M/день
  2. Параллельная загрузка OHLCV данных
  3. Быстрый скоринг каждой пары (без обучения ML)
  4. Фильтрация по качеству сигнала и режиму рынка
  5. Возврат топ-N пар для торговли
"""
import numpy as np
from typing import List
from dataclasses import dataclass

from data.fetcher import OHLCVFetcher
from indicators.technical import rsi, atr, adx, sma
from models.regime import RegimeDetector, Regime
from config import BARS_PER_DAY
from utils.logger import log


@dataclass
class PairScore:
    symbol:      str
    score:       float
    regime:      str
    atr_pct:     float
    rsi14:       float
    adx_val:     float
    volume_usd:  float      # нормализованный дневной объём
    trend:       str
    tradeable:   bool
    reason:      str = ""


class MultiAssetScanner:
    """
    Быстрый сканер для нахождения лучших торговых пар.
    Работает без обучения ML — использует технические индикаторы как прокси.
    """

    MIN_VOLUME_USD   = 50_000_000   # минимум $50M суточного объёма
    MIN_ADX          = 18.0
    MAX_ATR_PCT      = 0.08         # максимум 8% ATR
    MIN_ATR_PCT      = 0.003        # минимум 0.3% ATR
    MAX_PAIRS        = 5

    def __init__(self):
        self.regime_d = RegimeDetector()

    def score_pair(self, symbol: str, closes: np.ndarray,
                   highs: np.ndarray, lows: np.ndarray,
                   volumes: np.ndarray,
                   timeframe: str = "1h") -> PairScore:
        """
        Быстрый скоринг пары без ML.
        Score = ADX × тренд_фактор × объём_фактор / волатильность_штраф

        BUG FIX #VOL_NORM: vol_usd нормализуется к дневному через BARS_PER_DAY.
        """
        if len(closes) < 50:
            return PairScore(symbol, 0.0, "unknown", 0.0, 50.0, 0.0, 0.0, "—",
                             False, "мало баров")

        price = float(closes[-1])
        if price <= 0:
            return PairScore(symbol, 0.0, "unknown", 0.0, 50.0, 0.0, 0.0, "—",
                             False, "нет цены")

        # Основные индикаторы
        atr_v    = atr(highs, lows, closes, 14)
        atr_val  = float(atr_v[-1]) if not np.isnan(atr_v[-1]) else price * 0.02
        atr_pct  = atr_val / price

        adx_v, pdi, mdi = adx(highs, lows, closes, 14)
        adx_val  = float(adx_v[-1]) if not np.isnan(adx_v[-1]) else 0.0
        pdi_val  = float(pdi[-1])   if not np.isnan(pdi[-1])   else 0.0
        mdi_val  = float(mdi[-1])   if not np.isnan(mdi[-1])   else 0.0

        rsi14    = float(rsi(closes, 14)[-1]) if len(closes) > 14 else 50.0
        if np.isnan(rsi14): rsi14 = 50.0

        # BUG FIX #VOL_NORM: умножаем средний бар-объём на баров/день
        bars_per_day = BARS_PER_DAY.get(timeframe, 24.0)
        bar_vol_usd  = float(np.mean(closes[-20:] * volumes[-20:]))
        vol_usd      = bar_vol_usd * bars_per_day

        # Режим рынка
        regime   = self.regime_d.current_regime(highs, lows, closes)
        regime_l = RegimeDetector.label(regime)

        # Направление тренда
        s50  = sma(closes, 50)
        s200 = sma(closes, 200)
        s50_v  = float(s50[-1])  if not np.isnan(s50[-1])  else price
        s200_v = float(s200[-1]) if not np.isnan(s200[-1]) else price

        if price > s200_v and price > s50_v and pdi_val > mdi_val:
            trend = "uptrend"
        elif price < s200_v and price < s50_v and mdi_val > pdi_val:
            trend = "downtrend"
        else:
            trend = "sideways"

        # Фильтры качества
        if vol_usd < self.MIN_VOLUME_USD:
            return PairScore(symbol, 0.0, regime_l, atr_pct, rsi14, adx_val,
                             vol_usd, trend, False,
                             f"низкий объём (${vol_usd/1e6:.1f}M/d)")

        if atr_pct > self.MAX_ATR_PCT:
            return PairScore(symbol, 0.0, regime_l, atr_pct, rsi14, adx_val,
                             vol_usd, trend, False, "слишком волатильная")

        if atr_pct < self.MIN_ATR_PCT:
            return PairScore(symbol, 0.0, regime_l, atr_pct, rsi14, adx_val,
                             vol_usd, trend, False, "нет движения")

        if regime == Regime.VOLATILE:
            return PairScore(symbol, 0.0, regime_l, atr_pct, rsi14, adx_val,
                             vol_usd, trend, False, "хаотичный режим")

        # Скоринг
        adx_score    = min(adx_val / 50.0, 1.0)
        vol_score    = min(vol_usd / 500_000_000, 1.0)
        trend_score  = 1.2 if trend in ("uptrend", "downtrend") else 0.7
        rsi_score    = 1.0 if 35 < rsi14 < 65 else 0.7
        atr_score    = 1.0 if 0.005 < atr_pct < 0.04 else 0.7

        score = adx_score * vol_score * trend_score * rsi_score * atr_score

        return PairScore(
            symbol=symbol, score=round(score, 4),
            regime=regime_l, atr_pct=round(atr_pct, 4),
            rsi14=round(rsi14, 1), adx_val=round(adx_val, 1),
            volume_usd=round(vol_usd, 0), trend=trend,
            tradeable=True, reason="OK"
        )

    async def scan(
            self,
            timeframe:  str   = "1h",
            bars:       int   = 200,
            top_n:      int   = 5,
            min_volume: float = 50_000_000,
    ) -> List[PairScore]:
        """
        Полный скан рынка: загружает все пары и возвращает топ-N.
        """
        log.info(f"Сканирование рынка [{timeframe}]…")

        all_pairs = await OHLCVFetcher.fetch_all_futures_pairs(min_volume)
        log.info(f"Пар для анализа: {len(all_pairs)}")

        ohlcv_map = await OHLCVFetcher.fetch_multi(
            all_pairs, timeframe, bars, futures=True, max_concurrent=10)

        scores = []
        for symbol, data in ohlcv_map.items():
            if data is None:
                continue
            _, o, h, l, c, v = OHLCVFetcher.unpack(data)
            o = np.array(o); h = np.array(h); l = np.array(l)
            c = np.array(c); v = np.array(v)
            try:
                # BUG FIX #VOL_NORM: передаём timeframe в score_pair
                ps = self.score_pair(symbol, c, h, l, v, timeframe=timeframe)
                scores.append(ps)
            except Exception as e:
                log.warning(f"Ошибка скоринга {symbol}: {e}")

        tradeable = [s for s in scores if s.tradeable]
        tradeable.sort(key=lambda x: x.score, reverse=True)

        selected = self._filter_correlated(tradeable, top_n)

        log.info(f"Топ-{len(selected)} пар:")
        for ps in selected:
            log.info(f"  {ps.symbol}: score={ps.score:.3f} "
                     f"trend={ps.trend} adx={ps.adx_val:.1f} "
                     f"vol=${ps.volume_usd/1e6:.0f}M/d")

        return selected

    def _filter_correlated(self, scores: List[PairScore],
                           top_n: int) -> List[PairScore]:
        """
        Убираем пары которые торгуются одинаково.
        Не более 2 BTC-коррелированных пар, не более 2 ETH-коррелированных.
        """
        btc_count = 0
        eth_count = 0
        selected  = []

        BTC_CORR = {"BTCUSDT", "WBTCUSDT", "BTCDOMUSDT"}
        ETH_CORR = {"ETHUSDT", "STETHUSDT"}

        for ps in scores:
            if len(selected) >= top_n:
                break
            if ps.symbol in BTC_CORR:
                if btc_count >= 2: continue
                btc_count += 1
            elif ps.symbol in ETH_CORR:
                if eth_count >= 2: continue
                eth_count += 1
            selected.append(ps)

        return selected