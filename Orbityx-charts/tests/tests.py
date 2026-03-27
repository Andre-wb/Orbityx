"""
tests.py — all test suites for Orbityx × Binance.

Each suite returns a reporter.Suite with individual TestResult entries.
Suites are independent — a failure in one does not abort others.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any

import websockets

from binance_client import BinanceClient, Candle, TF_INTERVAL
from config import cfg
from reporter import Status, Suite, TestResult, info, section


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _run(name: str, fn, *args, **kwargs) -> TestResult:
    """Execute fn and capture pass / fail / timing."""
    t0 = time.perf_counter()
    try:
        result: TestResult = fn(*args, **kwargs)
        result.elapsed = time.perf_counter() - t0
        return result
    except Exception as exc:
        return TestResult(
            name    = name,
            status  = Status.FAIL,
            message = str(exc),
            elapsed = time.perf_counter() - t0,
        )


def _pause() -> None:
    time.sleep(cfg.request_delay)


# ─────────────────────────────────────────────────────────────────────────────
# Suite 1 — Connectivity
# ─────────────────────────────────────────────────────────────────────────────

def suite_connectivity(client: BinanceClient) -> Suite:
    section("1 · Connectivity")
    s = Suite("Connectivity")

    # 1.1 Ping
    def test_ping() -> TestResult:
        ok = client.ping()
        return TestResult(
            name    = "GET /ping",
            status  = Status.PASS if ok else Status.FAIL,
            message = "Binance is reachable" if ok else "No response",
        )

    s.add(_run("GET /ping", test_ping))
    _pause()

    # 1.2 Server time drift
    def test_server_time() -> TestResult:
        server_ms  = client.server_time()
        local_ms   = int(time.time() * 1000)
        drift_ms   = abs(server_ms - local_ms)
        server_dt  = datetime.fromtimestamp(server_ms / 1000, tz=timezone.utc)
        status     = Status.PASS if drift_ms < 5_000 else Status.WARN
        return TestResult(
            name    = "GET /time — clock drift",
            status  = status,
            message = f"drift = {drift_ms} ms",
            detail  = f"server={server_dt.isoformat()}",
        )

    s.add(_run("GET /time", test_server_time))
    _pause()

    # 1.3 Base URL sanity
    def test_base_url() -> TestResult:
        expected_prefix = "https://"
        ok = cfg.binance_base_url.startswith(expected_prefix)
        return TestResult(
            name    = "Base URL format",
            status  = Status.PASS if ok else Status.WARN,
            message = cfg.binance_base_url,
        )

    s.add(_run("Base URL format", test_base_url))

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 2 — Exchange Info (symbol validation)
# ─────────────────────────────────────────────────────────────────────────────

def suite_exchange_info(client: BinanceClient) -> Suite:
    section("2 · Exchange Info (symbol validation)")
    s = Suite("Exchange Info")

    for symbol in cfg.test_symbols:
        def test_symbol(sym: str = symbol) -> TestResult:
            data   = client.exchange_info(sym)
            syms   = data.get("symbols", [])
            entry  = next((x for x in syms if x["symbol"] == sym), None)

            if entry is None:
                return TestResult(name=f"{sym} exists", status=Status.FAIL,
                                  message="not found on exchange")

            status_str = entry.get("status", "UNKNOWN")
            trading    = status_str == "TRADING"
            base       = entry.get("baseAsset", "?")
            quote      = entry.get("quoteAsset", "?")

            return TestResult(
                name    = f"{sym} exists",
                status  = Status.PASS if trading else Status.WARN,
                message = f"{base}/{quote} — {status_str}",
                detail  = f"orderTypes={entry.get('orderTypes', [])}",
            )

        s.add(_run(f"{symbol} exists", test_symbol))
        _pause()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 3 — Candle fetching (mirrors fetchCandles() in binance.ts)
# ─────────────────────────────────────────────────────────────────────────────

def suite_candles(client: BinanceClient) -> Suite:
    section("3 · Candle fetching  (mirrors BinanceProvider.fetchCandles)")
    s = Suite("Candles")

    for symbol in cfg.test_symbols:
        for tf in cfg.test_timeframes:
            def test_candles(sym: str = symbol, timeframe: str = tf) -> TestResult:
                candles = client.fetch_candles(sym, timeframe, limit=cfg.candle_limit)
                n = len(candles)

                if n == 0:
                    return TestResult(name=f"{sym} {timeframe}", status=Status.FAIL,
                                      message="returned 0 candles")

                # Sorted ascending by timestamp?
                timestamps = [c.timestamp for c in candles]
                is_sorted  = timestamps == sorted(timestamps)

                # All timestamps are epoch ms (13 digits)?
                valid_ts = all(1_000_000_000_000 <= c.timestamp <= 9_999_999_999_999
                               for c in candles)

                # High ≥ max(open, close) and Low ≤ min(open, close)?
                ohlc_ok = all(
                    c.high >= max(c.open, c.close) and c.low <= min(c.open, c.close)
                    for c in candles
                )

                issues = []
                if not is_sorted:  issues.append("unsorted timestamps")
                if not valid_ts:   issues.append("invalid timestamp format")
                if not ohlc_ok:    issues.append("OHLC invariant violated")

                last = candles[-1]
                detail = (
                    f"count={n}  last: O={last.open} H={last.high} "
                    f"L={last.low} C={last.close} V={last.volume:.2f}"
                )

                return TestResult(
                    name    = f"{sym}  {timeframe}",
                    status  = Status.PASS if not issues else Status.FAIL,
                    message = f"{n} candles" + (f" — {', '.join(issues)}" if issues else ""),
                    detail  = detail,
                )

            s.add(_run(f"{symbol} {tf}", test_candles))
            _pause()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 4 — Market stats (mirrors fetchMarketStats() in binance.ts)
# ─────────────────────────────────────────────────────────────────────────────

def suite_market_stats(client: BinanceClient) -> Suite:
    section("4 · Market stats  (mirrors BinanceProvider.fetchMarketStats)")
    s = Suite("Market Stats")

    for symbol in cfg.test_symbols:
        def test_stats(sym: str = symbol) -> TestResult:
            stats = client.fetch_market_stats(sym)

            issues = []
            if stats.high_24h <= 0:           issues.append("high_24h ≤ 0")
            if stats.low_24h  <= 0:           issues.append("low_24h ≤ 0")
            if stats.high_24h < stats.low_24h: issues.append("high < low")
            if stats.volume_24h < 0:          issues.append("negative volume")

            detail = (
                f"H={stats.high_24h}  L={stats.low_24h}  "
                f"Vol={stats.volume_24h:.2f}  "
                f"Chg={stats.price_change_pct_24h:+.2f}%"
            )

            return TestResult(
                name    = f"{sym} 24h stats",
                status  = Status.PASS if not issues else Status.FAIL,
                message = f"Δ{stats.price_change_pct_24h:+.2f}%" + (f" — {', '.join(issues)}" if issues else ""),
                detail  = detail,
            )

        s.add(_run(f"{symbol} stats", test_stats))
        _pause()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 5 — Data quality (checks the library's normaliser assumptions)
# ─────────────────────────────────────────────────────────────────────────────

def suite_data_quality(client: BinanceClient) -> Suite:
    section("5 · Data quality  (validates normaliser assumptions)")
    s = Suite("Data Quality")

    for symbol in cfg.test_symbols[:2]:   # only first two symbols to avoid rate-limit

        # 5a — No NaN or Inf values
        def test_nan(sym: str = symbol) -> TestResult:
            candles = client.fetch_candles(sym, "1d", limit=50)
            bad = [
                c for c in candles
                if not all(
                    v == v and abs(v) != float("inf")   # NaN check: NaN != NaN
                    for v in (c.open, c.high, c.low, c.close, c.volume)
                )
            ]
            return TestResult(
                name    = f"{sym} no NaN/Inf",
                status  = Status.PASS if not bad else Status.FAIL,
                message = f"0 bad rows" if not bad else f"{len(bad)} rows with NaN/Inf",
            )

        s.add(_run(f"{symbol} NaN check", test_nan))
        _pause()

        # 5b — Volume is non-negative
        def test_volume(sym: str = symbol) -> TestResult:
            candles = client.fetch_candles(sym, "1d", limit=200)
            neg_vol = [c for c in candles if c.volume < 0]
            zero_vol_pct = sum(1 for c in candles if c.volume == 0) / max(len(candles), 1) * 100
            detail  = f"total={len(candles)}  zero_vol={zero_vol_pct:.1f}%"
            return TestResult(
                name    = f"{sym} volume ≥ 0",
                status  = Status.PASS if not neg_vol else Status.FAIL,
                message = f"no negative volume" if not neg_vol else f"{len(neg_vol)} negative",
                detail  = detail,
            )

        s.add(_run(f"{symbol} volume", test_volume))
        _pause()

        # 5c — Timestamps are strictly monotonically increasing
        def test_monotonic(sym: str = symbol) -> TestResult:
            candles = client.fetch_candles(sym, "1h", limit=200)
            bad_pairs = [
                (i, candles[i - 1].timestamp, candles[i].timestamp)
                for i in range(1, len(candles))
                if candles[i].timestamp <= candles[i - 1].timestamp
            ]
            detail = f"total={len(candles)} candles"
            return TestResult(
                name    = f"{sym} timestamps monotonic",
                status  = Status.PASS if not bad_pairs else Status.FAIL,
                message = "strictly increasing" if not bad_pairs else f"{len(bad_pairs)} non-monotonic pairs",
                detail  = detail,
            )

        s.add(_run(f"{symbol} monotonic", test_monotonic))
        _pause()

        # 5d — Cross-check: last candle close ≈ live ticker price (within 1%)
        def test_price_coherence(sym: str = symbol) -> TestResult:
            candles  = client.fetch_candles(sym, "1m", limit=2)
            live     = client.fetch_ticker_price(sym)
            last     = candles[-1].close if candles else None

            if last is None or live == 0:
                return TestResult(name=f"{sym} price coherence", status=Status.SKIP,
                                  message="no data")

            pct_diff = abs(live - last) / live * 100
            status   = Status.PASS if pct_diff < 1.0 else Status.WARN
            return TestResult(
                name    = f"{sym} price coherence",
                status  = status,
                message = f"last_close={last}  live={live}  diff={pct_diff:.3f}%",
            )

        s.add(_run(f"{symbol} price coherence", test_price_coherence))
        _pause()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 6 — Timeframe mapping (all TF_INTERVAL keys)
# ─────────────────────────────────────────────────────────────────────────────

def suite_timeframe_mapping(client: BinanceClient) -> Suite:
    section("6 · Timeframe mapping  (all TF_INTERVAL keys)")
    s = Suite("Timeframe Mapping")

    symbol = cfg.test_symbols[0]
    info(f"Using symbol: {symbol}")

    for lib_tf, binance_interval in TF_INTERVAL.items():
        def test_tf(tf: str = lib_tf, interval: str = binance_interval) -> TestResult:
            candles = client.fetch_candles(symbol, tf, limit=5)
            n = len(candles)
            return TestResult(
                name    = f"{tf:8s} → {interval}",
                status  = Status.PASS if n > 0 else Status.FAIL,
                message = f"{n} candles returned",
                detail  = f"first={candles[0].timestamp if candles else 'n/a'}",
            )

        s.add(_run(f"tf={lib_tf}", test_tf))
        _pause()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# Suite 7 — WebSocket  (mirrors ws.ts connection logic)
# ─────────────────────────────────────────────────────────────────────────────

def suite_websocket() -> Suite:
    section("7 · WebSocket  (mirrors ws.ts streaming)")
    s = Suite("WebSocket")

    async def listen(symbol: str, seconds: int) -> list[dict[str, Any]]:
        """Subscribe to <symbol>@kline_1m and collect messages for `seconds`."""
        stream = f"{symbol.lower()}@kline_1m"
        url    = f"{cfg.binance_ws_url}/{stream}"
        frames: list[dict[str, Any]] = []

        try:
            async with websockets.connect(url, open_timeout=10) as ws:  # type: ignore[attr-defined]
                deadline = asyncio.get_event_loop().time() + seconds
                while asyncio.get_event_loop().time() < deadline:
                    try:
                        raw  = await asyncio.wait_for(ws.recv(), timeout=3.0)
                        msg  = json.loads(raw)
                        frames.append(msg)
                    except asyncio.TimeoutError:
                        continue
        except Exception as exc:
            raise RuntimeError(f"WS error: {exc}") from exc

        return frames

    for symbol in cfg.test_symbols[:2]:    # test WS on first two symbols only

        def test_ws(sym: str = symbol) -> TestResult:
            frames = asyncio.run(listen(sym, cfg.ws_listen_seconds))

            if not frames:
                return TestResult(
                    name    = f"{sym} WS stream",
                    status  = Status.WARN,
                    message = f"no frames received in {cfg.ws_listen_seconds}s",
                )

            # Validate kline message shape (matches the ws.ts WSMessage envelope)
            klines = [f for f in frames if "k" in f]
            sample = klines[0]["k"] if klines else {}

            has_ohlcv = all(k in sample for k in ("o", "h", "l", "c", "v", "t"))

            detail = (
                f"frames={len(frames)}  klines={len(klines)}\n"
                f"sample: t={sample.get('t')} O={sample.get('o')} "
                f"H={sample.get('h')} L={sample.get('l')} C={sample.get('c')}"
            ) if sample else f"frames={len(frames)}"

            return TestResult(
                name    = f"{sym} WS stream",
                status  = Status.PASS if has_ohlcv else Status.WARN,
                message = f"{len(frames)} frames in {cfg.ws_listen_seconds}s",
                detail  = detail,
            )

        s.add(_run(f"{symbol} WS", test_ws))

    return s