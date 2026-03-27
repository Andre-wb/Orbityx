"""
OrbityxAI v7.3 — Checklist Backtest
=====================================
Бэктест стратегии CHECKLIST (уровни + пробой/ретест).
Новые принципы:
  - SL всегда за уровнем (не между входом и уровнем)
  - Фильтр объёма: сигнальный бар ≥ 1.2x среднего объёма
  - Фильтр режима: ADX H1 > 15 (не боковик)
  - Адаптивный SL: 8–30% ATR D1

Usage:
  python run_setup_backtest.py
  python run_setup_backtest.py --symbol BTCUSDT --bars 5000
  python run_setup_backtest.py --symbol ETHUSDT --min-rr 3.0 --risk 0.01
"""
import asyncio
import argparse
import numpy as np
import warnings
warnings.filterwarnings("ignore")


def parse_args():
    p = argparse.ArgumentParser(description="Checklist Strategy Backtest")
    p.add_argument("--symbol",   type=str,   default="BTCUSDT")
    p.add_argument("--tf",       type=str,   default="1h",
                   help="Base timeframe (1h recommended)")
    p.add_argument("--bars",     type=int,   default=5000,
                   help="Number of bars to fetch")
    p.add_argument("--capital",  type=float, default=10000)
    p.add_argument("--risk",     type=float, default=0.01,
                   help="Risk per trade (fraction, e.g. 0.01 = 1%%)")
    p.add_argument("--min-rr",   type=float, default=3.0)
    p.add_argument("--max-hold", type=int,   default=20,
                   help="Max bars to hold position before timeout")
    p.add_argument("--leverage", type=float, default=5.0)
    return p.parse_args()


# ── Simulate one trade outcome ────────────────────────────────────────

def simulate_outcome(direction, entry, sl, tp, highs, lows, closes,
                     bar_start, max_hold):
    """
    Walk bars forward from bar_start.
    Returns (outcome, exit_price, bars_held, exit_reason)
      outcome: 1=win, 0=loss, -1=timeout
    """
    for i in range(bar_start, min(bar_start + max_hold, len(closes))):
        h, l = float(highs[i]), float(lows[i])
        if direction == "LONG":
            if l <= sl:
                return 0, sl, i - bar_start, "stop_loss"
            if h >= tp:
                return 1, tp, i - bar_start, "take_profit"
        else:
            if h >= sl:
                return 0, sl, i - bar_start, "stop_loss"
            if l <= tp:
                return 1, tp, i - bar_start, "take_profit"
    # timeout
    exit_price = float(closes[min(bar_start + max_hold - 1, len(closes) - 1)])
    pnl_dir = exit_price - entry if direction == "LONG" else entry - exit_price
    outcome = 1 if pnl_dir > 0 else 0
    return outcome, exit_price, max_hold, "timeout"


# ── Main ─────────────────────────────────────────────────────────────

async def main():
    args = parse_args()

    from data.fetcher import OHLCVFetcher
    from indicators.technical import atr as calc_atr, ema, adx as calc_adx
    from levels.detector import detect_levels

    print(f"\n{'='*65}")
    print(f"  OrbityxAI v7.3 — Checklist Backtest")
    print(f"  {args.symbol} [{args.tf}] | {args.bars} баров")
    print(f"  Капитал: ${args.capital:,.0f} | Риск: {args.risk:.0%}/сделка")
    print(f"  Min R:R: {args.min_rr} | Плечо: {args.leverage}x")
    print(f"  Новые фильтры: объём ≥1.2x, ADX>15, SL за уровнем")
    print(f"{'='*65}\n")

    # ── Загрузка данных ──
    print("  Загрузка данных...")
    ohlcv = await OHLCVFetcher.fetch_binance_full(
        args.symbol, args.tf, args.bars, futures=True)
    if ohlcv is None:
        print("  ОШИБКА: нет данных"); return

    _, o_raw, h_raw, l_raw, c_raw, v_raw = OHLCVFetcher.unpack(ohlcv)
    o = np.array(o_raw, dtype=float)
    h = np.array(h_raw, dtype=float)
    l = np.array(l_raw, dtype=float)
    c = np.array(c_raw, dtype=float)
    v = np.array(v_raw, dtype=float)
    n = len(c)
    print(f"  Загружено {n} баров")

    # HTF данные (4x) для D1 уровней и ATR D1
    htf_factor = 4
    o_d = np.array([np.mean(o[i:i+htf_factor]) for i in range(0, n - htf_factor, htf_factor)])
    h_d = np.array([np.max(h[i:i+htf_factor]) for i in range(0, n - htf_factor, htf_factor)])
    l_d = np.array([np.min(l[i:i+htf_factor]) for i in range(0, n - htf_factor, htf_factor)])
    c_d = np.array([c[i+htf_factor-1] for i in range(0, n - htf_factor, htf_factor)])
    v_d = np.array([np.sum(v[i:i+htf_factor]) for i in range(0, n - htf_factor, htf_factor)])

    # ── Скользящий бэктест ──
    warm_up = 300          # баров для накопления уровней
    level_window = 500     # окно для детектирования уровней

    trades = []
    equity = args.capital
    equity_curve = [equity]
    peak_equity = equity
    consecutive_losses = 0
    active_position = None  # (entry_bar, direction, entry, sl, tp)

    # Счётчики фильтров
    filter_stats = {
        "пила": 0, "волатильность": 0, "тренд_H1": 0,
        "ADX_боковик": 0, "объём": 0, "SL_невалиден": 0,
        "нет_уровней": 0, "направление": 0, "прошли": 0,
    }

    print(f"  Сканирование сетапов (warm-up: {warm_up} баров)...")

    for bar in range(warm_up, n - args.max_hold - 1):
        # ── Управление открытой позицией ──
        if active_position is not None:
            eb, direction, entry, sl, tp, bar_open = active_position
            outcome, exit_price, bars_held, reason = simulate_outcome(
                direction, entry, sl, tp, h, l, c, bar, 1)
            if outcome != -1 or (bar - bar_open) >= args.max_hold:
                if outcome == -1:
                    outcome, exit_price, bars_held, reason = simulate_outcome(
                        direction, entry, sl, tp, h, l, c, bar, args.max_hold)
                pnl_pct = (exit_price - entry) / entry if direction == "LONG" else (entry - exit_price) / entry
                pos_val = equity * args.risk / (abs(entry - sl) / entry + 1e-9)
                pos_val = min(pos_val, equity * 0.10)  # не более 10% капитала
                pnl_usd = pos_val * pnl_pct * args.leverage
                equity += pnl_usd
                equity_curve.append(equity)
                peak_equity = max(peak_equity, equity)
                if outcome == 1:
                    consecutive_losses = 0
                else:
                    consecutive_losses += 1
                trades.append({
                    "bar": bar_open, "direction": direction,
                    "entry": entry, "sl": sl, "tp": tp,
                    "exit_price": exit_price, "exit_reason": reason,
                    "pnl_pct": pnl_pct * 100, "pnl_usd": pnl_usd,
                    "outcome": outcome, "bars_held": bars_held,
                })
                active_position = None
            continue  # пока в позиции — не ищем новую

        # ── Детектирование уровней ──
        ws = max(0, bar - level_window)
        h_w = h[ws:bar]; l_w = l[ws:bar]; c_w = c[ws:bar]; v_w = v[ws:bar]
        atr_w = calc_atr(h_w, l_w, c_w, 14)
        if len(atr_w) == 0 or atr_w[-1] <= 0:
            continue
        levels_h1 = detect_levels(h_w, l_w, c_w, v_w, atr_w, swing_window=10)

        # ATR D1 из агрегированных данных
        d_bar = bar // htf_factor
        if d_bar < 20:
            continue
        atr_d1_arr = calc_atr(h_d[:d_bar], l_d[:d_bar], c_d[:d_bar], 14)
        if len(atr_d1_arr) == 0:
            continue
        atr_d1 = float(atr_d1_arr[-1])
        if atr_d1 <= 0:
            continue
        levels_d1 = detect_levels(h_d[:d_bar], l_d[:d_bar], c_d[:d_bar], v_d[:d_bar],
                                   atr_d1_arr, swing_window=5)

        # ── Чек-лист на текущем баре ──
        price = float(c[bar])
        atr_m5 = float(atr_w[-1])  # используем тот же TF как "M5"

        # Объединяем уровни
        all_levels = [("D1", lv) for lv in levels_d1 if lv.strength >= 3.0] + \
                     [("H1", lv) for lv in levels_h1 if lv.strength >= 3.0]
        if not all_levels:
            filter_stats["нет_уровней"] += 1
            continue

        # Ближайший уровень
        best = min(all_levels, key=lambda x: abs(price - x[1].price))
        best_tf, best_lv = best
        level_price = best_lv.price
        dist_atr = abs(price - level_price) / atr_d1
        if dist_atr > 0.20:
            continue

        # Направление
        if len(c_w) < 100:
            continue
        sma100 = float(np.mean(c_w[-100:]))
        direction = None
        if price > level_price and price > sma100:
            direction = "LONG"
        elif price < level_price and price < sma100:
            direction = "SHORT"
        if direction is None:
            filter_stats["направление"] += 1
            continue

        # Фильтр 1: Нет пилы
        crossings = sum(
            1 for i in range(max(len(c_w) - 20, 1), len(c_w))
            if (c_w[i-1] > level_price) != (c_w[i] > level_price)
        )
        if crossings > 2:
            filter_stats["пила"] += 1
            continue

        # Фильтр 2: Волатильность
        if len(h_w) >= 5:
            avg_range = np.mean([h_w[i] - l_w[i] for i in range(-5, 0)])
            if avg_range > atr_m5 * 3:
                filter_stats["волатильность"] += 1
                continue

        # Фильтр 3: Тренд H1 (EMA9/EMA21)
        if len(c_w) >= 21:
            ema9_arr = ema(c_w, 9)
            ema21_arr = ema(c_w, 21)
            if direction == "LONG" and ema9_arr[-1] < ema21_arr[-1]:
                filter_stats["тренд_H1"] += 1
                continue
            if direction == "SHORT" and ema9_arr[-1] > ema21_arr[-1]:
                filter_stats["тренд_H1"] += 1
                continue

        # Фильтр 4: ADX > 15 (не боковик)
        if len(c_w) >= 28:
            adx_arr = calc_adx(h_w, l_w, c_w, 14)
            adx_val = float(adx_arr[0][-1]) if len(adx_arr[0]) > 0 else 0
            if adx_val < 15:
                filter_stats["ADX_боковик"] += 1
                continue

        # Фильтр 5: Объём ≥ 1.2x среднего
        if len(v_w) >= 21:
            avg_vol = float(np.mean(v_w[-21:-1]))
            if avg_vol > 0 and float(v_w[-1]) < avg_vol * 1.2:
                filter_stats["объём"] += 1
                continue

        # ── SL ──
        buffer = atr_m5 * 0.2
        # SL за уровнем
        if direction == "LONG":
            sl = level_price - buffer * 2
        else:
            sl = level_price + buffer * 2

        # Проверка расстояния
        dist_sl = abs(price - sl)
        min_dist = atr_d1 * 0.08
        max_dist = atr_d1 * 0.30
        if dist_sl < min_dist:
            sl = (level_price - atr_d1 * 0.15) if direction == "LONG" else (level_price + atr_d1 * 0.15)
            dist_sl = abs(price - sl)
        if not (min_dist <= dist_sl <= max_dist):
            filter_stats["SL_невалиден"] += 1
            continue

        # ── TP (минимум 3R) ──
        risk = abs(price - sl)
        tp = (price + risk * args.min_rr) if direction == "LONG" else (price - risk * args.min_rr)
        rr = abs(tp - price) / risk

        filter_stats["прошли"] += 1
        active_position = (bar, direction, price, sl, tp, bar)

    # ── Итоги ──
    if not trades:
        print("\n  Нет сделок. Попробуй --min-rr 2.5 или больше --bars")
        print(f"\n  Статистика фильтров: {filter_stats}")
        return

    wins = [t for t in trades if t["outcome"] == 1]
    losses = [t for t in trades if t["outcome"] == 0]
    wr = len(wins) / len(trades) * 100
    avg_win = np.mean([t["pnl_pct"] for t in wins]) if wins else 0
    avg_loss = np.mean([t["pnl_pct"] for t in losses]) if losses else 0

    gross_profit = sum(t["pnl_usd"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_usd"] for t in losses)) if losses else 1e-9
    pf = gross_profit / gross_loss

    equity_arr = np.array(equity_curve)
    max_eq = np.maximum.accumulate(equity_arr)
    drawdowns = (equity_arr - max_eq) / (max_eq + 1e-9) * 100
    max_dd = drawdowns.min()
    total_return = (equity / args.capital - 1) * 100

    longs = [t for t in trades if t["direction"] == "LONG"]
    shorts = [t for t in trades if t["direction"] == "SHORT"]
    wr_long = sum(1 for t in longs if t["outcome"] == 1) / max(len(longs), 1) * 100
    wr_short = sum(1 for t in shorts if t["outcome"] == 1) / max(len(shorts), 1) * 100

    by_reason = {}
    for t in trades:
        r = t["exit_reason"]
        by_reason.setdefault(r, {"n": 0, "wins": 0})
        by_reason[r]["n"] += 1
        by_reason[r]["wins"] += t["outcome"]

    bench_ret = (float(c[-1]) / float(c[warm_up]) - 1) * 100

    # Sharpe (грубо, на ежесделочных доходностях)
    pnls = [t["pnl_pct"] for t in trades]
    sharpe = (np.mean(pnls) / (np.std(pnls) + 1e-9)) * np.sqrt(len(trades)) if len(trades) > 1 else 0

    print(f"\n{'='*65}")
    print(f"  CHECKLIST BACKTEST — РЕЗУЛЬТАТЫ")
    print(f"{'='*65}")
    print(f"  Сделок:         {len(trades)}  ({len(trades)/(n-warm_up)*100:.2f}% баров)")
    print(f"  Win Rate:       {wr:.1f}%")
    print(f"  Avg Win:        +{avg_win:.2f}%")
    print(f"  Avg Loss:       {avg_loss:.2f}%")
    print(f"  Profit Factor:  {pf:.2f}")
    print(f"  Sharpe:         {sharpe:.2f}")
    print(f"{'─'*65}")
    print(f"  LONG:  {len(longs)} сделок  WR: {wr_long:.1f}%")
    print(f"  SHORT: {len(shorts)} сделок  WR: {wr_short:.1f}%")
    print(f"{'─'*65}")
    print(f"  Total Return:   {total_return:+.1f}%")
    print(f"  Max Drawdown:   {max_dd:.1f}%")
    print(f"  Benchmark:      {bench_ret:+.1f}% (buy & hold)")
    print(f"  Alpha:          {total_return - bench_ret:+.1f}%")
    print(f"  Final Equity:   ${equity:,.0f}")
    print(f"{'─'*65}")
    print(f"  Выход по причине:")
    for reason, stats in sorted(by_reason.items()):
        wr_r = stats["wins"] / stats["n"] * 100
        print(f"    {reason:15s}: {stats['n']} сделок  WR {wr_r:.1f}%")
    print(f"{'─'*65}")
    print(f"  Отсев фильтрами:")
    total_filtered = sum(v for k, v in filter_stats.items() if k != "прошли")
    for k, v in filter_stats.items():
        print(f"    {k:20s}: {v}")
    print(f"    {'итого отсеяно':20s}: {total_filtered}")
    print(f"{'='*65}")

    # ASCII equity
    n_cols = 60
    n_rows = 10
    step = max(len(equity_arr) // n_cols, 1)
    sampled = equity_arr[::step][:n_cols]
    y_min, y_max = sampled.min(), sampled.max()
    y_range = y_max - y_min + 1e-9
    print(f"\n  Кривая капитала:")
    for row in range(n_rows):
        y_level = y_max - (row / (n_rows - 1)) * y_range
        label = f"${y_level:>9,.0f}"
        line = "".join(
            "█" if (n_rows - 1 - int((val - y_min) / y_range * (n_rows - 1))) <= row else " "
            for val in sampled
        )
        print(f"  {label} │{line}")
    print(f"  {'':>10}╚{'═'*n_cols}╝")

    # Matplotlib chart
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(3, 1, figsize=(14, 12),
                                 gridspec_kw={'height_ratios': [3, 1, 1]})

        ax1, ax2, ax3 = axes
        ax1.plot(equity_arr, 'b-', linewidth=1.5, label='Checklist')
        ax1.axhline(y=args.capital, color='gray', linestyle=':', alpha=0.5)
        ax1.fill_between(range(len(equity_arr)), equity_arr, args.capital,
                         where=equity_arr >= args.capital, alpha=0.15, color='green')
        ax1.fill_between(range(len(equity_arr)), equity_arr, args.capital,
                         where=equity_arr < args.capital, alpha=0.15, color='red')
        ax1.set_title(
            f'OrbityxAI v7.3 Checklist | {args.symbol} [{args.tf}] | '
            f'WR: {wr:.0f}% | PF: {pf:.2f} | Return: {total_return:+.1f}%',
            fontsize=12, fontweight='bold')
        ax1.set_ylabel('Капитал ($)')
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        colors = ['green' if t["outcome"] == 1 else 'red' for t in trades]
        ax2.bar(range(len(trades)), [t["pnl_pct"] for t in trades],
                color=colors, alpha=0.7, width=0.8)
        ax2.axhline(y=0, color='black', linewidth=0.5)
        ax2.set_ylabel('PnL сделки (%)')
        ax2.grid(True, alpha=0.3)

        # Фильтры
        filter_labels = list(filter_stats.keys())
        filter_values = list(filter_stats.values())
        bar_colors = ['gray' if k != 'прошли' else 'green' for k in filter_labels]
        ax3.bar(filter_labels, filter_values, color=bar_colors, alpha=0.7)
        ax3.set_ylabel('Количество')
        ax3.set_title('Статистика фильтров')
        ax3.tick_params(axis='x', rotation=30)
        ax3.grid(True, alpha=0.3, axis='y')

        plt.tight_layout()
        plt.savefig('checklist_backtest.png', dpi=150)
        print(f"\n  График: checklist_backtest.png")
    except Exception as e:
        print(f"\n  График: {e}")


if __name__ == "__main__":
    asyncio.run(main())
