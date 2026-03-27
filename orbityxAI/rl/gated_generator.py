"""
RL-Gated Signal Generator v6.1
================================
RL агент интегрирован прямо в пайплайн генерации сигналов.

Как работает:
  1. Модель генерирует сигнал с confidence и direction
  2. RL агент смотрит на ситуацию: режим рынка, RSI, ATR, ADX
  3. На основе СВОЕГО ОПЫТА (предыдущих сделок) принимает решение:
     - action=0: пропустить (агент видел что в этой ситуации теряют)
     - action=1: войти с полным размером
     - action=2: войти с половинным размером
  4. Если агент говорит пропустить → сигнал = NEUTRAL
  5. После закрытия сделки → agent.learn_from_trade() → агент умнеет

Пример чему учится агент:
  "Когда RSI > 75 + VOLATILE режим → 70% убыточных входов"
  → следующий раз пропускает такие сигналы

  "Когда ADX > 30 + TREND_UP + conf > 0.62 → 68% прибыльных"
  → следующий раз входит с полным размером
"""
import numpy as np
from typing import Optional, Tuple
from dataclasses import dataclass
from utils.logger import log


@dataclass
class GatedSignal:
    """Сигнал прошедший через RL фильтр."""
    original_direction:  str    # что сказала ML модель
    original_confidence: float

    rl_action:     int    # 0=skip, 1=full, 2=half
    rl_size_scale: float  # множитель размера позиции
    rl_gate:       str    # "PASS" / "REDUCE" / "SKIP"

    final_direction:  str    # итоговое направление (NEUTRAL если skip)
    final_confidence: float  # итоговая уверенность

    reason: str = ""


class RLGatedGenerator:
    """
    Обёртка над SignalGenerator которая добавляет RL фильтрацию.

    На старте (мало опыта):
      - epsilon=0.15: 15% сделок агент исследует (случайное решение)
      - остальные 85%: жадная стратегия по Q-функции

    После 100+ сделок:
      - epsilon снижается до 0.05
      - агент использует накопленный опыт
    """

    def __init__(self, rl_agent, min_trades_to_activate: int = 30):
        """
        min_trades_to_activate: сколько сделок нужно прежде чем RL начнёт фильтровать.
        До этого агент обучается но не блокирует сигналы.
        """
        self.agent = rl_agent
        self.min_trades = min_trades_to_activate
        self._n_processed = 0
        self._n_skipped   = 0
        self._n_reduced   = 0

    def gate(
            self,
            direction:  str,
            confidence: float,
            regime:     int,
            rsi:        float,
            atr_pct:    float,
            adx:        float = 25.0,
            force_pass: bool = False,
    ) -> GatedSignal:
        """
        Пропустить сигнал через RL фильтр.

        force_pass=True: игнорировать RL (для backtest без RL).
        """
        self._n_processed += 1

        # Пока мало опыта → пропускаем все сигналы но учимся
        if force_pass or self.agent.memory.size < self.min_trades:
            return GatedSignal(
                original_direction=direction,
                original_confidence=confidence,
                rl_action=1,
                rl_size_scale=1.0,
                rl_gate="PASS",
                final_direction=direction,
                final_confidence=confidence,
                reason=f"накопление опыта ({self.agent.memory.size}/{self.min_trades})",
            )

        # RL решение
        action, size_scale = self.agent.decide(
            confidence=confidence,
            regime=regime,
            rsi=rsi,
            atr_pct=atr_pct,
            adx=adx,
        )

        if action == 0:
            # Агент говорит пропустить
            self._n_skipped += 1
            skip_rate = self._n_skipped / self._n_processed
            return GatedSignal(
                original_direction=direction,
                original_confidence=confidence,
                rl_action=0,
                rl_size_scale=0.0,
                rl_gate="SKIP",
                final_direction="NEUTRAL",
                final_confidence=0.0,
                reason=f"RL skip (skip_rate={skip_rate:.1%})",
            )
        elif action == 2:
            # Половинный размер
            self._n_reduced += 1
            return GatedSignal(
                original_direction=direction,
                original_confidence=confidence,
                rl_action=2,
                rl_size_scale=0.5,
                rl_gate="REDUCE",
                final_direction=direction,
                final_confidence=confidence * 0.8,
                reason="RL reduce (половинный размер)",
            )
        else:
            # Полный размер
            return GatedSignal(
                original_direction=direction,
                original_confidence=confidence,
                rl_action=1,
                rl_size_scale=1.0,
                rl_gate="PASS",
                final_direction=direction,
                final_confidence=confidence,
                reason="RL pass",
            )

    def stats(self) -> dict:
        if self._n_processed == 0:
            return {}
        return {
            "processed":  self._n_processed,
            "skipped":    self._n_skipped,
            "reduced":    self._n_reduced,
            "passed":     self._n_processed - self._n_skipped - self._n_reduced,
            "skip_rate":  round(self._n_skipped / self._n_processed, 3),
            "reduce_rate": round(self._n_reduced / self._n_processed, 3),
            "rl_experience": self.agent.memory.size,
        }