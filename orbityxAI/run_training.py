"""
OrbityxAI v6.3 — Full Training Launcher
=========================================
Режимы запуска:

  python run_training.py                          # все пары, все ТФ, максимум
  python run_training.py --tf 1d                  # только дневной
  python run_training.py --load model.pkl --live  # загрузить и получить сигнал
  python run_training.py --symbol BTCUSDT --live  # сигнал по одной паре

По умолчанию (без аргументов):
  1. Загружает ВСЕ фьючерсные пары с объёмом > $10M
  2. Обучает shared модель на топ-50 парах на каждом ТФ: 1h, 4h, 1d
  3. Сохраняет 3 модели: model_1h.pkl, model_4h.pkl, model_1d.pkl
  4. Выводит топ-10 сигналов по всем ТФ
"""
import asyncio
import argparse
import sys
import numpy as np
from typing import List, Optional, Dict
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="shap")

MAX_BARS    = 500_000
MIN_VOLUME  = 10_000_000      # $10M — ловим все ликвидные пары
SCAN_BARS   = 500             # баров для быстрого скана
TRAIN_PAIRS = 50              # топ-N пар для shared обучения
TIMEFRAMES  = ["1h", "4h", "1d"]


def parse_args():
    p = argparse.ArgumentParser(description="OrbityxAI v6.3 — Full Training")
    p.add_argument("--symbol",    type=str,   default=None,
                   help="Одна пара (иначе — все)")
    p.add_argument("--tf",        type=str,   default=None,
                   choices=["1m","5m","15m","30m","1h","4h","1d","1w"],
                   help="Один таймфрейм (иначе 1h+4h+1d)")
    p.add_argument("--bars",      type=int,   default=MAX_BARS)
    p.add_argument("--portfolio", type=float, default=10_000.0)
    p.add_argument("--volume",    type=float, default=MIN_VOLUME,
                   help=f"Мин. суточный объём $ (по умолчанию {MIN_VOLUME/1e6:.0f}M)")
    p.add_argument("--pairs",     type=int,   default=TRAIN_PAIRS,
                   help=f"Топ-N пар для обучения (по умолчанию {TRAIN_PAIRS})")
    p.add_argument("--backtest",  action="store_true")
    p.add_argument("--live",      action="store_true",
                   help="Вывести живой сигнал после обучения")
    p.add_argument("--save",      type=str,   default="auto",
                   help="Путь для сохранения (auto = model_{tf}.pkl)")
    p.add_argument("--load",      type=str,   default=None,
                   help="Загрузить модель (пропустить обучение)")
    p.add_argument("--no-save",   action="store_true",
                   help="Не сохранять модели")
    p.add_argument("--top",       type=int,   default=10,
                   help="Топ-N сигналов для вывода")
    p.add_argument("--min-rr",    type=float, default=1.5)
    p.add_argument("--min-conf",  type=float, default=0.52)
    return p.parse_args()


async def get_all_pairs(min_volume: float) -> List[str]:
    """Загружает все фьючерсные пары с нужным объёмом."""
    from data.fetcher import OHLCVFetcher
    pairs = await OHLCVFetcher.fetch_all_futures_pairs(min_volume)
    print(f"  📊 Найдено {len(pairs)} пар с объёмом > ${min_volume/1e6:.0f}M")
    return pairs


async def scan_and_rank(
        all_pairs: List[str],
        timeframe: str,
        top_n: int,
) -> List[str]:
    """Быстрый скан — выбираем топ-N лучших пар для обучения."""
    from data.fetcher import OHLCVFetcher
    from trading.scanner import MultiAssetScanner

    scanner   = MultiAssetScanner()
    ohlcv_map = await OHLCVFetcher.fetch_multi(
        all_pairs, timeframe, SCAN_BARS, futures=True, max_concurrent=15
    )
    scores = {}
    for sym, data in ohlcv_map.items():
        if data is None:
            continue
        try:
            _, o, h, l, c, v = OHLCVFetcher.unpack(data)
            ps = scanner.score_pair(sym, np.array(c), np.array(h),
                                    np.array(l), np.array(v))
            scores[sym] = ps.score
        except Exception:
            scores[sym] = 0.0

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top    = [sym for sym, _ in ranked[:top_n]]
    print(f"  🏆 Топ-{len(top)} пар для [{timeframe}]: {top[:10]}...")
    return top


async def train_one_tf(
        timeframe: str,
        symbols:   List[str],
        bars:      int,
        portfolio: float,
        save_path: Optional[str],
):
    """Обучает shared модель на одном таймфрейме."""
    from max_predictor import MaxAccuracyPredictor

    print(f"\n{'═'*60}")
    print(f"  🧠 Обучение [{timeframe}] — {len(symbols)} пар × {bars} баров")
    print(f"{'═'*60}")

    predictor = MaxAccuracyPredictor(
        portfolio_size = portfolio,
        shared         = True,
        use_futures    = True,
        use_mtf        = True,
        use_rl         = True,
    )

    # Передаём символы напрямую в train_max через _initial_train
    await predictor._initial_train(
        timeframe = timeframe,
        bars      = bars,
        symbols   = symbols,
    )

    oof_ll = predictor.predictor.ensemble.oof_logloss
    print(f"\n  ✅ [{timeframe}] Готово. OOF log-loss: {oof_ll:.4f}")

    if save_path and not save_path == "skip":
        predictor.save(save_path)
        print(f"  💾 Сохранено → {save_path}")

    return predictor


async def get_signals_for_pairs(
        predictor,
        symbols:   List[str],
        timeframe: str,
        bars:      int,
        min_rr:    float,
        min_conf:  float,
) -> list:
    """Получает сигналы по всем парам используя обученную модель."""
    from data.fetcher import OHLCVFetcher

    results = []
    batch   = 10

    for i in range(0, len(symbols), batch):
        chunk = symbols[i: i + batch]
        ohlcv_map = await OHLCVFetcher.fetch_multi(
            chunk, timeframe, min(bars, 3000), futures=True, max_concurrent=5
        )
        for sym, data in ohlcv_map.items():
            if data is None:
                continue
            try:
                _, o, h, l, c, v = OHLCVFetcher.unpack(data)
                sig = predictor.predictor.analyze(
                    sym, timeframe,
                    list(o), list(h), list(l), list(c), list(v),
                    auto_train=False,
                )
                if (sig.direction != "NEUTRAL"
                        and sig.confidence >= min_conf
                        and sig.risk_reward >= min_rr
                        and sig.is_valid_trade):
                    results.append((sym, timeframe, sig))
            except Exception:
                pass

        done = min(i + batch, len(symbols))
        print(f"  Сигналы [{timeframe}]: {done}/{len(symbols)}", end="\r")

    print(f"  Сигналы [{timeframe}]: {len(symbols)}/{len(symbols)} ✅  "
          f"найдено {len(results)} сигналов")
    return results


def print_signals(all_signals: list, top_n: int):
    """Выводит топ-N лучших сигналов."""
    if not all_signals:
        print("\n⚠️  Сигналов не найдено. Попробуй: --min-rr 1.2 --min-conf 0.50")
        return

    # Сортируем по R:R × уверенность
    all_signals.sort(key=lambda x: x[2].risk_reward * x[2].confidence, reverse=True)

    # Дедупликация (не более 2 на пару)
    seen: Dict[str, int] = {}
    deduped = []
    for sym, tf, sig in all_signals:
        cnt = seen.get(sym, 0)
        if cnt < 2:
            deduped.append((sym, tf, sig))
            seen[sym] = cnt + 1

    top = deduped[:top_n]

    print(f"\n{'═'*65}")
    print(f"  🎯 Топ-{len(top)} сигналов")
    print(f"{'═'*65}\n")

    for rank, (sym, tf, sig) in enumerate(top, 1):
        dir_emoji = "🟢 LONG " if sig.direction == "LONG" else "🔴 SHORT"
        risk_pct  = abs(sig.current_price - sig.stop_loss) / sig.current_price * 100
        profit_pct= abs(sig.take_profit_1 - sig.current_price) / sig.current_price * 100
        print(f"  {rank:2d}. {sym:<12s} {dir_emoji}  [{tf}]")
        print(f"      Вход:   {sig.current_price:>14,.4f}")
        print(f"      Стоп:   {sig.stop_loss:>14,.4f}  ({risk_pct:.2f}% риска)")
        print(f"      TP1:    {sig.take_profit_1:>14,.4f}  ({profit_pct:.2f}% прибыли)")
        print(f"      TP2:    {sig.take_profit_2:>14,.4f}")
        print(f"      TP3:    {sig.take_profit_3:>14,.4f}")
        print(f"      R:R={sig.risk_reward:.2f}  conf={sig.confidence:.1%}  "
              f"RSI={sig.rsi:.0f}  ADX={sig.adx:.0f}")
        print(f"      Режим: {sig.regime}  |  {sig.trend}")
        print()

    # Краткая таблица
    print(f"{'═'*65}")
    print(f"  {'#':>2}  {'Пара':<12} {'Dir':>5}  {'ТФ':>3}  "
          f"{'Вход':>10}  {'Стоп':>10}  {'TP1':>10}  {'R:R':>5}  {'Conf':>6}")
    print(f"  {'─'*60}")
    for rank, (sym, tf, sig) in enumerate(top, 1):
        d = "LONG " if sig.direction == "LONG" else "SHORT"
        print(f"  {rank:>2}. {sym:<12} {d}  {tf:>3}  "
              f"{sig.current_price:>10,.4f}  {sig.stop_loss:>10,.4f}  "
              f"{sig.take_profit_1:>10,.4f}  {sig.risk_reward:>5.2f}  "
              f"{sig.confidence:>6.1%}")
    print(f"{'═'*65}")

    longs  = sum(1 for _, _, s in top if s.direction == "LONG")
    shorts = sum(1 for _, _, s in top if s.direction == "SHORT")
    avg_rr = np.mean([s.risk_reward for _, _, s in top])
    avg_c  = np.mean([s.confidence  for _, _, s in top])
    print(f"\n  📈 LONG: {longs}  📉 SHORT: {shorts}  "
          f"Средний R:R: {avg_rr:.2f}  Средняя conf: {avg_c:.1%}\n")


async def main():
    args = parse_args()

    try:
        from utils.logger import log
    except ImportError as e:
        print(f"❌ {e}"); sys.exit(1)

    tfs = [args.tf] if args.tf else TIMEFRAMES

    print(f"\n{'═'*65}")
    print(f"  OrbityxAI v6.3 — Full Training")
    if args.symbol:
        print(f"  Пара: {args.symbol}  |  ТФ: {tfs}")
    else:
        print(f"  Режим: ВСЕ пары × {tfs}  |  топ-{args.pairs} на обучение")
    print(f"  Мин. R:R: {args.min_rr}  |  Мин. conf: {args.min_conf:.0%}")
    print(f"{'═'*65}\n")

    # ── Режим --load: только сигналы без обучения ─────────────
    if args.load:
        from max_predictor import MaxAccuracyPredictor
        print(f"📂 Загружаем {args.load}…")
        predictor = MaxAccuracyPredictor.load(args.load)

        if args.symbol:
            sig = await predictor.get_signal(args.symbol, tfs[0], args.bars)
            print(sig.summary())
        else:
            all_pairs  = await get_all_pairs(args.volume)
            all_signals = []
            for tf in tfs:
                sigs = await get_signals_for_pairs(
                    predictor, all_pairs[:200], tf, args.bars,
                    args.min_rr, args.min_conf
                )
                all_signals.extend(sigs)
            print_signals(all_signals, args.top)
        return

    # ── Полное обучение ───────────────────────────────────────
    if args.symbol:
        # Одна пара — стандартный режим
        from max_predictor import MaxAccuracyPredictor
        predictor = MaxAccuracyPredictor(portfolio_size=args.portfolio)
        tf = tfs[0]
        await predictor._initial_train(tf, args.bars, symbols=[args.symbol])

        if args.backtest:
            result = await predictor.predictor.backtest_live(
                args.symbol, tf, args.bars
            )
            if result:
                print(result.summary())

        if args.live or True:
            sig = await predictor.get_signal(args.symbol, tf, args.bars)
            print(sig.summary())

        if not args.no_save:
            path = (args.save if args.save != "auto"
                    else f"model_{tf}_{args.symbol.lower()}.pkl")
            predictor.save(path)
            print(f"✅ Сохранено: {path}")
        return

    # ── Все пары × все таймфреймы ─────────────────────────────
    all_pairs = await get_all_pairs(args.volume)

    predictors: Dict[str, object] = {}
    all_signals = []

    for tf in tfs:
        print(f"\n{'─'*65}")
        print(f"  ⚙️  Таймфрейм: [{tf}]")
        print(f"{'─'*65}")

        # Скан: выбираем лучшие пары для этого ТФ
        print(f"  🔍 Скан {len(all_pairs)} пар для [{tf}]…")
        top_symbols = await scan_and_rank(all_pairs, tf, args.pairs)

        # Обучаем shared модель
        save_path = ("skip" if args.no_save else
                     (args.save if args.save != "auto" else f"model_{tf}.pkl"))
        predictor = await train_one_tf(
            timeframe = tf,
            symbols   = top_symbols,
            bars      = args.bars,
            portfolio = args.portfolio,
            save_path = save_path,
        )
        predictors[tf] = predictor

        # Получаем сигналы по ВСЕМ парам (не только топ-50)
        scan_universe = all_pairs[:300]   # первые 300 по объёму
        print(f"\n  📡 Сигналы по {len(scan_universe)} парам [{tf}]…")
        sigs = await get_signals_for_pairs(
            predictor, scan_universe, tf, args.bars,
            args.min_rr, args.min_conf
        )
        all_signals.extend(sigs)

    # Финальный вывод
    print_signals(all_signals, args.top)

    if not args.no_save:
        print("💾 Модели сохранены:")
        for tf in tfs:
            path = f"model_{tf}.pkl"
            print(f"   {path}")
        print()
        print("Завтра запускай быстро:")
        for tf in tfs:
            print(f"  python run_training.py --load model_{tf}.pkl --tf {tf}")


if __name__ == "__main__":
    asyncio.run(main())