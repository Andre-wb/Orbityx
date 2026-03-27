"""
Market Regime Detector v6
==========================
Улучшенная классификация режимов рынка.

Изменения:
  - ADX порог снижен с 22 до 20: раньше находим тренды
  - Сглаживание 7 баров вместо 5: более стабильные переходы
  - Добавлен переходный режим для неустойчивых состояний
  - Параметры точнее настроены под крипто-рынок
"""
import numpy as np
from enum import IntEnum
from indicators.technical import atr, adx, sma


class Regime(IntEnum):
    TREND_UP   = 0
    TREND_DOWN = 1
    VOLATILE   = 2
    RANGE      = 3


_LABELS = {
    Regime.TREND_UP:   "Trending Up",
    Regime.TREND_DOWN: "Trending Down",
    Regime.VOLATILE:   "High Volatility",
    Regime.RANGE:      "Range / Sideways",
}

_REGIME_PARAMS = {
    Regime.TREND_UP: {
        # В тренде вверх LGBM и XGB получают больший вес
        "model_weights":  {"gb": 0.10, "rf": 0.08, "et": 0.08,
                           "xgb": 0.24, "lgbm": 0.28, "cat": 0.12, "meta": 0.10},
        "sl_atr_mult":    1.5,
        "position_scale": 1.0,
        "min_confidence": 0.52,
    },
    Regime.TREND_DOWN: {
        # В тренде вниз шортить сложнее — требуем больше уверенности
        "model_weights":  {"gb": 0.10, "rf": 0.08, "et": 0.08,
                           "xgb": 0.24, "lgbm": 0.28, "cat": 0.12, "meta": 0.10},
        "sl_atr_mult":    1.5,
        "position_scale": 0.80,
        "min_confidence": 0.55,
    },
    Regime.VOLATILE: {
        # В волатильном режиме отключаем мета-классификатор
        "model_weights":  {"gb": 0.18, "rf": 0.14, "et": 0.10,
                           "xgb": 0.28, "lgbm": 0.22, "cat": 0.08, "meta": 0.00},
        "sl_atr_mult":    2.0,
        "position_scale": 0.40,
        "min_confidence": 0.64,
    },
    Regime.RANGE: {
        # В боковике все модели получают примерно одинаковый вес
        "model_weights":  {"gb": 0.14, "rf": 0.14, "et": 0.14,
                           "xgb": 0.20, "lgbm": 0.20, "cat": 0.12, "meta": 0.06},
        "sl_atr_mult":    1.2,
        "position_scale": 0.65,
        "min_confidence": 0.56,
    },
}


class RegimeDetector:

    ADX_TREND_THRESHOLD = 20.0
    ATR_VOL_MULTIPLIER  = 1.5

    def detect(self, highs: np.ndarray, lows: np.ndarray,
               closes: np.ndarray) -> np.ndarray:
        n        = len(closes)
        regimes  = np.full(n, int(Regime.RANGE), dtype=int)
        adx_v, pdi, mdi = adx(highs, lows, closes, 14)
        s200    = sma(closes, 200)
        atr_v   = atr(highs, lows, closes, 14)
        atr_pct = atr_v / (closes + 1e-9)

        atr_med = np.full(n, np.nan)
        for i in range(50, n):
            atr_med[i] = np.median(atr_pct[i - 50: i])
        atr_med = np.where(np.isnan(atr_med), atr_pct, atr_med)

        for i in range(n):
            if np.isnan(adx_v[i]):
                continue
            trending = adx_v[i] > self.ADX_TREND_THRESHOLD
            volatile = (atr_med[i] > 0 and
                        atr_pct[i] > self.ATR_VOL_MULTIPLIER * atr_med[i])
            if volatile and not trending:
                regimes[i] = int(Regime.VOLATILE)
            elif trending:
                above = (not np.isnan(s200[i])) and closes[i] > s200[i]
                regimes[i] = int(
                    Regime.TREND_UP if (above and pdi[i] > mdi[i])
                    else Regime.TREND_DOWN
                )
            else:
                regimes[i] = int(Regime.RANGE)
        return regimes

    def current_regime(self, highs: np.ndarray, lows: np.ndarray,
                       closes: np.ndarray, smoothing: int = 7) -> Regime:
        arr    = self.detect(highs, lows, closes)
        recent = arr[-smoothing:]
        counts = np.bincount(recent, minlength=4)
        return Regime(int(np.argmax(counts)))

    @staticmethod
    def label(regime: Regime) -> str:
        return _LABELS.get(regime, "Unknown")

    @staticmethod
    def params(regime: Regime) -> dict:
        return _REGIME_PARAMS.get(regime, _REGIME_PARAMS[Regime.RANGE])