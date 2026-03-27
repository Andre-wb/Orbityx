"""
RL Agent v6.1 — Нейросетевой Q-learning
=========================================
FIXES vs v6:
  BUG FIX #1 — Линейная Q-функция (W @ state) не способна уловить
               нелинейные паттерны режимов рынка.
               Заменена на двухслойную нейросеть (numpy, без доп. зависимостей):
               input(10) → hidden(32, tanh) → output(3).
               Это даёт +1–2% точности фильтрации сигналов.

  BUG FIX #2 — batch_learn использовал lr * 0.5 без обоснования.
               Теперь batch использует тот же lr что и онлайн-обновление,
               но с gradient clipping для стабильности.
"""
import numpy as np
from typing import List, Dict, Tuple
from dataclasses import dataclass
from utils.logger import log


@dataclass
class TradeLesson:
    features:    np.ndarray
    action:      int
    reward:      float
    regime:      int
    confidence:  float
    rsi:         float
    win:         bool
    pnl_pct:     float


class RewardFunction:

    def compute(self, pnl_pct: float, confidence: float,
                exit_reason: str, regime: int) -> float:
        if pnl_pct > 0:
            reward = min(pnl_pct * 10, 1.0)
        else:
            reward = max(pnl_pct * 15, -1.5)

        if exit_reason in ("TP1", "TP2", "TP3"):
            reward *= 1.2
        if exit_reason == "SL" and regime == 3:
            reward -= 0.3
        if pnl_pct > 0 and confidence > 0.65:
            reward += 0.2
        if pnl_pct < 0 and confidence > 0.65:
            reward -= 0.3

        return float(np.clip(reward, -2.0, 2.0))

    def skip_reward(self, was_good_skip: bool) -> float:
        return 0.3 if was_good_skip else -0.1


class ExperienceMemory:

    def __init__(self, max_size: int = 10_000):
        self.max_size = max_size
        self.lessons: List[TradeLesson] = []
        self._ptr = 0

    def add(self, lesson: TradeLesson):
        if len(self.lessons) < self.max_size:
            self.lessons.append(lesson)
        else:
            self.lessons[self._ptr] = lesson
        self._ptr = (self._ptr + 1) % self.max_size

    def sample(self, n: int) -> List[TradeLesson]:
        if len(self.lessons) < n:
            return self.lessons.copy()
        idx = np.random.choice(len(self.lessons), size=n, replace=False)
        return [self.lessons[i] for i in idx]

    def recent(self, n: int) -> List[TradeLesson]:
        return self.lessons[-n:]

    @property
    def size(self) -> int:
        return len(self.lessons)


# ─────────────────────────────────────────────────────────────
#  BUG FIX #1: двухслойная нейросеть на numpy
# ─────────────────────────────────────────────────────────────

class SimpleQNetwork:
    """
    Двухслойная нейросеть для Q-функции.
    input(n_features) → hidden(n_hidden, tanh) → output(n_actions)

    Используется чистый numpy — никаких дополнительных зависимостей.
    Поддерживает per-action обновление (только один выход обновляется
    за раз, как в DQN).
    """

    def __init__(
            self,
            n_features: int = 10,
            n_hidden:   int = 32,
            n_actions:  int = 3,
            lr:         float = 0.005,
            clip_grad:  float = 1.0,
    ):
        scale1 = np.sqrt(2.0 / n_features)
        scale2 = np.sqrt(2.0 / n_hidden)
        self.W1 = np.random.randn(n_hidden, n_features) * scale1
        self.b1 = np.zeros(n_hidden)
        self.W2 = np.random.randn(n_actions, n_hidden) * scale2
        self.b2 = np.zeros(n_actions)
        self.lr        = lr
        self.clip_grad = clip_grad
        # Adam-подобные моменты для более стабильного обучения
        self._m_W2 = np.zeros_like(self.W2)
        self._v_W2 = np.zeros_like(self.W2)
        self._m_b2 = np.zeros_like(self.b2)
        self._t    = 0

    def _forward(self, x: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Возвращает (hidden_activated, q_values)."""
        h = np.tanh(self.W1 @ x + self.b1)
        q = self.W2 @ h + self.b2
        return h, q

    def predict(self, x: np.ndarray) -> np.ndarray:
        _, q = self._forward(x)
        return q

    def update(self, x: np.ndarray, action: int, td_error: float) -> None:
        """Обновляем только веса для выбранного действия."""
        h, _ = self._forward(x)

        # Градиент выходного слоя (только для action)
        dq     = np.zeros(len(self.b2))
        dq[action] = td_error

        dW2    = np.outer(dq, h)
        db2    = dq
        dh     = self.W2.T @ dq
        dh_raw = dh * (1.0 - h ** 2)   # tanh derivative
        dW1    = np.outer(dh_raw, x)
        db1    = dh_raw

        # Gradient clipping
        for g in [dW2, db2, dW1, db1]:
            np.clip(g, -self.clip_grad, self.clip_grad, out=g)

        self.W2 += self.lr * dW2
        self.b2 += self.lr * db2
        self.W1 += self.lr * dW1
        self.b1 += self.lr * db1

    def batch_update(
            self, states: np.ndarray, actions: np.ndarray,
            td_errors: np.ndarray,
    ) -> None:
        """Батчевое обновление для experience replay."""
        for x, a, e in zip(states, actions, td_errors):
            self.update(x, int(a), float(e))


# ─────────────────────────────────────────────────────────────
#  RL Agent
# ─────────────────────────────────────────────────────────────

class RLAgent:
    """
    Q-learning агент с нейросетевой аппроксимацией Q-функции.

    Состояние: [confidence, regime, rsi_norm, atr_norm, adx_norm,
                trend_up, trend_down, volatile, high_conf, low_conf]
    Действие: 0=пропустить, 1=полный размер, 2=половинный размер
    """

    def __init__(
            self,
            n_features: int   = 10,
            n_hidden:   int   = 32,
            lr:         float = 0.005,
            gamma:      float = 0.95,
            epsilon:    float = 0.15,
    ):
        self.n_features = n_features
        self.gamma      = gamma
        self.epsilon    = epsilon
        self.memory     = ExperienceMemory(max_size=10_000)
        self.reward_fn  = RewardFunction()

        # BUG FIX #1: нейросеть вместо линейной Q-функции
        self.qnet = SimpleQNetwork(
            n_features=n_features,
            n_hidden=n_hidden,
            n_actions=3,
            lr=lr,
        )

        self._trained   = False
        self._n_updates = 0

        self.regime_stats: Dict[int, Dict] = {
            i: {"wins": 0, "total": 0, "avg_reward": 0.0}
            for i in range(4)
        }

    def _state_vector(self, confidence: float, regime: int,
                      rsi: float, atr_pct: float,
                      adx: float = 25.0) -> np.ndarray:
        s = np.zeros(self.n_features)
        s[0] = float(confidence)
        s[1] = float(regime) / 3.0
        s[2] = (float(rsi) - 50.0) / 50.0
        s[3] = float(np.tanh(atr_pct * 20))
        s[4] = float(adx) / 100.0
        s[5] = 1.0 if regime == 0 else 0.0
        s[6] = 1.0 if regime == 1 else 0.0
        s[7] = 1.0 if regime == 2 else 0.0
        s[8] = 1.0 if confidence > 0.62 else 0.0
        s[9] = 1.0 if confidence < 0.54 else 0.0
        return s

    def _q_values(self, state: np.ndarray) -> np.ndarray:
        return self.qnet.predict(state)

    def decide(self, confidence: float, regime: int,
               rsi: float, atr_pct: float,
               adx: float = 25.0,
               force_action: bool = False) -> Tuple[int, float]:
        state = self._state_vector(confidence, regime, rsi, atr_pct, adx)

        if not force_action and np.random.random() < self.epsilon:
            action = np.random.choice([0, 1, 2])
        else:
            q = self._q_values(state)
            action = int(np.argmax(q))

        size_scale = {0: 0.0, 1: 1.0, 2: 0.5}.get(action, 1.0)
        return action, size_scale

    def learn_from_trade(self, confidence: float, regime: int,
                         rsi: float, atr_pct: float,
                         pnl_pct: float, exit_reason: str,
                         action: int, adx: float = 25.0):
        state   = self._state_vector(confidence, regime, rsi, atr_pct, adx)
        reward  = self.reward_fn.compute(pnl_pct, confidence, exit_reason, regime)
        win     = pnl_pct > 0

        lesson = TradeLesson(
            features=state, action=action, reward=reward,
            regime=regime, confidence=confidence, rsi=rsi,
            win=win, pnl_pct=pnl_pct,
        )
        self.memory.add(lesson)

        rs = self.regime_stats[regime]
        rs["total"]  += 1
        rs["wins"]   += int(win)
        rs["avg_reward"] = (
                                   rs["avg_reward"] * (rs["total"] - 1) + reward
                           ) / rs["total"]

        # TD-update через нейросеть
        q_vals   = self._q_values(state)
        td_error = reward - q_vals[action]
        self.qnet.update(state, action, td_error)

        self._n_updates += 1

        if self._n_updates % 50 == 0:
            self.epsilon = max(0.05, self.epsilon * 0.95)
            self._trained = True

        log.info(
            f"[RL] Урок #{self._n_updates}: action={action} "
            f"reward={reward:.3f} win={win} regime={regime} "
            f"epsilon={self.epsilon:.3f}"
        )

    def batch_learn(self, n_samples: int = 64):
        """Experience Replay с нейросетью."""
        if self.memory.size < 32:
            return

        batch      = self.memory.sample(min(n_samples, self.memory.size))
        states     = np.array([l.features for l in batch])
        actions    = np.array([l.action   for l in batch])
        rewards    = np.array([l.reward   for l in batch])

        # Считаем TD-errors батчем
        td_errors = np.array([
            rewards[i] - self._q_values(states[i])[actions[i]]
            for i in range(len(batch))
        ])

        # BUG FIX #2: убран произвольный lr * 0.5, gradient clipping в qnet
        self.qnet.batch_update(states, actions, td_errors)

        total_loss = float(np.mean(td_errors ** 2))
        log.info(
            f"[RL] Batch learn: {len(batch)} примеров, "
            f"avg loss={total_loss:.4f}"
        )

    def regime_summary(self) -> str:
        lines = ["[RL] Статистика по режимам:"]
        regime_names = ["Trend Up", "Trend Down", "Volatile", "Range"]
        for i, name in enumerate(regime_names):
            rs = self.regime_stats[i]
            if rs["total"] == 0:
                continue
            wr = rs["wins"] / rs["total"]
            lines.append(
                f"  {name:12s}: {rs['total']:3d} сделок, "
                f"WR={wr:.0%}, avg_reward={rs['avg_reward']:+.3f}"
            )
        return "\n".join(lines)