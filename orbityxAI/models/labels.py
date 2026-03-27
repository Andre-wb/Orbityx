"""
Triple-Barrier Labelling + Fractional Differentiation  v6.3
=============================================================
Lopez de Prado, AFML ch. 2, 3, 5

CHANGES vs v6.2:

  IMPROVEMENT #5 — Асимметричные барьеры по направлению тренда.
                   Прежде барьеры были симметричными: upper = lower = thresh.
                   Это несправедливо: в бычьем тренде цена идёт дальше вверх,
                   поэтому верхний барьер должен быть шире нижнего.

                   Новая логика:
                     ADX > 25 И PDI > MDI (бычий тренд):
                       upper = thresh × 1.15  (шире вверх — у тренда простор)
                       lower = thresh × 0.85  (уже вниз — стоп ближе)
                     ADX > 25 И MDI > PDI (медвежий тренд):
                       upper = thresh × 0.85  (уже вверх)
                       lower = thresh × 1.15  (шире вниз)
                     ADX ≤ 25 (боковик):
                       симметрично (× 1.0)

                   Это даёт более качественные метки: в тренде модель
                   правильно классифицирует движения по тренду как
                   более вероятные, что повышает Win Rate.

CHANGES vs v6.1:

  IMPROVEMENT #1 — triple_barrier_labels() возвращает четвёртый массив.
  IMPROVEMENT #2 — Режимно-взвешенные нейтральные метки.
  IMPROVEMENT #3 — combined_weights() принимает adx_arr.
  IMPROVEMENT #4 — compute_adx_for_labels().
"""
import numpy as np
from typing import Optional, Tuple
from indicators.technical import atr as compute_atr, adx as compute_adx
from config import LBL_CFG


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def winsorize(arr: np.ndarray, quantile: float = 0.005) -> np.ndarray:
    lo = np.nanquantile(arr, quantile)
    hi = np.nanquantile(arr, 1.0 - quantile)
    return np.clip(arr, lo, hi)


# ---------------------------------------------------------------------------
# Fractional differentiation
# ---------------------------------------------------------------------------

def _frac_diff_weights(d: float, size: int, threshold: float = 1e-5) -> np.ndarray:
    w = [1.0]
    for k in range(1, size):
        w_k = -w[-1] * (d - k + 1) / k
        if abs(w_k) < threshold:
            break
        w.append(w_k)
    return np.array(w[::-1])


def fractional_diff(series: np.ndarray, d: float = 0.4,
                    threshold: float = 1e-5) -> np.ndarray:
    """
    Дробное дифференцирование: делает ряд стационарным,
    сохраняя долгосрочную память (автокорреляцию).
    d=0.4 — оптимум для финансовых рядов по Lopez de Prado.
    """
    n   = len(series)
    w   = _frac_diff_weights(d, n, threshold)
    l   = len(w)
    res = np.full(n, np.nan)
    for i in range(l - 1, n):
        res[i] = np.dot(w, series[i - l + 1: i + 1])
    return res


def find_min_d(
        series:    np.ndarray,
        d_range:   Tuple[float, float] = (0.0, 1.0),
        step:      float = 0.05,
        threshold: float = 0.05,
) -> float:
    """Минимальное d при котором ряд становится стационарным (ADF test)."""
    try:
        from scipy.stats import adfuller
    except ImportError:
        return 0.4
    lo, hi = d_range
    best_d = hi
    d      = lo
    while d <= hi + 1e-9:
        fd    = fractional_diff(series, d)
        valid = fd[~np.isnan(fd)]
        if len(valid) > 30:
            try:
                pval = adfuller(valid, maxlag=1, autolag=None)[1]
                if pval < threshold:
                    best_d = d
                    break
            except Exception:
                pass
        d = round(d + step, 4)
    return best_d


# ---------------------------------------------------------------------------
# IMPROVEMENT #4 — вспомогательные функции для ADX/PDI/MDI
# ---------------------------------------------------------------------------

def compute_adx_for_labels(
        highs:  np.ndarray,
        lows:   np.ndarray,
        closes: np.ndarray,
        period: int = 14,
) -> np.ndarray:
    """
    Рассчитывает ADX для использования в triple_barrier_labels() и
    sample_weights_uniqueness(). Возвращает только ADX (без PDI/MDI).
    """
    try:
        adx_v, _, _ = compute_adx(highs, lows, closes, period)
        return adx_v
    except Exception:
        return np.full(len(closes), 20.0)


def compute_directional_for_labels(
        highs:  np.ndarray,
        lows:   np.ndarray,
        closes: np.ndarray,
        period: int = 14,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Рассчитывает ADX, PDI и MDI для асимметричных барьеров.

    Returns
    -------
    adx_arr, pdi_arr, mdi_arr : np.ndarray shape (n,)
    """
    try:
        return compute_adx(highs, lows, closes, period)
    except Exception:
        n = len(closes)
        return np.full(n, 20.0), np.full(n, 25.0), np.full(n, 25.0)


# ---------------------------------------------------------------------------
# Triple-Barrier Labelling
# ---------------------------------------------------------------------------

def triple_barrier_labels(
        closes:      np.ndarray,
        highs:       np.ndarray,
        lows:        np.ndarray,
        atr_mult:    float          = LBL_CFG.barrier_atr_mult,
        max_holding: int            = LBL_CFG.max_holding_bars,
        min_thresh:  float          = LBL_CFG.min_return_thresh,
        atr_period:  int            = LBL_CFG.atr_period,
        end_idx:     Optional[int]  = None,
        adx_arr:     Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Тройной барьер с адаптивной и АСИММЕТРИЧНОЙ шириной (AFML ch. 3).

    IMPROVEMENT #5 — Асимметричные барьеры по тренду:
      ADX > 25, PDI > MDI (бычий тренд):
        upper × 1.15 — шире, цена чаще идёт вверх
        lower × 0.85 — уже, стоп ближе
      ADX > 25, MDI > PDI (медвежий тренд):
        upper × 0.85 — уже
        lower × 1.15 — шире вниз
      ADX ≤ 25 (боковик): симметрично

    Returns
    -------
    labels          : np.ndarray int, {-1, 0, +1}
    fwd_ret         : np.ndarray float, реализованная доходность
    barriers        : np.ndarray float, базовая ширина барьера
    trend_factor_arr: np.ndarray float32, множитель тренда (1.0 или 1.3)
    """
    n        = len(closes)
    limit    = end_idx if end_idx is not None else n
    labels           = np.zeros(n,  dtype=int)
    fwd_ret          = np.zeros(n,  dtype=float)
    barriers         = np.zeros(n,  dtype=float)
    trend_factor_arr = np.ones(n,   dtype=np.float32)

    atr_v = compute_atr(highs, lows, closes, atr_period)

    # Вычисляем ADX, PDI, MDI одним вызовом для асимметричных барьеров
    adx_full = pdi_full = mdi_full = None
    try:
        adx_full, pdi_full, mdi_full = compute_adx(highs, lows, closes, 14)
        if adx_arr is None:
            adx_arr = adx_full
    except Exception:
        if adx_arr is None:
            adx_arr = np.full(n, 20.0)

    for i in range(limit - 1):
        if np.isnan(atr_v[i]) or atr_v[i] == 0.0:
            continue

        # Базовый множитель тренда (ширит оба барьера)
        is_trending  = (not np.isnan(adx_arr[i])) and (adx_arr[i] > 25)
        trend_factor = 1.3 if is_trending else 1.0
        trend_factor_arr[i] = trend_factor

        # IMPROVEMENT #5: асимметричные множители по направлению тренда
        up_mult = dn_mult = 1.0
        if is_trending and pdi_full is not None and mdi_full is not None:
            try:
                pdi_val = float(pdi_full[i])
                mdi_val = float(mdi_full[i])
                adx_val_i = float(adx_arr[i])
                if not (np.isnan(pdi_val) or np.isnan(mdi_val) or np.isnan(adx_val_i)):
                    # Scale asymmetry by trend strength (ADX 25-65 → 0-1)
                    trend_str = min((adx_val_i - 25) / 40.0, 1.0)
                    asym = 1.0 + trend_str * 0.25  # max 1.25x
                    if pdi_val > mdi_val:
                        up_mult = asym
                        dn_mult = 1.0 / asym
                    else:
                        up_mult = 1.0 / asym
                        dn_mult = asym
            except Exception:
                pass

        thresh      = max(
            atr_mult * atr_v[i] / (closes[i] + 1e-9) * trend_factor,
            min_thresh,
            )
        barriers[i] = thresh
        upper       = closes[i] * (1.0 + thresh * up_mult)
        lower       = closes[i] * (1.0 - thresh * dn_mult)
        label       = 0
        end_ret     = 0.0

        for j in range(i + 1, min(i + 1 + max_holding, limit)):
            hit_up   = highs[j] >= upper
            hit_down = lows[j]  <= lower
            if hit_up and hit_down:
                label   = 0
                end_ret = (closes[j] - closes[i]) / (closes[i] + 1e-9)
                break
            elif hit_up:
                label   = 1
                end_ret = thresh * up_mult
                break
            elif hit_down:
                label   = -1
                end_ret = -thresh * dn_mult
                break
        else:
            j_end   = min(i + max_holding, limit - 1)
            end_ret = (closes[j_end] - closes[i]) / (closes[i] + 1e-9)
            label   = 0

        labels[i]  = label
        fwd_ret[i] = end_ret

    return labels, fwd_ret, barriers, trend_factor_arr


# ---------------------------------------------------------------------------
# Meta-labelling helpers
# ---------------------------------------------------------------------------

def meta_labels(
        primary_direction: np.ndarray,
        true_labels:       np.ndarray,
) -> np.ndarray:
    """Мета-метка = 1 если первичная модель верно предсказала направление."""
    n  = len(primary_direction)
    ml = np.zeros(n, dtype=int)
    for i in range(n):
        if primary_direction[i] == 0:
            continue
        if primary_direction[i] == true_labels[i] and true_labels[i] != 0:
            ml[i] = 1
    return ml


def build_meta_features(X: np.ndarray, proba_up: np.ndarray) -> np.ndarray:
    return np.column_stack([X, proba_up.reshape(-1, 1)])


# ---------------------------------------------------------------------------
# Forward returns (zero look-ahead)
# ---------------------------------------------------------------------------

def forward_log_returns(
        closes:  np.ndarray,
        horizon: int = 5,
        end_idx: Optional[int] = None,
) -> np.ndarray:
    """Логарифмическая доходность на horizon баров вперёд (без утечки)."""
    n      = len(closes)
    limit  = end_idx if end_idx is not None else n
    ret    = np.zeros(n, dtype=float)
    safe_e = min(limit - horizon, n - horizon)
    if safe_e > 0:
        ret[:safe_e] = np.log(
            closes[horizon: safe_e + horizon] / (closes[:safe_e] + 1e-9)
        )
    return ret


# ---------------------------------------------------------------------------
# Sample weights
# ---------------------------------------------------------------------------

def sample_weights_uniqueness(
        labels:      np.ndarray,
        max_holding: int = LBL_CFG.max_holding_bars,
        adx_arr:     Optional[np.ndarray] = None,
) -> np.ndarray:
    """Вес каждого бара = средняя уникальность × режимный коэффициент нейтралей."""
    NEUTRAL_TREND   = 0.15
    NEUTRAL_RANGE   = 0.40
    NEUTRAL_DEFAULT = 0.30

    n          = len(labels)
    concurrent = np.zeros(n, dtype=float)

    for i in range(n):
        if labels[i] == 0:
            continue
        end = min(i + max_holding, n)
        concurrent[i:end] += 1.0

    weights = np.ones(n, dtype=float)
    for i in range(n):
        end  = min(i + max_holding, n)
        span = concurrent[i:end]
        # Use max(span, 1) to avoid division by zero / numerical explosion
        span_safe = np.maximum(span, 1.0)
        uniq = float(np.mean(1.0 / span_safe))

        if labels[i] == 0:
            if adx_arr is not None and i < len(adx_arr):
                adx_val = float(adx_arr[i])
                if np.isnan(adx_val):
                    nf = NEUTRAL_DEFAULT
                elif adx_val > 25:
                    nf = NEUTRAL_TREND
                else:
                    nf = NEUTRAL_RANGE
            else:
                nf = NEUTRAL_DEFAULT
            weights[i] = uniq * nf
        else:
            weights[i] = uniq

    nonzero = weights[weights > 0]
    mean_w  = nonzero.mean() if len(nonzero) > 0 else 1.0
    weights /= (mean_w + 1e-9)
    return weights


def time_decay_weights(n: int, decay: float = 0.995) -> np.ndarray:
    """Экспоненциальный временной распад: новые данные важнее старых."""
    w = np.array([decay ** (n - 1 - i) for i in range(n)], dtype=float)
    w /= w.mean()
    return w


def combined_weights(
        labels:      np.ndarray,
        max_holding: int            = LBL_CFG.max_holding_bars,
        decay:       float          = LBL_CFG.time_decay,
        adx_arr:     Optional[np.ndarray] = None,
) -> np.ndarray:
    """Итоговые веса для обучения = уникальность × временной распад."""
    w_uniq  = sample_weights_uniqueness(labels, max_holding, adx_arr=adx_arr)
    w_decay = time_decay_weights(len(labels), decay)
    w_comb  = w_uniq * w_decay
    w_comb /= (w_comb[w_comb > 0].mean() + 1e-9)
    return w_comb


def regime_aware_weights(
        labels:      np.ndarray,
        closes:      np.ndarray,
        highs:       np.ndarray,
        lows:        np.ndarray,
        max_holding: int   = LBL_CFG.max_holding_bars,
        decay:       float = LBL_CFG.time_decay,
        adx_period:  int   = 14,
        atr_period:  int   = 14,
        vol_window:  int   = 20,
) -> np.ndarray:
    """Веса для обучения с учётом рыночного режима (v6.7)."""
    NEUTRAL_TREND    = 0.20
    NEUTRAL_VOLATILE = 0.50
    NEUTRAL_RANGE    = 0.40
    NEUTRAL_DEFAULT  = 0.30

    n = len(labels)

    adx_arr = compute_adx_for_labels(highs, lows, closes, adx_period)
    atr_v   = compute_atr(highs, lows, closes, atr_period)
    with np.errstate(divide="ignore", invalid="ignore"):
        atr_norm = np.where(closes > 1e-9, atr_v / closes, np.nan)

    vol_thresh_arr = np.full(n, np.nan)
    for i in range(vol_window - 1, n):
        window = atr_norm[i - vol_window + 1: i + 1]
        valid  = window[~np.isnan(window)]
        if len(valid) > 0:
            vol_thresh_arr[i] = float(np.mean(valid))

    valid_thresh      = vol_thresh_arr[~np.isnan(vol_thresh_arr)]
    global_vol_thresh = float(np.median(valid_thresh)) if len(valid_thresh) > 0 else 0.02

    concurrent = np.zeros(n, dtype=float)
    for i in range(n):
        if labels[i] == 0:
            continue
        end = min(i + max_holding, n)
        concurrent[i:end] += 1.0

    weights = np.ones(n, dtype=float)
    for i in range(n):
        end  = min(i + max_holding, n)
        span = concurrent[i:end]
        with np.errstate(divide="ignore", invalid="ignore"):
            uniq = float(np.mean(1.0 / (span + 1e-9)))

        if labels[i] == 0:
            adx_val  = float(adx_arr[i])  if i < len(adx_arr)       else np.nan
            atr_val  = float(atr_norm[i]) if i < len(atr_norm)       else np.nan
            thresh_i = (float(vol_thresh_arr[i])
                        if i < len(vol_thresh_arr) and not np.isnan(vol_thresh_arr[i])
                        else global_vol_thresh)

            if np.isnan(adx_val) or np.isnan(atr_val):
                nf = NEUTRAL_DEFAULT
            elif atr_val > thresh_i * 1.5:
                nf = NEUTRAL_VOLATILE
            elif adx_val > 25:
                nf = NEUTRAL_TREND
            else:
                nf = NEUTRAL_RANGE

            weights[i] = uniq * nf
        else:
            weights[i] = uniq

    w_decay  = time_decay_weights(n, decay)
    w_comb   = weights * w_decay

    nonzero  = w_comb[w_comb > 0]
    w_comb  /= (nonzero.mean() + 1e-9) if len(nonzero) > 0 else 1.0
    return w_comb