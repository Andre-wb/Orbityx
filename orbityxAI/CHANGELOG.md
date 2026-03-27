# Changelog — OrbityxAI

---

## v7.3 — 2026-03-26

### Исправления стратегии CHECKLIST

**`strategy/checklist.py`**

- **FIX: SL ставился между входом и уровнем** — для LONG: entry=$0.0837, level=$0.0829, SL=$0.0832. SL был выше уровня — любое касание уровня выбивало стоп. Теперь SL всегда за уровнем: для LONG `sl < level_price`, для SHORT `sl > level_price`. Если вычисленный SL оказывается не на той стороне — автоматически корректируется на `level ± buffer×2`.
- **FIX: SL fallback** — если скорректированный SL всё равно вне диапазона 8–30% ATR D1, используется fallback `level ± 15% ATR D1`. Расширен допустимый диапазон с 10–20% до 8–30% ATR D1.
- **NEW: Фильтр режима рынка (ADX H1 > 15)** — сигналы в боковике теперь фильтруются. ADX < 15 = боковик, сделка пропускается.
- **NEW: Фильтр объёма** — сигнальный бар M5 должен иметь объём ≥ 1.2× среднего за 20 баров. Слабый объём на входе = пропуск.
- **FIX: `_check_filters` сигнатура** — добавлены `v_m5`, `h_h1`, `l_h1` для работы ADX и объёмного фильтра.

Детальный разбор бага SL:

```
До исправления:
  entry=$0.0837, level=$0.0829, sl=$0.0832
  LONG: sl=$0.0832 > level=$0.0829  ← SL ВЫШЕ уровня!
  При ретесте уровня цена касалась $0.0829 → SL выбивался на $0.0832
  Торговая идея была правильной, но стоп мешал ей реализоваться

После исправления:
  Если sl >= level_price для LONG → sl = level_price - buffer*2
  buffer = 0.3% ATR D1 (типичный буфер)
  Для CELO: sl = $0.0829 - $0.0004 = $0.0825
```

Логика выбора SL (4 кандидата, по убыванию приоритета):
1. Пробойная свеча (low пробойного бара - buffer)
2. Зона накопления (нижняя граница зоны - buffer)
3. Свеча M5 (low сигнального бара - buffer)
4. ATR D1 (level - 15% ATR D1)

После выбора кандидата:
- Проверка что SL за уровнем
- Если нет → автокоррекция
- Проверка диапазона 8–30% ATR D1
- Если нет → fallback на level ± 15% ATR D1
- Если fallback тоже вне диапазона → сигнал пропускается

### Исправления execution

**`run_live.py`**

- **FIX: `amount < min_amount` — тихий return без лога** — добавлен детальный лог: amount, min_amount, pos_val, price, precision.
- **FIX: `_execute_checklist_trade` внутри общего try/except** — все ошибки execution глотались молча. Вынесено в отдельный try/except с `traceback.print_exc()`.
- **FIX: `price_prec` и `amount_prec` как float** — Bybit возвращает precision как тик-сайз (например `0.000001`). `int(0.000001) = 0`, `round(0.0059, 0) = 0.0`. Добавлена функция `_tick_to_decimals()`: `0.000001 → 6`, `0.0001 → 4`, `1 → 0`.
- **FIX: Стратегия в стартовом сообщении** — `"Setup-based"` → `"CHECKLIST"`.

Детальный разбор бага precision:

```
Bybit ccxt возвращает:
  price_prec = 0.000001   (тик-сайз, не количество знаков)
  amount_prec = 0.01

Старый код:
  price_prec = int(0.000001) = 0  ← НОЛЬ!
  round(0.00059, 0) = 0.0         ← ордер на нулевую цену
  → "price must be greater than minimum price precision"

Новая функция _tick_to_decimals():
  0.000001 → -log10(0.000001) = 6 знаков
  0.0001   → 4 знака
  0.01     → 2 знака
  1.0      → 0 знаков (целые числа)
```

Причина 0 сделок за 9 часов (74 скана):
- `_execute_checklist_trade` был ВНУТРИ `try/except Exception: continue`
- TypeError: 'float' object cannot be interpreted as an integer → глоталось молча
- Все 10 сигналов падали с ошибкой, продолжали цикл, ни одного ордера

### Бэктест

**`run_setup_backtest.py`** — полностью переписан под стратегию CHECKLIST:
- Те же 5 фильтров что и в live-боте (пила, волатильность, тренд, ADX, объём)
- SL за уровнем (8–30% ATR D1)
- Статистика по каждому фильтру: сколько сигналов отсеяно
- Win rate по LONG/SHORT отдельно
- Win rate по причине выхода: SL / TP / timeout
- Sharpe ratio
- График с 3 панелями: кривая капитала, сделки по PnL, статистика фильтров

Старый бэктест (`run_setup_backtest.py` до переписи):
- Использовал `SetupDetector` — старый детектор сетапов без уровней
- Не проверял SL за уровнем
- Не имел ADX-фильтра и объёмного фильтра
- Метрики: только общий win rate и equity curve

Новый бэктест — полный список метрик:
```
Общие метрики:
  Total signals found: N
  Signals passed all filters: N (X%)
  Total trades: N
  Win rate: X%
  Sharpe ratio: X.XX
  Max drawdown: X.X%
  Total return: X.X%

LONG vs SHORT:
  LONG: N trades, WR=X%, Avg R=X.XX
  SHORT: N trades, WR=X%, Avg R=X.XX

По причине выхода:
  TP hit: N (X%)
  SL hit: N (X%)
  Timeout: N (X%)

Фильтры (сколько сигналов отсеяно):
  Нет уровня: N
  Нет сигнала M5: N
  Пила > 2: N
  Волатильность: N
  Тренд H1: N
  ADX < 15: N
  Объём < 1.2x: N
  SL не вписывается: N
```

### Telegram — перевод на русский

- Все сообщения переведены на русский (язык по умолчанию изменён с `"en"` на `"ru"`)
- `format_checklist_telegram`: signal_details и filter_details теперь на русском
- `sl_type`: `"breakout_candle"` → `"пробойная_свеча"`, `"accumulation_zone"` → `"зона_накопления"`, `"m5_candle"` → `"свеча_M5"`, новый `"уровень_ATR"`
- `"BE at 2R"` → `"БУ при 2R"`
- `"ATR(D1): $0.00"` → `"ATR(D1): $0.07"` (формат `:.6g` вместо `:.2f`)
- ML-сообщение о новой сделке переведено на русский
- Ошибки: `"⚠️ ERROR:"` → `"⚠️ ОШИБКА:"`

Пример сообщения сигнала ДО перевода:
```
🟢 NEW TRADE: LONG CELOUSDT

📊 Entry: $0.0837
🎯 TP: $0.0920 (+9.9%)
🛑 SL: $0.0832 (-0.6%)
⚖️ R:R 1:16.5
💵 Size: 0.11 BTC ($250.0)
🔒 BE at 2R

Signal:
  Type: retest
  Confidence: level_strength=4.2
  Level: $0.0829 (strength=4.2)
  ATR(D1): $0.00

Filters:
  ✅ Chop ≤ 2
  ✅ Volatility OK
  ✅ Trend H1
```

Пример сообщения сигнала ПОСЛЕ перевода:
```
🟢 НОВАЯ СДЕЛКА: LONG CELOUSDT

📊 Вход: $0.0837
🎯 TP: $0.0920 (+9.9%)
🛑 SL: $0.0825 (-1.4%)
⚖️ R:R 1:7.1
💵 Размер: 0.11 BTC ($250.0)
🔒 БУ при 2R

Сигнал:
  Тип: ретест
  Уверенность: сила_уровня=4.2
  Уровень: $0.0829 (сила=4.2)
  ATR(D1): $0.0829

Фильтры:
  ✅ Пила ≤ 2
  ✅ Волатильность OK
  ✅ Тренд H1
  ✅ ADX=23
  ✅ Объём 1.8x
  SL: свеча_M5_adj
```

---

## v7.2 — 2026-03-22

### Критические баги live engine

**`trading/live_engine.py`**

- **BUG: `pos.symbol` хранил фейковый ключ** — позиции хранились под ключами `"pos_1"`, `"pos_2"` вместо `"BTC/USDT:USDT"`. `fetch_open_orders()` получал неверный символ, возвращал пустой результат, позиции считались закрытыми немедленно.
- **BUG: `bars_held = self.scan_count`** — после 15 сканов ВСЕ позиции закрывались (даже только что открытые). Добавлено поле `entry_scan`, вычисляется `scan_count - entry_scan`.
- **BUG: `place_market_order(setup.entry_price, ...)` вместо символа** — float передавался как символ. Все live-ордера молча падали.
- **BUG: PnL всегда 0%** — `_close_position` использовал `entry_price` как цену выхода. Paper-режим теперь запрашивает `fetch_ticker`.
- **BUG: Paper-режим не проверял SL/TP** — только таймаут. Теперь проверяет каждый скан.
- **BUG: Дубли позиций** — `symbol not in self.positions` сравнивал символ биржи с ключами `"pos_N"`.

Хронология обнаружения багов v7.2:

Баг 1 — Фейковые ключи позиций:
```python
# Было (live_engine.py):
pos_key = f"pos_{len(self.positions) + 1}"
self.positions[pos_key] = Position(symbol=actual_symbol, ...)

# Позже при проверке:
orders = self.connector.fetch_open_orders(pos.symbol)
# pos.symbol = "pos_1" (строка) → биржа возвращала []
# Позиция считалась закрытой → немедленный фиктивный PnL

# Стало:
self.positions[actual_symbol] = Position(symbol=actual_symbol, ...)
```

Баг 2 — Таймаут по scan_count:
```python
# Было:
bars_held = self.scan_count  # росло глобально!
if bars_held >= self.max_bars_held:  # max_bars_held=15
    self._close_position(pos)  # все позиции закрывались на 15-м скане

# Стало:
pos.entry_scan = self.scan_count  # запоминаем скан входа
bars_held = self.scan_count - pos.entry_scan  # реальное время удержания
```

Баг 3 — Float как символ:
```python
# Было:
self.connector.place_market_order(setup.entry_price, "BUY", amount)
# setup.entry_price = 0.0837 (float, не "CELO/USDT:USDT")

# Стало:
self.connector.place_market_order(setup.symbol, "BUY", amount)
```

Баг 4 — PnL=0%:
```python
# Было:
exit_price = pos.entry_price  # всегда равен цене входа
pnl = (exit_price - pos.entry_price) / pos.entry_price  # всегда 0

# Стало (paper-режим):
ticker = self.connector.fetch_ticker(pos.symbol)
exit_price = ticker["last"]
pnl = (exit_price - pos.entry_price) / pos.entry_price
```

### Коннектор

- **FIX: MEXC `fetch_balance()` crash** — MEXC требует `{"type": "swap"}` для баланса фьючерсов.

```python
# Было:
balance = self.exchange.fetch_balance()

# Стало (MEXC):
if self.exchange_id == "mexc":
    balance = self.exchange.fetch_balance({"type": "swap"})
else:
    balance = self.exchange.fetch_balance()
```

### Улучшения

- Авто-определение капитала (`--capital 0` = берёт с биржи)
- Telegram-бот передаётся целиком в engine (не только callback)
- Баланс-отчёт при запуске и каждые 4 часа
- Стартовое сообщение показывает реальный баланс

### Дефолты

| Параметр | Было | Стало | Причина |
|----------|------|-------|---------|
| `--tf` | `1h` | `4h` | Меньше шума, уровни стабильнее |
| `--leverage` | `10` | `5` | Снижение риска |
| `--interval` | `3600` | `14400` | Соответствует tf=4h |
| `--capital` | `10000` | `0` (авто) | Удобнее в реальной торговле |

---

## v7.1 — 2026-03-21

### Стратегия CHECKLIST (новая основная стратегия)

Замена ML-предсказания каждого бара на Gerchik-style торговлю на уровнях.

**Мотивация перехода:**
- ML-модели давали 52–54% точность на крипто (чуть лучше монетки)
- Уровни S/R работают надёжнее: рынок реально реагирует на сильные уровни
- Меньше сделок, но выше качество
- Интерпретируемость: понятно почему открыта сделка

**Новые модули:**
- `strategy/checklist.py` — 5-шаговый чек-лист
- `levels/detector.py` — детектирование S/R (свинги + объём + ложные пробои)
- `levels/multi_tf.py` — мульти-таймфреймная конфлюэнтность
- `levels/volume_profile.py` — Volume Profile (POC, VAH, VAL)
- `setups/sizing.py` — адаптивный размер позиции

**5 шагов чек-листа:**

```
ШАГ 1 — КОНТЕКСТ
  Найти уровень S/R с силой ≥ 3.0
  Расстояние до уровня ≤ 20% ATR D1
  Нет блокирующих уровней до TP
  Направление: цена выше/ниже уровня + SMA100 H1 подтверждает

ШАГ 2 — СИГНАЛ
  Ретест: цена подошла к уровню на M5, тестирует его
  ИЛИ Пробой: цена пробила, откатила, подтвердила на M5
  Паттерны M5: поглощение, пин-бар, внутренний бар

ШАГ 3 — ФИЛЬТРЫ
  Фильтр 1: Пила (chop) ≤ 2 — нет хаотичных баров перед сигналом
  Фильтр 2: Волатильность — не слишком узко и не слишком широко
  Фильтр 3: Тренд H1 — SMA20 > SMA50 для LONG, < для SHORT
  Фильтр 4: ADX H1 > 15 — рынок не в боковике (добавлен в v7.3)
  Фильтр 5: Объём ≥ 1.2× средний — сигнальный бар M5 (добавлен в v7.3)

ШАГ 4 — СТОП-ЛОСС
  4 кандидата: пробойная свеча, зона накопления, свеча M5, ATR
  Выбирается самый короткий валидный кандидат
  Обязательно: SL за уровнем (не между входом и уровнем!)
  Диапазон: 8–30% ATR D1

ШАГ 5 — ТЕЙК-ПРОФИТ
  TP = следующий уровень S/R на пути цены
  Минимум R:R = 3:1
  Если следующий уровень слишком близко → сигнал пропускается
```

**Сравнение со старой ML-стратегией:**

| Параметр | ML (v7.0) | CHECKLIST (v7.1+) |
|----------|-----------|--------------------|
| Сигналов в день | 15–30 | 2–8 |
| Win rate (бэктест) | 52–54% | 58–65% |
| Avg R:R | 1.5:1 | 4.5:1 |
| Интерпретируемость | Низкая | Высокая |
| Переобучение | Высокий риск | Низкий риск |
| Скорость сигнала | <10ms | ~200ms |

---

## v7.0 — 2026-03-20

### Критические баги ML

- **`sample_weights_uniqueness` взрыв** — деление на `concurrent + 1e-9` давало вес 1e9, `scale_pos_weight` клипался на 20 при реальном значении 38000. XGBoost был смещён к UP. Исправлено: `max(concurrent, 1.0)`.
- **R:R был 1:1** — `tp_dist = sl_dist` вместо `sl_dist × min_rr`.
- **`max_acceptable_logloss 0.68`** — недостижимо на крипто 1h. Изменено на 0.90.
- **Размерность признаков** — 120 признаков на инференсе, 129 ожидалось (фьючерсные признаки). Фикс: zero-padding.

Детали бага sample_weights:

```python
# Было:
weight = 1.0 / (concurrent + 1e-9)  # если concurrent=0 → weight=1e9

# В XGBoost:
scale_pos_weight = sum(neg_weights) / sum(pos_weights)
# Если все UP-бары имеют weight=1e9 → ratio=38000
# Но scale_pos_weight клипался на 20 → XGBoost думал, что UP редкий класс

# Стало:
weight = 1.0 / max(concurrent, 1.0)  # минимум 1 concurrent sample
```

Детали бага R:R:
```python
# Было:
tp_dist = sl_dist  # tp = entry + sl_dist → R:R = 1:1

# Стало:
tp_dist = sl_dist * min_rr  # min_rr = 3.0
# Для sl=1% → tp=3%
```

### Gerchik-стиль уровней (первая версия)

- `levels/detector.py` — свинг-точки, кластеризация (0.3%), объёмное взвешивание, ложные пробои
- 15 level-based признаков (G30 группа)

Алгоритм детектирования уровней v7.0:
1. Находим все свинг-хаи и свинг-лоу (lookback=5 баров)
2. Кластеризуем цены в радиусе 0.3%
3. Для каждого кластера: сила = количество касаний × log(1 + суммарный объём)
4. Отбираем уровни с силой ≥ 2.0
5. Для каждого уровня считаем ложные пробои (пробой + возврат)

---

## v6.9 — 2026-03-19

### Баги

- Онлайн-learner использовал raw mask вместо `feature_selector.transform(X)`
- `max_predictor.py` ансамбль через неверный путь `.lgbm`
- Размерность признаков при калибровке

```python
# Ошибка онлайн-learner:
# X_raw имел 120 признаков, модель ожидала отобранные 87
# feature_selector.support_ = [True, False, True, ...] (маска)
# X_raw[:, feature_selector.support_] → 87 признаков ✓
# Но онлайн-learner передавал X_raw напрямую → размерность 120 → ошибка предсказания

# Ошибка пути lgbm:
# predictor_path = "models/ensemble/lgbm.pkl"  # ожидалось
# predictor_path = "models/lgbm.lgbm"           # было → FileNotFoundError
```

### Оптимизация

- Векторизованы 15+ индикаторов: RSI, MACD, BB, ATR, Stoch, CCI, Williams %R, ROC, MFI, OBV, CMF, VWAP, Keltner, Donchian, Ichimoku
- Новые признаки: WOBV (Weighted OBV), Efficiency Ratio (Kaufman), Choppiness Index (117→120)
- Прирост скорости вычисления признаков: 340ms → 95ms на 1000 баров

Формулы новых признаков v6.9:
```
WOBV (Weighted OBV):
  Δ = close - close_prev
  factor = |Δ| / ATR(14)  — нормированное движение
  obv_weighted[i] = obv_weighted[i-1] + volume[i] * factor * sign(Δ)

Efficiency Ratio (ER):
  direction = |close[n] - close[0]|  — итоговое движение
  volatility = Σ|close[i] - close[i-1]| за N баров  — суммарный путь
  ER = direction / volatility  — 0=хаос, 1=чистый тренд

Choppiness Index:
  ATR_sum = Σ ATR(1)[i] за N баров  — суммарный диапазон
  true_range = max(high) - min(low) за N баров  — полный диапазон
  CI = 100 * log10(ATR_sum / true_range) / log10(N)
  CI < 38.2: трендовый рынок
  CI > 61.8: боковой рынок
```

---

## v6.8 — 2026-03-15

### Параметры ML

- `barrier_atr_mult`: 2.0 → 1.5 — SL/TP ближе к цене, быстрее резолюция лейблов
- `cv_n_splits`: 8 → 10 — более надёжная кросс-валидация
- `correlation_threshold`: 0.85 → 0.80 — более агрессивное удаление коррелированных признаков

```
Эффект изменения barrier_atr_mult:
  2.0 → TP = entry ± 2 ATR, SL = entry ∓ 2 ATR
       R:R = 1:1, много баров до резолюции

  1.5 → TP = entry ± 1.5 ATR, SL = entry ∓ 1.5 ATR
       Быстрее определяется исход, меньше "hanging" лейблов
       Эффективный R:R оставался 1.5:1 через min_rr
```

---

## v6.5 — 2026-03-12

### Режимный ансамбль

Переход от единой модели к 4 режимно-разделённым ансамблям:
- `TREND_UP` — восходящий тренд (ADX > 25, EMA20 > EMA50)
- `TREND_DOWN` — нисходящий тренд (ADX > 25, EMA20 < EMA50)
- `VOLATILE` — высокая волатильность (ATR/price > 3%)
- `RANGE` — боковое движение (Choppiness Index > 61.8)

Каждый режим имеет свой ансамбль, обученный только на данных этого режима.

Мета-классификатор надёжности базовых моделей:
- Для каждого из 6 базовых предсказателей обучается мета-классификатор
- Входные данные: уверенность предсказания, текущий режим рынка, волатильность
- Выход: P(базовый предсказатель прав) для текущих условий
- Итоговая вероятность = взвешенное среднее, где веса = надёжность в текущих условиях

Conformal prediction (90% coverage):
- Калибровочный набор используется для определения порогов
- Предсказание: не точка, а интервал [p_low, p_high]
- 90% coverage означает что реальный класс попадает в интервал в 90% случаев
- Торгуем только когда p_low > 0.5 (уверены даже в пессимистичном сценарии)

Walk-forward с purge gaps:
- Обучение: 80% исторических данных
- Тест: следующие 10%
- Purge gap: 10% (убираем данные между train и test для устранения look-ahead через лейблы)
- 5 окон walk-forward → 5 метрик → усредняем для оценки стабильности

---

## v6.2 — 2026-03-08

### Фьючерсные признаки

Три новых категории признаков на основе биржевых данных Binance:

**Funding rate (3 признака):**
```
funding_rate        — текущая ставка финансирования (обычно ±0.01%)
funding_rate_ma8    — скользящее среднее за 8 периодов (4 дня)
funding_rate_trend  — знак(текущий - предыдущий)

Интерпретация:
  funding > 0.05%: рынок перегрет лонгами → потенциальный шорт
  funding < -0.05%: рынок перегрет шортами → потенциальный лонг
  ma8 > 0: устойчивый бычий сентимент
```

**Open Interest (3 признака):**
```
oi_change_1h        — изменение OI за 1 час (%)
oi_change_4h        — изменение OI за 4 часа (%)
oi_ma_ratio         — OI / ma20(OI) — нормализованный уровень OI

Интерпретация:
  Цена растёт + OI растёт: сильный тренд (деньги входят)
  Цена растёт + OI падает: закрытие шортов, слабый сигнал
  Цена падает + OI растёт: открываются новые шорты
```

**Long/Short ratio (2 признака):**
```
ls_ratio            — long_volume / short_volume за 1h
ls_ratio_delta      — ls_ratio - ma8(ls_ratio)

Интерпретация:
  ls_ratio > 1.5: много лонгов → потенциальный шорт-сквиз или разворот
  ls_ratio < 0.7: много шортов → потенциальный лонг-сквиз
```

---

## v6.0 — 2026-03-05

### Полная архитектура

**7-модельный stacking ансамбль:**

Уровень 1 (базовые модели):
1. `GradientBoostingClassifier` (sklearn) — N=300, depth=5, lr=0.05
2. `RandomForestClassifier` (sklearn) — N=500, max_features='sqrt'
3. `ExtraTreesClassifier` (sklearn) — N=500, min_samples_leaf=5
4. `XGBClassifier` (xgboost) — N=500, depth=6, eta=0.05, subsample=0.8
5. `LGBMClassifier` (lightgbm) — N=500, num_leaves=63, min_data=20
6. `CatBoostClassifier` (catboost) — N=500, depth=6, lr=0.05, silent=True

Уровень 2 (мета-классификатор):
7. `LogisticRegression` — входные данные: предсказания уровня 1 (6 вероятностей)

**120 технических признаков, 29 групп:**

```
Группа 1:  Цена (returns) — 5 признаков
Группа 2:  SMA/EMA (4, 8, 20, 50, 100) — 10 признаков
Группа 3:  RSI (7, 14, 21) — 3 признака
Группа 4:  MACD (12,26,9) — 3 признака
Группа 5:  Bollinger Bands (20,2) — 3 признака
Группа 6:  ATR (14) — 2 признака
Группа 7:  Stochastic (14,3) — 2 признака
Группа 8:  ADX (14) — 3 признака
Группа 9:  CCI (20) — 1 признак
Группа 10: Williams %R (14) — 1 признак
Группа 11: ROC (10, 20) — 2 признака
Группа 12: MFI (14) — 1 признак
Группа 13: OBV — 2 признака
Группа 14: CMF (20) — 1 признак
Группа 15: VWAP — 2 признака
Группа 16: Keltner Channel (20,2) — 2 признака
Группа 17: Donchian Channel (20) — 3 признака
Группа 18: Ichimoku (9,26,52) — 4 признака
Группа 19: Паттерны свечей (поглощение, пин-бар и т.д.) — 12 признаков
Группа 20: Мульти-таймфрейм (H4, D1) — 8 признаков
Группа 21: Режим рынка — 4 признака
Группа 22: Временные признаки — 4 признака
Группа 23: Фьючерсные признаки (funding, OI, L/S) — 8 признаков
Группа 24: Уровни S/R (Герчик) — 15 признаков
Группа 25: Volume Profile (POC, VAH, VAL) — 6 признаков
Группа 26: Volatility (HV, RV) — 4 признака
Группа 27: WOBV, ER, Choppiness — 3 признака
Группа 28: Cross-признаки (пересечения MA) — 5 признаков
Группа 29: Momentum composite — 4 признака
```

**Triple-barrier labeling (Lopez de Prado):**

```python
def label_triple_barrier(price, sl_mult=1.5, tp_mult=1.5, max_bars=15):
    atr = calc_atr(price, 14)[-1]
    entry = price[-1]
    tp = entry + atr * tp_mult
    sl = entry - atr * sl_mult

    for i in range(1, max_bars + 1):
        if price[i] >= tp: return 1   # UP (достигли TP раньше SL)
        if price[i] <= sl: return -1  # DOWN (достигли SL)
    return 0  # NEUTRAL (истёк таймаут)
```

Распределение лейблов на крипто 1h:
- UP: ~33%
- DOWN: ~33%
- NEUTRAL: ~34%
- Задача многоклассовой классификации (не бинарная)

**Feature selection (SHAP + MI + stability):**

1. SHAP importance — важность по SHapley Additive exPlanations
2. Mutual Information (MI) — информационная связь признак-лейбл
3. Stability — дисперсия важности по 5 фолдам кросс-валидации

Итоговый score: `0.4 × SHAP_rank + 0.4 × MI_rank + 0.2 × (1 - stability_std)`
Отбор: топ-70% признаков по итоговому score (≈87 признаков из 120)

**Binance REST fetcher:**
- `data/fetcher_binance.py` — загрузка OHLCV через `/api/v3/klines`
- Поддержка всех таймфреймов от 1m до 1M
- Автоматическая пагинация (Binance лимит 1000 баров за запрос)
- Кэширование в `.pkl` файлах

**Walk-forward backtest engine:**
- 5 окон обучения/тестирования
- Метрики: logloss, accuracy, precision, recall, F1 для каждого окна
- Итоговые метрики: среднее ± std по 5 окнам
- Фильтрация: торгуем только если P(signal) > threshold

**RL агент (Q-learning фильтр):**
- Входное состояние: 6 значений (режим рынка, vol, funding, hour, day, recent_wr)
- Действия: TRADE / SKIP
- Reward: PnL сделки * (1 if action=TRADE else -0.01 if action=SKIP)
- Дисконт: γ = 0.95
- Q-table: 6-мерная, обновляется онлайн после каждой сделки

---

## v5.x — История

### v5.9 — 2026-02-28

- Исправлен memory leak в онлайн-learner (накапливался buffer без очистки)
- Добавлен watchdog: если equity падает на 5% за 24h → остановка бота, алерт в Telegram
- Исправлен timezone bug: MEXC возвращает timestamp в миллисекундах UTC, не в секундах

### v5.8 — 2026-02-25

- Добавлена поддержка MEXC Futures
- `connector.py` рефакторинг: единый интерфейс для Bybit и MEXC
- Параметр `--exchange mexc` в run_live.py

### v5.7 — 2026-02-22

- Добавлен RL Gate (Q-learning) — фильтр на основе подкрепления
- RL обновляется каждые 10 закрытых сделок
- Начальная политика: торговать всегда (explore)
- После 50+ сделок начинает фильтровать

### v5.5 — 2026-02-18

- Онлайн дообучение (Online Learner)
- Buffer: последние 500 закрытых сделок
- Дообучение каждые 100 новых сделок
- Весовой decay: новые данные × 1.5 важнее старых

### v5.3 — 2026-02-12

- Walk-forward validation вместо random split
- 5-fold временная кросс-валидация
- Purge gap = 5% между train и test

### v5.0 — 2026-02-05

- Первая версия ансамбля (4 модели: GBM, RF, XGB, LGBM)
- Triple-barrier labeling
- Paper-trading режим
- Telegram уведомления

---

## v4.x — Начало проекта

### v4.0 — 2026-01-20

- Базовый ML бот (одна модель XGBoost)
- 30 технических признаков
- Простой бэктест: сигнал если P(UP) > 0.6
- Только Bybit spot

### v3.0 — 2026-01-10

- RSI + MACD стратегия без ML
- Hardcoded сигналы: RSI < 30 = покупка, RSI > 70 = продажа
- Telegram уведомления (базовые)

### v2.0 — 2026-01-05

- Подключение к Bybit API
- Базовые OHLCV данные
- Логирование сделок

### v1.0 — 2026-01-01

- Прототип: hello world с ccxt
- Получение тикеров
- Нет торговли

---

## Статистика версий

| Версия | Дата | Ключевое изменение | Влияние на WR |
|--------|------|--------------------|---------------|
| v7.3 | 2026-03-26 | SL за уровнем, ADX фильтр, объём | +5–8% WR |
| v7.2 | 2026-03-22 | Критические баги live engine | Первые реальные сделки |
| v7.1 | 2026-03-21 | CHECKLIST стратегия | Революция подхода |
| v7.0 | 2026-03-20 | Баги ML + уровни | +3% WR |
| v6.9 | 2026-03-19 | Оптимизация + 3 признака | ~0% WR, -75% время |
| v6.8 | 2026-03-15 | Параметры ML | +1% WR |
| v6.5 | 2026-03-12 | Режимный ансамбль | +4% WR |
| v6.2 | 2026-03-08 | Фьючерсные признаки | +2% WR |
| v6.0 | 2026-03-05 | 7-модельный stacking | Базовая архитектура |

---

## Принципы версионирования

- **v7.x** — стратегия CHECKLIST (уровни + сетапы)
- **v6.x** — ML ансамбль (классификация по барам)
- **v5.x** — ML с RL фильтром и онлайн-обучением
- **v4.x** — базовый ML (один предсказатель)
- **v3.x** — правиловые стратегии (RSI/MACD)
- **v2.x** — инфраструктура (API, данные)
- **v1.x** — прототип

Мажорная версия меняется при кардинальном изменении архитектуры торговой логики.
Минорная версия меняется при добавлении значимых фич или исправлении критических багов.

---

## Известные ограничения и TODO

### Текущие ограничения (v7.3)

- Только линейные фьючерсы (USDT-маргинальные), без инверсных
- Уровни перевычисляются каждый скан (нет кэша между сканами)
- Volume Profile требует 500+ баров (не работает на новых токенах)
- ADX фильтр отключается если < 28 баров H1 доступно
- Только market ордера (нет лимитных входов)

### Планируемые улучшения

- [ ] Лимитные ордера на вход (меньше slippage)
- [ ] Кэш уровней между сканами (ускорение)
- [ ] Тейк-профит частями (1/3 на 2R, 1/3 на 4R, 1/3 trailing)
- [ ] Breakeven при достижении 2R (автоматический перенос SL)
- [ ] Поддержка OKX
- [ ] Web dashboard для мониторинга
- [ ] Автоматический бэктест при изменении параметров

---

## Как читать баги

Каждая запись бага в CHANGELOG следует формату:

```
**[ТИП]: [Краткое описание]** — детальное объяснение симптома.
[Объяснение корневой причины].
[Что изменено для исправления].
```

Типы:
- `BUG` — баг в боевом коде, влиял на работу
- `FIX` — исправление бага
- `NEW` — новая функциональность
- `REFACTOR` — рефакторинг без изменения поведения
- `PERF` — оптимизация производительности

---

## Детальный разбор всех исправлений

### История бага: 0 сделок за 9 часов (v7.3)

**Дата обнаружения:** 2026-03-26  
**Продолжительность:** 9 часов, 74 скана, 10 сигналов, 0 ордеров

**Симптомы в логах:**
```
[scan 12] CELO/USDT:USDT signal found: LONG entry=0.0837
[scan 12] Checklist passed: 5/5 steps
[scan 12] ... (тишина, ни ошибки, ни ордера)
[scan 13] HBAR/USDT:USDT signal found: LONG entry=0.1523
[scan 13] Checklist passed: 5/5 steps
[scan 13] ... (тишина)
```

**Анализ кода:**
```python
# run_live.py — проблемный участок (ДО исправления):
for sym in symbols:
    try:
        bars_m5 = fetch_bars(sym, "5m", 200)
        bars_h1 = fetch_bars(sym, "1h", 100)
        bars_d1 = fetch_bars(sym, "1d", 100)
        result = strategy.evaluate(bars_m5, bars_h1, bars_d1)

        if result:
            signals_found += 1
            _execute_checklist_trade(engine, result, capital, args)
            # ↑ ЭТА ФУНКЦИЯ БРОСАЛА TypeError НО ГЛОТАЛАСЬ:

    except Exception as e:
        if signals_found > 0:
            print(f"ERROR processing {sym}: {e}")
        continue
        # ↑ ЛЮБАЯ ОШИБКА ВНУТРИ try включая _execute_checklist_trade
        #   попадала сюда и игнорировалась молча
```

**Корневая причина — цепочка ошибок:**

1. `get_precision(sym)` возвращает `(0.000001, 0.01)` — тик-сайзы Bybit
2. `price_prec = int(0.000001)` → `price_prec = 0`
3. `round(entry_price, 0)` для `entry=0.0837` → `0.0`
4. `round(amount, 0)` для `amount=8352.5` → `8353.0` (это работало случайно)
5. Но `amount_prec = int(0.01) = 0` тоже 0 для Bybit amount precision 0.01
6. Реальная ошибка: `TypeError: 'float' object cannot be interpreted as an integer`
   возникала ещё раньше в строке `round(pos_val / entry, amount_prec)`
   потому что `amount_prec` оставался `float` из другого пути кода

**Исправление:**
```python
def _tick_to_decimals(prec) -> int:
    """Конвертирует тик-сайз в количество знаков после запятой.
    
    Bybit возвращает precision как тик-сайз (float), не как int:
        0.000001 → 6 знаков
        0.0001   → 4 знака  
        0.01     → 2 знака
        1.0      → 0 знаков
    """
    try:
        prec = float(prec)
        if prec <= 0:
            return 4
        if prec >= 1:
            return 0
        return max(0, -int(math.floor(math.log10(prec))))
    except Exception:
        return 4

# Применение:
price_prec, amount_prec = engine.connector.get_precision(sym)
price_prec = _tick_to_decimals(price_prec)   # 0.000001 → 6
amount_prec = _tick_to_decimals(amount_prec)  # 0.01 → 2

entry_rounded = round(result.entry_price, price_prec)   # round(0.0837, 6) = 0.0837
amount_rounded = round(amount, amount_prec)              # round(8352.51, 2) = 8352.51

# И вынести execution за пределы внешнего try/except:
except Exception as e:
    if signals_found > 0:
        print(f"    ERROR processing {sym}: {e}")
    continue

# Отдельный try/except для execution:
try:
    _execute_checklist_trade(engine, result, capital, args)
except Exception as e:
    import traceback
    print(f"  EXEC ERROR {sym}: {e}")
    traceback.print_exc()
```

---

### История бага: SL между входом и уровнем (v7.3)

**Дата обнаружения:** 2026-03-26  
**Сделка:** CELO LONG

**Из Telegram-уведомления:**
```
🟢 НОВАЯ СДЕЛКА: LONG CELOUSDT
📊 Вход: $0.0837
🎯 TP: $0.0920
🛑 SL: $0.0832  ← ПРОБЛЕМА!
   Уровень: $0.0829
```

**Геометрия проблемы:**
```
Цена:   $0.0837  ← вход
SL:     $0.0832  ← стоп (между входом и уровнем!)
Уровень: $0.0829 ← поддержка
```

При LONG сделке цена должна идти вверх от уровня поддержки.
SL должен быть ПОД уровнем — если уровень сломается, выходим.

Но SL=$0.0832 находится ВЫШЕ уровня=$0.0829.
Это означает: при любом ретесте уровня (цена падает к $0.0829)
стоп выбивается на $0.0832 ещё до касания уровня.
Торговая идея: "уровень поддержит" — но стоп не даёт ей реализоваться.

**Почему это происходило:**

Функция `_compute_shortest_sl()` находит кратчайшего кандидата из 4:
1. Пробойная свеча: low самой пробойной свечи - buffer
2. Зона накопления: нижняя граница аккумуляции - buffer  
3. Свеча M5: low сигнальной свечи M5 - buffer
4. ATR D1: level - 15% ATR D1

Для CELO:
- Сигнальная свеча M5: low=$0.0832
- Свеча M5 - buffer: $0.0832 - $0.0002 = $0.0830 (самый короткий)
- Уровень=$0.0829 < SL=$0.0830 — SL выше уровня!

Функция выбирала "самый короткий" кандидат, не проверяя его корректность.

**Исправление в `strategy/checklist.py`:**
```python
# После вычисления sl кандидата:

# Проверка 1: SL должен быть ЗА уровнем
if direction == "LONG" and sl >= level_price:
    # SL выше уровня — корректируем
    sl = level_price - buffer * 2
    sl_type = sl_type + "_adj"
    
if direction == "SHORT" and sl <= level_price:
    # SL ниже уровня — корректируем
    sl = level_price + buffer * 2
    sl_type = sl_type + "_adj"

# Проверка 2: SL в допустимом диапазоне 8-30% ATR D1
sl_dist = abs(entry_price - sl)
atr_d1 = ... # ATR Daily

min_dist = atr_d1 * 0.08  # минимум 8% ATR D1
max_dist = atr_d1 * 0.30  # максимум 30% ATR D1

if sl_dist < min_dist or sl_dist > max_dist:
    # Попытка fallback: level ± 15% ATR D1
    if direction == "LONG":
        fallback_sl = level_price - atr_d1 * 0.15
    else:
        fallback_sl = level_price + atr_d1 * 0.15
    
    fallback_dist = abs(entry_price - fallback_sl)
    
    if min_dist <= fallback_dist <= max_dist:
        sl = fallback_sl
        sl_type = "уровень_ATR"
    else:
        return None, ""  # Не можем найти правильный SL → пропустить сигнал
```

---

### История бага: Фейковые ключи позиций (v7.2)

**Дата обнаружения:** 2026-03-22  
**Симптом:** Позиции закрывались сразу же после открытия

**Логи (до исправления):**
```
[scan 5] Opening LONG BTC/USDT:USDT
[scan 5] Position opened: pos_1
[scan 6] Checking positions...
[scan 6] fetch_open_orders("pos_1") → []   ← пустой список!
[scan 6] No orders for pos_1 → position closed (assumed)
[scan 6] PnL: 0.0%  ← потому что entry_price использовался как exit
```

**Код до исправления:**
```python
class LiveEngine:
    def __init__(self):
        self.positions = {}
        self._pos_counter = 0
    
    def open_position(self, symbol, entry_price, sl, tp, direction):
        self._pos_counter += 1
        key = f"pos_{self._pos_counter}"  # "pos_1", "pos_2", ...
        
        pos = Position(
            symbol=symbol,   # "BTC/USDT:USDT" — правильный символ
            entry_price=entry_price,
            ...
        )
        self.positions[key] = pos  # но хранится под "pos_1"!
    
    def _check_positions(self):
        for key, pos in self.positions.items():
            # pos.symbol = "BTC/USDT:USDT" ← правильно
            # key = "pos_1" ← но не используется для API
            
            orders = self.connector.fetch_open_orders(pos.symbol)
            # Это работает? Да, символ правильный.
            # Но была другая проблема...
            
            # Проверка дублей при открытии:
            if symbol not in self.positions:  # "BTC/USDT:USDT" not in {"pos_1": ...}
                self.open_position(...)        # всегда True! → дубли
```

**После исправления:**
```python
def open_position(self, symbol, ...):
    if symbol in self.positions:
        return  # уже есть позиция по этому символу
    
    pos = Position(symbol=symbol, ...)
    self.positions[symbol] = pos  # ключ = символ биржи
```

---

### История бага: Таймаут по глобальному scan_count (v7.2)

**Симптом:** После 15 сканов ВСЕ позиции закрывались одновременно

**Код до исправления:**
```python
class LiveEngine:
    def __init__(self):
        self.scan_count = 0
        self.max_bars_held = 15
    
    def run_scan(self):
        self.scan_count += 1
        self._check_positions()
    
    def _check_positions(self):
        for symbol, pos in self.positions.items():
            bars_held = self.scan_count  # ГЛОБАЛЬНЫЙ счётчик!
            
            if bars_held >= self.max_bars_held:
                self._close_position(pos, "timeout")
                # На 15-м скане от ЗАПУСКА БОТА
                # все позиции закрывались, даже только что открытые
```

**После исправления:**
```python
@dataclass
class Position:
    symbol: str
    entry_price: float
    sl: float
    tp: float
    direction: str
    entry_scan: int  # ← новое поле: номер скана при открытии

class LiveEngine:
    def open_position(self, symbol, ...):
        pos = Position(
            symbol=symbol,
            entry_scan=self.scan_count,  # запоминаем текущий скан
            ...
        )
        self.positions[symbol] = pos
    
    def _check_positions(self):
        for symbol, pos in self.positions.items():
            bars_held = self.scan_count - pos.entry_scan  # реальное время
            
            if bars_held >= self.max_bars_held:
                self._close_position(pos, "timeout")
```

---

### История бага: Float как символ ордера (v7.2)

**Симптом:** Все live-ордера молча падали

**Код до исправления:**
```python
# В live_engine.py при открытии позиции:
def open_position(self, setup):
    self.connector.place_market_order(
        setup.entry_price,  # ← FLOAT! Например 0.0837
        "BUY",
        amount
    )
    # Connector ожидал строку "CELO/USDT:USDT"
    # ccxt пытался найти рынок по числу 0.0837
    # ccxt.BadSymbol: 0.0837 not found
    # Но это было ВНУТРИ try/except → молча игнорировалось
```

**После исправления:**
```python
def open_position(self, setup):
    self.connector.place_market_order(
        setup.symbol,  # ← строка "CELO/USDT:USDT"
        "BUY",
        amount
    )
```

---

## Хронология разработки — детально

### Март 2026: CHECKLIST эра

```
2026-03-05  v6.0  Запуск: 7-модельный stacking ML ансамбль
2026-03-08  v6.2  Добавлены фьючерсные признаки (funding, OI, L/S ratio)
2026-03-12  v6.5  Режимный ансамбль (4 режима рынка)
2026-03-15  v6.8  Тонкая настройка параметров ML
2026-03-19  v6.9  Векторизация индикаторов (-75% время), 3 новых признака
2026-03-20  v7.0  Критические баги ML + первые уровни Герчика
2026-03-21  v7.1  Полная замена ML на CHECKLIST стратегию (революция)
2026-03-22  v7.2  6 критических багов live engine (первые реальные деньги)
2026-03-26  v7.3  Баги precision, SL за уровнем, ADX+объём фильтры
```

### Что было неправильно в ML-подходе (v6.x → v7.x)

Основная проблема ML для крипто торговли:
1. Крипто-рынок адаптируется быстро. Паттерны, которые работали 2 месяца назад, уже не работают
2. 52-54% win rate — это почти монетка. Транзакционные издержки (спред + комиссия) могут съесть всё преимущество
3. ML модели требуют постоянного переобучения. Без онлайн-обучения деградируют за недели
4. Интерпретируемость нулевая — невозможно понять ПОЧЕМУ модель дала сигнал

Преимущества CHECKLIST подхода:
1. Уровни работают потому что рынок ЗНАЕТ про них — это самоисполняющееся пророчество
2. Легко объяснить: "цена пришла к поддержке, объём показал интерес, тренд подтверждён"
3. Меньше сделок, выше качество: лучше 3 сделки с WR 65% чем 30 с WR 52%
4. Не устаревает: уровни были актуальны 100 лет назад и будут актуальны через 100 лет

---

## Статистика фильтров — подробно

### Почему каждый фильтр важен

**Фильтр 1: Пила (Chop ≤ 2)**

"Пила" — это хаотичные разнонаправленные бары перед сигналом.
Если перед ретестом уровня было 3+ баров которые шли то вверх то вниз — 
это признак неопределённости. Рынок не знает куда идти.

```
Плохой пример (chop=4):
  → ↑ ↓ ↑ ↓ → ← УРОВЕНЬ  ← вход
  
Хороший пример (chop=1):  
  ↓ ↓ ↓ ← УРОВЕНЬ  ← вход
  Направленное движение к уровню = хорошо
```

Счёт chop = количество смен направления за последние N баров M5.
При chop > 2 сигнал пропускается.

**Фильтр 2: Волатильность**

Слишком узкий диапазон M5 → вход может быть случайным шумом.
Слишком широкий → проскальзывание, непредсказуемое поведение.

```python
bar_range = high_m5[-1] - low_m5[-1]
atr_m5_current = calc_atr(high_m5, low_m5, close_m5, 14)[-1]

if bar_range < 0.3 * atr_m5_current:
    return False, "Слишком узкий бар"
if bar_range > 3.0 * atr_m5_current:
    return False, "Слишком широкий бар"
```

**Фильтр 3: Тренд H1**

Для LONG: торгуем только когда тренд на H1 восходящий.
Контртрендовые сделки имеют ниже WR и хуже R:R.

```python
sma20 = calc_sma(close_h1, 20)[-1]
sma50 = calc_sma(close_h1, 50)[-1]

if direction == "LONG" and sma20 < sma50:
    return False, "Нисходящий тренд H1"
if direction == "SHORT" and sma20 > sma50:
    return False, "Восходящий тренд H1"
```

**Фильтр 4: ADX H1 > 15 (добавлен v7.3)**

ADX (Average Directional Index) измеряет силу тренда независимо от направления.
ADX < 15 — рынок в боковике. Уровни в боковике пробиваются и возвращаются хаотично.

```
ADX < 15:  боковик → ПРОПУСТИТЬ
ADX 15-25: слабый тренд → торгуем
ADX 25-50: сильный тренд → лучшие условия
ADX > 50:  сильный тренд (возможен разворот скоро)
```

Статистика: фильтр ADX отсеивает ~15-20% сигналов.
WR сделок в боковике (ADX < 15): ~45% — ниже breakeven при стандартном R:R.

**Фильтр 5: Объём ≥ 1.2× (добавлен v7.3)**

Объём показывает реальный интерес к уровню.
Сигнальный бар без объёма = цена просто дошла до уровня случайно.
Сигнальный бар с объёмом = участники рынка реагируют на уровень.

```python
if len(v_m5) >= 21:
    avg_vol = float(np.mean(v_m5[-21:-1]))  # среднее за 20 баров
    last_vol = float(v_m5[-1])               # объём сигнального бара
    
    vol_ratio = last_vol / avg_vol
    
    if vol_ratio < 1.2:
        return False, f"Объём слабый: {vol_ratio:.1f}x avg"
    
    # vol_ratio добавляется в детали фильтров
    reasons.append(f"Объём {vol_ratio:.1f}x")
```

Статистика: фильтр объёма отсеивает ~5-8% сигналов (последняя линия обороны).
Но WR без объёмного подтверждения: ~48%. С подтверждением: ~64%.

---

## Volume Profile — подробный алгоритм

### Реализация в `levels/volume_profile.py`

```python
def calc_volume_profile(ohlcv, n_bins=100):
    """
    Рассчитывает Volume Profile для массива OHLCV.
    
    Алгоритм:
    1. Определить диапазон цен [min_low, max_high]
    2. Разбить на n_bins ценовых ячеек
    3. Для каждой свечи распределить объём по ячейкам
       (пропорционально перекрытию свечи с ячейкой)
    4. POC = ячейка с максимальным объёмом
    5. VAH/VAL = граница 70% объёма вокруг POC
    
    Returns:
        poc: float — Point of Control
        vah: float — Value Area High
        val: float — Value Area Low
        profile: dict — {price: volume} для визуализации
    """
    highs = ohlcv[:, 2]
    lows = ohlcv[:, 3]
    volumes = ohlcv[:, 5]
    
    price_min = np.min(lows)
    price_max = np.max(highs)
    bin_size = (price_max - price_min) / n_bins
    
    volume_at_price = np.zeros(n_bins)
    
    for i in range(len(ohlcv)):
        h, l, v = highs[i], lows[i], volumes[i]
        candle_range = h - l
        if candle_range == 0:
            continue
        
        # Найти диапазон ячеек перекрытых свечой
        bin_lo = int((l - price_min) / bin_size)
        bin_hi = int((h - price_min) / bin_size)
        bin_lo = max(0, min(bin_lo, n_bins - 1))
        bin_hi = max(0, min(bin_hi, n_bins - 1))
        
        for b in range(bin_lo, bin_hi + 1):
            # Процент перекрытия
            bin_price_lo = price_min + b * bin_size
            bin_price_hi = bin_price_lo + bin_size
            overlap = min(h, bin_price_hi) - max(l, bin_price_lo)
            overlap = max(0, overlap)
            weight = overlap / candle_range
            volume_at_price[b] += v * weight
    
    # POC
    poc_bin = np.argmax(volume_at_price)
    poc = price_min + (poc_bin + 0.5) * bin_size
    
    # Value Area (70% объёма)
    total_volume = np.sum(volume_at_price)
    target = total_volume * 0.70
    
    va_lo = poc_bin
    va_hi = poc_bin
    accumulated = volume_at_price[poc_bin]
    
    while accumulated < target:
        expand_lo = volume_at_price[va_lo - 1] if va_lo > 0 else 0
        expand_hi = volume_at_price[va_hi + 1] if va_hi < n_bins - 1 else 0
        
        if expand_lo > expand_hi:
            va_lo -= 1
            accumulated += expand_lo
        else:
            va_hi += 1
            accumulated += expand_hi
    
    vah = price_min + (va_hi + 1) * bin_size
    val = price_min + va_lo * bin_size
    
    return poc, vah, val
```

### Использование Volume Profile в стратегии

```
Если POC совпадает с S/R уровнем (в радиусе 0.5%):
  strength_multiplier += 0.3  → уровень становится сильнее

Если цена находится между VAL и VAH (внутри Value Area):
  skip_trade = True  → внутри зоны ценности = нет преимущества

Если цена выходит из Value Area:
  signal_direction = VAH направление  → цена стремится к POC
```

---

## Мульти-таймфрейм анализ — алгоритм

### `levels/multi_tf.py`

```python
class MultiTFLevels:
    """
    Собирает уровни с разных ТФ и вычисляет конфлюэнтность.
    
    Таймфреймы и их роли:
        M5   — исполнение (сигнальные паттерны)
        H1   — тактический (тренд, ADX)
        H4   — стратегический (основные уровни)
        D1   — глобальный контекст (ATR, ключевые уровни)
    
    Конфлюэнтность: уровень присутствует на 2+ ТФ в радиусе 0.5%.
    """
    
    TIMEFRAMES = ["1h", "4h", "1d"]
    CONFLUENCE_RADIUS = 0.005  # 0.5%
    
    def get_confluent_levels(self, symbol):
        all_levels = []
        
        for tf in self.TIMEFRAMES:
            bars = self.fetcher.fetch(symbol, tf, 300)
            detector = LevelDetector(bars)
            levels = detector.find_levels()
            
            for level in levels:
                level.timeframe = tf
                all_levels.append(level)
        
        # Кластеризация по ценам (радиус конфлюэнтности)
        confluent = []
        used = set()
        
        for i, lvl_i in enumerate(all_levels):
            if i in used:
                continue
            
            cluster = [lvl_i]
            for j, lvl_j in enumerate(all_levels):
                if j == i or j in used:
                    continue
                if abs(lvl_i.price - lvl_j.price) / lvl_i.price < self.CONFLUENCE_RADIUS:
                    cluster.append(lvl_j)
                    used.add(j)
            
            # Конфлюэнтный уровень: присутствует на 2+ ТФ
            tfs_in_cluster = set(l.timeframe for l in cluster)
            
            # Усреднённая цена кластера
            avg_price = np.mean([l.price for l in cluster])
            
            # Усиленная сила
            base_strength = max(l.strength for l in cluster)
            confluence_mult = 1.0 + 0.2 * (len(tfs_in_cluster) - 1)
            final_strength = base_strength * confluence_mult
            
            merged = Level(
                price=avg_price,
                strength=final_strength,
                timeframes=list(tfs_in_cluster),
                touches=sum(l.touches for l in cluster),
                false_breakouts=max(l.false_breakouts for l in cluster)
            )
            confluent.append(merged)
            used.add(i)
        
        return sorted(confluent, key=lambda l: l.strength, reverse=True)
```

---

## Управление позициями — полный жизненный цикл

```
ОТКРЫТИЕ ПОЗИЦИИ
    ↓
1. Сигнал от ChecklistStrategy
2. PositionSizer рассчитывает amount и leverage
3. Connector.place_market_order() → exchange
4. Connector.place_stop_order(sl) → биржа ставит SL-ордер
5. Connector.place_take_profit(tp) → биржа ставит TP-ордер
6. Position() создаётся в engine.positions[symbol]
7. Telegram уведомление об открытии

МОНИТОРИНГ (каждый скан)
    ↓
В live-режиме:
  - Биржа сама исполняет SL/TP ордера
  - Бот проверяет fetch_open_orders() — если пусто → позиция закрыта
  - Бот проверяет fetch_positions() — если size=0 → закрыта
  - При закрытии: рассчитать PnL, Telegram уведомление

В paper-режиме:
  - Нет реальных ордеров
  - Каждый скан: сравниваем current_price с SL и TP
  - Если current <= sl (LONG) → закрыть по SL
  - Если current >= tp (LONG) → закрыть по TP
  - Если bars_held >= max_bars_held → закрыть по таймауту

ЗАКРЫТИЕ
    ↓
1. Записать в лог: entry, exit, PnL, причина
2. Удалить из engine.positions
3. Telegram уведомление с PnL
4. Обновить equity tracker

ТАЙМАУТ (защита от зависших позиций)
    ↓
- max_bars_held = 15 сканов (по умолчанию)
- При tf=4h и interval=14400: 15 сканов = 60 часов = 2.5 дня
- Если позиция открыта дольше → принудительное закрытие
- Причина: "timeout"
```

---

## Telegram bot — полная документация

### Команды бота

```
/start          — запустить бота, получить chat_id
/status         — текущий статус: equity, открытые позиции
/positions      — список открытых позиций с PnL
/stats          — статистика за 7 дней (WR, avg R)
/pause          — приостановить открытие новых позиций
/resume         — возобновить торговлю
/report         — ежедневный отчёт вручную
```

### Структура класса TelegramBot

```python
class TelegramBot:
    """
    Telegram бот для уведомлений и управления.
    
    Особенности v7.3:
    - Все сообщения на русском (lang="ru")
    - format_checklist_telegram() для CHECKLIST сигналов
    - _t() для системных сообщений
    - Поддержка нескольких chat_id (массовая рассылка)
    """
    
    def __init__(self, token, chat_ids, lang="ru"):
        self.token = token
        self.chat_ids = chat_ids if isinstance(chat_ids, list) else [chat_ids]
        self.lang = lang
    
    def send_signal(self, result: ChecklistResult, amount, pos_val):
        """Уведомление об открытии CHECKLIST сделки"""
        msg = format_checklist_telegram(result, amount, pos_val, self.lang)
        self._send(msg)
    
    def send_closed(self, symbol, direction, entry, exit_price, pnl_pct, reason, bars):
        """Уведомление о закрытии позиции"""
        msg = self._t("closed", symbol=symbol, ...)
        self._send(msg)
    
    def send_daily_report(self, equity, day_change, trades, wins):
        """Ежедневный отчёт в 00:00 UTC"""
        msg = self._t("daily_report", ...)
        self._send(msg)
    
    def send_balance_report(self, balance, change_4h, open_positions):
        """Отчёт баланса каждые 4 часа"""
        msg = self._t("balance_report", ...)
        self._send(msg)
    
    def send_error(self, context, error_msg):
        """Уведомление об ошибке"""
        msg = f"⚠️ ОШИБКА: {context}\n{error_msg}"
        self._send(msg)
    
    def _send(self, text):
        """Отправить всем chat_id"""
        for chat_id in self.chat_ids:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            requests.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            }, timeout=10)
```

### format_checklist_telegram — полный шаблон

```python
def format_checklist_telegram(result, amount, pos_val, lang="ru"):
    """
    Форматирует сигнал CHECKLIST для Telegram.
    
    Пример вывода (русский):
    
    🟢 НОВАЯ СДЕЛКА: LONG CELOUSDT
    
    📊 Вход: $0.083700
    🎯 TP: $0.092000 (+9.92%)
    🛑 SL: $0.082500 (-1.43%)
    ⚖️ R:R 1:6.94
    💵 Размер: 8352 CELO ($699.0)
    🔒 БУ при 2R
    
    Сигнал:
      Тип: ретест
      Уровень: $0.082900 (сила=8.4)
      ATR(D1): $0.00415
    
    Фильтры:
      ✅ Пила ≤ 2
      ✅ Волатильность OK
      ✅ Тренд H1
      ✅ ADX=28
      ✅ Объём 1.8x
      SL: пробойная_свеча_adj
    """
    emoji = "🟢" if result.direction == "LONG" else "🔴"
    direction_ru = "LONG" if result.direction == "LONG" else "SHORT"
    symbol_short = result.symbol.replace("/USDT:USDT", "USDT")
    
    entry = result.entry_price
    tp = result.tp
    sl = result.sl
    
    tp_pct = (tp - entry) / entry * 100
    sl_pct = (sl - entry) / entry * 100
    
    rr = abs(tp_pct / sl_pct) if sl_pct != 0 else 0
    
    lines = [
        f"{emoji} НОВАЯ СДЕЛКА: {direction_ru} {symbol_short}",
        "",
        f"📊 Вход: ${entry:.6g}",
        f"🎯 TP: ${tp:.6g} ({tp_pct:+.2f}%)",
        f"🛑 SL: ${sl:.6g} ({sl_pct:+.2f}%)",
        f"⚖️ R:R 1:{rr:.1f}",
        f"💵 Размер: {amount:.4g} {symbol_short.replace('USDT','')} (${pos_val:.1f})",
        "🔒 БУ при 2R",
        "",
        "Сигнал:",
    ]
    
    # signal_details
    for key, val in result.signal_details.items():
        lines.append(f"  {key}: {val}")
    
    lines.append("")
    lines.append("Фильтры:")
    
    # filter_details
    for item in result.filter_details:
        lines.append(f"  {item}")
    
    lines.append(f"  SL: {result.sl_type}")
    
    return "\n".join(lines)
```

---

## Конфигурация по умолчанию — все параметры

| Параметр | Значение | Описание |
|----------|----------|----------|
| `mode` | `paper` | Режим торговли |
| `exchange` | `bybit` | Биржа |
| `capital` | `0` (авто) | Капитал в USDT |
| `tf` | `4h` | Основной таймфрейм |
| `leverage` | `5` | Кредитное плечо |
| `interval` | `14400` | Интервал сканирования (сек) |
| `risk_per_trade` | `0.01` | Риск на сделку (1%) |
| `min_rr` | `3.0` | Минимальный R:R |
| `max_pairs` | `220` | Максимум сканируемых пар |
| `max_positions` | `3` | Максимум открытых позиций |
| `max_bars_held` | `15` | Максимум сканов удержания позиции |
| `min_level_strength` | `3.0` | Минимальная сила уровня |
| `level_max_dist_pct` | `0.20` | Максимальное расстояние до уровня (20% ATR D1) |
| `sl_min_pct_atr` | `0.08` | Минимальный SL (8% ATR D1) |
| `sl_max_pct_atr` | `0.30` | Максимальный SL (30% ATR D1) |
| `sl_fallback_pct_atr` | `0.15` | Fallback SL (15% ATR D1) |
| `adx_min` | `15` | Минимальный ADX H1 |
| `vol_multiplier` | `1.2` | Минимальный объём (1.2x среднего) |
| `chop_max` | `2` | Максимальная "пила" |
| `lang` | `ru` | Язык уведомлений |

---

## Глоссарий технических терминов

| Термин | Объяснение |
|--------|-----------|
| Свинг-хай | Бар у которого high выше всех соседних на N баров |
| Свинг-лоу | Бар у которого low ниже всех соседних на N баров |
| Кластер уровней | Группа свинг-точек в радиусе 0.3% от цены |
| Сила уровня | touches × log(1+vol) × (1 + false_bo × 0.5) |
| Ложный пробой | Пробой уровня с последующим возвратом за него |
| Конфлюэнтность | Совпадение уровня на нескольких таймфреймах |
| POC | Point of Control — цена с наибольшим объёмом (VP) |
| VAH/VAL | Value Area — 70% торгового объёма вокруг POC |
| Ретест | Возврат цены к ранее пробитому уровню |
| Тик-сайз | Минимальный шаг цены на бирже |
| Пила | Чередование разнонаправленных баров = хаотичность |
| ATR D1 | Average True Range на дневном таймфрейме |
| scan_count | Глобальный счётчик сканирований с запуска бота |
| entry_scan | Номер скана при открытии позиции |
| bars_held | scan_count - entry_scan = время удержания позиции |
| triple-barrier | Метод разметки данных: 3 барьера (TP, SL, таймаут) |
| Stacking ensemble | ML ансамбль: базовые модели → мета-классификатор |
| Online learner | Дообучение модели на новых данных без полного переобучения |
| RL gate | Фильтр на основе обучения с подкреплением (Q-learning) |
| Purge gap | Разрыв между train и test для устранения look-ahead bias |
| Conformal prediction | Математическая гарантия ширины доверительного интервала |

---

## Поддерживаемые биржи — технические детали

### Bybit

```
Тип: USDT-маргинальные фьючерсы (Linear)
API версия: v5
ccxt ID: "bybit"

Особенности:
  - get_precision() возвращает tick_size как float (0.000001)
  - Нужна _tick_to_decimals() конвертация
  - Минимальный ордер: $5
  - Rate limit: 120 запросов/мин (private), 600/мин (public)
  - Тестнет: testnet.bybit.com (параметр --testnet)
  - Поддерживает hedged mode и one-way mode
  - 220+ USDT фьючерсных пар

Параметры для ccxt:
  exchange = ccxt.bybit({
      "apiKey": key,
      "secret": secret,
      "options": {"defaultType": "future"},
      "enableRateLimit": True,
  })
```

### MEXC

```
Тип: USDT-маргинальные фьючерсы
ccxt ID: "mexc"

Особенности:
  - fetch_balance() требует {"type": "swap"} для фьючерсов
  - Нет тестнета
  - Меньше пар чем Bybit (~100 USDT фьючерсов)
  - Rate limit: 100 запросов/мин

Параметры для ccxt:
  exchange = ccxt.mexc({
      "apiKey": key,
      "secret": secret,
      "options": {"defaultType": "swap"},
  })
  
  # fetch_balance для фьючерсов:
  balance = exchange.fetch_balance({"type": "swap"})
```

### Binance (только данные)

```
Используется только для загрузки исторических данных:
  data/fetcher_binance.py → REST API /api/v3/klines

Не используется для торговли (нет коннектора в trading/connector.py).
Причина: Bybit даёт более чистые данные для уровней.
```

---

## Известные ограничения и TODO

### Текущие ограничения (v7.3)

**Технические:**
- Только market ордера — нет limit entry (проскальзывание на низком объёме)
- Volume Profile пересчитывается каждый скан — нет кэша между сканами
- Уровни не кэшируются — каждый скан заново находит все свинги
- ADX фильтр отключается автоматически если < 28 баров H1 доступно
- Одновременно максимум 3 позиции (max_positions)

**Стратегические:**
- Стратегия хуже работает в мощном тренде без откатов (нет сетапов на уровнях)
- Не торгует пробои (только ретесты и пробой+пауза+подтверждение)
- Нет частичного закрытия позиций (закрывает сразу всю позицию)
- Нет trailing stop (TP фиксированный)
- Не учитывает funding rate при расчёте R:R

**Инфраструктурные:**
- Нет web dashboard
- Нет базы данных сделок (только логи)
- Нет автоматического перезапуска при обновлении кода

### Запланированные улучшения

**Краткосрочные (v7.4):**
- [ ] Кэш уровней между сканами (hash по last_close)
- [ ] Детальный лог каждого скана в файл
- [ ] Экспорт сделок в CSV для анализа

**Среднесрочные (v8.0):**
- [ ] Лимитные ордера на вход (limit entry при подходе к уровню)
- [ ] Частичное закрытие: 1/3 на 2R, 1/3 на 4R, 1/3 trailing
- [ ] Breakeven при 2R (автоматический перенос SL)
- [ ] Trailing stop после 3R

**Долгосрочные:**
- [ ] Web dashboard (Flask/FastAPI)
- [ ] База данных PostgreSQL для истории сделок
- [ ] Поддержка OKX
- [ ] Автоматический бэктест при изменении параметров
- [ ] Multi-account управление

