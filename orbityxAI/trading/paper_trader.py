"""
Paper Trading Engine v6
=======================
Демо-режим торговли на фьючерсах Binance в реальном времени.

Возможности:
  - Виртуальный баланс (без реальных денег)
  - WebSocket поток реальных цен
  - Автоматические входы по сигналам модели
  - Логирование всех сделок
  - Статистика в реальном времени
"""
import asyncio
import json
import time
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import httpx

from utils.logger import log


@dataclass
class PaperPosition:
    symbol:      str
    direction:   str        # LONG или SHORT
    entry_price: float
    size:        float      # в базовой валюте
    stop_loss:   float
    take_profit1: float
    take_profit2: float
    take_profit3: float
    confidence:  float
    open_time:   float = field(default_factory=time.time)
    pnl_pct:     float = 0.0
    pnl_usd:     float = 0.0
    status:      str = "OPEN"   # OPEN, TP1, TP2, TP3, SL, CLOSED


@dataclass
class TradeResult:
    symbol:      str
    direction:   str
    entry_price: float
    exit_price:  float
    pnl_pct:     float
    pnl_usd:     float
    duration_s:  float
    exit_reason: str
    confidence:  float


class PaperTrader:
    """
    Виртуальный торговый движок.
    Обучается на своих же сделках — каждая сделка это урок.
    """

    def __init__(self, initial_balance: float = 10_000.0):
        self.balance          = initial_balance
        self.initial_balance  = initial_balance
        self.positions:       Dict[str, PaperPosition] = {}
        self.closed_trades:   List[TradeResult] = []
        self.current_prices:  Dict[str, float] = {}

        # Статистика для обучения RL агента
        self.trade_memory: List[dict] = []

    # ─────────────────────────────────────────────────────────
    #  Управление позициями
    # ─────────────────────────────────────────────────────────

    def open_position(self, symbol: str, direction: str,
                      price: float, stop_loss: float,
                      take_profit1: float, take_profit2: float,
                      take_profit3: float, confidence: float,
                      risk_pct: float = 0.02) -> bool:
        """Открыть виртуальную позицию."""
        if symbol in self.positions:
            log.info(f"[Paper] {symbol}: позиция уже открыта")
            return False

        if len(self.positions) >= 5:
            log.info(f"[Paper] Достигнут лимит 5 позиций")
            return False

        risk_amount = self.balance * risk_pct
        risk_dist   = abs(price - stop_loss)
        if risk_dist < 1e-9:
            return False

        size = risk_amount / risk_dist
        position_value = size * price
        if position_value > self.balance * 0.20:
            size = (self.balance * 0.20) / price

        pos = PaperPosition(
            symbol=symbol, direction=direction,
            entry_price=price, size=size,
            stop_loss=stop_loss,
            take_profit1=take_profit1,
            take_profit2=take_profit2,
            take_profit3=take_profit3,
            confidence=confidence,
        )
        self.positions[symbol] = pos
        log.info(f"[Paper] ОТКРЫТО {direction} {symbol} @ {price:.2f} "
                 f"SL={stop_loss:.2f} TP1={take_profit1:.2f} "
                 f"size={size:.4f} conf={confidence:.1%}")
        return True

    def update_price(self, symbol: str, price: float) -> Optional[TradeResult]:
        """Обновить цену и проверить срабатывание стопов/тейков."""
        self.current_prices[symbol] = price
        if symbol not in self.positions:
            return None

        pos = self.positions[symbol]
        pos.pnl_pct = ((price - pos.entry_price) / pos.entry_price
                       if pos.direction == "LONG"
                       else (pos.entry_price - price) / pos.entry_price)
        pos.pnl_usd = pos.pnl_pct * pos.size * pos.entry_price

        # Проверка стопа
        if pos.direction == "LONG" and price <= pos.stop_loss:
            return self._close_position(symbol, price, "SL")
        if pos.direction == "SHORT" and price >= pos.stop_loss:
            return self._close_position(symbol, price, "SL")

        # Проверка TP1
        if pos.direction == "LONG" and price >= pos.take_profit1:
            return self._close_position(symbol, price, "TP1")
        if pos.direction == "SHORT" and price <= pos.take_profit1:
            return self._close_position(symbol, price, "TP1")

        return None

    def _close_position(self, symbol: str, exit_price: float,
                        reason: str) -> TradeResult:
        pos = self.positions.pop(symbol)
        pnl_pct = ((exit_price - pos.entry_price) / pos.entry_price
                   if pos.direction == "LONG"
                   else (pos.entry_price - exit_price) / pos.entry_price)
        pnl_usd = pnl_pct * pos.size * pos.entry_price

        # Вычитаем комиссию (0.04% × 2 = 0.08% round-trip)
        fee = pos.size * pos.entry_price * 0.0008
        pnl_usd -= fee

        self.balance += pnl_usd
        self.balance  = max(self.balance, 0.01)

        result = TradeResult(
            symbol=symbol, direction=pos.direction,
            entry_price=pos.entry_price, exit_price=exit_price,
            pnl_pct=round(pnl_pct, 5), pnl_usd=round(pnl_usd, 2),
            duration_s=round(time.time() - pos.open_time, 0),
            exit_reason=reason, confidence=pos.confidence,
        )
        self.closed_trades.append(result)

        # Записываем урок для RL агента
        self.trade_memory.append({
            "symbol":     symbol,
            "direction":  pos.direction,
            "entry":      pos.entry_price,
            "exit":       exit_price,
            "pnl_pct":    pnl_pct,
            "confidence": pos.confidence,
            "reason":     reason,
            "win":        pnl_usd > 0,
            "timestamp":  time.time(),
        })

        emoji = "✅" if pnl_usd > 0 else "❌"
        log.info(f"[Paper] {emoji} ЗАКРЫТО {pos.direction} {symbol} @ {exit_price:.2f} "
                 f"({reason}) PnL: {pnl_pct:+.2%} / ${pnl_usd:+.2f} "
                 f"Баланс: ${self.balance:.2f}")
        return result

    # ─────────────────────────────────────────────────────────
    #  Статистика
    # ─────────────────────────────────────────────────────────

    def stats(self) -> dict:
        if not self.closed_trades:
            return {
                "trades": 0, "wins": 0, "losses": 0,
                "win_rate": 0.0, "total_pnl": 0.0,
                "balance": round(self.balance, 2),
                "return": 0.0,
                "avg_win": 0.0, "avg_loss": 0.0,
                "open_positions": len(self.positions),
            }

        wins   = [t for t in self.closed_trades if t.pnl_usd > 0]
        losses = [t for t in self.closed_trades if t.pnl_usd <= 0]
        total_pnl = sum(t.pnl_usd for t in self.closed_trades)
        win_rate  = len(wins) / len(self.closed_trades)

        return {
            "trades":    len(self.closed_trades),
            "wins":      len(wins),
            "losses":    len(losses),
            "win_rate":  round(win_rate, 3),
            "total_pnl": round(total_pnl, 2),
            "balance":   round(self.balance, 2),
            "return":    round((self.balance - self.initial_balance) / self.initial_balance, 4),
            "avg_win":   round(np.mean([t.pnl_pct for t in wins]), 4)   if wins   else 0.0,
            "avg_loss":  round(np.mean([t.pnl_pct for t in losses]), 4) if losses else 0.0,
            "open_positions": len(self.positions),
        }

    def print_stats(self):
        s = self.stats()
        print(f"\n{'═'*50}")
        print(f"  Paper Trading Статистика")
        print(f"{'═'*50}")
        print(f"  Баланс:      ${s['balance']:>10.2f}")
        print(f"  Доходность:  {s['return']:>+10.1%}")
        print(f"  Сделок:      {s['trades']:>10}")
        print(f"  Win Rate:    {s['win_rate']:>10.1%}")
        print(f"  PnL:         ${s['total_pnl']:>+10.2f}")
        print(f"  Открытых:    {s['open_positions']:>10}")
        print(f"{'═'*50}\n")


class WebSocketPriceFeed:
    """
    Простой WebSocket клиент для получения реальных цен с Binance.
    """

    def __init__(self, symbols: List[str], callback):
        self.symbols  = [s.lower() for s in symbols]
        self.callback = callback
        self._running = False

    async def start(self):
        """Запустить поток цен."""
        streams = "/".join(f"{s}@aggTrade" for s in self.symbols)
        url     = f"wss://fstream.binance.com/stream?streams={streams}"
        self._running = True

        while self._running:
            try:
                async with httpx.AsyncClient() as client:
                    # httpx не поддерживает WSS напрямую — используем websockets
                    try:
                        import websockets
                        async with websockets.connect(url) as ws:
                            log.info(f"WebSocket подключён: {len(self.symbols)} пар")
                            async for msg in ws:
                                if not self._running:
                                    break
                                data = json.loads(msg)
                                stream_data = data.get("data", data)
                                symbol = stream_data.get("s", "").upper()
                                price  = float(stream_data.get("p", 0))
                                if symbol and price > 0:
                                    await self.callback(symbol, price)
                    except ImportError:
                        log.warning("websockets не установлен. pip install websockets")
                        await asyncio.sleep(5)
                        # Fallback: REST polling каждые 5 секунд
                        await self._rest_fallback()
            except Exception as e:
                log.error(f"WebSocket ошибка: {e}. Переподключение через 5 сек…")
                await asyncio.sleep(5)

    async def _rest_fallback(self):
        """Если WebSocket недоступен — опрашиваем REST каждые 5 секунд."""
        url = "https://fapi.binance.com/fapi/v1/ticker/price"
        async with httpx.AsyncClient(timeout=5) as client:
            while self._running:
                try:
                    for sym in self.symbols:
                        r = await client.get(url, params={"symbol": sym.upper()})
                        data = r.json()
                        price = float(data.get("price", 0))
                        if price > 0:
                            await self.callback(sym.upper(), price)
                    await asyncio.sleep(5)
                except Exception:
                    await asyncio.sleep(10)

    def stop(self):
        self._running = False