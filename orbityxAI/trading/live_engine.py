"""
Live Trading Engine v1.0
==========================
Runs setup-based strategy in live or paper mode.
- Scans pairs every candle close
- Detects setups at S/R levels
- Places orders (live) or logs trades (paper)
- Manages positions with trailing stops
- Sends Telegram alerts
"""
import time
import json
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Optional
from dataclasses import dataclass, field, asdict
from pathlib import Path

from trading.exchange import ExchangeConnector
from trading.pair_scanner import scan_pairs, PairInfo
from indicators.technical import atr, rsi
from levels.detector import detect_levels
from levels.multi_tf import detect_htf_levels, boost_levels_with_confluence
from levels.volume_profile import volume_profile_levels
from setups.detector import detect_setups, TradingSetup
from setups.sizing import adaptive_risk, compute_position_value


@dataclass
class Position:
    symbol: str           # actual exchange symbol (e.g. "BTC/USDT:USDT")
    direction: str        # "LONG" or "SHORT"
    entry_price: float
    amount: float
    stop_loss: float
    take_profit: float
    entry_time: str
    setup_confidence: float
    entry_scan: int = 0
    order_ids: List[str] = field(default_factory=list)
    trailing_active: bool = False
    best_price: float = 0.0
    pnl_pct: float = 0.0


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
    setup_confidence: float


class LiveEngine:

    def __init__(
            self,
            connector: ExchangeConnector,
            mode: str = "paper",           # "paper" or "live"
            capital: float = 10_000,
            risk_per_trade: float = 0.01,
            max_positions: int = 5,
            min_rr: float = 2.5,
            min_confirmations: int = 2,
            max_holding_bars: int = 15,
            timeframe: str = "1h",
            bars_history: int = 2000,
            leverage: int = 10,
            telegram_bot=None,
    ):
        self.connector = connector
        self.mode = mode
        self.capital = capital
        self.equity = capital
        self.risk_per_trade = risk_per_trade
        self.max_positions = max_positions
        self.min_rr = min_rr
        self.min_confirmations = min_confirmations
        self.max_holding_bars = max_holding_bars
        self.timeframe = timeframe
        self.bars_history = bars_history
        self.leverage = leverage
        self.tg = telegram_bot

        self.positions: Dict[str, Position] = {}
        self.trade_history: List[TradeRecord] = []
        self.scan_count = 0
        self.state_file = Path("live_state.json")

        # Paper trading equity tracking
        self.equity_curve = [capital]
        self.consecutive_losses = 0
        self.peak_equity = capital
        self._last_balance_report = 0  # timestamp

    # ── Main Loop ─────────────────────────────────────────────

    def run_once(self, pairs: List[str]) -> List[TradingSetup]:
        """Run one scan cycle across all pairs. Call every candle close."""
        self.scan_count += 1
        found_setups: List[TradingSetup] = []
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        self._log(f"\n{'='*50}")
        self._log(f"Scan #{self.scan_count} | {now} | {len(pairs)} pairs")
        self._log(f"Equity: ${self.equity:,.2f} | Positions: {len(self.positions)}/{self.max_positions}")

        # Balance report: on first scan and every 4 hours
        now_ts = time.time()
        if self.scan_count == 1 or (now_ts - self._last_balance_report) >= 4 * 3600:
            self.send_balance_report()
            self._last_balance_report = now_ts

        # Check existing positions first
        self._manage_positions()

        # Scan ALL pairs for setups (even if max positions reached — show signals)
        for symbol in pairs:
            try:
                time.sleep(0.2)  # rate limit
                setups = self._scan_pair(symbol)
                if setups:
                    best = max(setups, key=lambda s: s.confidence)
                    best.symbol = symbol  # attach symbol name

                    # Log the signal with entry/stop/TP
                    risk_pct = abs(best.entry_price - best.stop_loss) / (best.entry_price + 1e-9) * 100
                    tp_pct = abs(best.take_profit - best.entry_price) / (best.entry_price + 1e-9) * 100
                    emoji = "🟢" if best.direction == "LONG" else "🔴"

                    self._log(f"  {emoji} {symbol} {best.direction} "
                              f"Entry=${best.entry_price:,.4f} "
                              f"SL=${best.stop_loss:,.4f}(-{risk_pct:.2f}%) "
                              f"TP=${best.take_profit:,.4f}(+{tp_pct:.2f}%) "
                              f"R:R={best.risk_reward:.1f} "
                              f"conf={best.n_confirmations}")

                    # Send Telegram alert for every signal
                    if self.tg:
                        self.tg.send_setup_alert(
                            symbol=symbol,
                            direction=best.direction,
                            entry=best.entry_price,
                            stop=best.stop_loss,
                            tp=best.take_profit,
                            rr=best.risk_reward,
                            confirmations=best.n_confirmations,
                            confidence=best.confidence,
                            mode=self.mode.upper(),
                        )

                    found_setups.append(best)

                    # Execute if we have room (0 = unlimited)
                    if ((self.max_positions == 0 or len(self.positions) < self.max_positions)
                            and symbol not in self.positions):
                        self._execute_setup(best)

            except Exception as e:
                pass  # skip errors silently for individual pairs

        if not found_setups:
            self._log(f"  No setups found across {len(pairs)} pairs")

        self._save_state()
        return found_setups

    def _scan_pair(self, symbol: str) -> List[TradingSetup]:
        """Scan one pair for setups."""
        try:
            ts, o, h, l, c, v = self.connector.fetch_ohlcv(
                symbol, self.timeframe, self.bars_history
            )
        except Exception:
            return []

        n = len(c)
        if n < 200:
            return []

        atr_v = atr(h, l, c)
        rsi_v = rsi(c, 14)

        # Detect levels
        levels = detect_levels(h, l, c, v, atr_v, swing_window=10)

        # Multi-TF boost
        try:
            htf = detect_htf_levels(o, h, l, c, v, atr_v, factor=4)
            levels = boost_levels_with_confluence(levels, htf, float(np.nanmean(atr_v)))
        except Exception:
            pass

        # Volume Profile
        try:
            vp = volume_profile_levels(h, l, c, v, lookback=500)
            levels.extend(vp)
            levels.sort(key=lambda lv: lv.strength, reverse=True)
        except Exception:
            pass

        # Funding rate
        fr = self.connector.fetch_funding_rate(symbol)
        fr_arr = np.full(n, fr or 0.0)

        # Detect setups (only last bar)
        setups = detect_setups(
            o, h, l, c, v, atr_v, rsi_v, levels,
            level_tolerance_atr=0.8,
            min_rr=self.min_rr,
            min_confirmations=self.min_confirmations,
            funding_rate=fr_arr,
            trend_filter=True,
            sma_period=100,
        )

        # Only return setups on the LAST bar (current candle)
        latest = [s for s in setups if s.bar_idx >= n - 2]
        return latest

    # ── Order Execution ─────────────────────────────────────────

    def _execute_setup(self, setup: TradingSetup):
        """Execute a setup — place orders or log paper trade."""
        symbol = setup.symbol  # actual exchange symbol (e.g. "BTC/USDT:USDT")

        # Dynamic sizing
        self.peak_equity = max(self.peak_equity, self.equity)
        dd = self.equity / self.peak_equity - 1.0
        recent_wr = self._recent_win_rate()

        risk_frac = adaptive_risk(
            self.risk_per_trade,
            setup.n_confirmations,
            setup.confidence,
            recent_wr, dd,
            self.consecutive_losses,
        )

        position_val = compute_position_value(
            self.equity, risk_frac, setup.entry_price, setup.stop_loss
        )

        if position_val < 10:  # minimum $10
            return

        amount = position_val / (setup.entry_price + 1e-9)
        side = "buy" if setup.direction == "LONG" else "sell"

        # Check minimum amount and round to exchange precision
        if self.mode == "live":
            try:
                min_amount = self.connector.get_min_amount(symbol)
                _, amt_precision = self.connector.get_precision(symbol)
                amount = round(amount, amt_precision if isinstance(amt_precision, int) else 3)
                if amount < min_amount:
                    self._log(f"  SKIP {symbol}: amount {amount} < min {min_amount}")
                    return
            except Exception:
                pass

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        if self.mode == "live":
            try:
                # Set leverage
                self.connector.set_leverage(symbol, self.leverage)

                # Market entry
                order = self.connector.place_market_order(
                    symbol, side, amount
                )
                entry_price = order.price or setup.entry_price
                filled_amount = order.amount or amount

                # Place SL
                try:
                    sl_order = self.connector.place_stop_loss(
                        symbol, side, filled_amount, setup.stop_loss
                    )
                except Exception as e:
                    self._log(f"  SL FAILED (position open without SL!): {e}")
                    self._alert(f"WARNING: {symbol} open WITHOUT stop loss! Set SL manually at ${setup.stop_loss:,.4f}")
                    sl_order = type('', (), {'order_id': 'sl_failed'})()

                # Place TP
                try:
                    tp_order = self.connector.place_take_profit(
                        symbol, side, filled_amount, setup.take_profit
                    )
                except Exception as e:
                    self._log(f"  TP FAILED: {e}")
                    tp_order = type('', (), {'order_id': 'tp_failed'})()

                order_ids = [order.order_id, sl_order.order_id, tp_order.order_id]

            except Exception as e:
                self._log(f"  ORDER FAILED: {e}")
                self._alert(f"ORDER FAILED {symbol} {setup.direction}: {e}")
                return
        else:
            # Paper mode
            order_ids = [f"paper_{self.scan_count}"]
            entry_price = setup.entry_price

        pos = Position(
            symbol=symbol,
            direction=setup.direction,
            entry_price=entry_price,
            amount=amount,
            stop_loss=setup.stop_loss,
            take_profit=setup.take_profit,
            entry_time=now,
            setup_confidence=setup.confidence,
            entry_scan=self.scan_count,
            order_ids=order_ids,
            best_price=entry_price,
        )
        self.positions[symbol] = pos

        msg = (f"{symbol} {'LONG' if setup.direction == 'LONG' else 'SHORT'} "
               f"@ ${entry_price:,.4f}\n"
               f"SL: ${setup.stop_loss:,.4f} | TP: ${setup.take_profit:,.4f}\n"
               f"R:R: {setup.risk_reward:.1f} | Conf: {setup.n_confirmations}\n"
               f"Size: ${position_val:,.2f} ({risk_frac:.1%} risk)\n"
               f"Mode: {self.mode.upper()}")

        self._log(f"  ENTRY: {msg}")
        self._alert(f"NEW TRADE\n{msg}")

    # ── Position Management ─────────────────────────────────────

    def _manage_positions(self):
        """Check and manage all open positions."""
        closed = []
        for key, pos in list(self.positions.items()):
            if self.mode == "paper":
                # Simulate SL/TP/timeout for paper mode
                try:
                    ticker = self.connector.fetch_ticker(pos.symbol)
                    price = float(ticker.get("last", 0) or 0)
                except Exception:
                    price = 0

                if price > 0:
                    # Check SL hit
                    if pos.direction == "LONG" and price <= pos.stop_loss:
                        self._close_position(key, pos.stop_loss, "stop_loss")
                        closed.append(key)
                        continue
                    if pos.direction == "SHORT" and price >= pos.stop_loss:
                        self._close_position(key, pos.stop_loss, "stop_loss")
                        closed.append(key)
                        continue

                    # Check TP hit
                    if pos.direction == "LONG" and price >= pos.take_profit:
                        self._close_position(key, pos.take_profit, "take_profit")
                        closed.append(key)
                        continue
                    if pos.direction == "SHORT" and price <= pos.take_profit:
                        self._close_position(key, pos.take_profit, "take_profit")
                        closed.append(key)
                        continue

                # Timeout — bars held since entry
                bars_held = self.scan_count - pos.entry_scan
                if bars_held > self.max_holding_bars:
                    exit_price = price if price > 0 else pos.entry_price
                    self._close_position(key, exit_price, "timeout")
                    closed.append(key)
            else:
                # Live mode: check if SL/TP filled on exchange
                try:
                    open_orders = self.connector.fetch_open_orders(pos.symbol)
                    if not open_orders:
                        # SL/TP orders no longer open — position likely closed
                        positions = self.connector.fetch_positions(pos.symbol)
                        if not positions:
                            # Get actual exit price from recent trades
                            try:
                                ticker = self.connector.fetch_ticker(pos.symbol)
                                exit_price = float(ticker.get("last", 0) or pos.entry_price)
                            except Exception:
                                exit_price = pos.entry_price
                            self._close_position(key, exit_price, "filled")
                            closed.append(key)
                except Exception as e:
                    self._log(f"  Position check failed for {pos.symbol}: {e}")

        for key in closed:
            del self.positions[key]

    def _close_position(self, key: str, exit_price: float, reason: str):
        """Record a closed position."""
        pos = self.positions[key]
        if pos.direction == "LONG":
            pnl_pct = (exit_price - pos.entry_price) / (pos.entry_price + 1e-9)
        else:
            pnl_pct = (pos.entry_price - exit_price) / (pos.entry_price + 1e-9)

        pnl_usd = pos.amount * pos.entry_price * pnl_pct
        self.equity += pnl_usd
        self.equity_curve.append(self.equity)

        if pnl_pct > 0:
            self.consecutive_losses = 0
        else:
            self.consecutive_losses += 1

        record = TradeRecord(
            symbol=pos.symbol,
            direction=pos.direction,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            pnl_pct=pnl_pct * 100,
            pnl_usd=pnl_usd,
            entry_time=pos.entry_time,
            exit_time=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            exit_reason=reason,
            setup_confidence=pos.setup_confidence,
        )
        self.trade_history.append(record)

        emoji = "+" if pnl_pct > 0 else ""
        self._log(f"  EXIT: CLOSED {pos.direction} {pos.symbol} | {reason} | "
                  f"PnL: {emoji}{pnl_pct * 100:.2f}% (${pnl_usd:+,.2f}) | "
                  f"Equity: ${self.equity:,.2f}")
        if self.tg:
            self.tg.send_close_alert(
                symbol=pos.symbol,
                direction=pos.direction,
                pnl_pct=pnl_pct * 100,
                pnl_usd=pnl_usd,
                reason=reason,
                equity=self.equity,
            )

    # ── Helpers ─────────────────────────────────────────────────

    def _recent_win_rate(self, n: int = 50) -> float:
        recent = self.trade_history[-n:]
        if len(recent) < 5:
            return 0.28
        return sum(1 for t in recent if t.pnl_pct > 0) / len(recent)

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {msg}")

    def _alert(self, msg: str):
        if self.tg:
            try:
                self.tg.send(msg)
            except Exception:
                pass

    def send_balance_report(self):
        """Fetch exchange balance and send to Telegram."""
        try:
            balance = self.connector.fetch_balance()
            usdt = balance.get("USDT", {})
            total = float(usdt.get("total", 0) or 0)
            free = float(usdt.get("free", 0) or 0)
            used = float(usdt.get("used", 0) or 0)
        except Exception as e:
            self._log(f"  Balance fetch failed: {e}")
            total = free = used = 0

        pos_lines = ""
        for sym, pos in self.positions.items():
            pos_lines += f"  ▸ {sym} {pos.direction} @ ${pos.entry_price:,.4f}\n"

        msg = (
            f"💰 <b>Баланс</b> [{self.mode.upper()}]\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"Всего: <b>${total:,.2f}</b>\n"
            f"Свободно: ${free:,.2f}\n"
            f"В позициях: ${used:,.2f}\n"
        )
        if self.mode == "paper":
            msg += f"Paper equity: <b>${self.equity:,.2f}</b>\n"

        if self.positions:
            msg += f"\n📊 <b>Открытые позиции ({len(self.positions)}):</b>\n{pos_lines}"
        else:
            msg += "\nНет открытых позиций"

        self._log(f"  Balance: total=${total:,.2f} free=${free:,.2f} used=${used:,.2f}")
        if self.tg:
            self.tg.send(msg)
        return total

    def _save_state(self):
        """Save state to disk for recovery."""
        state = {
            "equity": self.equity,
            "scan_count": self.scan_count,
            "positions": {k: {
                "symbol": v.symbol, "direction": v.direction,
                "entry_price": v.entry_price, "amount": v.amount,
                "stop_loss": v.stop_loss, "take_profit": v.take_profit,
                "entry_time": v.entry_time, "entry_scan": v.entry_scan,
            } for k, v in self.positions.items()},
            "trade_count": len(self.trade_history),
            "consecutive_losses": self.consecutive_losses,
        }
        self.state_file.write_text(json.dumps(state, indent=2))

    def stats(self) -> Dict:
        """Get current statistics."""
        trades = self.trade_history
        if not trades:
            return {"trades": 0, "equity": self.equity}

        wins = [t for t in trades if t.pnl_pct > 0]
        losses = [t for t in trades if t.pnl_pct <= 0]
        wr = len(wins) / len(trades) * 100
        avg_w = np.mean([t.pnl_pct for t in wins]) if wins else 0
        avg_l = np.mean([t.pnl_pct for t in losses]) if losses else 0
        pf = (sum(t.pnl_pct for t in wins) /
              abs(sum(t.pnl_pct for t in losses) or 1e-9)) if losses else 999

        return {
            "trades": len(trades),
            "win_rate": f"{wr:.1f}%",
            "avg_win": f"{avg_w:+.2f}%",
            "avg_loss": f"{avg_l:+.2f}%",
            "profit_factor": f"{pf:.2f}",
            "equity": f"${self.equity:,.2f}",
            "return": f"{(self.equity / self.capital - 1) * 100:+.1f}%",
            "open_positions": len(self.positions),
        }

