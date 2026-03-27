"""
OrbityxAI — Find Trades
========================
Запуск:
    python find_trades.py                      # топ-10 сделок по всем ТФ
    python find_trades.py --top 20             # топ-20
    python find_trades.py --tf 1h              # только 1h
    python find_trades.py --min-rr 2.0         # минимум R:R = 2.0
    python find_trades.py --load model.pkl     # использовать готовую модель

Что делает:
  1. Загружает все фьючерсные пары с объёмом > $50M
  2. Быстрый скоринг на 3 таймфреймах: 1h, 4h, 1d
  3. ML-предсказание для топ-N пар
  4. Вывод: пара | направление | вход | стоп | TP1 | TP2 | R:R | уверенность
"""
import asyncio
import argparse
import sys
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict
from itertools import product


# ─────────────────────────────────────────────────────────────
#  Config
# ─────────────────────────────────────────────────────────────

TIMEFRAMES   = ["1h", "4h", "1d"]      # анализируем все три
SCAN_BARS    = 300                      # баров для быстрого скана
ML_BARS      = 500_000                  # баров для ML (вся история)
MIN_VOLUME   = 50_000_000              # минимум $50M объём
TOP_SCAN     = 30                       # сколько пар идут в ML после скана
TOP_RESULTS  = 10                       # сколько выводить в итоге
MIN_RR       = 1.5                      # минимум R:R для показа
MIN_CONF     = 0.52                     # минимум уверенности


# ─────────────────────────────────────────────────────────────
#  Trade dataclass
# ─────────────────────────────────────────────────────────────

@dataclass
class Trade:
    symbol:      str
    timeframe:   str
    direction:   str          # LONG / SHORT
    confidence:  float
    entry:       float
    stop_loss:   float
    tp1:         float
    tp2:         float
    tp3:         float
    risk_reward: float
    regime:      str
    rsi:         float
    adx:         float
    trend:       str
    scan_score:  float        # технический скор из скана
    tf_scores:   Dict[str, float]  # скоры по таймфреймам

    def risk_pct(self) -> float:
        """Процент риска от входа до стопа."""
        return abs(self.entry - self.stop_loss) / self.entry * 100

    def reward_pct(self) -> float:
        """Процент прибыли до TP1."""
        return abs(self.tp1 - self.entry) / self.entry * 100

    def summary_line(self, rank: int) -> str:
        dir_emoji = "🟢 LONG " if self.direction == "LONG" else "🔴 SHORT"
        return (
            f"  {rank:2d}. {self.symbol:<12s} {dir_emoji}  [{self.timeframe}]\n"
            f"      Вход:   {self.entry:>12,.4f}\n"
            f"      Стоп:   {self.stop_loss:>12,.4f}  ({self.risk_pct():.2f}% риска)\n"
            f"      TP1:    {self.tp1:>12,.4f}  ({self.reward_pct():.2f}% прибыли)\n"
            f"      TP2:    {self.tp2:>12,.4f}\n"
            f"      TP3:    {self.tp3:>12,.4f}\n"
            f"      R:R={self.risk_reward:.2f}  conf={self.confidence:.1%}  "
            f"RSI={self.rsi:.0f}  ADX={self.adx:.0f}\n"
            f"      Режим: {self.regime}  |  Тренд: {self.trend}\n"
        )


# ─────────────────────────────────────────────────────────────
#  Multi-timeframe scanner
# ─────────────────────────────────────────────────────────────

async def scan_all_timeframes(
        min_volume: float = MIN_VOLUME,
        top_n: int = TOP_SCAN,
) -> Dict[str, Dict[str, float]]:
    """
    Скан рынка по 3 таймфреймам одновременно.
    Возвращает {symbol: {tf: score}} для топ-N пар.
    """
    from data.fetcher import OHLCVFetcher
    from trading.scanner import MultiAssetScanner  # уже исправлен → scanner.py

    # Получаем список всех пар
    all_pairs = await OHLCVFetcher.fetch_all_futures_pairs(min_volume)
    print(f"  📊 Загружено {len(all_pairs)} пар с объёмом > ${min_volume/1e6:.0f}M")

    scanner = MultiAssetScanner()

    # Параллельный скан по 3 таймфреймам
    async def scan_tf(tf: str) -> Dict[str, float]:
        ohlcv_map = await OHLCVFetcher.fetch_multi(
            all_pairs, tf, SCAN_BARS, futures=True, max_concurrent=10
        )
        scores = {}
        for sym, data in ohlcv_map.items():
            if data is None:
                continue
            try:
                _, o, h, l, c, v = OHLCVFetcher.unpack(data)
                ps = scanner.score_pair(sym, np.array(c), np.array(h),
                                        np.array(l), np.array(v))
                if ps.tradeable:
                    scores[sym] = ps.score
            except Exception:
                pass
        return scores

    print(f"  🔍 Сканируем {len(all_pairs)} пар на {len(TIMEFRAMES)} таймфреймах…")
    tf_score_maps = await asyncio.gather(*[scan_tf(tf) for tf in TIMEFRAMES])

    # Объединяем скоры: среднее по таймфреймам
    combined: Dict[str, Dict[str, float]] = {}
    for tf, score_map in zip(TIMEFRAMES, tf_score_maps):
        for sym, score in score_map.items():
            if sym not in combined:
                combined[sym] = {}
            combined[sym][tf] = score

    # Оставляем только пары которые хорошие хотя бы на 2 из 3 ТФ
    qualified = {
        sym: tf_scores
        for sym, tf_scores in combined.items()
        if sum(1 for s in tf_scores.values() if s > 0.01) >= 2
    }

    # Сортируем по среднему скору
    ranked = sorted(
        qualified.items(),
        key=lambda x: np.mean(list(x[1].values())),
        reverse=True
    )[:top_n]

    print(f"  ✅ Отобрано {len(ranked)} пар для ML-анализа")
    return dict(ranked)


# ─────────────────────────────────────────────────────────────
#  ML signal for one pair × one timeframe
# ─────────────────────────────────────────────────────────────

async def get_ml_signal(
        predictor,
        symbol: str,
        timeframe: str,
        tf_scores: Dict[str, float],
) -> Optional[Trade]:
    """Получить ML-сигнал для пары на таймфрейме."""
    from data.fetcher import OHLCVFetcher

    try:
        ohlcv = await OHLCVFetcher.fetch_binance_full(
            symbol, timeframe, ML_BARS, futures=True
        )
        if ohlcv is None:
            return None

        _, o, h, l, c, v = OHLCVFetcher.unpack(ohlcv)
        sig = predictor.analyze(
            symbol, timeframe,
            list(o), list(h), list(l), list(c), list(v),
            auto_train=False,
        )

        # Фильтруем слабые сигналы
        if sig.direction == "NEUTRAL":
            return None
        if sig.confidence < MIN_CONF:
            return None
        if sig.risk_reward < MIN_RR:
            return None
        if not sig.is_valid_trade:
            return None

        return Trade(
            symbol      = symbol,
            timeframe   = timeframe,
            direction   = sig.direction,
            confidence  = sig.confidence,
            entry       = sig.current_price,
            stop_loss   = sig.stop_loss,
            tp1         = sig.take_profit_1,
            tp2         = sig.take_profit_2,
            tp3         = sig.take_profit_3,
            risk_reward = sig.risk_reward,
            regime      = sig.regime,
            rsi         = sig.rsi,
            adx         = sig.adx,
            trend       = sig.trend,
            scan_score  = np.mean(list(tf_scores.values())),
            tf_scores   = tf_scores,
        )

    except Exception as e:
        return None


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="OrbityxAI — Find Trades")
    p.add_argument("--top",     type=int,   default=TOP_RESULTS,
                   help=f"Сколько лучших сделок показать (по умолчанию {TOP_RESULTS})")
    p.add_argument("--tf",      type=str,   default=None,
                   choices=["1h", "4h", "1d"],
                   help="Анализировать только один таймфрейм")
    p.add_argument("--min-rr",  type=float, default=MIN_RR,
                   help=f"Минимум R:R (по умолчанию {MIN_RR})")
    p.add_argument("--min-conf",type=float, default=MIN_CONF,
                   help=f"Минимум уверенности (по умолчанию {MIN_CONF})")
    p.add_argument("--load",    type=str,   default=None,
                   help="Загрузить готовую модель (быстрее)")
    p.add_argument("--pairs",   type=str,   default=None,
                   help="Конкретные пары через запятую (пропустить скан)")
    p.add_argument("--volume",  type=float, default=MIN_VOLUME,
                   help=f"Минимум суточного объёма $ (по умолчанию {MIN_VOLUME/1e6:.0f}M)")
    return p.parse_args()


async def main():
    args = parse_args()

    # Переопределяем глобальные фильтры из аргументов
    global MIN_RR, MIN_CONF
    MIN_RR   = args.min_rr
    MIN_CONF = args.min_conf

    tfs = [args.tf] if args.tf else TIMEFRAMES

    try:
        from predictor import OrbityxPredictor
        from utils.logger import log
    except ImportError as e:
        print(f"❌ {e}"); sys.exit(1)

    print(f"\n{'═'*60}")
    print(f"  OrbityxAI — Поиск сделок")
    print(f"  Таймфреймы: {tfs}  |  Мин. R:R: {MIN_RR}  |  Мин. conf: {MIN_CONF:.0%}")
    print(f"{'═'*60}\n")

    # ── Шаг 1: Обучение или загрузка модели ─────────────────
    predictor = OrbityxPredictor(portfolio_size=10_000)

    if args.load:
        print(f"📂 Загружаем модель из {args.load}…")
        predictor = OrbityxPredictor.from_saved(args.load)
        print(f"  ✅ Модель загружена\n")
    else:
        print(f"🧠 Обучаем shared модель на 20 парах…")
        print(f"  (используй --load model.pkl для ускорения)\n")
        await predictor.train_max(timeframe="1d", bars=500_000)
        print()

    # ── Шаг 2: Скан рынка ───────────────────────────────────
    if args.pairs:
        # Конкретные пары — без скана
        pair_list  = [p.strip().upper() for p in args.pairs.split(",")]
        pair_scores = {sym: {tf: 1.0 for tf in tfs} for sym in pair_list}
        print(f"📌 Используем указанные пары: {pair_list}\n")
    else:
        print(f"🔍 Шаг 1: Скан рынка…")
        pair_scores = await scan_all_timeframes(
            min_volume=args.volume, top_n=TOP_SCAN
        )
        print()

    # ── Шаг 3: ML-анализ по всем таймфреймам ────────────────
    print(f"🤖 Шаг 2: ML-анализ {len(pair_scores)} пар × {len(tfs)} ТФ…\n")

    all_trades: List[Trade] = []

    # Анализируем батчами по 5 пар параллельно
    symbols = list(pair_scores.keys())
    batch_size = 5

    for i in range(0, len(symbols), batch_size):
        batch   = symbols[i: i + batch_size]
        tasks   = [
            get_ml_signal(predictor, sym, tf, pair_scores[sym])
            for sym in batch
            for tf  in tfs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for trade in results:
            if isinstance(trade, Trade):
                all_trades.append(trade)

        done  = min(i + batch_size, len(symbols))
        total = len(symbols)
        bar   = "█" * int(done / total * 20) + "░" * (20 - int(done / total * 20))
        print(f"  [{bar}] {done}/{total} пар", end="\r")

    print(f"  {'█'*20} {len(symbols)}/{len(symbols)} пар ✅\n")

    # ── Шаг 4: Сортировка и вывод ───────────────────────────
    if not all_trades:
        print("⚠️  Сигналов не найдено.")
        print(f"   Попробуй снизить фильтры: --min-rr 1.2 --min-conf 0.50\n")
        return

    # Сортируем: R:R × уверенность × скор скана
    all_trades.sort(
        key=lambda t: t.risk_reward * t.confidence * t.scan_score,
        reverse=True
    )

    # Дедупликация: не больше 2 сигналов на одну пару
    seen: Dict[str, int] = {}
    deduped = []
    for t in all_trades:
        count = seen.get(t.symbol, 0)
        if count < 2:
            deduped.append(t)
            seen[t.symbol] = count + 1

    top_trades = deduped[: args.top]

    print(f"{'═'*60}")
    print(f"  🎯 Топ-{len(top_trades)} сделок")
    print(f"{'═'*60}\n")

    for rank, trade in enumerate(top_trades, 1):
        print(trade.summary_line(rank))
        # Показываем согласованность ТФ
        tf_info = "  Скоры ТФ: " + "  ".join(
            f"{tf}={score:.3f}" for tf, score in sorted(trade.tf_scores.items())
        )
        print(f"{tf_info}\n")

    # ── Краткая таблица в конце ──────────────────────────────
    print(f"{'═'*60}")
    print(f"  {'#':>2}  {'Пара':<12} {'Dir':>5}  {'ТФ':>3}  {'Вход':>10}  "
          f"{'Стоп':>10}  {'TP1':>10}  {'R:R':>5}  {'Conf':>6}")
    print(f"  {'─'*57}")
    for rank, t in enumerate(top_trades, 1):
        dir_str = "LONG " if t.direction == "LONG" else "SHORT"
        print(
            f"  {rank:>2}. {t.symbol:<12} {dir_str}  {t.timeframe:>3}  "
            f"{t.entry:>10,.4f}  {t.stop_loss:>10,.4f}  "
            f"{t.tp1:>10,.4f}  {t.risk_reward:>5.2f}  {t.confidence:>6.1%}"
        )
    print(f"{'═'*60}\n")

    # Статистика
    longs  = sum(1 for t in top_trades if t.direction == "LONG")
    shorts = sum(1 for t in top_trades if t.direction == "SHORT")
    avg_rr = np.mean([t.risk_reward for t in top_trades])
    avg_c  = np.mean([t.confidence  for t in top_trades])
    print(f"  📈 LONG: {longs}  📉 SHORT: {shorts}  "
          f"Средний R:R: {avg_rr:.2f}  Средняя conf: {avg_c:.1%}\n")


if __name__ == "__main__":
    asyncio.run(main())