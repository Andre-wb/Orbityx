"""
OrbityxAI — Checklist-Based Trading Strategy
==============================================
Пробой/ретест уровней с жёстким чек-листом.
Без ML. Только цена, уровни, паттерны.

Чек-лист:
  1. КОНТЕКСТ: сильный уровень, ясное направление, нет блокирующих уровней
  2. СИГНАЛ: пробой + пауза + подтверждение ИЛИ ретест
  3. ФИЛЬТРЫ: нет пилы, волатильность < SL, тренд совпадает
  4. SL: самый короткий логичный
  5. TP: минимум 3R
"""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from indicators.technical import atr as calc_atr, rsi as calc_rsi, adx as calc_adx, ema, sma


@dataclass
class ChecklistResult:
    """Результат проверки чек-листа."""
    symbol: str
    direction: str          # "LONG" / "SHORT"
    signal_type: str        # "BREAKOUT" / "RETEST"
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float

    # Детали для Telegram
    level_price: float = 0.0
    level_strength: float = 0.0
    level_tf: str = ""
    atr_1d: float = 0.0
    price_move_pct_atr: float = 0.0
    sl_pct: float = 0.0
    tp_pct: float = 0.0
    sl_type: str = ""       # "пробойная_свеча" / "accumulation" / "atr_pct" / "свеча_M5"
    be_price: float = 0.0   # breakeven price (at 2R)

    # Чек-лист детали (для лога)
    context_details: str = ""
    signal_details: str = ""
    filter_details: str = ""


def evaluate_checklist(
        symbol: str,
        # M5 данные
        h_m5: np.ndarray, l_m5: np.ndarray, c_m5: np.ndarray, v_m5: np.ndarray,
        o_m5: np.ndarray,
        # H1 данные
        h_h1: np.ndarray, l_h1: np.ndarray, c_h1: np.ndarray, v_h1: np.ndarray,
        o_h1: np.ndarray,
        # D1 данные
        h_d1: np.ndarray, l_d1: np.ndarray, c_d1: np.ndarray, v_d1: np.ndarray,
        # Уровни (уже посчитанные)
        levels_h1: list,
        levels_d1: list,
        # Параметры
        max_move_atr_pct: float = 0.20,
        min_rr: float = 3.0,
        min_level_strength: float = 3.0,
) -> Optional[ChecklistResult]:
    """
    Проверяет чек-лист для одной пары.
    Возвращает ChecklistResult если все проверки пройдены, иначе None.
    """
    price = float(c_m5[-1])
    if price <= 0:
        return None

    # ── ATR на разных ТФ ──
    atr_d1 = _safe_atr(h_d1, l_d1, c_d1)
    atr_h1 = _safe_atr(h_h1, l_h1, c_h1)
    atr_m5 = _safe_atr(h_m5, l_m5, c_m5)

    if atr_d1 <= 0 or atr_m5 <= 0:
        return None

    # ── Объединяем уровни (D1 приоритет, потом H1) ──
    all_levels = []
    for lv in levels_d1:
        if lv.strength >= min_level_strength:
            all_levels.append(("D1", lv))
    for lv in levels_h1:
        if lv.strength >= min_level_strength:
            all_levels.append(("H1", lv))

    if not all_levels:
        return None

    # ── STEP 1: КОНТЕКСТ ──
    # Найти ближайший сильный уровень
    best_level = None
    best_tf = ""
    best_dist = float("inf")
    for tf_name, lv in all_levels:
        dist = abs(price - lv.price) / atr_d1
        if dist < best_dist:
            best_dist = dist
            best_level = lv
            best_tf = tf_name

    if best_level is None:
        return None

    level_price = best_level.price

    # Цена должна быть близко к уровню (≤20% ATR D1)
    move_pct_atr = abs(price - level_price) / atr_d1
    if move_pct_atr > max_move_atr_pct:
        return None

    # Определить направление
    direction = _determine_direction(price, level_price, c_h1, h_h1, l_h1, atr_h1)
    if direction is None:
        return None

    # Проверить нет ли блокирующих уровней на пути к TP
    risk_estimate = max(atr_d1 * 0.15, atr_m5 * 2)  # примерный SL
    tp_zone = price + risk_estimate * min_rr if direction == "LONG" else price - risk_estimate * min_rr
    blocking = _check_blocking_levels(price, tp_zone, direction, all_levels, atr_d1)
    if blocking:
        return None

    context_details = (f"Level: {best_tf} {level_price:,.4f} (str={best_level.strength:.1f}), "
                       f"Move: {move_pct_atr:.0%} ATR(D1), Dir: {direction}")

    # ── STEP 2: СИГНАЛ ──
    signal_type, signal_details_str = _detect_signal(
        direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5)

    if signal_type is None:
        return None

    # ── STEP 3: ФИЛЬТРЫ ──
    filters_ok, filter_details_str = _check_filters(
        direction, level_price, o_m5, h_m5, l_m5, c_m5, v_m5, c_h1, h_h1, l_h1, atr_m5)

    if not filters_ok:
        return None

    # ── STEP 4: SL (самый короткий логичный) ──
    sl, sl_type = _compute_shortest_sl(
        direction, price, level_price, o_m5, h_m5, l_m5, c_m5,
        atr_d1, atr_m5)

    if sl is None:
        return None

    risk = abs(price - sl)
    if risk <= 0:
        return None

    # ── STEP 5: TP (минимум 3R) ──
    tp = _compute_tp(direction, price, risk, min_rr, all_levels, atr_d1)

    reward = abs(tp - price)
    rr = round(reward / risk, 1) if risk > 0 else 0
    if rr < min_rr:
        return None

    # Breakeven price (at 2R)
    be_price = price + risk * 2 if direction == "LONG" else price - risk * 2

    sl_pct = risk / price * 100
    tp_pct = reward / price * 100

    return ChecklistResult(
        symbol=symbol,
        direction=direction,
        signal_type=signal_type,
        entry_price=price,
        stop_loss=round(sl, 8),
        take_profit=round(tp, 8),
        risk_reward=rr,
        level_price=level_price,
        level_strength=best_level.strength,
        level_tf=best_tf,
        atr_1d=atr_d1,
        price_move_pct_atr=move_pct_atr,
        sl_pct=round(sl_pct, 2),
        tp_pct=round(tp_pct, 2),
        sl_type=sl_type,
        be_price=round(be_price, 8),
        context_details=context_details,
        signal_details=signal_details_str,
        filter_details=filter_details_str,
    )


# ── Вспомогательные функции ──────────────────────────────────────────


def _safe_atr(h, l, c, period=14):
    """ATR с защитой от коротких массивов."""
    if len(c) < period + 1:
        return 0.0
    arr = calc_atr(np.array(h, dtype=float), np.array(l, dtype=float),
                   np.array(c, dtype=float), period)
    val = float(arr[-1])
    return val if np.isfinite(val) and val > 0 else 0.0


def _determine_direction(price, level_price, c_h1, h_h1, l_h1, atr_h1):
    """Определить направление: LONG/SHORT или None если неясно."""
    n = len(c_h1)
    if n < 100:
        return None

    sma100 = float(np.mean(c_h1[-100:]))

    # ADX для подтверждения тренда
    adx_arr = calc_adx(np.array(h_h1, dtype=float),
                       np.array(l_h1, dtype=float),
                       np.array(c_h1, dtype=float), 14)
    adx_val = float(adx_arr[0][-1]) if len(adx_arr[0]) > 0 else 0

    # Цена выше уровня + выше SMA100 = LONG
    if price > level_price and price > sma100:
        return "LONG"
    # Цена ниже уровня + ниже SMA100 = SHORT
    elif price < level_price and price < sma100:
        return "SHORT"
    # Неясно
    return None


def _check_blocking_levels(price, tp_zone, direction, all_levels, atr_d1):
    """Проверить есть ли сильный уровень на пути к TP."""
    for tf_name, lv in all_levels:
        if lv.strength < 5.0:  # только сильные уровни блокируют
            continue
        if direction == "LONG":
            # Сопротивление между ценой и TP
            if price < lv.price < tp_zone:
                # Если уровень ближе чем 2R — блокирует
                if abs(lv.price - price) < abs(tp_zone - price) * 0.6:
                    return True
        else:
            # Поддержка между ценой и TP
            if tp_zone < lv.price < price:
                if abs(price - lv.price) < abs(price - tp_zone) * 0.6:
                    return True
    return False


def _detect_signal(direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5):
    """
    Детектировать сигнал: пробой+пауза+подтверждение ИЛИ ретест.
    Возвращает (signal_type, description) или (None, "").
    """
    n = len(c_m5)
    if n < 30:
        return None, ""

    # ── Сигнал B: РЕТЕСТ (приоритет) ──
    retest = _detect_retest(direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5)
    if retest is not None:
        bar_idx = retest
        return "RETEST", f"Ретест на баре -{n - bar_idx}, тень через уровень, закрытие подтверждено"

    # ── Сигнал A: ПРОБОЙ + ПАУЗА + ПОДТВЕРЖДЕНИЕ ──
    breakout = _detect_breakout_pause_confirm(direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5)
    if breakout is not None:
        bo_idx, pause_bars, confirm_idx = breakout
        return "BREAKOUT", (f"Пробой на баре -{n - bo_idx}, "
                            f"{pause_bars} баров паузы, подтверждение на баре -{n - confirm_idx}")

    return None, ""


def _detect_retest(direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5):
    """
    Ретест: цена вернулась к уровню, проколола тенью, закрылась обратно.
    Ищем в последних 10 барах M5.
    """
    n = len(c_m5)
    tolerance = atr_m5 * 0.3  # зона ретеста

    for i in range(max(n - 10, 0), n):
        if direction == "LONG":
            # Ретест поддержки: тень ниже уровня, закрытие выше
            if l_m5[i] <= level_price + tolerance and c_m5[i] > level_price:
                # Подтверждающая свеча: закрытие выше открытия (бычья)
                if c_m5[i] > o_m5[i]:
                    return i
        else:
            # Ретест сопротивления: тень выше уровня, закрытие ниже
            if h_m5[i] >= level_price - tolerance and c_m5[i] < level_price:
                if c_m5[i] < o_m5[i]:
                    return i
    return None


def _detect_breakout_pause_confirm(direction, level_price, o_m5, h_m5, l_m5, c_m5, atr_m5):
    """
    Пробой + пауза (3-5 свечей) + подтверждающая свеча.
    Ищем в последних 30 барах M5.
    """
    n = len(c_m5)
    threshold = atr_m5 * 0.1  # порог пробоя

    # 1. Найти пробойную свечу (сканируем назад)
    breakout_idx = None
    for i in range(max(n - 30, 0), n - 5):
        if direction == "LONG":
            # Свеча закрылась выше уровня
            if c_m5[i] > level_price + threshold and c_m5[i - 1] <= level_price + threshold:
                breakout_idx = i
                break
        else:
            if c_m5[i] < level_price - threshold and c_m5[i - 1] >= level_price - threshold:
                breakout_idx = i
                break

    if breakout_idx is None:
        return None

    # 2. Пауза: 2-5 свечей после пробоя с уменьшающейся волатильностью
    bo_range = h_m5[breakout_idx] - l_m5[breakout_idx]
    if bo_range <= 0:
        return None

    pause_start = breakout_idx + 1
    pause_end = min(pause_start + 5, n - 1)
    pause_bars = 0

    for i in range(pause_start, pause_end):
        bar_range = h_m5[i] - l_m5[i]
        # Пауза: диапазон свечи < 70% пробойной
        if bar_range < bo_range * 0.7:
            # Цена не ушла обратно за уровень
            if direction == "LONG" and c_m5[i] > level_price:
                pause_bars += 1
            elif direction == "SHORT" and c_m5[i] < level_price:
                pause_bars += 1
            else:
                break  # ушла обратно
        else:
            break

    if pause_bars < 2:
        return None

    # 3. Подтверждающая свеча: после паузы, в направлении пробоя
    confirm_idx = pause_start + pause_bars
    if confirm_idx >= n:
        return None

    body = abs(c_m5[confirm_idx] - o_m5[confirm_idx])
    candle_range = h_m5[confirm_idx] - l_m5[confirm_idx]
    if candle_range <= 0:
        return None

    # Тело > 50% диапазона (моментум-свеча)
    if body / candle_range < 0.5:
        return None

    # Направление совпадает
    if direction == "LONG" and c_m5[confirm_idx] <= o_m5[confirm_idx]:
        return None
    if direction == "SHORT" and c_m5[confirm_idx] >= o_m5[confirm_idx]:
        return None

    return (breakout_idx, pause_bars, confirm_idx)


def _check_filters(direction, level_price, o_m5, h_m5, l_m5, c_m5, v_m5,
                   c_h1, h_h1, l_h1, atr_m5):
    """
    Фильтры качества:
    1. Нет пилы на уровне (≤2 пересечений за 20 баров)
    2. Волатильность последних 5 M5 свечей < 3×ATR_M5
    3. Тренд H1: EMA9 > EMA21 для LONG, EMA9 < EMA21 для SHORT
    4. Режим рынка: ADX H1 > 15 (не боковик)
    5. Объём подтверждения: текущий бар ≥ 1.2x среднего 20-барного объёма M5
    """
    n = len(c_m5)
    reasons = []

    # 1. Нет пилы
    crossings = 0
    for i in range(max(n - 20, 1), n):
        prev_above = c_m5[i - 1] > level_price
        curr_above = c_m5[i] > level_price
        if prev_above != curr_above:
            crossings += 1
    if crossings > 2:
        return False, f"Пила: {crossings} пересечений"
    reasons.append(f"Нет пилы ({crossings} пересеч.)")

    # 2. Волатильность последних 5 M5 < 3×ATR_M5
    if n >= 5:
        last5_ranges = [h_m5[i] - l_m5[i] for i in range(n - 5, n)]
        avg_range = np.mean(last5_ranges)
        if avg_range > atr_m5 * 3:
            return False, f"Волатильность M5 слишком высокая: avg_range={avg_range:.4f} > 3×ATR_M5"
        reasons.append(f"Волат. ОК (avg={avg_range:.4f})")

    # 3. Тренд H1
    n_h1 = len(c_h1)
    if n_h1 >= 21:
        ema9 = ema(np.array(c_h1, dtype=float), 9)
        ema21 = ema(np.array(c_h1, dtype=float), 21)
        if direction == "LONG" and ema9[-1] < ema21[-1]:
            return False, "Тренд H1 против ЛОНГ (EMA9 < EMA21)"
        if direction == "SHORT" and ema9[-1] > ema21[-1]:
            return False, "Тренд H1 против ШОРТ (EMA9 > EMA21)"
        reasons.append("Тренд H1 совпадает")

    # 4. Режим рынка: ADX H1 > 15 (фильтр боковика)
    if n_h1 >= 28:
        adx_arr = calc_adx(np.array(h_h1, dtype=float),
                           np.array(l_h1, dtype=float),
                           np.array(c_h1, dtype=float), 14)
        adx_val = float(adx_arr[0][-1]) if len(adx_arr[0]) > 0 else 0
        if adx_val < 15:
            return False, f"Боковик: ADX H1={adx_val:.1f} < 15"
        reasons.append(f"ADX={adx_val:.0f}")

    # 5. Объём подтверждения на сигнальном баре
    if len(v_m5) >= 21:
        avg_vol = float(np.mean(v_m5[-21:-1]))
        last_vol = float(v_m5[-1])
        if avg_vol > 0:
            vol_ratio = last_vol / avg_vol
            if vol_ratio < 1.2:
                return False, f"Объём слабый: {vol_ratio:.1f}x avg"
            reasons.append(f"Объём {vol_ratio:.1f}x")

    return True, ", ".join(reasons)


def _compute_shortest_sl(direction, price, level_price, o_m5, h_m5, l_m5, c_m5,
                         atr_d1, atr_m5):
    """
    4 варианта SL → выбираем самый короткий (ближайший к цене).
    """
    n = len(c_m5)
    buffer = atr_m5 * 0.2
    candidates = []
    candidate_types = []

    # 1. За пробойную свечу
    # Ищем последнюю сильную свечу в направлении
    for i in range(n - 1, max(n - 10, 0), -1):
        body = abs(c_m5[i] - o_m5[i])
        rng = h_m5[i] - l_m5[i]
        if rng > 0 and body / rng > 0.5:
            if direction == "LONG":
                candidates.append(l_m5[i] - buffer)
                candidate_types.append("пробойная_свеча")
            else:
                candidates.append(h_m5[i] + buffer)
                candidate_types.append("пробойная_свеча")
            break

    # 2. За зону накопления (минимум/максимум последних 5 баров)
    if n >= 5:
        if direction == "LONG":
            zone_low = min(l_m5[n - 5:n])
            candidates.append(zone_low - buffer)
            candidate_types.append("зона_накопления")
        else:
            zone_high = max(h_m5[n - 5:n])
            candidates.append(zone_high + buffer)
            candidate_types.append("зона_накопления")

    # 3. 10-15% ATR D1
    atr_sl = atr_d1 * 0.125  # среднее 10-15%
    if direction == "LONG":
        candidates.append(price - atr_sl)
        candidate_types.append("atr_12.5%")
    else:
        candidates.append(price + atr_sl)
        candidate_types.append("atr_12.5%")

    # 4. Размер M5 свечи
    if n >= 1:
        last_range = h_m5[-1] - l_m5[-1]
        if last_range > 0:
            if direction == "LONG":
                candidates.append(l_m5[-1] - buffer)
                candidate_types.append("свеча_M5")
            else:
                candidates.append(h_m5[-1] + buffer)
                candidate_types.append("свеча_M5")

    if not candidates:
        return None, ""

    # Выбираем самый короткий (ближайший к цене)
    if direction == "LONG":
        # Для LONG: SL ниже цены → max(candidates) = ближайший к цене
        best_idx = int(np.argmax(candidates))
    else:
        # Для SHORT: SL выше цены → min(candidates) = ближайший к цене
        best_idx = int(np.argmin(candidates))

    sl = candidates[best_idx]
    sl_type = candidate_types[best_idx]

    # Валидация: SL должен быть по правильную сторону от уровня
    # LONG: SL ниже уровня; SHORT: SL выше уровня
    if direction == "LONG" and sl >= level_price:
        sl = level_price - buffer * 2
        sl_type = sl_type + "_adj"
    if direction == "SHORT" and sl <= level_price:
        sl = level_price + buffer * 2
        sl_type = sl_type + "_adj"

    # Валидация: SL не слишком тесный и не слишком широкий
    dist = abs(price - sl)
    min_dist = atr_d1 * 0.08   # минимум 8% ATR D1
    max_dist = atr_d1 * 0.30   # максимум 30% ATR D1

    if dist < min_dist:
        # Попробуем использовать уровень как базу SL
        fallback_sl = (level_price - atr_d1 * 0.15) if direction == "LONG" else (level_price + atr_d1 * 0.15)
        fallback_dist = abs(price - fallback_sl)
        if min_dist <= fallback_dist <= max_dist:
            sl = fallback_sl
            sl_type = "уровень_ATR"
        else:
            return None, ""

    if dist > max_dist:
        return None, ""

    return sl, sl_type


def _compute_tp(direction, price, risk, min_rr, all_levels, atr_d1):
    """TP = минимум 3R или следующий сильный уровень (если дальше)."""
    tp_min = price + risk * min_rr if direction == "LONG" else price - risk * min_rr

    # Найти следующий уровень в направлении
    best_level_tp = None
    for tf_name, lv in all_levels:
        if direction == "LONG" and lv.price > price + risk * 2:
            if best_level_tp is None or lv.price < best_level_tp:
                best_level_tp = lv.price
        elif direction == "SHORT" and lv.price < price - risk * 2:
            if best_level_tp is None or lv.price > best_level_tp:
                best_level_tp = lv.price

    # Используем уровень если он дальше 3R
    if best_level_tp is not None:
        if direction == "LONG" and best_level_tp > tp_min:
            return best_level_tp
        elif direction == "SHORT" and best_level_tp < tp_min:
            return best_level_tp

    return tp_min


def format_checklist_telegram(result: ChecklistResult) -> str:
    """Форматирует чек-лист для Telegram."""
    emoji = "🟢" if result.direction == "LONG" else "🔴"
    d = "ЛОНГ" if result.direction == "LONG" else "ШОРТ"
    sig = "Ретест" if result.signal_type == "RETEST" else "Пробой"

    msg = (
        f"{emoji} CHECKLIST {d} {result.symbol}\n"
        f"{'━' * 32}\n"
        f"КОНТЕКСТ:\n"
        f"  ✅ Уровень: {result.level_tf} ${result.level_price:,.4f} (сила={result.level_strength:.1f})\n"
        f"  ✅ Цена у уровня ({result.price_move_pct_atr:.0%} ATR D1)\n"
        f"  ✅ Нет блокирующих уровней\n"
        f"\n"
        f"СИГНАЛ:\n"
        f"  ✅ {sig}: {result.signal_details}\n"
        f"\n"
        f"ФИЛЬТРЫ:\n"
        f"  ✅ {result.filter_details}\n"
        f"{'━' * 32}\n"
        f"▸ Вход:  ${result.entry_price:,.4f}\n"
        f"▸ Стоп:  ${result.stop_loss:,.4f} ({result.sl_pct:.2f}%) [{result.sl_type}]\n"
        f"▸ Цель:  ${result.take_profit:,.4f} ({result.tp_pct:.2f}%)\n"
        f"▸ R:R = {result.risk_reward:.1f}\n"
        f"▸ БУ при 2R: ${result.be_price:,.4f}\n"
        f"{'━' * 32}\n"
        f"ATR(D1): ${result.atr_1d:.6g}"
    )
    return msg
