"""
OrbityxAI v7.1 — Auto Trading Bot
====================================
Places REAL orders on exchange based on detected setups.
Manages positions with SL/TP orders automatically.

IMPORTANT: This uses REAL money. Start with small capital.

Usage:
  # Bybit (основная)
  python run_auto_trade.py --exchange bybit --capital 100

  # Binance
  python run_auto_trade.py --exchange binance --capital 100

  # MEXC
  python run_auto_trade.py --exchange mexc --capital 100

  # Testnet (без реальных денег)
  python run_auto_trade.py --exchange bybit --testnet --capital 1000

Environment variables (.env):
  EXCHANGE_KEY=your_api_key
  EXCHANGE_SECRET=your_api_secret
  TELEGRAM_TOKEN=bot_token
  TELEGRAM_CHAT_IDS=id1,id2
"""
import json
import time
import signal
import sys
import argparse
import os
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional

from dotenv import load_dotenv
load_dotenv()


STATE_FILE = Path("autotrade_state.json")


@dataclass
class LivePosition:
    symbol: str
    direction: str          # "LONG" / "SHORT"
    side: str               # "buy" / "sell"
    entry_price: float
    amount: float           # in base currency
    stop_loss: float
    take_profit: float
    risk_reward: float
    position_usd: float
    confirmations: int
    entry_time: str
    entry_order_id: str = ""
    sl_order_id: str = ""
    tp_order_id: str = ""
    bar_count: int = 0


@dataclass
class TradeRecord:
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    pnl_usd: float
    entry_time: str
    exit_time: str
    exit_reason: str


def parse_args():
    p = argparse.ArgumentParser(description="OrbityxAI Auto Trading")
    p.add_argument("--exchange", choices=["binance", "bybit", "mexc"], default="bybit")
    p.add_argument("--key", type=str, default=os.getenv("EXCHANGE_KEY", ""))
    p.add_argument("--secret", type=str, default=os.getenv("EXCHANGE_SECRET", ""))
    p.add_argument("--testnet", action="store_true")
    p.add_argument("--capital", type=float, default=100,
                   help="Trading capital USD (default $100 — start small!)")
    p.add_argument("--risk", type=float, default=0.01,
                   help="Risk per trade (default 1%%)")
    p.add_argument("--max-positions", type=int, default=3)
    p.add_argument("--max-pairs", type=int, default=50)
    p.add_argument("--min-rr", type=float, default=2.5)
    p.add_argument("--min-conf", type=int, default=2)
    p.add_argument("--tf", type=str, default="15m",
                   choices=["5m", "15m", "30m", "1h", "4h"])
    p.add_argument("--leverage", type=int, default=10)
    p.add_argument("--interval", type=int, default=0,
                   help="Scan interval (0 = auto from TF)")
    p.add_argument("--tg", action="store_true")
    p.add_argument("--lang", choices=["en", "ru"], default="ru")
    p.add_argument("--dry-run", action="store_true",
                   help="Show what would be traded without placing orders")
    return p.parse_args()


class AutoTrader:

    def __init__(self, args):
        self.args = args
        self.capital = args.capital
        self.positions: Dict[str, LivePosition] = {}
        self.trades: List[TradeRecord] = []
        self.scan_count = 0
        self.tg = None

        tf_seconds = {"5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400}
        self.interval = args.interval if args.interval > 0 else tf_seconds.get(args.tf, 900)

        # Validate API keys
        if not args.key and not args.testnet:
            print("ERROR: Set EXCHANGE_KEY and EXCHANGE_SECRET in .env or use --testnet")
            sys.exit(1)

        # Exchange
        from trading.exchange import ExchangeConnector
        self.conn = ExchangeConnector(
            exchange_id=args.exchange,
            api_key=args.key,
            secret=args.secret,
            testnet=args.testnet,
            futures=True,
        )

        # Telegram
        if args.tg:
            from bot.telegram_bot import TelegramBot
            self.tg = TelegramBot()
            self.tg.set_lang(args.lang)

        self._load_state()

    def _tg(self, msg):
        if self.tg and self.tg.enabled:
            self.tg.send(msg)

    # ── Main Loop ─────────────────────────────────────────────

    def run_forever(self):
        running = True
        def stop(s, f):
            nonlocal running
            running = False
        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)

        mode = "TESTNET" if self.args.testnet else "LIVE"
        if self.args.dry_run:
            mode = "DRY-RUN"

        header = (f"{'='*60}\n"
                  f"  OrbityxAI AUTO TRADING [{mode}]\n"
                  f"  Биржа: {self.args.exchange.upper()}\n"
                  f"  Капитал: ${self.capital:,.2f}\n"
                  f"  Риск: {self.args.risk:.0%}/сделку | Плечо: {self.args.leverage}x\n"
                  f"  TF: {self.args.tf} | Скан каждые {self.interval//60} мин\n"
                  f"  Max позиций: {self.args.max_positions}\n"
                  f"{'='*60}")
        print(header)
        self._tg(header.replace('=', '').strip())

        if mode == "LIVE":
            print("\n  ⚠️  ВНИМАНИЕ: Торговля РЕАЛЬНЫМИ деньгами!")
            print("  Нажмите Enter чтобы продолжить или Ctrl+C для отмены...")
            try:
                input()
            except (KeyboardInterrupt, EOFError):
                print("  Отменено.")
                return

        while running:
            try:
                self._run_once()
            except Exception as e:
                print(f"  ERROR: {e}")
                self._tg(f"⚠️ Ошибка: {e}")
                time.sleep(60)
                continue

            for _ in range(self.interval):
                if not running:
                    break
                time.sleep(1)

        # Shutdown
        print(f"\n{'='*60}")
        print(f"  Бот остановлен. Открытых позиций: {len(self.positions)}")
        if self.positions:
            print("  ⚠️  Позиции НЕ закрыты! SL/TP ордера активны на бирже.")
        print(f"{'='*60}")
        self._tg(f"Бот остановлен\nОткрытых позиций: {len(self.positions)}")

    def _run_once(self):
        self.scan_count += 1
        now = datetime.now(timezone.utc).strftime("%H:%M UTC")
        print(f"\n{'─'*60}")
        print(f"  Скан #{self.scan_count} | {now} | Поз: {len(self.positions)}")

        # 1. Check existing positions
        self._check_positions()

        # 2. Scan for new setups
        if len(self.positions) < self.args.max_positions:
            self._scan_and_trade()

        self._save_state()

    # ── Position Management ───────────────────────────────────

    def _check_positions(self):
        """Check if any positions were closed by exchange (SL/TP filled)."""
        to_remove = []
        for sym, pos in self.positions.items():
            pos.bar_count += 1
            try:
                # Check if position still exists on exchange
                exchange_positions = self.conn.fetch_positions(sym)
                has_position = any(
                    abs(float(p.get("contracts", 0) or p.get("contractSize", 0) or 0)) > 0
                    for p in exchange_positions
                )

                if not has_position:
                    # Position was closed (SL or TP hit)
                    ticker = self.conn.fetch_ticker(sym)
                    exit_price = float(ticker.get("last", pos.entry_price))
                    self._record_close(sym, pos, exit_price, "SL/TP")
                    to_remove.append(sym)

                # Timeout: close manually after max bars
                elif pos.bar_count >= self.args.max_positions * 5:  # generous timeout
                    self._close_position(sym, pos, "TIMEOUT")
                    to_remove.append(sym)

            except Exception as e:
                print(f"    Check {sym}: {e}")

        for sym in to_remove:
            del self.positions[sym]

    def _close_position(self, sym: str, pos: LivePosition, reason: str):
        """Manually close a position on exchange."""
        try:
            # Cancel existing SL/TP orders
            self.conn.cancel_all_orders(sym)

            # Close position with market order
            close_side = "sell" if pos.side == "buy" else "buy"
            order = self.conn.place_market_order(sym, close_side, pos.amount)

            exit_price = order.price or float(self.conn.fetch_ticker(sym).get("last", 0))
            self._record_close(sym, pos, exit_price, reason)

        except Exception as e:
            print(f"    Close error {sym}: {e}")
            self._tg(f"⚠️ Ошибка закрытия {sym}: {e}")

    def _record_close(self, sym: str, pos: LivePosition, exit_price: float, reason: str):
        """Record a closed trade."""
        if pos.direction == "LONG":
            pnl_pct = (exit_price - pos.entry_price) / (pos.entry_price + 1e-9)
        else:
            pnl_pct = (pos.entry_price - exit_price) / (pos.entry_price + 1e-9)

        pnl_usd = pos.position_usd * pnl_pct
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        self.trades.append(TradeRecord(
            symbol=sym, direction=pos.direction,
            entry_price=pos.entry_price, exit_price=exit_price,
            pnl_pct=pnl_pct * 100, pnl_usd=pnl_usd,
            entry_time=pos.entry_time, exit_time=now,
            exit_reason=reason,
        ))

        emoji = "✅" if pnl_usd > 0 else "❌"
        d = "ЛОНГ" if pos.direction == "LONG" else "ШОРТ"
        sign = "+" if pnl_pct > 0 else ""
        msg = (f"{emoji} ЗАКРЫТА {d} {sym}\n"
               f"${pos.entry_price:,.4f} → ${exit_price:,.4f}\n"
               f"PnL: {sign}{pnl_pct*100:.2f}% (${pnl_usd:+,.2f})\n"
               f"Причина: {reason}")
        print(f"  {msg}")
        self._tg(msg)

    # ── Scanning & Trading ────────────────────────────────────

    def _scan_and_trade(self):
        from trading.pair_scanner import scan_pairs
        from indicators.technical import atr, rsi
        from levels.detector import detect_levels
        from levels.multi_tf import detect_htf_levels, boost_levels_with_confluence
        from levels.volume_profile import volume_profile_levels
        from setups.detector import detect_setups
        from setups.sizing import adaptive_risk, compute_position_value

        pairs = scan_pairs(self.conn, self.args.tf,
                           min_volume_usd=5_000_000, min_bars=500,
                           max_pairs=self.args.max_pairs, verbose=False)

        for pair in pairs:
            sym = pair.symbol
            if sym in self.positions or len(self.positions) >= self.args.max_positions:
                continue

            try:
                ts, o, h, l, c, v = self.conn.fetch_ohlcv(sym, self.args.tf, limit=2000)
                n = len(c)
                if n < 200:
                    continue

                atr_v = atr(h, l, c)
                rsi_v = rsi(c, 14)
                levels = detect_levels(h, l, c, v, atr_v, swing_window=10)

                try:
                    htf = detect_htf_levels(o, h, l, c, v, atr_v, factor=4)
                    levels = boost_levels_with_confluence(levels, htf, float(np.nanmean(atr_v)))
                except Exception:
                    pass
                try:
                    vp = volume_profile_levels(h, l, c, v, lookback=500)
                    levels.extend(vp)
                    levels.sort(key=lambda lv: lv.strength, reverse=True)
                except Exception:
                    pass

                fr = self.conn.fetch_funding_rate(sym)
                setups = detect_setups(o, h, l, c, v, atr_v, rsi_v, levels,
                    level_tolerance_atr=0.8, min_rr=self.args.min_rr,
                    min_confirmations=self.args.min_conf,
                    funding_rate=np.full(n, fr or 0.0),
                    trend_filter=True, sma_period=100)

                recent = [s for s in setups if s.bar_idx >= n - 3]
                if not recent:
                    continue

                best = max(recent, key=lambda s: s.confidence)

                # Position sizing
                risk_frac = adaptive_risk(
                    self.args.risk, best.n_confirmations,
                    best.confidence, self._wr(), 0.0, self._closs())
                pos_val = compute_position_value(
                    self.capital, risk_frac, best.entry_price, best.stop_loss)

                if pos_val < 5:
                    continue

                # Get precision
                price_prec, amount_prec = self.conn.get_precision(sym)
                min_amount = self.conn.get_min_amount(sym)
                amount = round(pos_val / best.entry_price, amount_prec)

                if amount < min_amount:
                    continue

                side = "buy" if best.direction == "LONG" else "sell"
                risk_d = abs(best.entry_price - best.stop_loss) / (best.entry_price + 1e-9) * 100
                tp_d = abs(best.take_profit - best.entry_price) / (best.entry_price + 1e-9) * 100

                d = "ЛОНГ" if best.direction == "LONG" else "ШОРТ"
                emoji = "🟢" if best.direction == "LONG" else "🔴"

                if self.args.dry_run:
                    msg = (f"{emoji} [DRY-RUN] {d} {sym}\n"
                           f"Вход: ${best.entry_price:,.4f}\n"
                           f"Стоп: ${best.stop_loss:,.4f} (-{risk_d:.2f}%)\n"
                           f"Цель: ${best.take_profit:,.4f} (+{tp_d:.2f}%)\n"
                           f"R:R={best.risk_reward:.1f} | Подтв: {best.n_confirmations}\n"
                           f"Размер: {amount} ({pos_val:.2f}$)")
                    print(f"  {msg}")
                    self._tg(msg)
                    continue

                # === PLACE REAL ORDERS ===
                try:
                    # Set leverage
                    self.conn.set_leverage(sym, self.args.leverage)

                    # Entry: market order
                    entry_order = self.conn.place_market_order(sym, side, amount)
                    entry_price = entry_order.price or best.entry_price

                    # SL order
                    sl_order = self.conn.place_stop_loss(
                        sym, side, amount, round(best.stop_loss, price_prec))

                    # TP order
                    tp_order = self.conn.place_take_profit(
                        sym, side, amount, round(best.take_profit, price_prec))

                    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                    self.positions[sym] = LivePosition(
                        symbol=sym, direction=best.direction, side=side,
                        entry_price=entry_price, amount=amount,
                        stop_loss=best.stop_loss, take_profit=best.take_profit,
                        risk_reward=best.risk_reward, position_usd=pos_val,
                        confirmations=best.n_confirmations, entry_time=now,
                        entry_order_id=entry_order.order_id,
                        sl_order_id=sl_order.order_id,
                        tp_order_id=tp_order.order_id,
                    )

                    msg = (f"{emoji} ОТКРЫТА {d} {sym}\n"
                           f"Вход: ${entry_price:,.4f}\n"
                           f"Стоп: ${best.stop_loss:,.4f} (-{risk_d:.2f}%)\n"
                           f"Цель: ${best.take_profit:,.4f} (+{tp_d:.2f}%)\n"
                           f"R:R={best.risk_reward:.1f} | Подтв: {best.n_confirmations}\n"
                           f"Размер: {amount} (${pos_val:.2f})\n"
                           f"Ордера: entry={entry_order.order_id}")
                    print(f"  {msg}")
                    self._tg(msg)

                except Exception as e:
                    msg = f"⚠️ ОШИБКА ордера {sym}: {e}"
                    print(f"  {msg}")
                    self._tg(msg)

            except Exception:
                continue

    # ── Helpers ────────────────────────────────────────────────

    def _wr(self, n=50):
        r = self.trades[-n:]
        return sum(1 for t in r if t.pnl_pct > 0) / len(r) if len(r) >= 5 else 0.3

    def _closs(self):
        c = 0
        for t in reversed(self.trades):
            if t.pnl_pct <= 0:
                c += 1
            else:
                break
        return c

    def _save_state(self):
        state = {
            "capital": self.capital,
            "scan_count": self.scan_count,
            "positions": {k: asdict(v) for k, v in self.positions.items()},
            "trades": [asdict(t) for t in self.trades[-500:]],
        }
        STATE_FILE.write_text(json.dumps(state, indent=2, default=str))

    def _load_state(self):
        if not STATE_FILE.exists():
            return
        try:
            s = json.loads(STATE_FILE.read_text())
            self.scan_count = s.get("scan_count", 0)
            for k, v in s.get("positions", {}).items():
                self.positions[k] = LivePosition(**v)
            for t in s.get("trades", []):
                self.trades.append(TradeRecord(**t))
            if self.positions or self.trades:
                print(f"  Загружено: {len(self.trades)} сделок, "
                      f"{len(self.positions)} позиций")
        except Exception as e:
            print(f"  Не удалось загрузить: {e}")


if __name__ == "__main__":
    args = parse_args()
    trader = AutoTrader(args)
    trader.run_forever()
