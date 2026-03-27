#!/usr/bin/env python3
"""
run.py — Orbityx Chart Pro × Binance test runner.

Usage
─────
  python run.py                 run all suites
  python run.py --suite 1 3 5   run suites 1, 3, and 5 only
  python run.py --symbols BTCUSDT ETHUSDT   override symbols from .env
  python run.py --timeframes 1m 1h 1d       override timeframes from .env
  python run.py --no-ws                     skip the WebSocket suite
  python run.py --fast                      fewer candles, less delay

Setup
─────
  pip install requests websockets python-dotenv
  cp .env.example .env          (fill in values if needed)
  python run.py
"""
from __future__ import annotations

import argparse
import sys
import time

# ── Import config first (loads .env) ─────────────────────────────────────────
from config import cfg

# ── Rest of imports ───────────────────────────────────────────────────────────
from binance_client import BinanceClient
from reporter import BOLD, CYAN, GREEN, RED, Suite, info, print_summary, section
import tests as T


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Orbityx × Binance test runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--suite", "-s",
        nargs="+",
        type=int,
        metavar="N",
        help="run only these suite numbers (1–7)",
    )
    p.add_argument(
        "--symbols",
        nargs="+",
        metavar="SYM",
        help="override TEST_SYMBOLS from .env",
    )
    p.add_argument(
        "--timeframes",
        nargs="+",
        metavar="TF",
        help="override TEST_TIMEFRAMES from .env",
    )
    p.add_argument(
        "--no-ws",
        action="store_true",
        help="skip the WebSocket suite (suite 7)",
    )
    p.add_argument(
        "--fast",
        action="store_true",
        help="limit=20 candles, delay=0s — quicker but less thorough",
    )
    return p.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()

    # Apply CLI overrides to cfg before anything else reads it.
    if args.symbols:
        cfg.test_symbols = args.symbols
    if args.timeframes:
        cfg.test_timeframes = args.timeframes
    if args.fast:
        cfg.candle_limit   = 20
        cfg.request_delay  = 0.0

    # ── Banner ────────────────────────────────────────────────────────────────
    print(BOLD(CYAN("\n╔══════════════════════════════════════════════════════╗")))
    print(BOLD(CYAN(  "║        Orbityx Chart Pro — Binance Test Suite        ║")))
    print(BOLD(CYAN(  "╚══════════════════════════════════════════════════════╝")))
    print()
    print(cfg.summary())

    # ── Build test schedule ───────────────────────────────────────────────────
    client = BinanceClient()

    ALL_SUITES = [
        (1, "Connectivity",        lambda: T.suite_connectivity(client)),
        (2, "Exchange Info",       lambda: T.suite_exchange_info(client)),
        (3, "Candle Fetching",     lambda: T.suite_candles(client)),
        (4, "Market Stats",        lambda: T.suite_market_stats(client)),
        (5, "Data Quality",        lambda: T.suite_data_quality(client)),
        (6, "Timeframe Mapping",   lambda: T.suite_timeframe_mapping(client)),
        (7, "WebSocket",           lambda: T.suite_websocket()),
    ]

    requested = set(args.suite) if args.suite else {n for n, *_ in ALL_SUITES}
    if args.no_ws:
        requested.discard(7)

    schedule = [(n, name, fn) for n, name, fn in ALL_SUITES if n in requested]

    if not schedule:
        print(RED("No suites selected. Use --suite 1 2 3 … to pick suites."))
        return 1

    info(f"Running {len(schedule)} of {len(ALL_SUITES)} suites: "
         + ", ".join(f"{n}" for n, *_ in schedule))

    # ── Run ───────────────────────────────────────────────────────────────────
    completed_suites: list[Suite] = []
    t_start = time.perf_counter()

    for _n, _name, fn in schedule:
        suite_result = fn()
        completed_suites.append(suite_result)

    elapsed = time.perf_counter() - t_start

    # ── Summary ───────────────────────────────────────────────────────────────
    all_passed = print_summary(completed_suites)
    print(f"\n  Completed in {elapsed:.2f}s\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())