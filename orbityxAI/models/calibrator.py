"""
Probability Calibration v6.2
==============================
FIXES vs v6.1:
  BUG FIX #1 — combined режим: p_cal вычислялась но НЕ присваивалась
               обратно в p после Isotonic шага.
               Isotonic применялся, результат терялся — калибровка
               фактически не работала в combined режиме.
               Fix: p = self.isotonic.predict(p) вместо p_cal = ...

Калибровка вероятностей улучшает точность напрямую:
  - Некалиброванная модель: P(up)=0.7 → реально выигрывает 60% времени
  - Калиброванная модель:   P(up)=0.7 → реально выигрывает ~70% времени

Два метода:
  1. Platt Scaling: логистическая регрессия поверх сырых скоров
     Хорошо работает когда модель систематически переуверена/недоуверена

  2. Isotonic Regression: непараметрическая монотонная калибровка
     Лучше когда ошибки некалиброванности нелинейные

Оба метода используют OOF вероятности → нет утечки данных.
"""
import numpy as np
from typing import Optional
from utils.logger import log

try:
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.isotonic import IsotonicRegression
    from sklearn.linear_model import LogisticRegression
    SKLEARN = True
except ImportError:
    SKLEARN = False


class ProbabilityCalibrator:
    """
    Двухэтапная калибровка OOF вероятностей.

    Этап 1: Platt Scaling (логрег поверх raw proba)
    Этап 2: Isotonic Regression (нелинейная коррекция)

    Итоговая calibrated_proba ближе к истинным частотам → лучший log-loss.
    """

    def __init__(self, method: str = "isotonic"):
        """
        method: "platt" | "isotonic" | "combined"
        combined = Platt сначала, потом Isotonic
        """
        self.method       = method
        self.platt        = None
        self.isotonic     = None
        self._fitted      = False
        self._ece_before  = float("nan")
        self._ece_after   = float("nan")

    def fit(self, proba: np.ndarray, y_true: np.ndarray) -> "ProbabilityCalibrator":
        """
        Обучить калибратор на OOF вероятностях.
        proba: P(up), форма (n,)
        y_true: бинарные метки {0, 1}, форма (n,)
        """
        if not SKLEARN:
            log.warning("[Calibrator] sklearn недоступен — калибровка отключена")
            return self

        if len(proba) < 30:
            log.warning("[Calibrator] Мало примеров для калибровки")
            return self

        self._ece_before = self._expected_calibration_error(proba, y_true)
        log.info(f"[Calibrator] ECE до калибровки: {self._ece_before:.4f}")

        p = np.clip(proba, 1e-6, 1 - 1e-6)

        if self.method in ("platt", "combined"):
            try:
                log_odds = np.log(p / (1 - p)).reshape(-1, 1)
                self.platt = LogisticRegression(C=1.0, max_iter=500)
                self.platt.fit(log_odds, y_true)
                p = self.platt.predict_proba(log_odds)[:, 1]  # обновляем p
                log.info(f"[Calibrator] Platt fitted")
            except Exception as e:
                log.warning(f"[Calibrator] Platt failed: {e}")

        if self.method in ("isotonic", "combined"):
            try:
                self.isotonic = IsotonicRegression(out_of_bounds="clip")
                self.isotonic.fit(p, y_true)
                # BUG FIX #1: было p_cal = self.isotonic.predict(p)
                # p_cal нигде не использовалась дальше — результат терялся.
                # Fix: присваиваем обратно в p чтобы predict() работал корректно.
                p = self.isotonic.predict(p)
                log.info(f"[Calibrator] Isotonic fitted")
            except Exception as e:
                log.warning(f"[Calibrator] Isotonic failed: {e}")

        # Замеряем ECE после
        self._fitted = True
        p_cal_check = self.predict(proba)
        self._ece_after = self._expected_calibration_error(p_cal_check, y_true)
        log.info(f"[Calibrator] ECE после калибровки: {self._ece_after:.4f} "
                 f"(улучшение: {self._ece_before - self._ece_after:+.4f})")
        return self

    def predict(self, proba: np.ndarray) -> np.ndarray:
        """Применить калибровку к новым вероятностям."""
        if not self._fitted:
            return proba

        p = np.clip(proba, 1e-6, 1 - 1e-6)

        if self.platt is not None:
            try:
                log_odds = np.log(p / (1 - p)).reshape(-1, 1)
                p = self.platt.predict_proba(log_odds)[:, 1]
            except Exception:
                pass

        if self.isotonic is not None:
            try:
                p = self.isotonic.predict(p)
            except Exception:
                pass

        return np.clip(p, 1e-6, 1 - 1e-6)

    def predict_scalar(self, proba: float) -> float:
        """Калибровка одного значения."""
        if not self._fitted:
            return proba
        return float(self.predict(np.array([proba]))[0])

    @staticmethod
    def _expected_calibration_error(proba: np.ndarray, y_true: np.ndarray,
                                    n_bins: int = 10) -> float:
        """
        Expected Calibration Error (ECE): насколько P(up) соответствует реальной частоте.
        0.0 = идеальная калибровка, 0.1 = отклонение 10%.
        """
        bins  = np.linspace(0, 1, n_bins + 1)
        ece   = 0.0
        n     = len(proba)
        for i in range(n_bins):
            mask = (proba >= bins[i]) & (proba < bins[i + 1])
            if mask.sum() == 0:
                continue
            avg_conf = proba[mask].mean()
            avg_acc  = y_true[mask].mean()
            ece     += (mask.sum() / n) * abs(avg_conf - avg_acc)
        return float(ece)

    @property
    def improvement(self) -> float:
        return self._ece_before - self._ece_after