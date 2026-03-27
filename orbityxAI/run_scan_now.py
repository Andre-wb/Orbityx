"""
OrbityxAI v7.1 — Scan All Pairs NOW
=====================================
One-shot scan: finds all current setups across all safe pairs.
No trading, no loop — just shows signals right now.

Usage:
  python run_scan_now.py
  python run_scan_now.py --exchange bybit --max-pairs 50
"""
import numpy as np
import time
import argparse
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()


def parse_args():
    p = argparse.ArgumentParser(description="Scan all pairs for setups NOW")
    p.add_argument("--exchange", choices=["binance", "bybit", "mexc"],
                   default="binance")
    p.add_argument("--max-pairs", type=int, default=0,
                   help="0 = ALL safe pairs")
    p.add_argument("--tf", type=str, default="1h")
    p.add_argument("--min-rr", type=float, default=2.5)
    p.add_argument("--min-conf", type=int, default=2)
    p.add_argument("--min-volume", type=float, default=5_000_000,
                   help="Min 24h volume USD (default $5M)")
    p.add_argument("--tg", action="store_true",
                   help="Send signals to Telegram (uses .env)")
    p.add_argument("--lang", choices=["en", "ru"], default="ru",
                   help="Language for Telegram alerts (default: ru)")
    p.add_argument("--loop", action="store_true",
                   help="Run continuously (scan every --interval seconds)")
    p.add_argument("--interval", type=int, default=900,
                   help="Seconds between scans in loop mode (default 900=15min)")
    return p.parse_args()


def main():
    args = parse_args()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    print(f"\n{'='*70}")
    print(f"  OrbityxAI v7.1 — Live Scan | {now}")
    print(f"  Exchange: {args.exchange.upper()} | TF: {args.tf}")
    print(f"  Min R:R: {args.min_rr} | Min confirms: {args.min_conf}")
    print(f"{'='*70}\n")

    # Connect
    from trading.exchange import ExchangeConnector
    conn = ExchangeConnector(args.exchange, futures=True)

    # Scan pairs
    print("  Scanning pairs...")
    from trading.pair_scanner import scan_pairs
    pairs = scan_pairs(conn, args.tf,
                       min_volume_usd=args.min_volume,
                       min_bars=500,
                       max_pairs=args.max_pairs,
                       verbose=False)
    print(f"  Found {len(pairs)} safe pairs\n")

    if not pairs:
        print("  No pairs found!")
        return

    # Import setup detection
    from indicators.technical import atr, rsi
    from levels.detector import detect_levels
    from levels.multi_tf import detect_htf_levels, boost_levels_with_confluence
    from levels.volume_profile import volume_profile_levels
    from setups.detector import detect_setups

    signals = []
    scanned = 0

    for pi, pair in enumerate(pairs):
        sym = pair.symbol
        try:
            ts, o, h, l, c, v = conn.fetch_ohlcv(sym, args.tf, limit=2000)
            n = len(c)
            if n < 200:
                continue

            atr_v = atr(h, l, c)
            rsi_v = rsi(c, 14)

            # Levels
            levels = detect_levels(h, l, c, v, atr_v, swing_window=10)
            try:
                htf = detect_htf_levels(o, h, l, c, v, atr_v, factor=4)
                levels = boost_levels_with_confluence(
                    levels, htf, float(np.nanmean(atr_v)))
            except Exception:
                pass
            try:
                vp = volume_profile_levels(h, l, c, v, lookback=500)
                levels.extend(vp)
                levels.sort(key=lambda lv: lv.strength, reverse=True)
            except Exception:
                pass

            # Funding
            fr = conn.fetch_funding_rate(sym)
            fr_arr = np.full(n, fr or 0.0)

            # Detect setups on last 5 bars
            setups = detect_setups(
                o, h, l, c, v, atr_v, rsi_v, levels,
                level_tolerance_atr=0.8,
                min_rr=args.min_rr,
                min_confirmations=args.min_conf,
                funding_rate=fr_arr,
                trend_filter=True,
                sma_period=100,
            )

            # Only setups on last 3 bars (current)
            recent = [s for s in setups if s.bar_idx >= n - 3]
            if recent:
                best = max(recent, key=lambda s: s.confidence)
                best.symbol = sym
                signals.append((pair, best))

        except Exception:
            pass

        scanned += 1
        if scanned % 30 == 0:
            print(f"  Scanned {scanned}/{len(pairs)}... "
                  f"found {len(signals)} signals", end="\r")

    print(f"  Scanned {scanned}/{len(pairs)} pairs" + " " * 30)

    # Display results
    if not signals:
        print(f"\n  No setups found right now. Market is quiet.")
        print(f"  Try again at next candle close or use --min-conf 1")
        return

    # Sort by R:R
    signals.sort(key=lambda x: x[1].risk_reward, reverse=True)

    print(f"\n{'='*70}")
    print(f"  FOUND {len(signals)} SETUPS")
    print(f"{'='*70}\n")

    for i, (pair, s) in enumerate(signals, 1):
        emoji = "🟢 LONG " if s.direction == "LONG" else "🔴 SHORT"
        risk_pct = abs(s.entry_price - s.stop_loss) / (s.entry_price + 1e-9) * 100
        tp_pct = abs(s.take_profit - s.entry_price) / (s.entry_price + 1e-9) * 100

        print(f"  {i:2d}. {emoji}  {pair.symbol}")
        print(f"      Entry:  ${s.entry_price:>12,.4f}")
        print(f"      Stop:   ${s.stop_loss:>12,.4f}  (-{risk_pct:.2f}%)")
        print(f"      TP:     ${s.take_profit:>12,.4f}  (+{tp_pct:.2f}%)")
        print(f"      R:R = {s.risk_reward:.1f}  |  "
              f"Confirms: {s.n_confirmations}  |  "
              f"Vol: ${pair.volume_24h / 1e6:.0f}M")
        print()

    # Summary table
    print(f"{'='*70}")
    print(f"  {'#':>2}  {'Pair':<18} {'Dir':>5}  "
          f"{'Entry':>12}  {'Stop':>12}  {'TP':>12}  {'R:R':>4}  {'Cf':>2}")
    print(f"  {'─'*66}")
    for i, (pair, s) in enumerate(signals, 1):
        d = "LONG" if s.direction == "LONG" else "SHORT"
        print(f"  {i:>2}. {pair.symbol:<18} {d:>5}  "
              f"${s.entry_price:>11,.4f}  "
              f"${s.stop_loss:>11,.4f}  "
              f"${s.take_profit:>11,.4f}  "
              f"{s.risk_reward:>4.1f}  {s.n_confirmations:>2}")
    print(f"{'='*70}")

    longs = sum(1 for _, s in signals if s.direction == "LONG")
    shorts = sum(1 for _, s in signals if s.direction == "SHORT")
    print(f"\n  LONG: {longs}  |  SHORT: {shorts}  |  Total: {len(signals)}")

    # Send to Telegram
    if args.tg:
        from bot.telegram_bot import TelegramBot
        tg = TelegramBot()  # reads from .env
        tg.set_lang(args.lang)
        if tg.enabled:
            for pair, s in signals:
                tg.send_setup_alert(
                    symbol=pair.symbol,
                    direction=s.direction,
                    entry=s.entry_price,
                    stop=s.stop_loss,
                    tp=s.take_profit,
                    rr=s.risk_reward,
                    confirmations=s.n_confirmations,
                    confidence=s.confidence,
                    mode="SCAN",
                )
                time.sleep(0.5)  # rate limit
            print(f"  Sent {len(signals)} signals to Telegram")
        else:
            print("  Telegram not configured (check .env)")
    print()


if __name__ == "__main__":
    args = parse_args()
    if args.loop:
        import signal as _sig

        running = True
        def _stop(s, f):
            global running
            running = False
        _sig.signal(_sig.SIGINT, _stop)
        _sig.signal(_sig.SIGTERM, _stop)

        print(f"  Running in loop mode (every {args.interval}s). Ctrl+C to stop.\n")
        while running:
            try:
                main()
            except Exception as e:
                print(f"  Error: {e}")
            print(f"  Next scan in {args.interval // 60} min...\n")
            for _ in range(args.interval):
                if not running:
                    break
                time.sleep(1)
        print("\n  Stopped.")
    else:
        main()
