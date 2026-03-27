"""
Regime-Separated Ensemble  v1.0
=================================
Обёртка над StackingEnsemble которая обучает отдельный ансамбль
для каждого из 4 режимов рынка + один глобальный ансамбль как fallback.

Архитектура:
  _global_model       — обучен на ВСЕХ барах (fallback когда режим неизвестен
                        или когда в режиме недостаточно данных)
  _regime_models[r]   — обучен только на барах режима r (r ∈ {0,1,2,3})

  При инференсе:
    1. Определяем текущий режим (приходит снаружи как regime_int)
    2. Если для этого режима есть обученная модель → используем её
    3. Иначе → global fallback

Почему это точнее единой модели:
  Модель в TREND_UP видит только бычьи тренды — учит именно паттерны тренда.
  Модель в VOLATILE видит только дислокации — учит паттерны волатильности.
  Единая модель вынуждена компромиссировать между всеми режимами сразу.

Минимальный порог для обучения отдельной модели:
  MIN_NON_NEUTRAL_PER_REGIME = 300 не-нейтральных баров.
  Меньше → недостаточно для надёжного OOF → используем global.

Интерфейс полностью совместим с StackingEnsemble:
  .predict(), .get_p_correct(), .fit(), .save(), .load()
  .oof_logloss, .oof_brier, .reg_rmse, .scaler, .conformal, ._trained
"""
from __future__ import annotations

import numpy as np
from typing import Optional, Dict, Tuple

from models.ensemble import StackingEnsemble
from utils.logger import log

try:
    import joblib; JOBLIB = True
except ImportError:
    JOBLIB = False

# Минимум non-neutral баров чтобы обучить отдельную режимную модель
MIN_NON_NEUTRAL_PER_REGIME = 300

# Имена режимов для логов
_REGIME_NAMES = {0: "TREND_UP", 1: "TREND_DOWN", 2: "VOLATILE", 3: "RANGE"}


class RegimeEnsemble:

    def __init__(self):
        # Глобальная модель — обучена на всех данных, используется как fallback
        self._global_model       = StackingEnsemble()

        # Режимные модели: ключ = int(Regime), значение = StackingEnsemble
        self._regime_models:   Dict[int, StackingEnsemble] = {}

        # Флаги: обучена ли модель для данного режима
        self._regime_trained:  Dict[int, bool] = {r: False for r in range(4)}

        # Статистика: сколько баров в каждом режиме
        self._regime_n_samples: Dict[int, int] = {}
        self._regime_n_nn:      Dict[int, int] = {}

    # ── Properties (совместимость с StackingEnsemble) ────────────────────

    @property
    def _trained(self) -> bool:
        return self._global_model._trained

    @property
    def scaler(self):
        """Scaler глобальной модели — для диагностики в engine.py."""
        return self._global_model.scaler

    @property
    def conformal(self):
        """Конформный предиктор глобальной модели."""
        return self._global_model.conformal

    @property
    def oof_logloss(self) -> float:
        """
        Взвешенное среднее OOF logloss по режимным моделям.
        Если нет режимных моделей — возвращает global OOF logloss.

        Взвешивание по количеству non-neutral баров в режиме.
        """
        trained_regimes = [r for r in range(4) if self._regime_trained.get(r, False)]

        if not trained_regimes:
            return self._global_model.oof_logloss

        total_nn = sum(self._regime_n_nn.get(r, 0) for r in trained_regimes)
        if total_nn == 0:
            return self._global_model.oof_logloss

        weighted_ll = sum(
            self._regime_models[r].oof_logloss * self._regime_n_nn.get(r, 0)
            for r in trained_regimes
        )
        return weighted_ll / total_nn

    @property
    def oof_brier(self) -> float:
        trained_regimes = [r for r in range(4) if self._regime_trained.get(r, False)]
        if not trained_regimes:
            return self._global_model.oof_brier
        total_nn = sum(self._regime_n_nn.get(r, 0) for r in trained_regimes)
        if total_nn == 0:
            return self._global_model.oof_brier
        weighted = sum(
            self._regime_models[r].oof_brier * self._regime_n_nn.get(r, 0)
            for r in trained_regimes
        )
        return weighted / total_nn

    @property
    def reg_rmse(self) -> float:
        # Возвращаем global reg_rmse — наиболее стабильная оценка
        return self._global_model.reg_rmse

    # ── Model selection helper ────────────────────────────────────────────

    def _get_model(self, regime_int: Optional[int]) -> StackingEnsemble:
        """
        Выбрать подходящую модель для данного режима.
        Если режимная модель не обучена → global fallback.
        """
        if (regime_int is not None
                and self._regime_trained.get(regime_int, False)
                and regime_int in self._regime_models):
            return self._regime_models[regime_int]
        return self._global_model

    # ── FIT ──────────────────────────────────────────────────────────────

    def fit(
            self,
            X:             np.ndarray,
            labels:        np.ndarray,
            fwd_ret:       np.ndarray,
            sample_weight: Optional[np.ndarray] = None,
            regime_arr:    Optional[np.ndarray] = None,
    ) -> "RegimeEnsemble":
        """
        Обучение: сначала глобальная модель, затем режимные.

        Parameters
        ----------
        X             : (N, F) матрица признаков (уже отобранных selector'ом)
        labels        : (N,)   метки {-1, 0, +1}
        fwd_ret       : (N,)   форвардные логдоходности
        sample_weight : (N,)   веса баров (опционально)
        regime_arr    : (N,)   int{0,1,2,3} режим каждого бара (опционально).
                               Если None — обучается только global модель.
        """
        n_total = len(labels)
        n_nn    = int((labels != 0).sum())

        log.info(
            f"[RegimeEnsemble] Обучаем global модель: "
            f"{n_total} баров, {n_nn} не-нейтральных"
        )

        # ── Шаг 1: Глобальная модель (всегда) ───────────────────────────
        self._global_model.fit(
            X, labels, fwd_ret,
            sample_weight=sample_weight,
            regime_arr=regime_arr,
        )
        log.info(
            f"[RegimeEnsemble] Global OOF LL={self._global_model.oof_logloss:.4f}"
        )

        # ── Шаг 2: Режимные модели (если передан regime_arr) ────────────
        if regime_arr is None:
            log.info("[RegimeEnsemble] regime_arr=None → только global модель")
            return self

        for r in range(4):
            regime_name = _REGIME_NAMES.get(r, str(r))
            mask        = regime_arr == r
            n_r         = int(mask.sum())
            labels_r    = labels[mask]
            n_nn_r      = int((labels_r != 0).sum())

            self._regime_n_samples[r] = n_r
            self._regime_n_nn[r]      = n_nn_r

            if n_nn_r < MIN_NON_NEUTRAL_PER_REGIME:
                log.info(
                    f"[RegimeEnsemble] {regime_name}: {n_r} баров, "
                    f"{n_nn_r} не-нейтральных < {MIN_NON_NEUTRAL_PER_REGIME} "
                    f"→ пропускаем (используем global)"
                )
                self._regime_trained[r] = False
                continue

            X_r   = X[mask]
            fwd_r = fwd_ret[mask]
            sw_r  = sample_weight[mask] if sample_weight is not None else None

            log.info(
                f"[RegimeEnsemble] {regime_name}: обучаем на "
                f"{n_r} барах ({n_nn_r} не-нейтральных)…"
            )

            try:
                model_r = StackingEnsemble()
                # Передаём regime_arr для per-regime конформной калибровки
                # внутри каждого ансамбля (все бары в этом режиме → 1 тип)
                model_r.fit(X_r, labels_r, fwd_r, sample_weight=sw_r)
                self._regime_models[r] = model_r
                self._regime_trained[r] = True

                log.info(
                    f"[RegimeEnsemble] {regime_name} OOF LL="
                    f"{model_r.oof_logloss:.4f}"
                )
            except Exception as e:
                log.warning(
                    f"[RegimeEnsemble] {regime_name}: ошибка обучения: {e} "
                    f"→ fallback на global"
                )
                self._regime_trained[r] = False

        # Итоговый отчёт
        trained_names = [
            _REGIME_NAMES[r] for r in range(4)
            if self._regime_trained.get(r, False)
        ]
        log.info(
            f"[RegimeEnsemble] Готово. "
            f"Режимные модели: {trained_names or 'нет (только global)'}\n"
            f"  Global OOF LL:   {self._global_model.oof_logloss:.4f}\n"
            f"  Weighted OOF LL: {self.oof_logloss:.4f}"
        )
        return self

    # ── PREDICT ──────────────────────────────────────────────────────────

    def predict(
            self,
            X_row:      np.ndarray,
            weights:    Optional[dict] = None,
            regime_int: Optional[int]  = None,
    ) -> Tuple[float, str, float, float]:
        model = self._get_model(regime_int)
        return model.predict(X_row, weights=weights, regime_int=regime_int)

    def get_p_correct(
            self,
            X_row:      np.ndarray,
            prob_up:    float,
            regime_int: Optional[int] = None,
    ) -> float:
        """MetaClassifier p_correct из подходящей модели."""
        model = self._get_model(regime_int)
        return model.get_p_correct(X_row, prob_up, regime_int)

    # ── Diagnostics ──────────────────────────────────────────────────────

    def feature_importance(self) -> Optional[np.ndarray]:
        return self._global_model.feature_importance()

    def regime_report(self) -> str:
        """Читаемый отчёт по режимным моделям."""
        lines = ["RegimeEnsemble Report:"]
        lines.append(
            f"  Global:  OOF LL={self._global_model.oof_logloss:.4f}"
        )
        for r in range(4):
            name = _REGIME_NAMES.get(r, str(r))
            n    = self._regime_n_samples.get(r, 0)
            n_nn = self._regime_n_nn.get(r, 0)
            if self._regime_trained.get(r, False):
                ll   = self._regime_models[r].oof_logloss
                lines.append(
                    f"  {name:<12}: {n:>7} bars, {n_nn:>6} non-neutral "
                    f"→ TRAINED  OOF LL={ll:.4f}"
                )
            else:
                lines.append(
                    f"  {name:<12}: {n:>7} bars, {n_nn:>6} non-neutral "
                    f"→ fallback"
                )
        return "\n".join(lines)

    # ── Persistence ──────────────────────────────────────────────────────

    def save(self, path: str) -> None:
        if not JOBLIB:
            log.warning("joblib не установлен"); return
        state = {
            "_global_model":        self._global_model,
            "_regime_models":       self._regime_models,
            "_regime_trained":      self._regime_trained,
            "_regime_n_samples":    self._regime_n_samples,
            "_regime_n_nn":         self._regime_n_nn,
        }
        joblib.dump(state, path, compress=3)
        log.info(f"RegimeEnsemble сохранён → {path}")

    @classmethod
    def load(cls, path: str) -> "RegimeEnsemble":
        if not JOBLIB:
            raise RuntimeError("joblib не установлен")
        state = joblib.load(path)
        obj   = cls()

        # Поддержка старых pkl файлов где был StackingEnsemble
        if isinstance(state, StackingEnsemble):
            log.warning(
                "[RegimeEnsemble] Загружен старый StackingEnsemble pkl. "
                "Оборачиваем в RegimeEnsemble как global fallback."
            )
            obj._global_model = state
            return obj

        # Поддержка старых pkl из predictor.save_model() (dict с ключом 'ensemble')
        if isinstance(state, dict) and "ensemble" in state:
            ensemble = state["ensemble"]
            if isinstance(ensemble, RegimeEnsemble):
                log.info(f"RegimeEnsemble загружен ← {path}")
                return ensemble
            elif isinstance(ensemble, StackingEnsemble):
                log.warning(
                    "[RegimeEnsemble] Ключ 'ensemble' содержит StackingEnsemble. "
                    "Оборачиваем."
                )
                obj._global_model = ensemble
                return obj

        # Нативный формат RegimeEnsemble
        if isinstance(state, dict) and "_global_model" in state:
            for k, v in state.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)
            log.info(f"RegimeEnsemble загружен ← {path}")
            return obj

        raise ValueError(f"Неизвестный формат pkl: {type(state)}")