"""
OrbityxAI v6.7 — Walk-Forward Backtest Launcher
=================================================
Изменения vs v6.2:
  - Timestamps теперь извлекаются из OHLCV и передаются в BacktestEngine,
    чтобы FeatureEngineer мог строить G26 временные фичи (hour/day циклическое).
  - BacktestEngine v6.7 используется с новыми параметрами
    (use_meta_filter, use_calibration, max_acceptable_logloss).

Запуск:

  python run_backtest.py                                  # BTCUSDT 1d
  python run_backtest.py --symbol ETHUSDT --tf 4h
  python run_backtest.py --bars 100000 --tf 1h            # рекомендуется
  python run_backtest.py --symbol SOLUSDT --splits 5
  python run_backtest.py --no-plot
  python run_backtest.py --save-trades trades.csv
  python run_backtest.py --multi BTCUSDT,ETHUSDT,SOLUSDT --tf 1d
  python run_backtest.py --load model_1d.pkl --tf 1d
"""

import asyncio
import argparse
import csv
import sys
from typing import List, Optional
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="OrbityxAI v6.7 — Walk-Forward Backtest",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    p.add_argument("--symbol",  type=str,   default="BTCUSDT")
    p.add_argument("--multi",   type=str,   default=None,
                   help="Несколько пар: BTCUSDT,ETHUSDT,SOLUSDT")
    p.add_argument("--tf",      type=str,   default="1d",
                   choices=["1m","5m","15m","30m","1h","4h","1d"])
    p.add_argument("--bars",    type=int,   default=500_000)
    p.add_argument("--capital", type=float, default=10_000.0)
    p.add_argument("--risk",    type=float, default=0.02)
    p.add_argument("--splits",  type=int,   default=8)
    p.add_argument("--min-conf",type=float, default=0.05,
                   help="Мин. |prob_up − 0.5| × 2. По умолчанию: 0.05")
    p.add_argument("--max-ll",  type=float, default=0.90,
                   help="Макс. OOF log-loss для принятия сплита. По умолчанию: 0.90")
    p.add_argument("--no-meta-filter", action="store_true",
                   help="Отключить MetaClassifier фильтр сделок")
    p.add_argument("--no-calibration", action="store_true",
                   help="Отключить per-split калибровку вероятностей")
    p.add_argument("--save-trades", type=str, default=None, metavar="FILE")
    p.add_argument("--load",    type=str,   default=None, metavar="MODEL")
    p.add_argument("--no-plot", action="store_true")
    p.add_argument("--futures", action="store_true", default=True)
    p.add_argument("--spot",    action="store_true")
    return p.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
#  Данные — теперь возвращаем timestamps
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_ohlcv(
        symbol:    str,
        timeframe: str,
        bars:      int,
        futures:   bool = True,
) -> Optional[tuple]:
    """
    Загружает OHLCV данные с Binance.
    Возвращает (timestamps, opens, highs, lows, closes, volumes) или None.
    timestamps — Unix milliseconds (np.ndarray).
    """
    from data.fetcher import OHLCVFetcher

    print(f"  📥 Загрузка {symbol} [{timeframe}] — до {bars} баров…",
          end="", flush=True)
    try:
        data = await OHLCVFetcher.fetch_binance_full(
            symbol, timeframe, bars, futures=futures
        )
        if data is None:
            print(" ❌ нет данных")
            return None

        ts, o, h, l, c, v = OHLCVFetcher.unpack(data)
        ts, o, h, l, c, v = (
            np.array(ts, dtype=float),
            np.array(o,  dtype=float),
            np.array(h,  dtype=float),
            np.array(l,  dtype=float),
            np.array(c,  dtype=float),
            np.array(v,  dtype=float),
        )

        if len(c) < 200:
            print(f" ❌ слишком мало баров ({len(c)})")
            return None

        print(f" ✅ {len(c)} баров")
        return ts, o, h, l, c, v

    except Exception as e:
        print(f" ❌ ошибка: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Сохранение лога сделок
# ─────────────────────────────────────────────────────────────────────────────

def save_trade_log(trade_log: list, filepath: str) -> None:
    if not trade_log:
        print(f"  ⚠️  Лог сделок пуст — файл не создан.")
        return
    fieldnames = list(trade_log[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(trade_log)
    print(f"  💾 Лог сделок → {filepath}  ({len(trade_log)} строк)")


# ─────────────────────────────────────────────────────────────────────────────
#  ASCII equity curve
# ─────────────────────────────────────────────────────────────────────────────

def print_ascii_equity(equity: list, width: int = 60, height: int = 12) -> None:
    if len(equity) < 2:
        return
    eq   = np.array(equity, dtype=float)
    lo   = eq.min();  hi = eq.max();  span = hi - lo or 1.0
    idxs = np.linspace(0, len(eq) - 1, width, dtype=int)
    vals = eq[idxs]
    rows = []
    for row in range(height):
        threshold = hi - (row / (height - 1)) * span
        line      = ""
        for val in vals:
            line += "█" if val >= threshold - span / height * 0.5 else " "
        rows.append(f"  ${threshold:>9,.0f} │{line}")
    print(f"\n  {'─'*10}╔{'═'*width}╗")
    for r in rows:
        print(r)
    print(f"  {' '*10}╚{'═'*width}╝")
    print(f"  {' '*11}{'Начало':^{width//2}}{'Конец':^{width//2}}")


# ─────────────────────────────────────────────────────────────────────────────
#  Один бэктест
# ─────────────────────────────────────────────────────────────────────────────

async def run_single_backtest(
        symbol:         str,
        timeframe:      str,
        bars:           int,
        futures:        bool,
        capital:        float,
        risk:           float,
        splits:         int,
        min_conf:       float,
        max_ll:         float,
        use_meta:       bool,
        use_calib:      bool,
        save_trades:    Optional[str],
        no_plot:        bool,
):
    from backtest.engine import BacktestEngine

    result_data = await fetch_ohlcv(symbol, timeframe, bars, futures)
    if result_data is None:
        return None

    timestamps, opens, highs, lows, closes, volumes = result_data

    engine = BacktestEngine(
        initial_capital        = capital,
        risk_per_trade         = risk,
        timeframe              = timeframe,
        n_splits               = splits,
        min_confidence         = min_conf,
        max_acceptable_logloss = max_ll,
        min_p_correct          = 0.52 if use_meta  else 0.0,
        calibration_fraction   = 0.10 if use_calib else 0.0,
    )

    print(f"\n  ⚙️  Walk-Forward бэктест [{symbol} {timeframe}]…")
    # Передаём timestamps для G26 временных фич
    result = engine.run(opens, highs, lows, closes, volumes,
                        timestamps=timestamps)

    print(result.summary())

    if not no_plot and result.equity_curve:
        print("\n  📈 Equity Curve:")
        print_ascii_equity(result.equity_curve)

    if result.mc_p50:
        initial   = capital
        final_p5  = result.mc_p5[-1]  if result.mc_p5  else 0
        final_p50 = result.mc_p50[-1] if result.mc_p50 else 0
        final_p95 = result.mc_p95[-1] if result.mc_p95 else 0
        print(f"\n  🎲 Monte Carlo (500 симуляций):")
        print(f"     p5  → ${final_p5:>10,.0f}  ({final_p5/initial - 1:>+.1%})")
        print(f"     p50 → ${final_p50:>10,.0f}  ({final_p50/initial - 1:>+.1%})")
        print(f"     p95 → ${final_p95:>10,.0f}  ({final_p95/initial - 1:>+.1%})")

    if result.trade_log:
        sorted_trades = sorted(result.trade_log,
                               key=lambda t: t["pnl_usd"], reverse=True)
        print(f"\n  🏆 Топ-5 лучших сделок:")
        for t in sorted_trades[:5]:
            print(f"     [{t['split']}] {t['direction']:<5}  "
                  f"bar {t['entry_bar']}→{t['exit_bar']}  "
                  f"{t['exit_reason']:<7}  "
                  f"PnL: {t['pnl_pct']:>+.2%} / ${t['pnl_usd']:>+.2f}")

        print(f"\n  💥 Топ-5 худших сделок:")
        for t in sorted_trades[-5:][::-1]:
            print(f"     [{t['split']}] {t['direction']:<5}  "
                  f"bar {t['entry_bar']}→{t['exit_bar']}  "
                  f"{t['exit_reason']:<7}  "
                  f"PnL: {t['pnl_pct']:>+.2%} / ${t['pnl_usd']:>+.2f}")

        reasons: dict = {}
        for t in result.trade_log:
            r = t["exit_reason"]
            reasons[r] = reasons.get(r, {"n": 0, "pnl": 0.0})
            reasons[r]["n"]   += 1
            reasons[r]["pnl"] += t["pnl_usd"]
        print(f"\n  📊 По причинам закрытия:")
        for r, s in sorted(reasons.items(), key=lambda x: -x[1]["n"]):
            wr = sum(1 for t in result.trade_log
                     if t["exit_reason"] == r and t["pnl_usd"] > 0)
            n  = s["n"]
            print(f"     {r:<8}  {n:>4} сделок  "
                  f"WR: {wr/n:>5.1%}  "
                  f"PnL: ${s['pnl']:>+,.2f}")

    if save_trades and result.trade_log:
        fname = save_trades
        for token, val in [("{symbol}", symbol.lower()), ("{tf}", timeframe)]:
            fname = fname.replace(token, val)
        save_trade_log(result.trade_log, fname)

    return result


# ─────────────────────────────────────────────────────────────────────────────
#  Multi-symbol сводка
# ─────────────────────────────────────────────────────────────────────────────

def print_multi_summary(results: dict) -> None:
    if not results:
        return
    print(f"\n\n{'='*80}")
    print(f"  📊 СВОДНАЯ ТАБЛИЦА — {len(results)} пар")
    print(f"{'='*80}")
    print(f"  {'Пара':<12}  {'Trades':>6}  {'WR':>6}  {'Sharpe':>7}  "
          f"{'CAGR':>8}  {'MaxDD':>8}  {'PF':>6}  {'Ret':>8}")
    print(f"  {'─'*72}")
    for sym, r in sorted(results.items(),
                         key=lambda x: x[1].sharpe_ratio if x[1] else -999,
                         reverse=True):
        if r is None:
            print(f"  {sym:<12}  — ошибка")
            continue
        print(f"  {sym:<12}  {r.total_trades:>6}  {r.win_rate:>6.1%}  "
              f"{r.sharpe_ratio:>7.2f}  {r.cagr:>+8.1%}  "
              f"{r.max_drawdown:>8.1%}  {r.profit_factor:>6.2f}  "
              f"{r.total_return:>+8.1%}")
    all_sharpes = [r.sharpe_ratio for r in results.values() if r]
    all_cagrs   = [r.cagr         for r in results.values() if r]
    print(f"  {'─'*72}")
    print(f"  {'Среднее':<12}  {'':>6}  {'':>6}  "
          f"{np.mean(all_sharpes) if all_sharpes else 0:>7.2f}  "
          f"{np.mean(all_cagrs) if all_cagrs else 0:>+8.1%}")
    print(f"{'='*80}\n")


# ─────────────────────────────────────────────────────────────────────────────
#  Режим --load (готовая модель)
# ─────────────────────────────────────────────────────────────────────────────

def _inject_pretrained_model(loaded_predictor):
    from models.regime_ensemble import RegimeEnsemble  # ← не StackingEnsemble

    try:
        trained_re = loaded_predictor.predictor.ensemble
    except AttributeError:
        try:
            trained_re = loaded_predictor.ensemble
        except AttributeError:
            print("  ⚠️  Не удалось достать ensemble — переобучение")
            return None

    _orig_init = RegimeEnsemble.__init__
    _orig_fit  = RegimeEnsemble.fit

    def _patched_init(self, *a, **kw):
        self.__dict__.update(trained_re.__dict__)

    def _patched_fit(self, X, y, *a, **kw):
        return self  # не переобучаем

    RegimeEnsemble.__init__ = _patched_init
    RegimeEnsemble.fit      = _patched_fit
    print("  🔌 Готовая модель подключена к BacktestEngine")

    def _restore():
        RegimeEnsemble.__init__ = _orig_init
        RegimeEnsemble.fit      = _orig_fit

    return _restore


async def run_backtest_with_loaded_model(
        model_path:  str,
        symbol:      str,
        timeframe:   str,
        bars:        int,
        futures:     bool,
        max_ll:      float,
        use_meta:    bool,
        use_calib:   bool,
        save_trades: Optional[str],
        no_plot:     bool,
):
    from pathlib import Path

    if not Path(model_path).exists():
        print(f"❌ Файл не найден: {model_path}")
        return None

    print(f"  📂 Загружаем модель: {model_path}…")
    try:
        from max_predictor import MaxAccuracyPredictor
        loaded = MaxAccuracyPredictor.load(model_path)
        print(f"  ✅ Модель загружена\n")
    except Exception as e:
        print(f"  ❌ Ошибка загрузки: {e}")
        return None

    restore_fn = _inject_pretrained_model(loaded)

    try:
        result_data = await fetch_ohlcv(symbol, timeframe, bars, futures)
        if result_data is None:
            return None

        timestamps, opens, highs, lows, closes, volumes = result_data

        from backtest.engine import BacktestEngine
        engine = BacktestEngine(
            timeframe              = timeframe,
            max_acceptable_logloss = max_ll,
            min_p_correct          = 0.52 if use_meta  else 0.0,
            calibration_fraction   = 0.10 if use_calib else 0.0,
        )

        print(f"  ⚙️  Бэктест [{symbol} {timeframe}] с готовой моделью…")
        result = engine.run(opens, highs, lows, closes, volumes,
                            timestamps=timestamps)
    finally:
        if restore_fn:
            restore_fn()

    if not result or not result.trade_log:
        print("  ⚠️  Бэктест без сделок.")
        return result

    print(result.summary())

    if not no_plot and result.equity_curve:
        print("\n  📈 Equity Curve:")
        print_ascii_equity(result.equity_curve)

    if result.mc_p50:
        initial   = result.equity_curve[0] if result.equity_curve else 10_000
        final_p50 = result.mc_p50[-1] if result.mc_p50 else 0
        final_p95 = result.mc_p95[-1] if result.mc_p95 else 0
        final_p5  = result.mc_p5[-1]  if result.mc_p5  else 0
        print(f"\n  🎲 Monte Carlo:")
        print(f"     p5  → ${final_p5:>10,.0f}  ({final_p5/initial - 1:>+.1%})")
        print(f"     p50 → ${final_p50:>10,.0f}  ({final_p50/initial - 1:>+.1%})")
        print(f"     p95 → ${final_p95:>10,.0f}  ({final_p95/initial - 1:>+.1%})")

    if save_trades and result.trade_log:
        save_trade_log(result.trade_log, save_trades)

    return result


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    args    = parse_args()
    futures = not args.spot

    symbols = ([s.strip().upper() for s in args.multi.split(",") if s.strip()]
               if args.multi else [args.symbol.upper()])

    # Авто-поиск модели
    if not args.load:
        from pathlib import Path
        for c in [f"model_{args.tf}.pkl", "model.pkl"]:
            if Path(c).exists():
                print(f"\n  🔎 Авто-найдена модель: {c}\n")
                args.load = c
                break

    use_meta  = not args.no_meta_filter
    use_calib = not args.no_calibration

    print(f"\n{'='*65}")
    print(f"  OrbityxAI v6.7 — Walk-Forward Backtest")
    print(f"  Пар: {len(symbols)}  |  ТФ: {args.tf}  |  Баров: {args.bars:,}")
    if args.load:
        print(f"  Модель: {args.load}  (без переобучения)")
    else:
        print(f"  Капитал: ${args.capital:,.0f}  |  Риск: {args.risk:.0%}/сделку")
        print(f"  Сплиты: {args.splits}  |  Мин. conf: {args.min_conf}")
    print(f"  Max LL: {args.max_ll}  |  MetaFilter: {use_meta}  "
          f"|  Calibration: {use_calib}")
    print(f"  Данные: {'Futures' if futures else 'Spot'}")
    print(f"{'='*65}\n")

    if args.load:
        if len(symbols) == 1:
            await run_backtest_with_loaded_model(
                model_path  = args.load,
                symbol      = symbols[0],
                timeframe   = args.tf,
                bars        = args.bars,
                futures     = futures,
                max_ll      = args.max_ll,
                use_meta    = use_meta,
                use_calib   = use_calib,
                save_trades = args.save_trades,
                no_plot     = args.no_plot,
            )
        else:
            results = {}
            for sym in symbols:
                print(f"\n{'─'*65}\n  ▶  {sym}\n{'─'*65}")
                results[sym] = await run_backtest_with_loaded_model(
                    model_path  = args.load,
                    symbol      = sym,
                    timeframe   = args.tf,
                    bars        = args.bars,
                    futures     = futures,
                    max_ll      = args.max_ll,
                    use_meta    = use_meta,
                    use_calib   = use_calib,
                    save_trades = args.save_trades,
                    no_plot     = True,
                )
            print_multi_summary(results)
        return

    if len(symbols) == 1:
        await run_single_backtest(
            symbol      = symbols[0],
            timeframe   = args.tf,
            bars        = args.bars,
            futures     = futures,
            capital     = args.capital,
            risk        = args.risk,
            splits      = args.splits,
            min_conf    = args.min_conf,
            max_ll      = args.max_ll,
            use_meta    = use_meta,
            use_calib   = use_calib,
            save_trades = args.save_trades,
            no_plot     = args.no_plot,
        )
        return

    results = {}
    for sym in symbols:
        print(f"\n{'─'*65}\n  ▶  {sym}\n{'─'*65}")
        save_file = (
            args.save_trades.replace("{symbol}", sym.lower())
            .replace("{tf}",     args.tf)
            if args.save_trades else None
        )
        results[sym] = await run_single_backtest(
            symbol      = sym,
            timeframe   = args.tf,
            bars        = args.bars,
            futures     = futures,
            capital     = args.capital,
            risk        = args.risk,
            splits      = args.splits,
            min_conf    = args.min_conf,
            max_ll      = args.max_ll,
            use_meta    = use_meta,
            use_calib   = use_calib,
            save_trades = save_file,
            no_plot     = True,
        )
    print_multi_summary(results)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n🛑 Прервано пользователем.")
        sys.exit(0)