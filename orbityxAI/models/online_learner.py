"""
Online Learning v6.4
=====================
FIXES vs v6.3:
  BUG FIX #1  — `from ..config import MODEL_CFG` (relative import) — уже исправлен в v6.2.

  BUG FIX #2  — update_lgbm() создавал новый RobustScaler внутри себя, тогда как
                 LGBM был обучен на данных масштабированных ensemble.scaler.
                 Это вызывало feature-scale mismatch при каждом инкрементальном обновлении.
                 Исправлено: добавлен параметр existing_scaler=None.
                 Если передан — используется он, иначе создаётся новый (backward compat).

  BUG FIX #3 (this version) — triple_barrier_labels() возвращает 4 значения начиная
                 с labels.py v6.2, но здесь распаковывалось в 3 переменных.
                 ValueError: too many values to unpack при каждом online update.
                 Fix: labels, _, _, _ = triple_barrier_labels(c, h, l)
"""
import numpy as np
from typing import Optional, List, Deque
from collections import deque

from config import MODEL_CFG
from utils.logger import log


class SlidingWindowBuffer:

    def __init__(self, max_bars: int = 100_000):
        self.max_bars  = max_bars
        self.opens:   Deque[float] = deque(maxlen=max_bars)
        self.highs:   Deque[float] = deque(maxlen=max_bars)
        self.lows:    Deque[float] = deque(maxlen=max_bars)
        self.closes:  Deque[float] = deque(maxlen=max_bars)
        self.volumes: Deque[float] = deque(maxlen=max_bars)
        self._n_added: int = 0

    def add_bar(self, o: float, h: float, l: float, c: float, v: float) -> None:
        self.opens.append(o); self.highs.append(h)
        self.lows.append(l);  self.closes.append(c)
        self.volumes.append(v)
        self._n_added += 1

    def add_batch(
            self,
            opens: List[float], highs: List[float], lows: List[float],
            closes: List[float], volumes: List[float],
    ) -> None:
        for o, h, l, c, v in zip(opens, highs, lows, closes, volumes):
            self.add_bar(o, h, l, c, v)

    def get_arrays(self):
        return (
            np.array(self.opens),  np.array(self.highs),
            np.array(self.lows),   np.array(self.closes),
            np.array(self.volumes),
        )

    @property
    def size(self) -> int:
        return len(self.closes)

    @property
    def n_added(self) -> int:
        return self._n_added


class OnlineLearner:

    def __init__(
            self,
            update_every: int   = 100,
            window_bars:  int   = 10_000,
            decay:        float = 0.999,
    ):
        self.update_every    = update_every
        self.window_bars     = window_bars
        self.decay           = decay
        self.buffer          = SlidingWindowBuffer(
            max_bars=max(window_bars * 2, 100_000)
        )
        self._n_since_update  = 0
        self._n_updates       = 0
        self._last_logloss    = float("inf")
        self._logloss_history: List[float] = []

    def add_bars(
            self,
            opens: List[float], highs: List[float], lows: List[float],
            closes: List[float], volumes: List[float],
    ) -> bool:
        self.buffer.add_batch(opens, highs, lows, closes, volumes)
        self._n_since_update += len(closes)
        return self._n_since_update >= self.update_every

    def update_lgbm(
            self,
            lgbm_model,
            feature_engineer,
            feature_selector,
            existing_scaler=None,   # BUG FIX #2: принимаем scaler от ансамбля
    ) -> bool:
        """
        Инкрементальный рефит LightGBM.

        BUG FIX #2: если передан existing_scaler — используем его для
        масштабирования новых данных, чтобы признаки были в том же
        пространстве что и при исходном обучении модели.

        BUG FIX #3: triple_barrier_labels возвращает 4 значения — правильная распаковка.
        """
        try:
            import lightgbm as lgb
        except ImportError:
            log.warning("[Online] LightGBM недоступен")
            return False

        if self.buffer.size < 200:
            log.warning(f"[Online] Мало данных в буфере: {self.buffer.size}")
            return False

        o, h, l, c, v = self.buffer.get_arrays()

        if len(c) > self.window_bars:
            start = len(c) - self.window_bars
            o, h, l, c, v = o[start:], h[start:], l[start:], c[start:], v[start:]

        from models.labels import triple_barrier_labels, combined_weights
        from sklearn.preprocessing import RobustScaler

        try:
            X = feature_engineer.build(o, h, l, c, v)

            # BUG FIX #3: правильная распаковка 4 значений
            labels, _, _, _ = triple_barrier_labels(c, h, l)

            sw = combined_weights(labels, decay=self.decay)

            if (feature_selector is not None
                    and feature_selector.selected_mask is not None):
                X_sel = feature_selector.transform(X)
            else:
                X_sel = X

            yc = (labels == 1).astype(int)
            nn = labels != 0

            if nn.sum() < 100:
                log.warning(f"[Online] Мало не-нейтральных: {nn.sum()}")
                return False

            sw_adj = sw.copy()
            sw_adj[labels == 0] *= 0.30

            # BUG FIX #2: используем existing_scaler если передан
            if existing_scaler is not None:
                try:
                    Xs = existing_scaler.transform(X_sel)
                    log.info("[Online] Используем ensemble.scaler для масштабирования")
                except Exception as e:
                    log.warning(f"[Online] existing_scaler.transform: {e} — создаём новый")
                    scaler = RobustScaler()
                    Xs = scaler.fit_transform(X_sel)
            else:
                scaler = RobustScaler()
                Xs = scaler.fit_transform(X_sel)

            lgbm_model.fit(
                Xs[nn], yc[nn],
                sample_weight=sw_adj[nn],
                init_model=lgbm_model,
            )

            self._n_updates      += 1
            self._n_since_update  = 0
            log.info(
                f"[Online] LGBM обновлён #{self._n_updates}: "
                f"{nn.sum()} примеров, {self.buffer.size} баров в буфере"
            )
            return True

        except Exception as e:
            log.warning(f"[Online] Ошибка обновления: {e}")
            return False

    def needs_full_retrain(
            self,
            current_logloss: float,
            threshold: float = 0.05,
    ) -> bool:
        self._logloss_history.append(current_logloss)
        if len(self._logloss_history) < 5:
            self._last_logloss = current_logloss
            return False
        baseline = min(self._logloss_history[:5])
        if current_logloss > baseline + threshold:
            log.warning(
                f"[Online] Деградация: LL={current_logloss:.4f} "
                f"vs baseline={baseline:.4f} → нужно полное переобучение"
            )
            return True
        return False

    @property
    def stats(self) -> dict:
        return {
            "buffer_size":    self.buffer.size,
            "total_bars":     self.buffer.n_added,
            "n_updates":      self._n_updates,
            "since_update":   self._n_since_update,
            "next_update_in": max(0, self.update_every - self._n_since_update),
        }