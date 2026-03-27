"""
OrbityxAI v7.1 — Paper Trading Tracker
========================================
Full paper trading with real price tracking:
  - Opens positions on detected setups
  - Checks SL/TP/trailing every scan
  - Tracks P&L per trade and total equity
  - Sends reports to Telegram
  - Saves state to disk (survives restarts)

Usage:
  python run_paper.py --exchange bybit
  python run_paper.py --exchange binance --tg
  python run_paper.py --exchange bybit --interval 1800  # scan every 30min
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
from typing import List, Dict

from dotenv import load_dotenv
load_dotenv()


STATE_FILE = Path("paper_state.json")


@dataclass
class PaperPosition:
    symbol: str
    direction: str
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    amount_usd: float
    risk_pct: float
    confirmations: int
    entry_time: str
    bar_count: int = 0
    best_price: float = 0.0
    trailing_active: bool = False
    trailing_sl: float = 0.0


@dataclass
class PaperTrade:
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    pnl_usd: float
    entry_time: str
    exit_time: str
    exit_reason: str
    confirmations: int


def parse_args():
    p = argparse.ArgumentParser(description="Paper Trading Tracker")
    p.add_argument("--exchange", choices=["binance", "bybit", "mexc"], default="bybit")
    p.add_argument("--capital", type=float, default=10000)
    p.add_argument("--risk", type=float, default=0.01)
    p.add_argument("--max-positions", type=int, default=5)
    p.add_argument("--max-pairs", type=int, default=100)
    p.add_argument("--min-rr", type=float, default=2.5)
    p.add_argument("--min-conf", type=int, default=2)
    p.add_argument("--tf", type=str, default="15m",
                   choices=["5m", "15m", "30m", "1h", "4h"])
    p.add_argument("--interval", type=int, default=0,
                   help="Scan interval seconds (0 = auto from TF)")
    p.add_argument("--max-hold", type=int, default=15)
    p.add_argument("--tg", action="store_true")
    p.add_argument("--lang", choices=["en", "ru"], default="ru")
    return p.parse_args()


class PaperTrader:

    def __init__(self, args):
        self.args = args
        self.capital = args.capital
        self.equity = args.capital
        self.positions: Dict[str, PaperPosition] = {}
        self.trades: List[PaperTrade] = []
        self.equity_curve: List[float] = [args.capital]
        self.scan_count = 0
        self.tg = None
        self._load_state()

        # Auto interval from TF
        tf_seconds = {"5m": 300, "15m": 900, "30m": 1800,
                      "1h": 3600, "4h": 14400}
        self.tf = args.tf
        self.interval = args.interval if args.interval > 0 else tf_seconds.get(args.tf, 900)

        from trading.exchange import ExchangeConnector
        self.conn = ExchangeConnector(args.exchange, futures=True)

        if args.tg:
            from bot.telegram_bot import TelegramBot
            self.tg = TelegramBot()
            self.tg.set_lang(args.lang)
            if self.tg.enabled:
                self.tg.start_polling(on_command=self._on_cmd)

    def _on_cmd(self, cmd):
        if cmd == "stats":
            self._tg(self._stats_text())
        elif cmd == "scan":
            self._tg("Сканирую..." if self.args.lang == "ru" else "Scanning...")

    def _tg(self, msg):
        if self.tg and self.tg.enabled:
            self.tg.send(msg)

    # ── Main ──────────────────────────────────────────────────

    def run_forever(self):
        running = True
        def stop(s, f):
            nonlocal running
            running = False
        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)

        header = (f"OrbityxAI Paper Trading\n"
                  f"Биржа: {self.args.exchange.upper()} | TF: {self.tf}\n"
                  f"Баланс: ${self.equity:,.2f}\n"
                  f"Скан каждые {self.interval//60} мин\n"
                  f"Позиций: {len(self.positions)} | Сделок: {len(self.trades)}")
        print(f"\n{'='*60}\n  {header}\n{'='*60}\n")
        self._tg(header)

        while running:
            try:
                self.run_once()
            except Exception as e:
                print(f"  ERROR: {e}")
            for _ in range(self.interval):
                if not running: break
                time.sleep(1)

        print(f"\n{self._stats_text()}")
        self._tg(f"Бот остановлен\n\n{self._stats_text()}")

    def run_once(self):
        self.scan_count += 1
        now = datetime.now(timezone.utc).strftime("%H:%M UTC")
        print(f"\n{'─'*60}")
        print(f"  Скан #{self.scan_count} | {now} | "
              f"${self.equity:,.2f} | Поз: {len(self.positions)}")

        closed = self._check_positions()
        opened = self._scan_and_open() if len(self.positions) < self.args.max_positions else 0

        if closed or opened:
            summary = (f"Скан #{self.scan_count}: "
                       f"закрыто {closed}, открыто {opened}, "
                       f"баланс ${self.equity:,.2f} "
                       f"({(self.equity/self.capital-1)*100:+.1f}%)")
            print(f"  {summary}")
            self._tg(summary)
        else:
            print(f"  Без изменений")

        self._save_state()

    # ── Check Positions ───────────────────────────────────────

    def _check_positions(self) -> int:
        to_close = []
        for sym, pos in self.positions.items():
            try:
                # Use current price only (not 24h high/low which is misleading)
                t = self.conn.fetch_ticker(sym)
                price = float(t.get("last", 0) or 0)
            except Exception:
                pos.bar_count += 1
                continue

            pos.bar_count += 1

            # Best price for trailing (based on actual price, not 24h)
            if pos.direction == "LONG":
                pos.best_price = max(pos.best_price, price)
            else:
                pos.best_price = min(pos.best_price, price) if pos.best_price > 0 else price

            risk = abs(pos.entry_price - pos.stop_loss)

            # Activate trailing
            if not pos.trailing_active:
                moved = (pos.best_price - pos.entry_price if pos.direction == "LONG"
                         else pos.entry_price - pos.best_price)
                if moved >= risk:
                    pos.trailing_active = True
                    if pos.direction == "LONG":
                        pos.trailing_sl = pos.best_price - risk * 0.5
                    else:
                        pos.trailing_sl = pos.best_price + risk * 0.5

            # Update trailing
            if pos.trailing_active:
                if pos.direction == "LONG":
                    pos.trailing_sl = max(pos.trailing_sl, pos.best_price - risk * 0.5)
                else:
                    pos.trailing_sl = min(pos.trailing_sl, pos.best_price + risk * 0.5)

            sl = pos.trailing_sl if pos.trailing_active else pos.stop_loss
            exit_p = exit_r = None

            if pos.direction == "LONG":
                if price <= sl:
                    exit_p, exit_r = sl, ("TRAIL" if pos.trailing_active else "SL")
                elif price >= pos.take_profit:
                    exit_p, exit_r = pos.take_profit, "TP"
            else:
                if price >= sl:
                    exit_p, exit_r = sl, ("TRAIL" if pos.trailing_active else "SL")
                elif price <= pos.take_profit:
                    exit_p, exit_r = pos.take_profit, "TP"

            if exit_p is None and pos.bar_count >= self.args.max_hold:
                exit_p, exit_r = price, "TIMEOUT"

            if exit_p is not None:
                self._close(sym, pos, exit_p, exit_r)
                to_close.append(sym)

        for s in to_close:
            del self.positions[s]
        return len(to_close)

    def _close(self, sym, pos, exit_p, reason):
        if pos.direction == "LONG":
            pnl_pct = (exit_p - pos.entry_price) / (pos.entry_price + 1e-9)
        else:
            pnl_pct = (pos.entry_price - exit_p) / (pos.entry_price + 1e-9)

        pnl_usd = pos.amount_usd * pnl_pct
        self.equity += pnl_usd
        self.equity_curve.append(self.equity)

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        self.trades.append(PaperTrade(
            symbol=sym, direction=pos.direction,
            entry_price=pos.entry_price, exit_price=exit_p,
            pnl_pct=pnl_pct * 100, pnl_usd=pnl_usd,
            entry_time=pos.entry_time, exit_time=now,
            exit_reason=reason, confirmations=pos.confirmations))

        e = "✅" if pnl_usd > 0 else "❌"
        d = "Л" if pos.direction == "LONG" else "Ш"
        msg = (f"{e} {d} {sym}\n"
               f"${pos.entry_price:,.4f} → ${exit_p:,.4f}\n"
               f"PnL: {'+' if pnl_pct>0 else ''}{pnl_pct*100:.2f}% "
               f"(${pnl_usd:+,.2f})\n"
               f"{reason} | Баланс: ${self.equity:,.2f}")
        print(f"  {msg}")
        self._tg(msg)

    # ── Scan & Open ───────────────────────────────────────────

    def _scan_and_open(self) -> int:
        from trading.pair_scanner import scan_pairs
        from indicators.technical import atr, rsi
        from levels.detector import detect_levels
        from levels.multi_tf import detect_htf_levels, boost_levels_with_confluence
        from levels.volume_profile import volume_profile_levels
        from setups.detector import detect_setups
        from setups.sizing import adaptive_risk, compute_position_value

        pairs = scan_pairs(self.conn, self.tf, min_volume_usd=5_000_000,
                           min_bars=500, max_pairs=self.args.max_pairs, verbose=False)
        opened = 0
        for pair in pairs:
            sym = pair.symbol
            if sym in self.positions or len(self.positions) >= self.args.max_positions:
                continue
            try:
                ts, o, h, l, c, v = self.conn.fetch_ohlcv(sym, self.tf, limit=2000)
                if len(c) < 200: continue
                n = len(c)
                atr_v = atr(h, l, c); rsi_v = rsi(c, 14)
                levels = detect_levels(h, l, c, v, atr_v, swing_window=10)
                try:
                    htf = detect_htf_levels(o, h, l, c, v, atr_v, factor=4)
                    levels = boost_levels_with_confluence(levels, htf, float(np.nanmean(atr_v)))
                except Exception: pass
                try:
                    vp = volume_profile_levels(h, l, c, v, lookback=500)
                    levels.extend(vp)
                    levels.sort(key=lambda lv: lv.strength, reverse=True)
                except Exception: pass

                fr = self.conn.fetch_funding_rate(sym)
                setups = detect_setups(o, h, l, c, v, atr_v, rsi_v, levels,
                    level_tolerance_atr=0.8, min_rr=self.args.min_rr,
                    min_confirmations=self.args.min_conf,
                    funding_rate=np.full(n, fr or 0.0),
                    trend_filter=True, sma_period=100)

                recent = [s for s in setups if s.bar_idx >= n - 3]
                if not recent: continue
                best = max(recent, key=lambda s: s.confidence)

                peak = max(self.equity_curve) if self.equity_curve else self.equity
                dd = self.equity / peak - 1.0
                rf = adaptive_risk(self.args.risk, best.n_confirmations,
                    best.confidence, self._wr(), dd, self._closs())
                pv = compute_position_value(self.equity, rf, best.entry_price, best.stop_loss)
                if pv < 10: continue

                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                self.positions[sym] = PaperPosition(
                    symbol=sym, direction=best.direction,
                    entry_price=best.entry_price, stop_loss=best.stop_loss,
                    take_profit=best.take_profit, risk_reward=best.risk_reward,
                    amount_usd=pv, risk_pct=rf*100, confirmations=best.n_confirmations,
                    entry_time=now, best_price=best.entry_price)
                opened += 1

                rd = abs(best.entry_price-best.stop_loss)/(best.entry_price+1e-9)*100
                td = abs(best.take_profit-best.entry_price)/(best.entry_price+1e-9)*100
                e = "🟢" if best.direction=="LONG" else "🔴"
                d = "ЛОНГ" if best.direction=="LONG" else "ШОРТ"
                msg = (f"{e} {d} {sym}\n"
                       f"Вход: ${best.entry_price:,.4f}\n"
                       f"Стоп: ${best.stop_loss:,.4f} (-{rd:.2f}%)\n"
                       f"Цель: ${best.take_profit:,.4f} (+{td:.2f}%)\n"
                       f"R:R={best.risk_reward:.1f} | Подтв: {best.n_confirmations}\n"
                       f"Размер: ${pv:,.2f}")
                print(f"  {msg}")
                self._tg(msg)
            except Exception: continue
        return opened

    def _wr(self, n=50):
        r = self.trades[-n:]
        return sum(1 for t in r if t.pnl_pct > 0) / len(r) if len(r) >= 5 else 0.3

    def _closs(self):
        c = 0
        for t in reversed(self.trades):
            if t.pnl_pct <= 0: c += 1
            else: break
        return c

    # ── Stats ─────────────────────────────────────────────────

    def _stats_text(self) -> str:
        if not self.trades:
            return (f"📊 Статистика\nСделок: 0\n"
                    f"Баланс: ${self.equity:,.2f}\nПозиций: {len(self.positions)}")
        wins = [t for t in self.trades if t.pnl_pct > 0]
        losses = [t for t in self.trades if t.pnl_pct <= 0]
        wr = len(wins)/len(self.trades)*100
        aw = np.mean([t.pnl_pct for t in wins]) if wins else 0
        al = np.mean([t.pnl_pct for t in losses]) if losses else 0
        gp = sum(t.pnl_pct for t in wins) if wins else 0
        gl = abs(sum(t.pnl_pct for t in losses)) if losses else 1e-9
        pf = gp/gl
        ret = (self.equity/self.capital-1)*100

        last5 = ""
        for t in self.trades[-5:]:
            e = "✅" if t.pnl_pct > 0 else "❌"
            d = "Л" if t.direction == "LONG" else "Ш"
            last5 += f"  {e} {d} {t.symbol} {t.pnl_pct:+.2f}% ${t.pnl_usd:+,.2f}\n"

        return (f"📊 <b>Paper Trading</b>\n\n"
                f"Сделок: {len(self.trades)} (✅{len(wins)} ❌{len(losses)})\n"
                f"Win Rate: <b>{wr:.1f}%</b>\n"
                f"Ср. win: +{aw:.2f}% | Ср. loss: {al:.2f}%\n"
                f"Profit Factor: <b>{pf:.2f}</b>\n\n"
                f"Баланс: <b>${self.equity:,.2f}</b> ({ret:+.1f}%)\n"
                f"Позиций: {len(self.positions)}\n\n"
                f"Последние:\n{last5}")

    # ── State ─────────────────────────────────────────────────

    def _save_state(self):
        state = {"equity": self.equity, "capital": self.capital,
                 "scan_count": self.scan_count,
                 "equity_curve": self.equity_curve[-1000:],
                 "positions": {k: asdict(v) for k, v in self.positions.items()},
                 "trades": [asdict(t) for t in self.trades[-500:]]}
        STATE_FILE.write_text(json.dumps(state, indent=2, default=str))

    def _load_state(self):
        if not STATE_FILE.exists(): return
        try:
            s = json.loads(STATE_FILE.read_text())
            self.equity = s.get("equity", self.args.capital)
            self.capital = s.get("capital", self.args.capital)
            self.scan_count = s.get("scan_count", 0)
            self.equity_curve = s.get("equity_curve", [self.equity])
            for k, v in s.get("positions", {}).items():
                self.positions[k] = PaperPosition(**v)
            for t in s.get("trades", []):
                self.trades.append(PaperTrade(**t))
            print(f"  Загружено: ${self.equity:,.2f}, "
                  f"{len(self.trades)} сделок, {len(self.positions)} позиций")
        except Exception as e:
            print(f"  Не удалось загрузить: {e}")


if __name__ == "__main__":
    main = PaperTrader(parse_args())
    main.run_forever()
