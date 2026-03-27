"""
OrbityxAI v7.2 — Live/Paper Trading Runner
=============================================
Usage:
  # Paper trading (no real money)
  python run_live.py --mode paper --exchange binance

  # Live trading with ML model
  python run_live.py --mode live --exchange bybit --tf 1h --load model_1h.pkl

  # Live trading without ML (setup-only strategy)
  python run_live.py --mode live --exchange binance --key YOUR_KEY --secret YOUR_SECRET

  # Bybit testnet
  python run_live.py --mode paper --exchange bybit --testnet

  # With Telegram alerts
  python run_live.py --mode paper --exchange binance --tg-token BOT_TOKEN --tg-chat CHAT_ID

Environment variables (alternative to CLI args):
  EXCHANGE_KEY, EXCHANGE_SECRET, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
"""
import asyncio
import argparse
import math
import os
import time
import signal
import sys
import numpy as np
from dotenv import load_dotenv
load_dotenv()


def parse_args():
    p = argparse.ArgumentParser(description="OrbityxAI Live/Paper Trading")
    p.add_argument("--mode", choices=["paper", "live"], default="paper",
                   help="Trading mode (default: paper)")
    p.add_argument("--exchange", choices=["binance", "bybit", "mexc"],
                   default="binance")
    p.add_argument("--key", type=str, default=os.getenv("EXCHANGE_KEY", ""),
                   help="API key (or set EXCHANGE_KEY env)")
    p.add_argument("--secret", type=str, default=os.getenv("EXCHANGE_SECRET", ""),
                   help="API secret (or set EXCHANGE_SECRET env)")
    p.add_argument("--testnet", action="store_true",
                   help="Use exchange testnet")
    p.add_argument("--capital", type=float, default=0,
                   help="Starting capital (0 = auto-detect from exchange balance)")
    p.add_argument("--risk", type=float, default=0.01,
                   help="Risk per trade (default: 1%%)")
    p.add_argument("--max-positions", type=int, default=0,
                   help="Max simultaneous positions (0 = unlimited)")
    p.add_argument("--max-pairs", type=int, default=0,
                   help="Max pairs to scan (0 = ALL safe pairs)")
    p.add_argument("--tf", type=str, default="4h")
    p.add_argument("--leverage", type=int, default=5)
    p.add_argument("--min-rr", type=float, default=1.2)
    p.add_argument("--min-conf", type=int, default=2)
    p.add_argument("--interval", type=int, default=14400,
                   help="Scan interval in seconds (default: 14400 = 4h)")
    p.add_argument("--tg-token", type=str,
                   default=os.getenv("TELEGRAM_TOKEN", ""))
    p.add_argument("--tg-chat", type=str,
                   default=os.getenv("TELEGRAM_CHAT_ID", ""))
    p.add_argument("--scan-only", action="store_true",
                   help="Just scan pairs and exit")
    p.add_argument("--load", type=str, default=None,
                   help="Load trained ML model (e.g. model_1h.pkl)")
    p.add_argument("--min-ml-conf", type=float, default=0.10,
                   help="Min ML confidence to trade (default: 0.10)")
    p.add_argument("--max-atr-pct", type=float, default=5.0,
                   help="Max ATR%% to trade a pair (default: 5.0, skip volatile junk)")
    p.add_argument("--strategy", choices=["checklist", "ml", "setup"],
                   default="checklist",
                   help="Trading strategy (default: checklist)")
    return p.parse_args()


def main():
    args = parse_args()

    strategy = args.strategy
    ml_mode = strategy == "ml" and args.load is not None
    model_name = args.load or "none"

    strategy_names = {
        "checklist": "CHECKLIST (уровни + пробой/ретест)",
        "ml": f"ML MODEL ({model_name})",
        "setup": "Setup-based (уровни + индикаторы)",
    }

    print(f"\n{'='*60}")
    print(f"  OrbityxAI v7.2 — {'LIVE' if args.mode == 'live' else 'PAPER'} Trading")
    print(f"  Exchange: {args.exchange.upper()}"
          f"{'  (TESTNET)' if args.testnet else ''}")
    print(f"  Strategy: {strategy_names.get(strategy, strategy)}")
    print(f"  Capital: {'auto-detect' if args.capital <= 0 else f'${args.capital:,.0f}'} | Risk: {args.risk:.0%}/trade")
    print(f"  Pairs: {'ALL' if args.max_pairs == 0 else f'top {args.max_pairs}'} | TF: {args.tf}")
    print(f"  Leverage: {args.leverage}x | Max positions: {args.max_positions}")
    print(f"{'='*60}\n")

    if args.mode == "live" and not args.key:
        print("ERROR: Live mode requires --key and --secret (or EXCHANGE_KEY env)")
        sys.exit(1)

    # Load ML model if specified
    ml_predictor = None
    if ml_mode:
        try:
            from max_predictor import MaxAccuracyPredictor
            print(f"  Loading ML model: {args.load}...")
            ml_predictor = MaxAccuracyPredictor.load(args.load)
            print(f"  ML model loaded successfully!")
        except Exception as e:
            print(f"  ERROR loading model: {e}")
            print(f"  Falling back to setup-based strategy")
            ml_mode = False

    # Initialize exchange connector
    from trading.exchange import ExchangeConnector
    connector = ExchangeConnector(
        exchange_id=args.exchange,
        api_key=args.key,
        secret=args.secret,
        testnet=args.testnet,
        futures=True,
    )

    # Auto-detect capital from exchange balance
    capital = args.capital
    if capital <= 0:
        try:
            bal = connector.fetch_balance()
            capital = float(bal.get("USDT", {}).get("total", 0) or 0)
            print(f"  Auto-detected capital: ${capital:,.2f}")
        except Exception:
            capital = 1000
            print(f"  Could not fetch balance, using default: ${capital:,.0f}")

    # Initialize Telegram bot
    tg = None
    tg_token = args.tg_token or os.getenv("TELEGRAM_TOKEN", "")
    tg_chat = args.tg_chat or os.getenv("TELEGRAM_CHAT_IDS", "") or os.getenv("TELEGRAM_CHAT_ID", "")
    if tg_token:
        from bot.telegram_bot import TelegramBot
        tg = TelegramBot(tg_token, tg_chat)
        if tg.enabled:
            strategy_str = f"ML ({model_name})" if ml_mode else "CHECKLIST"
            tg.send(f"🚀 <b>OrbityxAI запущен</b>\n"
                    f"Режим: <b>{args.mode.upper()}</b>\n"
                    f"Биржа: <b>{args.exchange.upper()}</b>\n"
                    f"Стратегия: <b>{strategy_str}</b>\n"
                    f"Капитал: <b>${capital:,.2f}</b>\n"
                    f"Плечо: <b>{args.leverage}x</b>\n"
                    f"Риск: <b>{args.risk:.0%}</b>/сделка")
            tg.start_polling()
            print("  Telegram connected (polling commands)")

    # Scan pairs
    print("\n  Scanning pairs...")
    from trading.pair_scanner import scan_pairs
    pairs = scan_pairs(connector, args.tf, max_pairs=args.max_pairs)
    pair_symbols = [p.symbol for p in pairs]

    if not pair_symbols:
        print("  ERROR: No pairs found!")
        sys.exit(1)

    print(f"\n  Selected {len(pair_symbols)} pairs for trading")

    if args.scan_only:
        return

    # Initialize trading engine (used for both modes)
    from trading.live_engine import LiveEngine
    engine = LiveEngine(
        connector=connector,
        mode=args.mode,
        capital=capital,
        risk_per_trade=args.risk,
        max_positions=args.max_positions,
        min_rr=args.min_rr,
        min_confirmations=args.min_conf,
        max_holding_bars=15,
        timeframe=args.tf,
        leverage=args.leverage,
        telegram_bot=tg,
    )

    # Graceful shutdown
    running = True

    def _stop(_sig, _frame):
        nonlocal running
        print("\n\nShutting down...")
        running = False

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    # Auto interval
    interval = args.interval
    if strategy == "checklist" and interval == 14400:
        interval = 300  # 5 минут для чек-листа (M5 свечи)
        print(f"  Auto interval for checklist: {interval}s (5 min)")
    elif ml_mode and interval == 14400:
        tf_seconds = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800,
                      "1h": 3600, "4h": 14400}
        interval = tf_seconds.get(args.tf, 3600)
        print(f"  Auto interval from TF: {interval}s")

    # Main loop
    print(f"\n  Starting trading loop (interval: {interval}s)")
    print(f"  Strategy: {strategy_names.get(strategy, strategy)}")
    print(f"  Press Ctrl+C to stop\n")

    while running:
        try:
            if strategy == "checklist":
                # ── Checklist mode (уровни + пробой/ретест) ───
                _run_checklist_scan(engine, connector, pair_symbols,
                                   args, capital, tg)
            elif ml_mode:
                # ── ML-enhanced mode ────────────────────────────
                _run_ml_scan(engine, ml_predictor, connector, pair_symbols,
                             args, capital, tg)
            else:
                # ── Original setup-only mode ────────────────────
                setups = engine.run_once(pair_symbols)
                if setups:
                    for s in setups:
                        print(f"  -> SETUP: {s.direction} "
                              f"conf={s.confidence:.2f} "
                              f"R:R={s.risk_reward:.1f}")

            # Print stats periodically
            if engine.scan_count % 6 == 0:
                stats = engine.stats()
                print(f"\n  --- Stats ---")
                for k, v in stats.items():
                    print(f"  {k}: {v}")
                if tg and tg.enabled:
                    tg.send_daily_report(stats)

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"  ERROR: {e}")
            if tg and tg.enabled:
                tg.send(f"⚠️ ОШИБКА: {e}")
            time.sleep(60)
            continue

        # Wait for next candle
        if running:
            print(f"\n  Next scan in {interval}s...")
            for _ in range(interval):
                if not running:
                    break
                time.sleep(1)

    # Final report
    print(f"\n{'='*60}")
    print(f"  FINAL REPORT")
    print(f"{'='*60}")
    stats = engine.stats()
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print(f"{'='*60}\n")


def _run_checklist_scan(engine, connector, pair_symbols, args, capital, tg):
    """Run one checklist-based scan cycle (levels + breakout/retest)."""
    from datetime import datetime, timezone
    from levels.detector import detect_levels
    from levels.multi_tf import detect_htf_levels, boost_levels_with_confluence
    from strategy.checklist import evaluate_checklist, format_checklist_telegram
    from setups.sizing import compute_position_value

    engine.scan_count += 1
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    print(f"\n{'─'*60}")
    print(f"  Checklist Scan #{engine.scan_count} | {now} | Поз: {len(engine.positions)}")

    engine._manage_positions()

    signals_found = 0
    scanned = 0

    for sym in pair_symbols:
        if sym in engine.positions:
            continue
        if engine.max_positions > 0 and len(engine.positions) >= engine.max_positions:
            break

        try:
            # Fetch 3 timeframes
            ts_m5, o_m5, h_m5, l_m5, c_m5, v_m5 = connector.fetch_ohlcv(sym, "5m", limit=500)
            if len(c_m5) < 100:
                continue

            ts_h1, o_h1, h_h1, l_h1, c_h1, v_h1 = connector.fetch_ohlcv(sym, "1h", limit=500)
            if len(c_h1) < 200:
                continue

            ts_d1, o_d1, h_d1, l_d1, c_d1, v_d1 = connector.fetch_ohlcv(sym, "1d", limit=200)
            if len(c_d1) < 30:
                continue

            scanned += 1

            # ATR filter
            from indicators.technical import atr as calc_atr
            atr_arr = calc_atr(np.array(h_h1), np.array(l_h1), np.array(c_h1), 14)
            atr_pct = float(atr_arr[-1]) / (float(c_h1[-1]) + 1e-9) * 100
            if atr_pct > getattr(args, 'max_atr_pct', 5.0):
                continue

            # Detect levels on H1 and D1
            h1_arr = np.array(h_h1, dtype=float)
            l1_arr = np.array(l_h1, dtype=float)
            c1_arr = np.array(c_h1, dtype=float)
            v1_arr = np.array(v_h1, dtype=float)
            atr_h1 = calc_atr(h1_arr, l1_arr, c1_arr, 14)
            levels_h1 = detect_levels(h1_arr, l1_arr, c1_arr, v1_arr, atr_h1, swing_window=10)

            hd_arr = np.array(h_d1, dtype=float)
            ld_arr = np.array(l_d1, dtype=float)
            cd_arr = np.array(c_d1, dtype=float)
            vd_arr = np.array(v_d1, dtype=float)
            atr_d1 = calc_atr(hd_arr, ld_arr, cd_arr, 14)
            levels_d1 = detect_levels(hd_arr, ld_arr, cd_arr, vd_arr, atr_d1, swing_window=5)

            # Evaluate checklist
            result = evaluate_checklist(
                symbol=sym,
                h_m5=np.array(h_m5), l_m5=np.array(l_m5), c_m5=np.array(c_m5),
                v_m5=np.array(v_m5), o_m5=np.array(o_m5),
                h_h1=h1_arr, l_h1=l1_arr, c_h1=c1_arr, v_h1=v1_arr, o_h1=np.array(o_h1),
                h_d1=hd_arr, l_d1=ld_arr, c_d1=cd_arr, v_d1=vd_arr,
                levels_h1=levels_h1, levels_d1=levels_d1,
                min_rr=args.min_rr if args.min_rr >= 2.0 else 3.0,
            )

            if result is None:
                continue

            signals_found += 1
            emoji = "🟢" if result.direction == "LONG" else "🔴"

            # Console log
            print(f"\n  {emoji} CHECKLIST {result.direction} {sym} [{result.signal_type}]")
            print(f"    Level: {result.level_tf} ${result.level_price:,.4f} (str={result.level_strength:.1f})")
            print(f"    Entry: ${result.entry_price:,.4f} | SL: ${result.stop_loss:,.4f} ({result.sl_pct:.2f}%) [{result.sl_type}]")
            print(f"    TP: ${result.take_profit:,.4f} ({result.tp_pct:.2f}%) | R:R = {result.risk_reward:.1f}")
            print(f"    Signal: {result.signal_details}")
            print(f"    Filters: {result.filter_details}")

            # Telegram
            if tg and tg.enabled:
                tg.send(format_checklist_telegram(result))

            time.sleep(0.5)

        except Exception as e:
            if signals_found > 0:
                print(f"    ERROR processing {sym}: {e}")
            continue

        # Execute trade — outside try/except so errors are visible
        try:
            _execute_checklist_trade(engine, result, capital, args)
        except Exception as e:
            import traceback
            print(f"  EXEC ERROR {sym}: {e}")
            traceback.print_exc()

    print(f"  Скан: {scanned} пар | Сигналов: {signals_found}")

    # ── Баланс и позиции после каждого скана ──
    _print_portfolio(engine, connector, capital)


def _print_portfolio(engine, connector, capital):
    """Вывести баланс и открытые позиции с PnL."""
    positions = engine.positions
    if not positions:
        print(f"\n  💰 Капитал: ${capital:,.2f} | Позиций: 0")
        return

    total_pnl = 0.0
    print(f"\n  📊 Открытые позиции ({len(positions)}):")

    for sym, pos in positions.items():
        try:
            ticker = connector.fetch_ticker(sym)
            current_price = float(ticker.get("last", pos.entry_price))
        except Exception:
            current_price = pos.entry_price

        if pos.direction == "LONG":
            pnl_pct = (current_price - pos.entry_price) / (pos.entry_price + 1e-9) * 100
        else:
            pnl_pct = (pos.entry_price - current_price) / (pos.entry_price + 1e-9) * 100

        pnl_usd = pos.amount * abs(current_price - pos.entry_price)
        if pnl_pct < 0:
            pnl_usd = -pnl_usd
        total_pnl += pnl_usd

        emoji = "✅" if pnl_pct > 0 else "❌"
        d = "L" if pos.direction == "LONG" else "S"
        sl_dist = abs(current_price - pos.stop_loss) / (current_price + 1e-9) * 100
        tp_dist = abs(pos.take_profit - current_price) / (current_price + 1e-9) * 100

        print(f"    {emoji} {sym} {d} @ ${pos.entry_price:,.4f} → ${current_price:,.4f} "
              f"| PnL: {pnl_pct:+.2f}% (${pnl_usd:+.2f}) "
              f"| SL: {sl_dist:.1f}% away | TP: {tp_dist:.1f}% away")

    sign = "+" if total_pnl >= 0 else ""
    print(f"  💰 Капитал: ${capital:,.2f} | Unrealized PnL: {sign}${total_pnl:.2f}")


def _tick_to_decimals(prec) -> int:
    """Convert tick size (e.g. 0.0001 → 4) or integer decimals (e.g. 4 → 4) to decimal places."""
    try:
        prec = float(prec)
        if prec <= 0:
            return 4
        if prec >= 1:
            return 0
        return max(0, -int(math.floor(math.log10(prec))))
    except Exception:
        return 4


def _execute_checklist_trade(engine, result, capital, args):
    """Execute a trade based on checklist result."""
    from setups.sizing import compute_position_value
    sym = result.symbol

    if sym in engine.positions:
        print(f"    SKIP trade {sym}: already in position")
        return
    if engine.max_positions > 0 and len(engine.positions) >= engine.max_positions:
        print(f"    SKIP trade {sym}: max positions reached")
        return

    pos_val = compute_position_value(
        capital, args.risk, result.entry_price, result.stop_loss)
    print(f"    Sizing: pos_val=${pos_val:.2f}, risk={args.risk:.1%}, capital=${capital:.2f}")
    if pos_val < 5:
        print(f"    SKIP trade {sym}: pos_val ${pos_val:.2f} < $5")
        return

    try:
        price_prec, amount_prec = engine.connector.get_precision(sym)
        price_prec = _tick_to_decimals(price_prec)
        amount_prec = _tick_to_decimals(amount_prec)
        min_amount = engine.connector.get_min_amount(sym)
    except Exception as e:
        print(f"    SKIP trade {sym}: precision error: {e}")
        # Fallback для paper mode
        price_prec, amount_prec = 4, 2
        min_amount = 0.01

    amount = round(pos_val / result.entry_price, amount_prec)
    if amount < min_amount:
        print(f"    SKIP trade {sym}: amount {amount} < min_amount {min_amount} (pos_val=${pos_val:.2f}, price=${result.entry_price:.4f}, prec={amount_prec})")
        return

    side = "buy" if result.direction == "LONG" else "sell"
    d = "ЛОНГ" if result.direction == "LONG" else "ШОРТ"

    if engine.mode == "paper":
        from trading.live_engine import Position
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        engine.positions[sym] = Position(
            symbol=sym, direction=result.direction,
            entry_price=result.entry_price, amount=amount,
            stop_loss=result.stop_loss, take_profit=result.take_profit,
            entry_time=now, setup_confidence=1.0,
            entry_scan=engine.scan_count,
        )
        print(f"\n  NEW TRADE [PAPER] {d} {sym}")
        print(f"  Entry: ${result.entry_price:,.4f} | Size: ${pos_val:.2f}")
    else:
        try:
            engine.connector.set_leverage(sym, args.leverage)
            entry_order = engine.connector.place_market_order(sym, side, amount)
            sl_order = engine.connector.place_stop_loss(
                sym, side, amount, round(result.stop_loss, price_prec))
            tp_order = engine.connector.place_take_profit(
                sym, side, amount, round(result.take_profit, price_prec))

            from trading.live_engine import Position
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            engine.positions[sym] = Position(
                symbol=sym, direction=result.direction,
                entry_price=entry_order.price or result.entry_price,
                amount=amount,
                stop_loss=result.stop_loss, take_profit=result.take_profit,
                entry_time=now, setup_confidence=1.0,
                entry_scan=engine.scan_count,
            )
            print(f"\n  NEW TRADE [LIVE] {d} {sym} @ ${result.entry_price:,.4f} | ${pos_val:.2f}")

        except Exception as e:
            print(f"  ORDER ERROR {sym}: {e}")


def _run_ml_scan(engine, ml_predictor, connector, pair_symbols, args, capital, tg):
    """Run one ML-enhanced scan cycle with detailed logging."""
    from datetime import datetime, timezone

    engine.scan_count += 1
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    print(f"\n{'─'*60}")
    print(f"  ML Scan #{engine.scan_count} | {now} | Поз: {len(engine.positions)}")

    # Check existing positions
    engine._manage_positions()

    # Scan pairs with ML model
    signals_found = 0
    skipped_neutral = 0
    skipped_conf = 0
    skipped_rr = 0
    skipped_atr = 0
    skipped_sl_wide = 0
    scanned = 0
    max_atr_pct = getattr(args, 'max_atr_pct', 5.0)
    max_sl_pct = 5.0   # never trade with SL > 5%
    max_tp_pct = 15.0   # cap TP at 15% (realistic for 1h)

    for sym in pair_symbols:
        if sym in engine.positions:
            continue
        if engine.max_positions > 0 and len(engine.positions) >= engine.max_positions:
            break

        try:
            # Fetch OHLCV data
            ts, o, h, l, c, v = connector.fetch_ohlcv(sym, args.tf, limit=2000)
            if len(c) < 200:
                continue

            scanned += 1

            # Filter: skip hyper-volatile pairs by ATR%
            from indicators.technical import atr as calc_atr
            atr_arr = calc_atr(np.array(h), np.array(l), np.array(c), 14)
            atr_pct = float(atr_arr[-1]) / (float(c[-1]) + 1e-9) * 100
            if atr_pct > max_atr_pct:
                skipped_atr += 1
                continue

            # Get ML signal
            sig = ml_predictor.predictor.analyze(
                sym, args.tf,
                list(o), list(h), list(l), list(c), list(v),
                auto_train=False,
            )

            # --- Detailed skip logging ---
            if sig.direction == "NEUTRAL":
                skipped_neutral += 1
                continue

            # Show what the trade WOULD look like for all non-neutral signals
            emoji_skip = "🟢" if sig.direction == "LONG" else "🔴"
            risk_pct_skip = abs(sig.current_price - sig.stop_loss) / (sig.current_price + 1e-9) * 100
            tp_pct_skip = abs(sig.take_profit_1 - sig.current_price) / (sig.current_price + 1e-9) * 100

            # Filter: SL too wide
            if risk_pct_skip > max_sl_pct:
                skipped_sl_wide += 1
                print(f"  {emoji_skip} SKIP {sym} {sig.direction} | SL too wide: {risk_pct_skip:.1f}% > {max_sl_pct}%"
                      f" | conf={sig.confidence:.1%} | ATR={atr_pct:.1f}%")
                continue

            # Cap TP at max_tp_pct (don't skip, just limit)
            if tp_pct_skip > max_tp_pct:
                if sig.direction == "LONG":
                    sig.take_profit_1 = sig.current_price * (1 + max_tp_pct / 100)
                else:
                    sig.take_profit_1 = sig.current_price * (1 - max_tp_pct / 100)
                tp_pct_skip = max_tp_pct
                # Recalc R:R
                risk_d = abs(sig.current_price - sig.stop_loss)
                reward_d = abs(sig.take_profit_1 - sig.current_price)
                sig.risk_reward = round(reward_d / risk_d, 2) if risk_d > 0 else 0

            if sig.confidence < args.min_ml_conf:
                skipped_conf += 1
                print(f"  {emoji_skip} SKIP {sym} {sig.direction} | conf={sig.confidence:.1%} < {args.min_ml_conf:.0%}"
                      f" | P(up)={sig.prob_up:.1%} | {sig.regime}"
                      f" | RSI={sig.rsi:.0f} ADX={sig.adx:.0f}"
                      f" | Вход=${sig.current_price:,.4f}"
                      f" SL=${sig.stop_loss:,.4f}({risk_pct_skip:.1f}%)"
                      f" TP=${sig.take_profit_1:,.4f}({tp_pct_skip:.1f}%)"
                      f" R:R={sig.risk_reward:.1f}")
                continue

            if sig.risk_reward < args.min_rr:
                skipped_rr += 1
                print(f"  {emoji_skip} SKIP {sym} {sig.direction} | R:R={sig.risk_reward:.1f} < {args.min_rr}"
                      f" | conf={sig.confidence:.1%} P(up)={sig.prob_up:.1%}"
                      f" | {sig.regime}"
                      f" | RSI={sig.rsi:.0f} ADX={sig.adx:.0f}"
                      f" | Вход=${sig.current_price:,.4f}"
                      f" SL=${sig.stop_loss:,.4f}({risk_pct_skip:.1f}%)"
                      f" TP=${sig.take_profit_1:,.4f}({tp_pct_skip:.1f}%)")
                continue

            # --- Signal passed all filters ---
            signals_found += 1
            emoji = "🟢" if sig.direction == "LONG" else "🔴"
            risk_pct = abs(sig.current_price - sig.stop_loss) / (sig.current_price + 1e-9) * 100
            tp_pct = abs(sig.take_profit_1 - sig.current_price) / (sig.current_price + 1e-9) * 100

            # Build reason string
            reasons = []
            if sig.prob_up > 0.55:
                reasons.append(f"P(up)={sig.prob_up:.0%} > 55%")
            elif sig.prob_up < 0.45:
                reasons.append(f"P(up)={sig.prob_up:.0%} < 45%")
            if sig.rsi < 30:
                reasons.append("RSI перепродан")
            elif sig.rsi > 70:
                reasons.append("RSI перекуплен")
            else:
                reasons.append(f"RSI={sig.rsi:.0f}")
            if sig.adx > 25:
                reasons.append(f"сильный тренд (ADX={sig.adx:.0f})")
            else:
                reasons.append(f"слабый тренд (ADX={sig.adx:.0f})")
            reason_str = ", ".join(reasons)

            # Console log
            msg_console = (
                f"\n  {emoji} SIGNAL {sig.direction} {sym}\n"
                f"    Conf: {sig.confidence:.1%} | P(up): {sig.prob_up:.1%}\n"
                f"    Режим: {sig.regime} | RSI: {sig.rsi:.0f} | ADX: {sig.adx:.0f}\n"
                f"    Вход: ${sig.current_price:,.4f} | SL: ${sig.stop_loss:,.4f} ({risk_pct:.2f}%)"
                f" | TP: ${sig.take_profit_1:,.4f} ({tp_pct:.2f}%)\n"
                f"    R:R = {sig.risk_reward:.1f} | Причина: {reason_str}")
            print(msg_console)

            # Telegram message (detailed)
            d = "ЛОНГ" if sig.direction == "LONG" else "ШОРТ"
            msg_tg = (
                f"{emoji} ML {d} {sym} [{args.tf}]\n"
                f"{'━'*28}\n"
                f"▸ Уверенность: {sig.confidence:.1%}\n"
                f"▸ P(рост): {sig.prob_up:.1%}\n"
                f"▸ Режим: {sig.regime}\n"
                f"▸ RSI: {sig.rsi:.0f} | ADX: {sig.adx:.0f}\n"
                f"{'━'*28}\n"
                f"▸ Вход: ${sig.current_price:,.4f}\n"
                f"▸ Стоп: ${sig.stop_loss:,.4f} ({risk_pct:.2f}%)\n"
                f"▸ Цель: ${sig.take_profit_1:,.4f} ({tp_pct:.2f}%)\n"
                f"▸ R:R = {sig.risk_reward:.1f}\n"
                f"{'━'*28}\n"
                f"Причина: {reason_str}")

            if tg and tg.enabled:
                tg.send(msg_tg)

            # Execute trade through engine
            engine._execute_ml_signal(sym, sig, capital, args)

            time.sleep(0.3)  # rate limit

        except Exception:
            continue

    # --- Scan summary ---
    summary = (f"  Скан: {scanned} пар | "
               f"Сигналов: {signals_found} | "
               f"NEUTRAL: {skipped_neutral} | "
               f"High ATR: {skipped_atr} | "
               f"Wide SL: {skipped_sl_wide} | "
               f"Low conf: {skipped_conf} | "
               f"Low R:R: {skipped_rr}")
    print(summary)


def _patch_engine_for_ml(engine_cls):
    """Add ML signal execution to LiveEngine if not present."""
    if hasattr(engine_cls, '_execute_ml_signal'):
        return

    def _execute_ml_signal(self, sym, sig, capital, args):
        """Execute a trade based on ML signal."""
        from setups.sizing import compute_position_value

        if sym in self.positions:
            return
        if self.max_positions > 0 and len(self.positions) >= self.max_positions:
            return

        risk_frac = args.risk
        pos_val = compute_position_value(
            capital, risk_frac, sig.current_price, sig.stop_loss)

        if pos_val < 5:
            return

        price_prec, amount_prec = self.connector.get_precision(sym)
        min_amount = self.connector.get_min_amount(sym)
        amount = round(pos_val / sig.current_price, amount_prec)

        if amount < min_amount:
            return

        side = "buy" if sig.direction == "LONG" else "sell"

        if self.mode == "paper":
            # Paper trade
            from trading.live_engine import Position
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            self.positions[sym] = Position(
                symbol=sym, direction=sig.direction,
                entry_price=sig.current_price, amount=amount,
                stop_loss=sig.stop_loss, take_profit=sig.take_profit_1,
                entry_time=now, setup_confidence=sig.confidence,
                entry_scan=self.scan_count,
            )
            d = "ЛОНГ" if sig.direction == "LONG" else "ШОРТ"
            risk_d = abs(sig.current_price - sig.stop_loss) / (sig.current_price + 1e-9) * 100
            print(f"\n  NEW TRADE [PAPER]")
            print(f"  {sym} {d} @ ${sig.current_price:,.4f}")
            print(f"  SL: ${sig.stop_loss:,.4f} | TP: ${sig.take_profit_1:,.4f}")
            print(f"  R:R: {sig.risk_reward:.1f} | Conf: {sig.confidence:.1%}")
            print(f"  Size: ${pos_val:.2f} ({risk_d:.1f}% risk)")
        else:
            # Live trade — place real orders
            try:
                self.connector.set_leverage(sym, args.leverage)
                entry_order = self.connector.place_market_order(sym, side, amount)
                entry_price = entry_order.price or sig.current_price

                sl_order = self.connector.place_stop_loss(
                    sym, side, amount, round(sig.stop_loss, price_prec))
                tp_order = self.connector.place_take_profit(
                    sym, side, amount, round(sig.take_profit_1, price_prec))

                from trading.live_engine import Position
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                self.positions[sym] = Position(
                    symbol=sym, direction=sig.direction,
                    entry_price=entry_price, amount=amount,
                    stop_loss=sig.stop_loss, take_profit=sig.take_profit_1,
                    entry_time=now, setup_confidence=sig.confidence,
                    entry_scan=self.scan_count,
                )

                d = "ЛОНГ" if sig.direction == "LONG" else "ШОРТ"
                emoji = "🟢" if sig.direction == "LONG" else "🔴"
                risk_d = abs(entry_price - sig.stop_loss) / (entry_price + 1e-9) * 100
                msg = (f"\n{emoji} НОВАЯ СДЕЛКА [{self.mode.upper()}]\n"
                       f"{sym} {d} @ ${entry_price:,.4f}\n"
                       f"Стоп: ${sig.stop_loss:,.4f} | Цель: ${sig.take_profit_1:,.4f}\n"
                       f"R:R: {sig.risk_reward:.1f} | Увер.: {sig.confidence:.1%}\n"
                       f"Размер: ${pos_val:.2f} ({risk_d:.1f}% риск)\n"
                       f"Режим: {self.mode.upper()}")
                print(f"  {msg}")
                if self.tg and self.tg.enabled:
                    self.tg.send(msg)

            except Exception as e:
                print(f"  ORDER ERROR {sym}: {e}")
                if self.tg and self.tg.enabled:
                    self.tg.send(f"⚠️ ОШИБКА ордера {sym}: {e}")

    engine_cls._execute_ml_signal = _execute_ml_signal


# Patch LiveEngine with ML support on import
from trading.live_engine import LiveEngine as _LE
_patch_engine_for_ml(_LE)


if __name__ == "__main__":
    main()
