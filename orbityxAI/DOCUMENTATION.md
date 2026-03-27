# OrbityxAI v7.2 — Полная техническая документация

## Содержание

1. [Общий обзор системы](#1-общий-обзор-системы)
2. [Технические индикаторы](#2-технические-индикаторы)
3. [Feature Engineering — Построение признаков](#3-feature-engineering--построение-признаков)
4. [Отбор признаков](#4-отбор-признаков)
5. [Определение режима рынка](#5-определение-режима-рынка)
6. [Разметка данных — Triple Barrier](#6-разметка-данных--triple-barrier)
7. [Ансамбль моделей (Stacking Ensemble)](#7-ансамбль-моделей-stacking-ensemble)
8. [Режимный ансамбль](#8-режимный-ансамбль)
9. [Калибровка вероятностей](#9-калибровка-вероятностей)
10. [Мета-классификатор](#10-мета-классификатор)
11. [Мульти-таймфрейм подтверждение (MTF)](#11-мульти-таймфрейм-подтверждение-mtf)
12. [RL Gate — Фильтр на основе обучения с подкреплением](#12-rl-gate--фильтр-на-основе-обучения-с-подкреплением)
13. [Онлайн-обучение](#13-онлайн-обучение)
14. [Уровни поддержки/сопротивления](#14-уровни-поддержкисопротивления)
15. [Объёмный профиль (Volume Profile)](#15-объёмный-профиль-volume-profile)
16. [Детектор торговых сетапов](#16-детектор-торговых-сетапов)
17. [Управление рисками — SL/TP](#17-управление-рисками--sltp)
18. [Расчёт размера позиции](#18-расчёт-размера-позиции)
19. [Генерация финального сигнала](#19-генерация-финального-сигнала)
20. [Полный пайплайн MaxAccuracyPredictor](#20-полный-пайплайн-maxaccuracypredictor)
21. [Ключевые формулы](#21-ключевые-формулы)
22. [Конфигурация системы](#22-конфигурация-системы)
23. [Структура файлов](#23-структура-файлов)
24. [Метрики производительности](#24-метрики-производительности)

---

## 1. Общий обзор системы

OrbityxAI — ML-торговый бот для криптовалютных фьючерсов, объединяющий:

- **120+ технических признаков** без look-ahead bias
- **Stacking-ансамбль** из 6 моделей (GradientBoosting, RandomForest, ExtraTrees, XGBoost, LightGBM, CatBoost) + мета-классификатор
- **Режимно-разделённые модели** с 4-мя режимами рынка (Trend Up/Down, Volatile, Range)
- **Калибровку вероятностей** (Platt + Isotonic Regression)
- **Мульти-таймфрейм подтверждение** (согласованность 1h/4h/1d/1w)
- **RL-фильтр**, обучающийся на результатах сделок
- **Онлайн дообучение**, предотвращающее устаревание модели
- **Уровни поддержки/сопротивления** по методу Герчика
- **Детектор сетапов** с 7 подтверждающими сигналами

### Пайплайн сигнала

```
Данные OHLCV
    → Индикаторы (145 шт.)
    → Признаки (120 базовых + 10 взаимодействий)
    → Отбор признаков (50-60 по SHAP)
    → Ансамблевое предсказание
    → Калибровка вероятностей
    → MTF подтверждение
    → RL фильтр
    → Управление рисками (SL/TP)
    → Финальный сигнал (LONG / SHORT / NEUTRAL)
```

---

## 2. Технические индикаторы

**Файл:** `indicators/technical.py`

### Скользящие средние (5 типов)

| Индикатор | Формула | Назначение |
|-----------|---------|------------|
| **SMA** | `SMA(n) = Σ(C[i]) / n` | Базовый тренд |
| **EMA** | `EMA = C × k + EMA[prev] × (1-k)`, `k = 2/(n+1)` | Быстрый тренд с весом на недавних |
| **WMA** | `WMA = Σ(C[i] × w[i]) / Σ(w)`, `w[i] = i+1` | Линейно-взвешенный тренд |
| **HMA** | `HMA = WMA(2×WMA(n/2) - WMA(n), √n)` | Минимальный лаг |
| **VWMA** | `VWMA = Σ(C × V) / Σ(V)` | Объёмно-взвешенный тренд |

### Осцилляторы (8 типов)

| Индикатор | Формула | Диапазон | Сигналы |
|-----------|---------|----------|---------|
| **RSI** | `RSI = 100 - 100/(1 + AVG(gains)/AVG(losses))` | [0, 100] | <30 перепродан, >70 перекуплен |
| **MACD** | `MACD = EMA(12) - EMA(26)`, `Signal = EMA(MACD, 9)` | (-∞, +∞) | Пересечение линий |
| **Stochastic** | `K = (C - L14)/(H14 - L14) × 100` | [0, 100] | <20/<80 экстремумы |
| **StochRSI** | Stochastic применённый к RSI | [0, 100] | Комбинация RSI + Stoch |
| **CCI** | `CCI = (TP - SMA(TP)) / (0.015 × σ(TP))` | (-∞, +∞) | >100/-100 экстремумы |
| **Williams %R** | `%R = -(H14 - C)/(H14 - L14) × 100` | [-100, 0] | <-80/-20 экстремумы |
| **ROC** | `ROC = (C / C[n] - 1) × 100` | (-∞, +∞) | Скорость изменения |
| **TSI** | `TSI = 100 × EMA(EMA(ΔC,r),s) / EMA(EMA(\|ΔC\|,r),s)` | [-100, 100] | Сила тренда |

### Волатильность (10 типов)

| Индикатор | Формула | Назначение |
|-----------|---------|------------|
| **ATR** | `TR = max(H-L, \|H-C[prev]\|, \|L-C[prev]\|)`, `ATR = EMA(TR, 14)` | Истинный диапазон |
| **Bollinger Bands** | `BB = SMA(20) ± 2 × σ(C, 20)` | Волатильность ± 2σ |
| **Keltner Channels** | `KC = EMA(20) ± 2 × ATR` | ATR-каналы |
| **Donchian** | `[min(L, n), max(H, n)]` | Экстремумы диапазона |
| **Historical Vol** | `HV = √252 × σ(log_returns)` | Годовая волатильность |
| **Garman-Klass** | OHLC-формула (более точная чем close-close) | Внутридневная vol |
| **Yang-Zhang** | GK + Parkinson + дисперсия open/close | Самая точная vol |
| **Parkinson** | `√(252/(4ln2)) × log(H/L)` | Только по H/L |
| **Squeeze** | BB внутри KC = сжатие → ожидается взрыв | Сжатие волатильности |
| **Vol Ratio** | `HV_short / HV_long` | Ускорение/замедление vol |

### Тренд (4 типа)

| Индикатор | Формула | Сигналы |
|-----------|---------|---------|
| **ADX** | `DX = 100 × \|+DI - -DI\| / (+DI + -DI)`, `ADX = EMA(DX, 14)` | >20 тренд, >30 сильный, <10 нет тренда |
| **SuperTrend** | `HL/2 ± mult × ATR` с переключением состояния | Направление тренда (бинарно) |
| **Ichimoku** | Tenkan(9), Kijun(26), Senkou A/B, Chikou(26) | Облако = зона тренда |
| **Lin. Regression** | Наклон линейной регрессии за 14 баров | Скорость тренда |

**Все индикаторы вычисляются без заглядывания в будущее (zero look-ahead bias).**

---

## 3. Feature Engineering — Построение признаков

**Файл:** `features/engineer.py`

### 120 базовых признаков в 30 группах

| Группа | Название | Кол-во | Признаки |
|--------|----------|--------|----------|
| G1 | Лаговые лог-доходности | 7 | Returns за [1,2,3,5,10,20,40] баров |
| G2 | Фракционная дифференциация | 2 | FD(d=0.4) для стационарности |
| G3 | Кумулятивный моментум | 4 | Cumsum доходностей, tanh-масштаб |
| G4 | Мульти-ТФ моментум | 2 | Mom(5) vs Mom(20) дивергенция |
| G5 | Ускорение цены | 1 | 2-я производная моментума |
| G6 | RSI ансамбль | 4 | RSI(7,14,21) + StochRSI(14) |
| G7 | MACD | 4 | Линия, Сигнал, Гистограмма, Наклон гистограммы |
| G8 | Осцилляторы | 8 | Williams %R, ROC, Momentum, TSI, CCI |
| G9 | BB/Keltner | 3 | BB позиция, BB ширина, KC сжатие |
| G10 | Squeeze моментум | 2 | Моментум во время сжатия |
| G11 | Волатильность | 10 | ATR%, HV ratio, Parkinson, Yang-Zhang |
| G12 | Тренд | 4 | ADX, +DI, -DI, SuperTrend направление |
| G13 | SMA vs цена | 6 | Расстояние до SMA(10,20,50,100,200) в % |
| G14 | EMA vs цена | 6 | Расстояние, alignment score, наклон |
| G15 | Ichimoku+VWAP | 5 | Позиция в облаке, VWAP пересечение |
| G16 | Объём | 8 | OBV, MFI, тренд объёма, ratio |
| G17 | Статистика доходностей | 6 | Skew, kurtosis, autocorr, mean, std |
| G18 | Энтропия перестановок | 1 | Сложность (0=порядок, 1=хаос) |
| G19 | Свечные паттерны | 1 | Pin bar, engulfing, doji score |
| G20 | OHLC-признаки | 4 | Давление покупателей, body ratio, wick ratio |
| G21 | Микроструктура | 4 | Amihud illiquidity, Kyle lambda, tick rule |
| G22 | Hurst + vol ratio | 2 | Экспонент Hurst, GK/HV ratio |
| G23 | Donchian+DEMA+VPT | 4 | Donchian позиция, DEMA наклон, VPT |
| G24 | Мульти-ТФ ATR | 4 | ATR по [1h, 4h, 1d, 1w] |
| G25 | Позиция в диапазоне | 4 | Положение в range, близость к экстремумам |
| G26 | Временные/сессионные | 4 | Час дня, день недели (sin/cos) |
| G27 | Кросс-актив BTC | 4 | BTC return, pair/BTC ratio, корреляция, дивергенция |
| G28 | CVD/Delta Volume | 3 | Bar delta, rolling CVD, CVD дивергенция |
| G29 | WOBV/ER/Choppiness | 3 | Weighted OBV, Efficiency Ratio, Choppiness |

### Взаимодействия признаков

После SHAP-отбора топ-5 признаков вычисляются C(5,2) = 10 попарных произведений:
```
interactions = [(i,j) для i в топ-5 и j в топ-5 при i < j]
feature_interaction[k] = feature[i] × feature[j]
```

**Итого: 120 базовых + 10 взаимодействий = ~130 признаков до отбора.**

---

## 4. Отбор признаков

**Файл:** `features/selector.py`

### 5-этапный пайплайн

1. **Фильтр дисперсии**: убрать признаки с `var < 1e-6` (константы)
2. **Mutual Information**: ранжировать по MI(признак, метка)
3. **Корреляционная очистка**:
   - Порог: `|corr| > 0.75`
   - Из коррелированной пары оставляем признак с наивысшим MI
   - Убирает ~40-60 избыточных признаков
4. **Стабильность**:
   - 10 подвыборок, пересчёт MI на каждой
   - Оставить признаки, выжившие в >20% подвыборок
5. **SHAP топ-K**:
   - Обучить быстрый LightGBM на оставшихся
   - Посчитать SHAP importance
   - Взять топ 45-50 по SHAP

**Приоритетные признаки (никогда не удаляются):**
- G27-G29: кросс-актив, структурные (10 шт.)
- Уровни поддержки/сопротивления (15 шт.)

**Результат: 50-60 базовых + 10 взаимодействий = ~66 признаков для модели.**

---

## 5. Определение режима рынка

**Файл:** `models/regime.py`

### 4 режима

| Режим | Условие | Описание |
|-------|---------|----------|
| **TREND_UP** | ADX > 20, цена > SMA(200), +DI > -DI | Восходящий тренд |
| **TREND_DOWN** | ADX > 20, цена < SMA(200), -DI > +DI | Нисходящий тренд |
| **VOLATILE** | ATR% > 1.5 × медиана ATR%, нет тренда | Высокая волатильность |
| **RANGE** | Всё остальное | Боковик |

### Логика определения

```python
trending = ADX > 20
volatile = ATR% > 1.5 × median(ATR%[-50:])

if volatile and not trending:
    режим = VOLATILE
elif trending:
    if цена > SMA200 and +DI > -DI:
        режим = TREND_UP
    else:
        режим = TREND_DOWN
else:
    режим = RANGE
```

### Параметры по режимам

| Режим | SL множитель | Размер позиции | Мин. confidence | Веса моделей |
|-------|-------------|---------------|-----------------|-------------|
| TREND_UP | 1.5 × ATR | 100% | 52% | LGBM 28%, XGB 24%, Meta 10% |
| TREND_DOWN | 1.5 × ATR | 80% | 55% | LGBM 28%, XGB 24%, Meta 10% |
| VOLATILE | 2.0 × ATR | 40% | 64% | XGB 28%, LGBM 22%, Meta 0% |
| RANGE | 1.2 × ATR | 65% | 56% | Равномерно ~14-20% |

---

## 6. Разметка данных — Triple Barrier

**Файл:** `models/labels.py`

### Метод тройного барьера (De Prado)

Для каждого бара определяется метка: **+1** (рост), **-1** (падение), **0** (нейтрально).

```
barrier = ATR × 1.5 / цена    (порог доходности)

Асимметричные барьеры по тренду:
  Если ADX > 25 (тренд):
    trend_strength = min((ADX - 25) / 40, 1.0)
    asym = 1.0 + trend_strength × 0.25   (макс. 1.25)

    Восходящий тренд:
      верхний_барьер = barrier × asym      (шире — цена стремится вверх)
      нижний_барьер = barrier / asym       (уже — стоп ближе)

    Нисходящий тренд:
      верхний_барьер = barrier / asym
      нижний_барьер = barrier × asym

  Боковик:
    верхний = нижний = barrier
```

### Логика присвоения метки

```
Для каждого бара i:
  Ищем в окне [i+1, i+15]:
    Если high[j] >= вход × (1 + верхний_барьер) → метка = +1
    Если low[j] <= вход × (1 - нижний_барьер)  → метка = -1
    Если оба одновременно → метка = 0
    Если дошли до бара i+15 без срабатывания → метка = 0 (тайм-барьер)
```

### Веса наблюдений

```python
uniqueness = 1 / среднее_количество_перекрывающихся_меток
time_decay = 0.999^(n-i)   # новые данные важнее

Вес нейтральных меток (label=0):
  В тренде (ADX > 25):    0.15   # нейтральные = шум
  В волатильности:         0.50   # больше неопределённости
  В боковике:              0.40   # конфликтующие сигналы

Итоговый вес = uniqueness × neutral_factor × time_decay
Нормализация: mean(weights) = 1.0
```

---

## 7. Ансамбль моделей (Stacking Ensemble)

**Файл:** `models/ensemble.py`

### Архитектура

```
Базовый слой (6 моделей):
├── GradientBoosting  (GB):   n_est=500, depth=4, lr=0.02
├── RandomForest      (RF):   n_est=400, depth=8
├── ExtraTrees        (ET):   n_est=300, depth=10
├── LightGBM         (LGBM):  n_est=800, depth=6, lr=0.01
├── XGBoost           (XGB):  n_est=800, depth=6, lr=0.01
└── CatBoost          (Cat):  iter=800,  depth=6, lr=0.01

Мета-слой:
└── LogisticRegression на OOF-предсказаниях базовых моделей
```

### OOF кросс-валидация

```python
cv = PurgedTimeSeriesSplit(n_splits=10, gap=15)
# gap=15: между train и test 15 баров разрыва (нет утечки данных)

for train_idx, test_idx in cv.split():
    # Обучаем все 6 моделей на train
    # Предсказываем на test → OOF матрица (n × 6)

# Мета-модель обучается на OOF предсказаниях
meta = LogisticRegression().fit(OOF_predictions, y)
```

### Балансировка классов

| Модель | Метод |
|--------|-------|
| XGB | `scale_pos_weight = sum(sw[y==0]) / sum(sw[y==1])` |
| LGBM | `compute_sample_weight('balanced', y)` |
| CatBoost | `auto_class_weights='Balanced'` |
| GB/RF/ET | Внешние `sample_weight` |

### Конформное предсказание (90% покрытие)

```python
# Гарантия: в 90% случаев истинный класс попадёт в предсказанное множество
for class in [0, 1]:
    q = ceil((n+1) × 0.9) / n
    threshold = quantile(nonconformity_scores, q)

# При предсказании:
if proba >= 1 - threshold_up:   может_быть_LONG = True
if 1-proba >= threshold_down:   может_быть_SHORT = True
```

### Предсказание

```python
def predict(x, weights, regime):
    # 1. Масштабирование
    x_scaled = RobustScaler.transform(x)

    # 2. Базовые предсказания
    p_gb   = GB.predict_proba(x_scaled)[:, 1]
    p_rf   = RF.predict_proba(x_scaled)[:, 1]
    p_et   = ET.predict_proba(x_scaled)[:, 1]
    p_xgb  = XGB.predict_proba(x_scaled)[:, 1]
    p_lgbm = LGBM.predict_proba(x_scaled)[:, 1]
    p_cat  = Cat.predict_proba(x_scaled)[:, 1]

    # 3. Мета-предсказание
    meta_in = [p_gb, p_rf, p_et, p_xgb, p_lgbm, p_cat]
    p_meta  = Meta.predict_proba(meta_in)[:, 1]

    # 4. Взвешенное усреднение (веса зависят от режима)
    prob_up = Σ(weights[model] × p[model])

    # 5. Направление
    if prob_up > 0.55: direction = "LONG"
    elif prob_up < 0.45: direction = "SHORT"
    else: direction = "NEUTRAL"

    confidence = |prob_up - 0.5| × 2
    return confidence, direction, prob_up
```

### Fallback (если модель не обучена)

```python
# 3 простых эвристики:
p = momentum_prob(x) × 0.40      # моментум
  + mean_reversion_prob(x) × 0.20 # возврат к среднему
  + trend_following_prob(x) × 0.40 # следование за трендом
```

---

## 8. Режимный ансамбль

**Файл:** `models/regime_ensemble.py`

### Архитектура

```
RegimeEnsemble:
├── _global_model        StackingEnsemble обученный на ВСЕХ данных (fallback)
└── _regime_models       Отдельный StackingEnsemble для каждого режима
    ├── TREND_UP (0)     если >= 300 не-нейтральных баров
    ├── TREND_DOWN (1)   если >= 300 не-нейтральных баров
    ├── VOLATILE (2)     если >= 300 не-нейтральных баров
    └── RANGE (3)        если >= 300 не-нейтральных баров
```

### Зачем отдельные модели?

- **TREND_UP модель** видит только бычьи тренды → специализируется на моментуме
- **VOLATILE модель** видит только хаос → устойчива к пилам
- **RANGE модель** видит только боковик → детектирует развороты
- **Global** = запасной вариант когда мало данных для режима

### Инференс

```python
regime = detect_regime(h, l, c)  # текущий режим
if regime in _regime_models:
    prediction = _regime_models[regime].predict(features)
else:
    prediction = _global_model.predict(features)   # fallback
```

---

## 9. Калибровка вероятностей

**Файл:** `models/calibrator.py`

### Зачем калибровка?

ML-модели часто выдают `prob=0.65` когда реальная частота выигрыша только 55%. Калибровка исправляет это.

### Двухэтапная калибровка

**Этап 1: Platt Scaling (сигмоидная калибровка)**
```
log_odds = log(p / (1-p))
Обучаем LogisticRegression на (log_odds, y)
p_calibrated = σ(a × log_odds + b)
```
Корректирует систематическую пере/недо-уверенность.

**Этап 2: Isotonic Regression (монотонная калибровка)**
```
Обучаем кусочно-линейную монотонную функцию: p_calibrated → p_final
Не требует предположений о форме зависимости.
```

### Метрика: Expected Calibration Error (ECE)

```
ECE = Σ (|bin| / n) × |avg_predicted - avg_actual|
для каждого бина [0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]

Цель: ECE < 0.05 (идеально: 0.00)
```

---

## 10. Мета-классификатор

**Файл:** `models/meta_classifier.py`

### Назначение

Вторичный классификатор, который предсказывает: **"правильно ли основная модель?"**

### Обучение

```python
meta_labels = (primary_prediction == true_label) & (label != 0)
# True = модель была права, False = модель ошиблась

meta_model = LogisticRegression()
meta_model.fit([OOF_proba, primary_confidence], meta_labels)
```

### Модуляция уверенности

```python
meta_p = meta_model.predict_proba(features)  # P(модель права)

if meta_p < 0.55:
    # Мета-модель не уверена что основная модель права
    shrink = meta_p / 0.55
    final_conf = base_conf × shrink     # Снижаем уверенность
else:
    # Мета-модель подтверждает
    boost = 1 + (meta_p - 0.55) × 0.3
    final_conf = min(base_conf × boost, 1.0)  # Повышаем
```

---

## 11. Мульти-таймфрейм подтверждение (MTF)

**Файл:** `models/mtf.py`

### Принцип

Если 1h сигнал — LONG, проверяем согласованность с 4h, 1d и 1w.

### Оценка тренда на старшем ТФ (без ML)

```python
bullish_score = 0  (из 14 макс.)
if close > EMA(9):    +1
if close > EMA(21):   +1
if close > EMA(55):   +1
if close > EMA(200):  +1
if EMA(9) > EMA(21) > EMA(55):  +2
if RSI > 55:          +1
if ADX > 20 и +DI > -DI:  +2
if close > SMA(200) × 1.02:  +2

bull_ratio = bullish_score / 14
if bull_ratio > 0.65: direction = "LONG"
elif bull_ratio < 0.35: direction = "SHORT"
else: direction = "NEUTRAL"
```

### Подтверждение

```python
confirmation = 0
for tf in ["4h", "1d", "1w"]:
    weight = {"4h": 0.4, "1d": 0.4, "1w": 0.2}[tf]

    if tf_direction == primary_direction:
        confirmation += weight × tf_score        # Согласие
    elif tf_direction == "NEUTRAL":
        confirmation += weight × 0.5             # Нет сигнала
    else:
        confirmation += weight × (1-tf_score)×0.3  # Несогласие (штраф)

adjusted_confidence = confidence × (0.5 + confirmation)
```

**Пример:**
- 1h LONG conf=0.65, 4h LONG score=0.8, 1d NEUTRAL
- confirmation = 0.4×0.8 + 0.4×0.5 + 0.2×0.5 = 0.62
- adjusted = 0.65 × (0.5 + 0.62) = **0.73** (повышена)

---

## 12. RL Gate — Фильтр на основе обучения с подкреплением

**Файл:** `rl/gated_generator.py`

### Назначение

RL-агент учится на результатах закрытых сделок и решает:
- **PASS** — торговать (100% размер)
- **REDUCE** — торговать с уменьшенным размером
- **SKIP** — не торговать

### Состояние агента

```python
state = [confidence, regime_int, rsi, atr_pct, adx]
```

### Обучение

```python
# После каждой закрытой сделки:
reward = pnl_pct × {1.5 если PASS, 1.0 если REDUCE, 0.5 если SKIP}

# Каждые 20 сделок:
agent.batch_learn(batch_size=64)  # Q-learning обновление
```

### Активация

RL-гейт активируется только после **30 накопленных сделок**. До этого — всегда PASS.

---

## 13. Онлайн-обучение

**Файл:** `models/online_learner.py`

### Скользящий буфер

```python
buffer = SlidingWindowBuffer(max_bars=100_000)
# Каждый новый бар добавляется в буфер
# Каждые 100 баров → инкрементальный рефит LGBM
```

### Инкрементальный рефит

```python
def update_lgbm():
    o, h, l, c, v = buffer.get_arrays()[-10_000:]  # последние 10K баров
    X = engineer.build(o, h, l, c, v)
    y, _, _, _ = triple_barrier_labels(c, h, l)
    sw = combined_weights(y, decay=0.999)

    # КРИТИЧНО: используем тот же scaler что и при обучении
    X_scaled = ensemble.scaler.transform(X)

    lgbm.fit(X_scaled, y, sample_weight=sw,
             init_model=lgbm)  # warm-start (продолжение обучения)
```

### Почему только LGBM?

- LGBM поддерживает `init_model` для warm-start
- Самый быстрый из ансамбля
- Не нужно переобучать все 6 моделей

---

## 14. Уровни поддержки/сопротивления

**Файл:** `levels/detector.py`

### Детекция swing-точек

```python
for i in range(window, n-window):
    # window = 10 баров
    if high[i] == max(highs[i-10 : i+11]):
        swing_highs.append((i, high[i], volume[i]))
    if low[i] == min(lows[i-10 : i+11]):
        swing_lows.append((i, low[i], volume[i]))
```

### Кластеризация уровней

```python
merge_pct = 0.003  # группировать точки в пределах 0.3% цены
for cluster in clusters:
    price = median([p for p, _, _ in cluster])
    touches = len(cluster)
    total_vol = sum(v for _, _, v in cluster)
    level = PriceLevel(price, touches, total_vol)
```

### Сила уровня

```
strength = touches × log(total_volume) × (1 + false_breakouts × 0.5)
```

### Ложный пробой

```python
# Цена проколола уровень тенью, но закрылась обратно
if low[bar] < support × 1.002 and close[bar] > support:
    false_breakout_count += 1
# Ложные пробои УСИЛИВАЮТ уровень (больше ликвидности)
```

### 15 признаков уровней

| # | Признак | Описание |
|---|---------|----------|
| 0 | distance_to_support / ATR | Расстояние до ближайшей поддержки |
| 1 | distance_to_resistance / ATR | Расстояние до ближайшего сопротивления |
| 2 | support_strength | Сила поддержки (нормализована) |
| 3 | resistance_strength | Сила сопротивления |
| 4 | at_support | Цена у поддержки (0/1) |
| 5 | at_resistance | Цена у сопротивления (0/1) |
| 6-7 | touches | Количество касаний (support/resistance) |
| 8-9 | false_breakouts | Количество ложных пробоев |
| 10 | level_squeeze | Сжатие уровней (0=широко, 1=узко) |
| 11 | position_in_range | Положение в диапазоне (-0.5 до +0.5) |
| 12 | volume_vs_level_avg | Объём vs средний на уровне |
| 13 | nearest_level_recency | Давность ближайшего касания |
| 14 | breakout_risk | Риск пробоя (объём + близость) |

---

## 15. Объёмный профиль (Volume Profile)

**Файл:** `levels/volume_profile.py`

### Расчёт

```python
# 50 ценовых бинов, распределение объёма
vol_profile = histogram(volume, price_bins=50)

POC = цена с максимальной концентрацией объёма
Value Area = диапазон, содержащий 70% объёма

# Расширяем от POC вверх и вниз пока не наберём 70%
accumulated = 0
while accumulated < 0.7 × total_vol:
    expand в сторону большего объёма
```

**Создаёт 3 уровня:**
- **POC** (Point of Control) — 15% веса
- **VAH** (Value Area High) — сопротивление, 8% веса
- **VAL** (Value Area Low) — поддержка, 8% веса

---

## 16. Детектор торговых сетапов

**Файл:** `setups/detector.py`

### 7 подтверждающих сигналов

| # | Сигнал | Вес | Описание |
|---|--------|-----|----------|
| 1 | Сила уровня | 25% | Количество касаний × объём |
| 2 | Объём | 20% | Текущий vol vs среднее за 20 баров |
| 3 | Свечной паттерн | 15% | Pin bar, engulfing |
| 4 | RSI экстремум | 10% | RSI < 20 (лонг) или > 80 (шорт) |
| 5 | Моментум | 8% | Направление цены совпадает с сигналом |
| 6 | Funding Rate | 12% | Контр-тренд сигнал (экстремальный фандинг) |
| 7 | Отскок | 10% | Мульти-барный отскок от уровня |

### Валидация

```python
confidence = Σ(weight × score)     # от 0 до 1
n_confirmations = count(score > 0) # от 0 до 7

is_valid = (
    confidence >= 0.52
    and risk_reward >= 2.0
    and n_confirmations >= 2
)
```

---

## 17. Управление рисками — SL/TP

**Файл:** `signals/risk.py`

### Формула расчёта SL

```python
tf_mult = TIMEFRAME_ATR_MULT[timeframe]
# 1m=0.2, 5m=0.4, 15m=0.7, 30m=0.9, 1h=1.0, 4h=1.8, 1d=3.0

raw_sl = ATR × tf_mult × sl_atr_mult
# sl_atr_mult зависит от режима:
# TREND_UP/DOWN: 1.5, VOLATILE: 2.0, RANGE: 1.2

# Для LONG:
sl = цена - raw_sl
# Привязка к уровню поддержки:
if есть поддержки ниже:
    sl = min(sl, ближайшая_поддержка × 0.994)
# Минимальный стоп: 0.3% от цены
sl = min(sl, цена × 0.997)
```

### Формула расчёта TP

```python
tp_targets = [1.5, 2.5, 3.5]  # множители ATR для TP1/TP2/TP3

# Для LONG:
tp1 = цена + ATR × tf_mult × 1.5
tp2 = цена + ATR × tf_mult × 2.5
tp3 = цена + ATR × tf_mult × 3.5

# Привязка к уровням сопротивления:
if есть сопротивление выше:
    tp1 = min(tp1, ближайшее_сопротивление × 0.997)
```

### Risk:Reward

```python
risk = |цена_входа - SL|
reward = |TP1 - цена_входа|
RR = reward / risk

# Минимальный R:R для входа: 1.2
```

### Пример (BTC, 1h, TREND_UP)

```
ATR(14) = $500
tf_mult = 1.0 (1h)
sl_atr_mult = 1.5 (TREND_UP)

SL дистанция = $500 × 1.0 × 1.5 = $750 (0.86% от $87,000)
TP1 дистанция = $500 × 1.0 × 1.5 = $750 (R:R = 1.0)
TP2 дистанция = $500 × 1.0 × 2.5 = $1,250 (R:R = 1.7)
TP3 дистанция = $500 × 1.0 × 3.5 = $1,750 (R:R = 2.3)
```

---

## 18. Расчёт размера позиции

**Файл:** `setups/sizing.py`

### Критерий Келли

```python
Kelly_optimal = (WR × AvgWin - (1-WR) × AvgLoss) / AvgWin
Kelly_practical = 0.25 × Kelly_optimal  # четверть Келли (безопасность)
position_size = Kelly_practical × Portfolio
```

### Адаптивный риск

```python
def adaptive_risk(base_risk, confirmations, confidence, win_rate, drawdown, consec_losses):
    risk = base_risk  # обычно 1%

    if confirmations >= 4:
        risk *= 1.5       # Много подтверждений → увеличить
    if drawdown < -5%:
        risk *= 0.5       # Просадка → снизить
    if consec_losses >= 5:
        risk *= 0.3       # Серия убытков → минимум

    return clamp(risk, 0.3%, 2%)
```

### Итоговый размер позиции

```python
position_units = (equity × risk_fraction) / sl_distance
position_value = position_units × entry_price
# Максимум: 5% от портфеля
```

---

## 19. Генерация финального сигнала

**Файл:** `signals/generator.py`

### Полный поток

```python
def generate(symbol, timeframe, o, h, l, c, v):
    # 1. Определить режим рынка
    regime = regime_detector.detect(h, l, c)
    params = regime.params()

    # 2. Построить признаки (120 базовых + взаимодействия)
    X = engineer.build(o, h, l, c, v, btc_closes, timestamps)

    # 3. Отобрать топ-60 признаков
    x = selector.transform_single(X[-1])

    # 4. Ансамблевое предсказание
    conf, direction, prob_up, pred_ret = ensemble.predict(
        x, weights=params["model_weights"], regime=regime)

    # 5. Конформное предсказание
    prediction_set = conformal.predict_set(prob_up, regime)

    # 6. Уровни → SL/TP
    sl, tp1, tp2, tp3, rr = risk_manager.compute_stops(
        price, atr, direction, supports, resistances,
        timeframe, sl_atr_mult=params["sl_atr_mult"])

    # 7. Размер позиции
    sizing = risk_manager.risk_based_size(
        price, sl, portfolio, params["position_scale"])

    return TradingSignal(...)
```

---

## 20. Полный пайплайн MaxAccuracyPredictor

**Файл:** `max_predictor.py`

```
┌──────────────────────────────────────────────┐
│  OHLCV данные с биржи                        │
└────────────────┬─────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Feature        │  120 базовых + 10 взаимодействий
         │ Engineering    │
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │ Feature        │  50-60 отобранных (SHAP)
         │ Selection      │
         └───────┬────────┘
                 │
      ┌──────────▼──────────┐
      │ Regime-Separated    │  4 модели по режимам рынка
      │ Stacking Ensemble   │
      │ (6 моделей + мета)  │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Калибровка          │  Platt + Isotonic
      │ вероятностей        │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ MTF подтверждение   │  4h/1d/1w согласованность
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ RL Gate             │  PASS / REDUCE / SKIP
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Управление рисками  │  SL/TP по уровням + ATR
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Размер позиции      │  Kelly + адаптивный риск
      └──────────┬──────────┘
                 │
         ┌───────▼────────┐
         │ ФИНАЛЬНЫЙ       │  LONG / SHORT / NEUTRAL
         │ СИГНАЛ         │  + SL, TP1/2/3, R:R, размер
         └────────────────┘
```

### Вклад компонентов в точность

| Компонент | Вклад |
|-----------|-------|
| ML Ансамбль (базовый) | 55-58% win rate |
| + Shared модель (20 пар) | +2-3% |
| + Futures данные (funding, OI, L/S) | +1-2% |
| + Калибровка | +1-2% |
| + MTF фильтр | +1-2% |
| + RL gate | +1-2% |
| + Онлайн дообучение | +0-1% |
| **Итого (цель)** | **62-68%** |

---

## 21. Ключевые формулы

### RSI (Wilder)
```
RS = AVG(gains, 14) / AVG(losses, 14)   [экспоненциальное среднее]
RSI = 100 - 100 / (1 + RS)
```

### MACD
```
MACD = EMA(close, 12) - EMA(close, 26)
Signal = EMA(MACD, 9)
Histogram = MACD - Signal
```

### ATR (Wilder)
```
TR[i] = max(H[i]-L[i], |H[i]-C[i-1]|, |L[i]-C[i-1]|)
ATR = EMA(TR, 14)   [НЕ SMA — критическая разница]
```

### ADX
```
+DI = 100 × EMA(+DM, 14) / ATR
-DI = 100 × EMA(-DM, 14) / ATR
DX = 100 × |+DI - -DI| / (+DI + -DI)
ADX = EMA(DX, 14)
```

### Bollinger Bands
```
BB_mid = SMA(close, 20)
BB_upper = BB_mid + 2 × σ(close, 20)
BB_lower = BB_mid - 2 × σ(close, 20)
BB_position = (close - BB_lower) / (BB_upper - BB_lower)
```

### Фракционная дифференциация
```
weights[0] = 1
weights[k] = -weights[k-1] × (d - k + 1) / k
FD[i] = Σ weights[j] × series[i-j]

d = 0.4 — баланс стационарности и памяти
```

### Критерий Келли
```
K = (WR × AvgWin - (1-WR) × AvgLoss) / AvgWin
Практический K = 0.25 × K   [четверть Келли]
```

---

## 22. Конфигурация системы

**Файл:** `config.py`

### Ключевые параметры

| Параметр | Значение | Описание |
|----------|----------|----------|
| `barrier_atr_mult` | 1.5 | Множитель ATR для меток (~38% не-нейтральных) |
| `max_holding` | 15 | Макс. баров до тайм-барьера |
| `cv_n_splits` | 10 | Количество фолдов кросс-валидации |
| `optuna_trials` | 100 | Итераций оптимизации гиперпараметров |
| `correlation_threshold` | 0.75 | Порог удаления коррелированных признаков |
| `top_k_features` | 45-50 | Сколько признаков оставить по SHAP |
| `conformal_alpha` | 0.10 | 90% гарантия покрытия |
| `TIMEFRAME_ATR_MULT[1h]` | 1.0 | Множитель ATR для 1h |
| `TIMEFRAME_ATR_MULT[4h]` | 1.8 | Множитель ATR для 4h |
| `tp_rr_targets` | [1.5, 2.5, 3.5] | Множители для TP1/TP2/TP3 |
| `sl_atr_fallback` | 1.0 | SL множитель по умолчанию |
| `max_risk_pct` | 2% | Макс. риск на сделку |
| `max_position_pct` | 20% | Макс. размер позиции от портфеля |

---

## 23. Структура файлов

```
OrbityxAI/
├── config.py                     # Все гиперпараметры
├── max_predictor.py              # Полный пайплайн
├── predictor.py                  # OrbityxPredictor (одна пара)
│
├── indicators/
│   └── technical.py              # 145 индикаторов (~1800 строк)
│
├── features/
│   ├── engineer.py               # 120 базовых признаков
│   └── selector.py               # 5-этапный отбор (SHAP)
│
├── models/
│   ├── ensemble.py               # StackingEnsemble: 6 моделей + мета
│   ├── regime.py                 # 4-режимный детектор
│   ├── regime_ensemble.py        # Отдельные модели по режимам
│   ├── labels.py                 # Triple barrier + frac diff
│   ├── meta_classifier.py        # Вторичный мета-классификатор
│   ├── calibrator.py             # Platt + Isotonic калибровка
│   ├── online_learner.py         # Инкрементальное обучение LGBM
│   ├── mtf.py                    # Мульти-таймфрейм подтверждение
│   └── shared_trainer.py         # Обучение на 20+ парах
│
├── signals/
│   ├── generator.py              # Генерация сигналов
│   └── risk.py                   # SL/TP и размер позиции
│
├── levels/
│   ├── detector.py               # Swing → уровни → кластеры
│   ├── multi_tf.py               # HTF уровни confluence
│   └── volume_profile.py         # POC, VAH, VAL
│
├── setups/
│   ├── detector.py               # 7-сигнальный детектор сетапов
│   └── sizing.py                 # Kelly + адаптивный риск
│
├── trading/
│   ├── pair_scanner.py           # Сканер и ранжирование пар
│   ├── exchange.py               # Bybit/Binance API
│   └── live_engine.py            # Движок live-торговли
│
├── rl/
│   └── gated_generator.py        # RL-агент + фильтр
│
├── data/
│   └── fetcher.py                # Async загрузка OHLCV
│
├── bot/
│   └── telegram_bot.py           # Телеграм уведомления
│
├── run_live.py                   # Live/Paper торговля (ML + Setup)
├── run_training.py               # Обучение модели
├── run_auto_trade.py             # Автоматическая торговля
├── run_backtest.py               # Бэктестинг
└── deploy.sh                     # Деплой на Hetzner
```

---

## 24. Метрики производительности

### OOF Log-Loss

| Состояние | Log-Loss | Описание |
|-----------|----------|----------|
| Случайный | 0.693 | Монетка (50/50) |
| Базовый ML | 0.60-0.65 | Один ансамбль |
| С калибровкой+MTF | 0.50-0.55 | Полный пайплайн |
| **Цель v7.2** | **< 0.50** | |

### Win Rate

| Компонент | Win Rate |
|-----------|----------|
| Один индикатор | 48-52% (шум) |
| ML ансамбль | 55-58% |
| + MTF подтверждение | 58-62% |
| + RL фильтр | 60-65% |
| **Полная система** | **62-68%** (цель) |

### Sharpe Ratio (бэктест)

| Оценка | Sharpe |
|--------|--------|
| Отличный | > 2.0 |
| Хороший | 1.5-2.0 |
| Приемлемый | 1.0-1.5 |
| **Цель** | **> 1.5** |

---

## Критические замечания по реализации

1. **Zero Look-Ahead**: Все индикаторы используют rolling/expanding окна, никогда — будущие данные
2. **Purged CV**: Разрыв 15 баров между train/test предотвращает утечку данных
3. **Sample Weights**: Uniqueness × time_decay устраняют дубликаты и устаревание
4. **Конформное предсказание**: Математическая гарантия 90% покрытия (не эвристика)
5. **Режимное разделение**: Отдельные модели для разных состояний рынка = +5-10% edge
6. **Калибровка обязательна**: Без неё confidence → размер позиции будут искажены
7. **Уровни > ATR**: SL привязан к реальной структуре рынка, а не слепым множителям
8. **MTF фильтр**: Отсекает ~70% ложных сигналов на младшем ТФ
9. **RL обратная связь**: Каждая сделка улучшает фильтр со временем
10. **Онлайн-обучение**: LGBM дообучается каждые 100 баров, модель не устаревает

---

## Section 25: CHECKLIST Strategy — Полное Техническое Описание

### 25.1 Обзор стратегии

CHECKLIST стратегия реализует многоуровневую фильтрацию торговых сигналов на основе ключевых ценовых уровней (поддержка/сопротивление), паттернов ретеста и пробоя, а также набора подтверждающих фильтров. Стратегия работает на таймфреймах M5 (сигнальный) и H1/H4 (структурный контекст).

### 25.2 ChecklistResult Dataclass

```python
@dataclass
class ChecklistResult:
    signal: str                    # "LONG", "SHORT", или "" (нет сигнала)
    entry_price: float             # Цена входа (обычно текущая цена закрытия)
    sl_price: float                # Stop-Loss цена
    tp_price: float                # Take-Profit цена
    level_price: float             # Цена уровня, от которого сигнал
    level_type: str                # "support" или "resistance"
    pattern: str                   # "retest" или "breakout"
    filters_passed: list[str]      # Список пройденных фильтров
    filters_failed: list[str]      # Список непройденных фильтров
    rr_ratio: float                # Risk/Reward ratio
    confidence: float              # Общий уровень уверенности [0.0, 1.0]
    sl_candidate: str              # Источник SL: "wick", "level", "atr", "swing"
    notes: list[str]               # Отладочные заметки
```

Поле `confidence` вычисляется как:

```
confidence = (len(filters_passed) / total_filters) * pattern_weight
```

где `pattern_weight = 1.0` для ретеста, `0.85` для пробоя (пробои менее надёжны).

### 25.3 Алгоритм _find_levels()

Функция обнаруживает ключевые горизонтальные уровни на основе исторических баров.

```
ВХОДНЫЕ ДАННЫЕ:
  bars_h1  — список баров H1 (минимум 200 баров)
  bars_h4  — список баров H4 (минимум 50 баров)

АЛГОРИТМ:

1. СБОР КАНДИДАТОВ:
   candidates = []
   Для каждого бара b в bars_h1[10:-10]:
     Если b.high является локальным максимумом (выше N соседей с каждой стороны):
       candidates.append(LevelCandidate(price=b.high, type="resistance", touches=1))
     Если b.low является локальным минимумом (ниже N соседей с каждой стороны):
       candidates.append(LevelCandidate(price=b.low, type="support", touches=1))

2. КЛАСТЕРИЗАЦИЯ:
   tolerance = ATR_h1 * 0.3  (30% от H1 ATR)
   clusters = []
   Для каждого кандидата c:
     Найти существующий кластер cl, где |cl.price - c.price| < tolerance
     Если найден: cl.touches += 1, cl.price = среднее(cl.price, c.price)
     Иначе: clusters.append(новый кластер из c)

3. ФИЛЬТРАЦИЯ ПО СИЛЕ:
   strong_levels = [cl for cl in clusters if cl.touches >= MIN_TOUCHES]
   где MIN_TOUCHES = 2 (минимум 2 касания для признания уровня)

4. ОБОГАЩЕНИЕ H4:
   Для каждого бара b в bars_h4:
     Для каждого уровня l в strong_levels:
       Если |b.high - l.price| < tolerance: l.h4_confirmed = True
       Если |b.low  - l.price| < tolerance: l.h4_confirmed = True

5. СОРТИРОВКА:
   Уровни сортируются по близости к текущей цене.
   Возвращаются top-N уровней (обычно N=10).

ВЫХОДНЫЕ ДАННЫЕ:
  list[Level] — отсортированный список уровней
```

Структура `Level`:

```python
@dataclass
class Level:
    price: float          # Цена уровня
    level_type: str       # "support" | "resistance"
    touches: int          # Количество касаний
    h4_confirmed: bool    # Подтверждён на H4
    last_touch_idx: int   # Индекс последнего касания в массиве баров
    strength: float       # Нормализованная сила [0.0, 1.0]
```

### 25.4 Логика _check_signal_m5()

Функция анализирует последние бары M5 для определения паттерна относительно уровня.

```
ВХОДНЫЕ ДАННЫЕ:
  bars_m5  — последние 50 баров M5
  level    — уровень Level
  current_price — текущая цена

ПАТТЕРН РЕТЕСТА (Retest):

Условие для LONG ретеста (уровень = поддержка):
  1. Цена ранее была ниже уровня (пробой вниз)
  2. Цена вернулась к уровню снизу
  3. Последние 1-3 бара показывают отбой:
     - close[-1] > level.price (закрытие выше уровня)
     - low[-1] <= level.price + tolerance (касание уровня снизу)
     - close[-1] > open[-1] (бычья свеча)
  4. Объём на баре касания выше среднего (volume[-1] > avg_volume * 1.2)

Условие для SHORT ретеста (уровень = сопротивление):
  (симметрично для продаж)

ПАТТЕРН ПРОБОЯ (Breakout):

Условие для LONG пробоя (уровень = сопротивление):
  1. Предыдущие бары были ниже уровня
  2. Текущий или последний бар закрылся выше уровня:
     - close[-1] > level.price * (1 + BREAKOUT_THRESHOLD)
     - где BREAKOUT_THRESHOLD = 0.001 (0.1%)
  3. Объём пробойного бара > avg_volume * BREAKOUT_VOLUME_MULT
     - BREAKOUT_VOLUME_MULT = 1.5
  4. Бар пробоя является бычьим (close > open)

ВЫХОДНЫЕ ДАННЫЕ:
  pattern: str  — "retest" | "breakout" | ""
  signal: str   — "LONG" | "SHORT" | ""
```

### 25.5 Функция _check_filters() — Все 5 Фильтров

#### Фильтр 1: Тренд (Trend Filter)

```
ЦЕЛЬ: Убедиться, что сделка направлена по тренду старшего таймфрейма.

ВЫЧИСЛЕНИЕ:
  ema_fast = EMA(closes_h1, period=20)
  ema_slow = EMA(closes_h1, period=50)
  
  trend_up   = ema_fast[-1] > ema_slow[-1]
  trend_down = ema_fast[-1] < ema_slow[-1]

УСЛОВИЕ ПРОХОЖДЕНИЯ:
  LONG  сигнал: trend_up   == True  (торгуем в лонг только в восходящем тренде)
  SHORT сигнал: trend_down == True  (торгуем в шорт только в нисходящем тренде)

ФОРМУЛА EMA:
  EMA[0] = closes[0]
  EMA[i] = closes[i] * k + EMA[i-1] * (1 - k)
  k = 2 / (period + 1)
```

#### Фильтр 2: Волатильность (Volatility Filter)

```
ЦЕЛЬ: Отсеять сигналы при аномально низкой или высокой волатильности.

ВЫЧИСЛЕНИЕ:
  atr = ATR(bars_m5, period=14)
  atr_pct = atr / current_price * 100  (ATR в процентах от цены)

УСЛОВИЕ ПРОХОЖДЕНИЯ:
  MIN_ATR_PCT <= atr_pct <= MAX_ATR_PCT

ДЕФОЛТНЫЕ ЗНАЧЕНИЯ:
  MIN_ATR_PCT = 0.05  (минимум 0.05% — рынок должен двигаться)
  MAX_ATR_PCT = 5.0   (максимум 5.0% — исключить экстремальную волатильность)

ФОРМУЛА ATR:
  TR[i] = max(high[i] - low[i],
              abs(high[i] - close[i-1]),
              abs(low[i]  - close[i-1]))
  ATR = SMA(TR, period=14)
```

#### Фильтр 3: RSI (Momentum Filter)

```
ЦЕЛЬ: Подтвердить направление импульса.

ВЫЧИСЛЕНИЕ:
  rsi = RSI(closes_m5, period=14)

УСЛОВИЕ ПРОХОЖДЕНИЯ:
  LONG  сигнал: RSI_LONG_MIN  <= rsi[-1] <= RSI_LONG_MAX
  SHORT сигнал: RSI_SHORT_MIN <= rsi[-1] <= RSI_SHORT_MAX

ДЕФОЛТНЫЕ ЗНАЧЕНИЯ:
  RSI_LONG_MIN  = 40   (не перепродан настолько, чтоб избегать)
  RSI_LONG_MAX  = 70   (не перекуплен)
  RSI_SHORT_MIN = 30   (не перепродан)
  RSI_SHORT_MAX = 60   (не перекуплен настолько, чтоб избегать)

ФОРМУЛА RSI:
  gain[i] = max(close[i] - close[i-1], 0)
  loss[i] = max(close[i-1] - close[i], 0)
  avg_gain = SMA(gain, period=14)
  avg_loss = SMA(loss, period=14)
  RS  = avg_gain / avg_loss
  RSI = 100 - (100 / (1 + RS))
```

#### Фильтр 4: Объём (Volume Filter)

```
ЦЕЛЬ: Подтвердить сигнал повышенным объёмом.

ВЫЧИСЛЕНИЕ:
  avg_volume = SMA(volumes_m5[-50:], period=20)
  current_volume = volumes_m5[-1]
  volume_ratio = current_volume / avg_volume

УСЛОВИЕ ПРОХОЖДЕНИЯ:
  volume_ratio >= VOLUME_THRESHOLD

ДЕФОЛТНОЕ ЗНАЧЕНИЕ:
  VOLUME_THRESHOLD = 1.1  (объём должен быть минимум на 10% выше среднего)

ПРИМЕЧАНИЕ: При отсутствии данных объёма (некоторые споты) фильтр пропускается
  автоматически (considered passed).
```

#### Фильтр 5: Время (Session Filter)

```
ЦЕЛЬ: Ограничить торговлю активными сессиями.

ПРОВЕРКА:
  current_hour = datetime.utcnow().hour

  ASIAN_SESSION  = [0, 8]    # UTC 00:00 - 08:00
  LONDON_SESSION = [8, 16]   # UTC 08:00 - 16:00
  NY_SESSION     = [13, 21]  # UTC 13:00 - 21:00

УСЛОВИЕ ПРОХОЖДЕНИЯ:
  Если TRADE_SESSIONS = ["london", "ny"]:
    active = (8 <= hour < 16) or (13 <= hour < 21)
  
  Перекрытие сессий (13:00-16:00 UTC) считается наиболее активным временем.
  
  Азиатская сессия может быть исключена для волатильных пар (BTC, ETH).
```

### 25.6 Алгоритм _compute_shortest_sl()

Функция выбирает оптимальный Stop-Loss из 4 кандидатов.

```
КАНДИДАТ 1: Wick SL (по фитилю свечи)
  Для LONG:
    sl_wick = min(low[-1], low[-2], low[-3])  (минимум последних 3 баров M5)
    sl_wick -= ATR_m5 * 0.1  (небольшой буфер)
  Для SHORT:
    sl_wick = max(high[-1], high[-2], high[-3])
    sl_wick += ATR_m5 * 0.1

КАНДИДАТ 2: Level SL (за уровнем)
  Для LONG (уровень поддержки):
    sl_level = level.price - ATR_m5 * LEVEL_SL_BUFFER
    где LEVEL_SL_BUFFER = 0.5 (50% ATR буфер за уровень)
  Для SHORT (уровень сопротивления):
    sl_level = level.price + ATR_m5 * LEVEL_SL_BUFFER

КАНДИДАТ 3: ATR SL (фиксированный множитель ATR)
  Для LONG:
    sl_atr = entry_price - ATR_m5 * ATR_SL_MULT
    где ATR_SL_MULT = 2.0
  Для SHORT:
    sl_atr = entry_price + ATR_m5 * ATR_SL_MULT

КАНДИДАТ 4: Swing SL (по последнему swing high/low)
  Swing Low  = min(low[-20:])   (для LONG)
  Swing High = max(high[-20:])  (для SHORT)
  sl_swing = Swing Low  - ATR_m5 * 0.2  (для LONG)
  sl_swing = Swing High + ATR_m5 * 0.2  (для SHORT)

ВЫБОР КАНДИДАТА:

  Для LONG (минимизируем расстояние от entry до SL):
    candidates = [sl_wick, sl_level, sl_atr, sl_swing]
    # Все кандидаты должны быть НИЖЕ entry
    valid = [c for c in candidates if c < entry_price]
    # Выбираем ближайший (минимальный риск = shortest SL)
    chosen_sl = max(valid)  (ближайший = наибольший из допустимых)

  Для SHORT:
    valid = [c for c in candidates if c > entry_price]
    chosen_sl = min(valid)  (ближайший = наименьший из допустимых)
```

### 25.7 Валидация Stop-Loss

После выбора кандидата SL проходит 3-уровневую валидацию:

```
ПРОВЕРКА 1: SL должен быть за уровнем
  Для LONG  (поддержка): sl < level.price  → иначе сдвинуть sl = level.price - tick_size
  Для SHORT (сопротивление): sl > level.price → иначе сдвинуть sl = level.price + tick_size

ПРОВЕРКА 2: Диапазон SL
  sl_pct = abs(entry_price - sl_price) / entry_price * 100

  Если sl_pct < MIN_SL_PCT (дефолт 0.1%):
    Применить fallback: sl = entry - ATR_m5 * 1.5  (для LONG)

  Если sl_pct > MAX_SL_PCT (дефолт 5.0%):
    Сигнал отклоняется (слишком широкий SL, нецелесообразен)

ПРОВЕРКА 3: Fallback логика
  Если ни один кандидат не прошёл валидацию:
    sl = entry_price ± ATR_m5 * DEFAULT_ATR_SL_MULT
    где DEFAULT_ATR_SL_MULT = 2.0
    Записать в notes: "используется ATR fallback SL"
```

### 25.8 Выбор Take-Profit

```
АЛГОРИТМ:

1. Найти следующий уровень за entry в направлении сделки:
   Для LONG:
     tp_levels = [l for l in all_levels if l.price > entry_price]
     tp_levels = sorted(tp_levels, key=lambda l: l.price)
     next_level = tp_levels[0] if tp_levels else None

   Для SHORT:
     tp_levels = [l for l in all_levels if l.price < entry_price]
     tp_levels = sorted(tp_levels, key=lambda l: l.price, reverse=True)
     next_level = tp_levels[0] if tp_levels else None

2. Проверить минимальное R/R:
   sl_distance = abs(entry_price - sl_price)
   tp_distance = abs(next_level.price - entry_price)
   rr = tp_distance / sl_distance

   Если rr >= MIN_RR (дефолт 3.0):
     tp_price = next_level.price
   Иначе:
     Попробовать следующий уровень (tp_levels[1])
     Если второй уровень тоже не даёт MIN_RR:
       tp_price = entry_price ± sl_distance * MIN_RR  (синтетический TP)

3. Буфер к уровню TP:
   Для LONG  (TP у сопротивления): tp_price -= tick_size * 2
   Для SHORT (TP у поддержки):     tp_price += tick_size * 2

ФИНАЛЬНЫЕ МЕТРИКИ:
  rr_ratio = abs(tp_price - entry_price) / abs(sl_price - entry_price)
```

---

## Section 26: Position Sizing — Расчёт Размера Позиции

### 26.1 Основная Формула

Модуль управления размером позиции реализует риск-ориентированный подход: размер позиции определяется из заданного процента риска от капитала, а не из фиксированного количества монет.

```
ВХОДНЫЕ ПАРАМЕТРЫ:
  capital      — текущий баланс аккаунта (в USDT)
  risk_pct     — риск на сделку в долях (например 0.01 = 1%)
  entry_price  — цена входа
  sl_price     — цена стоп-лосса
  leverage     — кредитное плечо (для фьючерсов)
  min_amount   — минимальный размер ордера биржи
  tick_size    — минимальный шаг цены

ШАГИ ВЫЧИСЛЕНИЯ:

Шаг 1: Денежный риск
  risk_usdt = capital * risk_pct
  # Пример: 10000 USDT * 0.01 = 100 USDT риска

Шаг 2: Расстояние до SL в процентах
  sl_distance_pct = abs(entry_price - sl_price) / entry_price
  # Пример: |50000 - 49000| / 50000 = 0.02 (2%)

Шаг 3: Стоимость позиции (без плеча)
  pos_val = risk_usdt / sl_distance_pct
  # Пример: 100 / 0.02 = 5000 USDT

Шаг 4: Стоимость позиции с плечом
  pos_val_leveraged = pos_val * leverage
  # При leverage=1 (спот): pos_val_leveraged = pos_val
  # При leverage=10 (фьючерс): pos_val_leveraged = 50000 USDT

Шаг 5: Количество монет
  amount = pos_val_leveraged / entry_price
  # Пример: 5000 / 50000 = 0.1 BTC (спот)
  # Пример: 50000 / 50000 = 1.0 BTC (фьючерс с плечом 10)
```

### 26.2 Вычисление Необходимого Плеча

```
ФОРМУЛА:
  leverage_needed = pos_val_leveraged / capital

  # Пример:
  # capital = 10000 USDT
  # pos_val_leveraged = 50000 USDT
  # leverage_needed = 50000 / 10000 = 5x

ОГРАНИЧЕНИЯ:
  leverage_needed = min(leverage_needed, MAX_LEVERAGE)
  где MAX_LEVERAGE берётся из конфига (дефолт: 20 для крипто)

  Если leverage_needed > exchange_max_leverage:
    Уменьшить pos_val_leveraged до capital * exchange_max_leverage
    Пересчитать amount
```

### 26.3 Проверка Минимального Размера

```python
def validate_amount(amount: float, min_amount: float, min_cost: float,
                    entry_price: float) -> tuple[float, bool]:
    """
    Валидация размера ордера против биржевых ограничений.
    
    Returns:
        (validated_amount, is_valid)
    """
    # Проверка минимального количества
    if amount < min_amount:
        logger.warning(f"amount {amount} < min_amount {min_amount}")
        return min_amount, False  # сигнал пропускается
    
    # Проверка минимальной стоимости (min notional)
    cost = amount * entry_price
    if cost < min_cost:
        # Увеличить amount до min_cost
        amount = min_cost / entry_price
        amount = round_up_to_tick(amount, tick_size)
    
    return amount, True
```

Типичные ограничения бирж:

| Биржа | min_amount (BTC) | min_cost (USDT) | Примечание |
|-------|-----------------|-----------------|------------|
| Binance Spot | 0.00001 BTC | 10 USDT | MIN_NOTIONAL |
| Binance Futures | 0.001 BTC | 5 USDT | — |
| Bybit USDT Perp | 0.001 BTC | 1 USDT | — |
| OKX Spot | 0.00001 BTC | 1 USDT | — |

### 26.4 Функция _tick_to_decimals()

```python
def _tick_to_decimals(tick_size: float) -> int:
    """
    Вычисляет количество десятичных знаков из tick_size.
    
    Formula:
        decimals = floor(-log10(tick_size))
    
    Examples:
        tick_size = 0.01   → floor(-log10(0.01))   = floor(2.0)  = 2
        tick_size = 0.001  → floor(-log10(0.001))  = floor(3.0)  = 3
        tick_size = 0.0001 → floor(-log10(0.0001)) = floor(4.0)  = 4
        tick_size = 1.0    → floor(-log10(1.0))    = floor(0.0)  = 0
        tick_size = 10.0   → floor(-log10(10.0))   = floor(-1.0) = -1 → max(0, -1) = 0
    
    Implementation:
        import math
        decimals = max(0, math.floor(-math.log10(tick_size)))
        return decimals
    """
    import math
    if tick_size <= 0:
        raise ValueError(f"tick_size must be positive, got {tick_size}")
    return max(0, math.floor(-math.log10(tick_size)))
```

### 26.5 Округление Размера Позиции

```python
def round_amount(amount: float, step_size: float) -> float:
    """
    Округление количества до ближайшего шага (step_size).
    Используется floor-округление (в меньшую сторону) для безопасности.
    
    Formula:
        rounded = floor(amount / step_size) * step_size
    
    Examples:
        round_amount(0.123456, 0.001) = 0.123
        round_amount(1.999,    0.01)  = 1.99
        round_amount(0.00512,  0.001) = 0.005
    """
    import math
    decimals = _tick_to_decimals(step_size)
    factor = 1 / step_size
    rounded = math.floor(amount * factor) / factor
    return round(rounded, decimals)
```

### 26.6 Итоговый Pipeline Расчёта

```
position_sizing_pipeline(capital, risk_pct, entry, sl, leverage, market_info):

  1. risk_usdt          = capital * risk_pct
  2. sl_dist_pct        = |entry - sl| / entry
  3. pos_val            = risk_usdt / sl_dist_pct
  4. pos_val_leveraged  = pos_val * leverage
  5. amount_raw         = pos_val_leveraged / entry
  6. amount_rounded     = round_amount(amount_raw, market_info.step_size)
  7. (amount_val, ok)   = validate_amount(amount_rounded, market_info.min_amount,
                                          market_info.min_cost, entry)
  8. actual_risk_usdt   = amount_val * sl_dist_pct * entry / leverage
  9. actual_risk_pct    = actual_risk_usdt / capital * 100
  10. RETURN PositionSize(
        amount        = amount_val,
        pos_val_usdt  = amount_val * entry / leverage,
        risk_usdt     = actual_risk_usdt,
        risk_pct      = actual_risk_pct,
        leverage_used = leverage
      )
```

---

## Section 27: Live Engine — Движок Реального Времени

### 27.1 Архитектура LiveEngine

```
LiveEngine
├── connector: ExchangeConnector   (API биржи)
├── strategy: ChecklistStrategy    (стратегия)
├── notifier: TelegramNotifier     (уведомления)
├── positions: dict[str, Position] (открытые позиции)
├── scan_count: int                (счётчик сканирований)
└── config: BotConfig              (конфигурация)
```

### 27.2 Основной Цикл Сканирования

```python
async def run(self):
    """
    Основной бесконечный цикл бота.
    Pseudocode:
    """
    self.scan_count = 0
    
    while True:
        try:
            cycle_start = time.monotonic()
            
            # 1. Обновить баланс
            balance = await self.connector.get_balance()
            self.capital = balance['USDT']['free']
            
            # 2. Проверить открытые позиции (SL/TP hit)
            await self._check_open_positions()
            
            # 3. Сканировать все пары на сигналы
            if len(self.positions) < self.config.max_open_positions:
                await self._scan_all_symbols()
            
            # 4. Обновить счётчик
            self.scan_count += 1
            
            # 5. Дневной отчёт (раз в час)
            if self.scan_count % SCANS_PER_HOUR == 0:
                await self._send_daily_report()
            
            # 6. Пауза до следующего цикла
            elapsed = time.monotonic() - cycle_start
            sleep_time = max(0, SCAN_INTERVAL_SEC - elapsed)
            await asyncio.sleep(sleep_time)
            
        except Exception as e:
            logger.error(f"Scan cycle error: {e}")
            await self.notifier.send_error(str(e))
            await asyncio.sleep(ERROR_RETRY_DELAY)
```

### 27.3 Псевдокод _scan_all_symbols()

```
async _scan_all_symbols():
  symbols = config.symbols  # Список торговых пар

  # Параллельное сканирование (semaphore для ограничения RPS)
  async with asyncio.Semaphore(MAX_CONCURRENT_SCANS):
    tasks = [self._scan_symbol(sym) for sym in symbols
             if sym not in self.positions]  # Пропустить уже открытые
    results = await asyncio.gather(*tasks, return_exceptions=True)

  for sym, result in zip(symbols, results):
    if isinstance(result, Exception):
      logger.warning(f"Scan failed for {sym}: {result}")
      continue
    if result and result.signal:
      await self._execute_signal(sym, result)
```

### 27.4 Отслеживание Позиций

```python
# Структура данных позиции
@dataclass
class Position:
    symbol: str           # Торговая пара (ключ словаря)
    side: str             # "LONG" | "SHORT"
    entry_price: float    # Цена входа
    amount: float         # Количество (базовая валюта)
    sl_price: float       # Текущий Stop-Loss
    tp_price: float       # Take-Profit
    entry_scan: int       # scan_count в момент входа
    entry_time: datetime  # UTC время входа
    order_id: str         # ID ордера на бирже (если live)
    paper: bool           # True = paper trade
    pnl_usdt: float       # Нереализованный PnL
    max_favorable: float  # Максимум цены в пользу сделки (для trailing)

# Словарь активных позиций
positions: dict[str, Position] = {}
# Ключ = symbol, значение = Position

# Добавление позиции
positions[symbol] = Position(symbol=symbol, ...)

# Удаление после закрытия
del positions[symbol]
```

### 27.5 Paper Mode: Проверка SL/TP

```python
async def _check_open_positions(self):
    """
    В paper mode: симулируем проверку SL/TP по текущим ценам.
    В live mode: позиции закрываются ордерами на бирже,
                 здесь только синхронизируем статус.
    """
    for symbol, pos in list(self.positions.items()):
        
        if pos.paper:
            # Получить текущую цену
            ticker = await self.connector.get_ticker(symbol)
            current_price = ticker['last']
            
            # Вычислить bars_held
            bars_held = self.scan_count - pos.entry_scan
            
            closed = False
            exit_reason = ""
            
            if pos.side == "LONG":
                if current_price <= pos.sl_price:
                    closed = True
                    exit_reason = "SL"
                elif current_price >= pos.tp_price:
                    closed = True
                    exit_reason = "TP"
            
            elif pos.side == "SHORT":
                if current_price >= pos.sl_price:
                    closed = True
                    exit_reason = "SL"
                elif current_price <= pos.tp_price:
                    closed = True
                    exit_reason = "TP"
            
            if closed:
                pnl = self._calc_pnl(pos, current_price)
                await self._close_position(symbol, current_price,
                                           exit_reason, pnl, bars_held)
```

### 27.6 Вычисление Баров В Позиции

```
bars_held = scan_count - entry_scan

ИНТЕРПРЕТАЦИЯ:
  Каждый цикл сканирования = 1 скан
  Если SCAN_INTERVAL_SEC = 300 (5 минут):
    bars_held = 10 → позиция открыта ~50 минут

ПЕРЕСЧЁТ В ВРЕМЯ:
  time_held_sec  = bars_held * SCAN_INTERVAL_SEC
  time_held_min  = time_held_sec / 60
  time_held_hours = time_held_min / 60

ИСПОЛЬЗОВАНИЕ:
  В отчёте: "Держали позицию 2.5 часа (30 баров)"
  В статистике: avg_bars_held для оценки стратегии
```

### 27.7 Исполнение Ордера

```python
async def _execute_signal(self, symbol: str, signal: ChecklistResult):
    """
    Размещение рыночного ордера через коннектор.
    """
    # Рассчитать размер позиции
    sizing = self.position_sizer.compute(
        capital    = self.capital,
        risk_pct   = self.config.risk_per_trade,
        entry      = signal.entry_price,
        sl         = signal.sl_price,
        leverage   = self.config.leverage,
        market     = self.markets[symbol]
    )
    
    if not sizing.is_valid:
        logger.warning(f"Invalid sizing for {symbol}, skipping")
        return
    
    if self.config.paper_trade:
        # Paper mode: симулировать ордер
        order_id = f"PAPER_{symbol}_{self.scan_count}"
    else:
        # Live mode: отправить реальный ордер
        order = await self.connector.place_market_order(
            symbol = symbol,
            side   = signal.signal,   # "LONG" | "SHORT" → "buy" | "sell"
            amount = sizing.amount
        )
        order_id = order['id']
    
    # Сохранить позицию
    self.positions[symbol] = Position(
        symbol      = symbol,
        side        = signal.signal,
        entry_price = signal.entry_price,
        amount      = sizing.amount,
        sl_price    = signal.sl_price,
        tp_price    = signal.tp_price,
        entry_scan  = self.scan_count,
        entry_time  = datetime.utcnow(),
        order_id    = order_id,
        paper       = self.config.paper_trade,
        pnl_usdt    = 0.0,
        max_favorable = signal.entry_price
    )
    
    # Уведомление в Telegram
    await self.notifier.send_new_trade(symbol, signal, sizing)
```

---

## Section 28: Backtest Engine — Движок Бэктестирования

### 28.1 Walk-Forward логика

Walk-forward тест делит исторические данные на окна обучения и тестирования для реалистичной оценки стратегии:

```
WALK-FORWARD ПАРАМЕТРЫ:
  train_window = 180  (дней обучения)
  test_window  = 30   (дней тестирования)
  step         = 30   (сдвиг окна)

ПРИМЕР РАЗБИВКИ (данные 2023-2024):

  Окно 1:
    Train: 2023-01-01 → 2023-06-30 (180 дней)
    Test:  2023-07-01 → 2023-07-31 (30 дней)

  Окно 2:
    Train: 2023-02-01 → 2023-07-31 (180 дней)
    Test:  2023-08-01 → 2023-08-31 (30 дней)

  ... и так далее

АЛГОРИТМ:

  all_results = []
  start = data_start
  
  while start + train_window + test_window <= data_end:
    train_end  = start + train_window
    test_start = train_end
    test_end   = test_start + test_window
    
    # Оптимизация на train
    best_params = optimize_params(data[start:train_end])
    
    # Тест на out-of-sample
    result = backtest(data[test_start:test_end], best_params)
    all_results.append(result)
    
    start += step
  
  # Агрегация результатов всех окон
  final_report = aggregate(all_results)
```

### 28.2 Сбор Статистики Фильтров

```python
@dataclass
class FilterStats:
    name: str
    total_checks: int     = 0
    passed: int           = 0
    failed: int           = 0
    passed_and_won: int   = 0   # Фильтр прошёл, сделка выиграна
    failed_and_lost: int  = 0   # Фильтр не прошёл, сделка проиграна
    
    @property
    def pass_rate(self) -> float:
        if self.total_checks == 0:
            return 0.0
        return self.passed / self.total_checks
    
    @property
    def precision(self) -> float:
        """% выигрышей среди сделок, прошедших фильтр"""
        if self.passed == 0:
            return 0.0
        return self.passed_and_won / self.passed
    
    @property
    def contribution(self) -> float:
        """Вклад фильтра: насколько хорошо он отсеивает убытки"""
        if self.total_checks == 0:
            return 0.0
        # Фильтр полезен, если rejected сделки были бы проигрышными
        return self.failed_and_lost / max(self.failed, 1)
```

Сбор данных во время бэктеста:

```python
for signal in all_signals:
    for filter_name, passed in signal.filter_results.items():
        stats[filter_name].total_checks += 1
        if passed:
            stats[filter_name].passed += 1
        else:
            stats[filter_name].failed += 1
        
        # После симуляции сделки
        if trade_won and passed:
            stats[filter_name].passed_and_won += 1
        if not trade_won and not passed:
            stats[filter_name].failed_and_lost += 1
```

### 28.3 Формула Коэффициента Шарпа

```
ФОРМУЛА:
  Sharpe = mean(returns) / std(returns) * sqrt(252)

  где:
    returns    = список дневных доходностей в долях
    mean()     = среднее арифметическое
    std()      = стандартное отклонение (sample std, ddof=1)
    sqrt(252)  = аннуализация (252 торговых дня в году)

ПРИМЕР ВЫЧИСЛЕНИЯ:
  returns = [0.01, -0.005, 0.02, 0.003, -0.01, 0.015]
  mean    = 0.005  (0.5% в день)
  std     = 0.0094
  Sharpe  = 0.005 / 0.0094 * sqrt(252)
           = 0.532 * 15.87
           = 8.44  (аннуализированный)

ИНТЕРПРЕТАЦИЯ:
  Sharpe < 1.0  — слабая стратегия
  Sharpe 1-2    — приемлемая стратегия
  Sharpe 2-3    — хорошая стратегия
  Sharpe > 3    — отличная стратегия (редко, возможна подгонка)

КРИПТО-ПОПРАВКА:
  Для крипто используют 365 дней (рынок работает круглосуточно):
  Sharpe_crypto = mean(returns) / std(returns) * sqrt(365)

РЕАЛИЗАЦИЯ:
  import numpy as np
  
  def sharpe_ratio(returns: list[float], periods_per_year: int = 252) -> float:
      r = np.array(returns)
      if len(r) < 2:
          return 0.0
      mean_r = np.mean(r)
      std_r  = np.std(r, ddof=1)
      if std_r == 0:
          return 0.0
      return (mean_r / std_r) * np.sqrt(periods_per_year)
```

### 28.4 Дополнительные Метрики Бэктеста

```python
@dataclass
class BacktestMetrics:
    # Базовые метрики
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float           # winning / total
    
    # PnL метрики
    total_pnl_usdt: float
    total_pnl_pct: float
    avg_win_usdt: float
    avg_loss_usdt: float
    profit_factor: float      # sum(wins) / sum(losses)
    
    # Риск метрики
    max_drawdown_pct: float   # Максимальная просадка в %
    max_drawdown_usdt: float
    sharpe_ratio: float
    sortino_ratio: float      # Sharpe только по негативным отклонениям
    calmar_ratio: float       # Годовой доход / Max Drawdown
    
    # По причинам выхода
    sl_exits: int
    tp_exits: int
    manual_exits: int
    sl_win_rate: float        # % выигрышей среди SL-выходов (должен быть ~0)
    tp_win_rate: float        # % выигрышей среди TP-выходов (должен быть ~100%)
    
    # По направлению
    long_trades: int
    short_trades: int
    long_win_rate: float
    short_win_rate: float
    long_pnl_usdt: float
    short_pnl_usdt: float
```

### 28.5 Win Rate по Причинам Выхода

```
ТАБЛИЦА WIN RATE ПО ПРИЧИНАМ:

  Exit Reason | Count | Win Rate | Avg PnL USDT
  ------------|-------|----------|-------------
  TP          | 85    | 100.0%   | +$42.50
  SL          | 60    | 0.0%     | -$20.00
  Manual      | 15    | 53.3%    | +$5.20
  Timeout     | 10    | 40.0%    | -$2.10
  ------------|-------|----------|-------------
  TOTAL       | 170   | 50.0%    | +$15.60

ПРИМЕЧАНИЕ:
  Win Rate = 50% при Profit Factor > 1.5 → жизнеспособная стратегия
  (большие победители, маленькие проигрыши)
```

### 28.6 LONG vs SHORT Win Rate

```python
def compute_directional_stats(trades: list[Trade]) -> dict:
    long_trades  = [t for t in trades if t.side == "LONG"]
    short_trades = [t for t in trades if t.side == "SHORT"]
    
    long_wins  = [t for t in long_trades  if t.pnl > 0]
    short_wins = [t for t in short_trades if t.pnl > 0]
    
    return {
        "long": {
            "count":    len(long_trades),
            "wins":     len(long_wins),
            "win_rate": len(long_wins) / max(len(long_trades), 1),
            "total_pnl": sum(t.pnl for t in long_trades),
            "avg_pnl":  sum(t.pnl for t in long_trades) / max(len(long_trades), 1)
        },
        "short": {
            "count":    len(short_trades),
            "wins":     len(short_wins),
            "win_rate": len(short_wins) / max(len(short_trades), 1),
            "total_pnl": sum(t.pnl for t in short_trades),
            "avg_pnl":  sum(t.pnl for t in short_trades) / max(len(short_trades), 1)
        }
    }
```

---

## Section 29: Telegram Message Formats — Форматы Сообщений

### 29.1 Новая Сделка (New Trade)

```python
NEW_TRADE_TEMPLATE = """
🚀 *НОВАЯ СДЕЛКА*

*Пара:*  `{symbol}`
*Направление:*  {side_emoji} `{side}`
*Паттерн:*  `{pattern}` от уровня `{level_price:.4f}`

*Вход:*  `{entry_price:.4f}`
*SL:*    `{sl_price:.4f}` ({sl_pct:.2f}%)
*TP:*    `{tp_price:.4f}` ({tp_pct:.2f}%)
*R/R:*   `{rr_ratio:.1f}R`

*Размер:*  `{amount:.4f}` {base_currency}
*Стоимость:*  `${pos_val:.2f}`
*Риск:*  `${risk_usdt:.2f}` ({risk_pct:.1f}%)

*Фильтры:*  {filters_passed}/{filters_total} ✅
*Уверенность:*  {confidence:.0f}%

*Баланс:*  `${balance:.2f} USDT`
*Режим:*  {mode}

🕐 {timestamp} UTC
"""

# Переменные:
# side_emoji: "📈" для LONG, "📉" для SHORT
# mode: "📄 Paper" или "💰 Live"
# sl_pct: abs(entry - sl) / entry * 100
# tp_pct: abs(tp - entry) / entry * 100
```

### 29.2 Закрытая Позиция (Position Closed)

```python
CLOSED_TRADE_TEMPLATE = """
{result_emoji} *ПОЗИЦИЯ ЗАКРЫТА*

*Пара:*  `{symbol}`
*Направление:*  {side_emoji} `{side}`
*Причина:*  `{exit_reason}`

*Вход:*   `{entry_price:.4f}`
*Выход:*  `{exit_price:.4f}`
*Держали:*  `{bars_held}` баров ({time_held})

*PnL:*  {pnl_emoji} `{pnl_sign}${abs_pnl:.2f}` ({pnl_pct:+.2f}%)

*Всего сделок:*  `{total_trades}`
*Win Rate:*  `{win_rate:.1f}%`
*Баланс:*  `${balance:.2f} USDT`

🕐 {timestamp} UTC
"""

# result_emoji: "✅" для прибыли, "❌" для убытка
# pnl_emoji: "💚" для прибыли, "🔴" для убытка
# pnl_sign: "+" для прибыли, "-" для убытка
# time_held: "2ч 35м" — форматированное время
```

### 29.3 Дневной Отчёт (Daily Report)

```python
DAILY_REPORT_TEMPLATE = """
📊 *ДНЕВНОЙ ОТЧЁТ*  {date}

*Сделок за день:*  `{daily_trades}`
*Выиграно:*  `{daily_wins}` ✅
*Проиграно:*  `{daily_losses}` ❌
*Win Rate:*  `{daily_win_rate:.1f}%`

*PnL за день:*  {pnl_emoji} `{daily_pnl_sign}${abs_daily_pnl:.2f}`
*PnL %:*  `{daily_pnl_pct:+.2f}%`

━━━━━━━━━━━━━━━━━
*ВСЕГО ЗА ВСЁ ВРЕМЯ:*
*Сделок:*  `{total_trades}`
*Win Rate:*  `{total_win_rate:.1f}%`
*Общий PnL:*  {total_pnl_emoji} `{total_pnl_sign}${abs_total_pnl:.2f}`
*Макс. просадка:*  `{max_dd:.2f}%`
*Sharpe:*  `{sharpe:.2f}`

━━━━━━━━━━━━━━━━━
*ОТКРЫТЫЕ ПОЗИЦИИ:*  `{open_positions}`
{open_positions_list}

*Баланс:*  `${balance:.2f} USDT`
*Начальный:*  `${initial_balance:.2f} USDT`
*Изменение:*  `{balance_change:+.2f}%`

🕐 {timestamp} UTC
"""
```

### 29.4 Баланс Аккаунта (Balance Request)

```python
BALANCE_TEMPLATE = """
💰 *БАЛАНС АККАУНТА*

*Доступно:*  `${free:.2f} USDT`
*В ордерах:*  `${used:.2f} USDT`
*Итого:*  `${total:.2f} USDT`

*Открытые позиции:*  `{open_count}`
{positions_summary}

*Режим:*  {mode}
🕐 {timestamp} UTC
"""
```

### 29.5 Сообщение об Ошибке (Error Message)

```python
ERROR_TEMPLATE = """
⚠️ *ОШИБКА БОТА*

*Тип:*  `{error_type}`
*Сообщение:*  `{error_message}`
*Компонент:*  `{component}`
*Действие:*  `{action_taken}`

*Следующая попытка:*  через `{retry_after}` сек
🕐 {timestamp} UTC
"""

# error_type: "NetworkError", "ExchangeError", "StrategyError", etc.
# action_taken: "retry", "skip_symbol", "pause_trading", "shutdown"
```

### 29.6 Уведомление о Старте Бота

```python
START_TEMPLATE = """
🤖 *OrbityxAI ЗАПУЩЕН*

*Версия:*  `{version}`
*Режим:*  `{mode}`
*Биржа:*  `{exchange}`
*Пар для торговли:*  `{symbol_count}`
*Стратегия:*  `{strategy}`

*Конфигурация:*
  • Риск/сделку:  `{risk_pct:.1f}%`
  • Макс. позиций:  `{max_positions}`
  • Плечо:  `{leverage}x`
  • Сканирование:  каждые `{scan_interval}` сек

*Баланс:*  `${balance:.2f} USDT`
🕐 {timestamp} UTC
"""
```

### 29.7 Форматирование Позиций (вспомогательные функции)

```python
def format_positions_list(positions: dict) -> str:
    """Форматирует список открытых позиций для Telegram."""
    if not positions:
        return "  _Нет открытых позиций_"
    
    lines = []
    for symbol, pos in positions.items():
        side_emoji = "📈" if pos.side == "LONG" else "📉"
        pnl_emoji  = "💚" if pos.pnl_usdt >= 0 else "🔴"
        lines.append(
            f"  {side_emoji} `{symbol}` "
            f"entry=`{pos.entry_price:.4f}` "
            f"pnl={pnl_emoji}`{pos.pnl_usdt:+.2f}`"
        )
    return "\n".join(lines)


def format_time_held(bars_held: int, scan_interval_sec: int) -> str:
    """Форматирует время удержания позиции."""
    total_sec = bars_held * scan_interval_sec
    hours   = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    
    if hours > 0:
        return f"{hours}ч {minutes}м"
    return f"{minutes}м"
```

---

## Section 30: Performance Benchmarks — Производительность

### 30.1 Методология Замеров

Все бенчмарки проводились на стандартном окружении:
- CPU: Apple M1 Pro / Intel i7-10700K
- RAM: 16 GB
- Python 3.11
- ccxt 4.x
- Данные: локальный SQLite кэш (без сетевых задержек для чистых тестов)

### 30.2 Время Сканирования На Пару

```
ОПЕРАЦИЯ                    | СРЕДНЕЕ  | P95      | P99
----------------------------|----------|----------|----------
Загрузка баров (кэш)        |  2.1 ms  |  4.5 ms  |  8.2 ms
Загрузка баров (API)        | 180 ms   | 350 ms   | 600 ms
_find_levels() (200 баров)  |  8.3 ms  | 12.1 ms  | 18.5 ms
_check_signal_m5()          |  1.2 ms  |  2.1 ms  |  3.8 ms
_check_filters() (все 5)    |  3.1 ms  |  5.2 ms  |  8.1 ms
_compute_shortest_sl()      |  0.8 ms  |  1.2 ms  |  2.0 ms
Position sizing             |  0.3 ms  |  0.5 ms  |  0.9 ms
----------------------------|----------|----------|----------
ИТОГО (с кэшем)             | 15.8 ms  | 25.6 ms  | 41.5 ms
ИТОГО (с API)               | 193 ms   | 375 ms   | 620 ms
```

### 30.3 Масштабирование По Количеству Пар

```
КОЛ-ВО ПАР | ВРЕМЯ СКАНА (кэш) | ВРЕМЯ СКАНА (API) | RPS нагрузка
-----------|-------------------|-------------------|-------------
10         | 0.16 сек          | 1.93 сек          | ~5 req/s
20         | 0.32 сек          | 3.86 сек          | ~10 req/s
50         | 0.79 сек          | 9.65 сек          | ~26 req/s
100        | 1.58 сек          | 19.3 сек          | ~52 req/s
200        | 3.16 сек          | 38.6 сек          | ~104 req/s

ВАЖНО: Биржи лимитируют RPS (Binance: 1200/мин = 20/сек).
При 100 парах без параллелизма = 52 req/s → ПРЕВЫСИТ ЛИМИТ.

РЕШЕНИЕ: asyncio.Semaphore(MAX_CONCURRENT) = 10
  Эффективное время = max(n_pairs/concurrent * api_time, n_pairs * cache_time)
  При 100 парах: 10 * 1.93 сек = 19.3 сек (10 параллельных потоков)
```

### 30.4 Время Обнаружения Уровней

```
_find_levels() детальный профиль:

  ШАГ                      | ВРЕМЯ
  -------------------------|--------
  Поиск локальных экстремов|  2.1 ms
  Кластеризация            |  3.8 ms
  Фильтрация по силе       |  0.9 ms
  Обогащение H4            |  1.2 ms
  Сортировка               |  0.3 ms
  -------------------------|--------
  ИТОГО                    |  8.3 ms

ЗАВИСИМОСТЬ ОТ РАЗМЕРА ДАННЫХ:
  100 баров H1  →  4.1 ms
  200 баров H1  →  8.3 ms
  500 баров H1  → 18.7 ms
  Сложность: O(n * m) где n=баров, m=уровней (кластеризация)
```

### 30.5 Оценка Сигнала

```
_check_signal_m5() + _check_filters():

  ОПЕРАЦИЯ          | ВРЕМЯ    | ЗАВИСИМОСТЬ
  ------------------|----------|------------------
  RSI вычисление    |  0.4 ms  | O(period)
  EMA вычисление    |  0.3 ms  | O(n_bars)
  ATR вычисление    |  0.5 ms  | O(period)
  Volume анализ     |  0.1 ms  | O(1)
  Session check     |  0.01 ms | O(1)
  Pattern detection |  0.8 ms  | O(n_bars_m5)
  ------------------|----------|------------------
  ИТОГО             |  2.1 ms  | —
```

### 30.6 Использование Памяти

```
КОМПОНЕНТ                   | ПАМЯТЬ
----------------------------|--------
Бары H1 (200 × 6 полей)     |   ~96 KB
Бары H4 (50 × 6 полей)      |   ~24 KB
Бары M5 (50 × 6 полей)      |   ~24 KB
Уровни (10 уровней)         |    ~1 KB
Позиции (10 открытых)       |    ~5 KB
Кэш баров (100 пар)         | ~14.4 MB
Весь процесс Python         |  ~85 MB
--------------------------- |--------
ИТОГО (100 пар, кэш)        | ~100 MB

ОПТИМИЗАЦИЯ ПАМЯТИ:
  - numpy arrays вместо list[float]: экономия ~40%
  - Кэш с LRU политикой: maxsize=200 пар
  - Сборка мусора после каждого цикла сканирования
```

### 30.7 Бэктест Производительность

```
БЭКТЕСТ МЕТРИКИ:

  ПАРАМЕТР                 | ЗНАЧЕНИЕ
  -------------------------|----------
  Баров за день (M5)       | 288
  Баров за год (M5)        | 105,120
  Скорость обработки       | ~50,000 баров/сек
  Время бэктеста (1 год)   | ~2.1 сек
  Время бэктеста (5 лет)   | ~10.5 сек
  Walk-forward (1 год)     | ~8.4 сек (4 окна)
  
  ПАМЯТЬ ПРИ БЭКТЕСТЕ:
  5 лет M5 данных (1 пара) | ~36 MB
  5 лет M5 данных (10 пар) | ~360 MB
```

---

## Section 31: Configuration Reference — Полный Справочник Параметров

### 31.1 Общая Структура Конфига

```yaml
# config.yaml — полная структура

exchange:
  name: "binance"           # Биржа
  api_key: ""               # API ключ (из env)
  api_secret: ""            # API секрет (из env)
  sandbox: false            # Тестовая сеть

trading:
  symbols: []               # Список пар
  paper_trade: true         # Бумажная торговля
  leverage: 1               # Плечо (1 = спот)
  risk_per_trade: 0.01      # Риск на сделку (1%)
  max_open_positions: 3     # Макс. одновременных позиций
  scan_interval_sec: 300    # Интервал сканирования (сек)

strategy:
  name: "checklist"         # Стратегия
  timeframes:
    signal: "5m"            # Сигнальный таймфрейм
    structure: "1h"         # Структурный таймфрейм
    context: "4h"           # Контекстный таймфрейм
  
  levels:
    min_touches: 2          # Минимум касаний для уровня
    tolerance_atr_mult: 0.3 # Допуск кластеризации (×ATR)
    max_levels: 10          # Макс. уровней для анализа
    lookback_bars: 200      # Глубина истории (баров H1)
  
  signal:
    breakout_threshold: 0.001      # Порог пробоя (0.1%)
    breakout_volume_mult: 1.5      # Множитель объёма пробоя
    retest_tolerance_atr_mult: 0.5 # Допуск ретеста (×ATR)
  
  filters:
    trend:
      enabled: true
      ema_fast_period: 20
      ema_slow_period: 50
    
    volatility:
      enabled: true
      min_atr_pct: 0.05
      max_atr_pct: 5.0
      atr_period: 14
    
    rsi:
      enabled: true
      period: 14
      long_min: 40
      long_max: 70
      short_min: 30
      short_max: 60
    
    volume:
      enabled: true
      threshold: 1.1         # 110% от среднего объёма
      lookback: 20
    
    session:
      enabled: true
      sessions: ["london", "ny"]
      timezone: "UTC"
  
  sl:
    candidates: ["wick", "level", "atr", "swing"]
    level_buffer_atr_mult: 0.5
    atr_mult: 2.0
    swing_lookback: 20
    swing_buffer_atr_mult: 0.2
    min_sl_pct: 0.1
    max_sl_pct: 5.0
    default_atr_mult: 2.0
  
  tp:
    min_rr: 3.0              # Минимальный R/R
    level_buffer_ticks: 2    # Буфер до уровня TP (в тиках)
    use_next_level: true     # Использовать следующий уровень
    synthetic_rr: 3.0        # Синтетический TP если нет уровня

sizing:
  min_sl_pct: 0.1            # Минимальный SL %
  max_sl_pct: 5.0            # Максимальный SL %
  max_leverage: 20           # Максимальное плечо

telegram:
  enabled: true
  bot_token: ""              # Из env
  chat_id: ""                # Из env
  notify_new_trade: true
  notify_closed_trade: true
  notify_daily_report: true
  daily_report_hour: 20      # UTC час дневного отчёта
  notify_errors: true
  error_cooldown_sec: 300    # Пауза между повторными ошибками

backtest:
  start_date: "2023-01-01"
  end_date: "2024-01-01"
  initial_capital: 10000.0
  commission_pct: 0.001      # 0.1% комиссия
  slippage_pct: 0.0005       # 0.05% проскальзывание
  walk_forward:
    enabled: false
    train_days: 180
    test_days: 30
    step_days: 30

logging:
  level: "INFO"              # DEBUG, INFO, WARNING, ERROR
  file: "logs/orbityxai.log"
  max_size_mb: 100
  backup_count: 5
  format: "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
```

### 31.2 Таблица Всех Параметров

| Параметр | Тип | По Умолчанию | Диапазон | Описание |
|----------|-----|-------------|---------|----------|
| `exchange.name` | str | "binance" | binance/bybit/okx | Название биржи |
| `exchange.sandbox` | bool | false | — | Тестовая сеть |
| `trading.paper_trade` | bool | true | — | Бумажная торговля |
| `trading.leverage` | int | 1 | 1–125 | Плечо |
| `trading.risk_per_trade` | float | 0.01 | 0.001–0.05 | Риск на сделку |
| `trading.max_open_positions` | int | 3 | 1–20 | Макс. позиций |
| `trading.scan_interval_sec` | int | 300 | 60–3600 | Интервал скана |
| `strategy.levels.min_touches` | int | 2 | 2–5 | Мин. касаний уровня |
| `strategy.levels.max_levels` | int | 10 | 5–30 | Макс. уровней |
| `strategy.levels.lookback_bars` | int | 200 | 50–500 | Глубина истории |
| `strategy.signal.breakout_threshold` | float | 0.001 | 0.0005–0.005 | Порог пробоя |
| `strategy.signal.breakout_volume_mult` | float | 1.5 | 1.0–3.0 | Объём пробоя |
| `strategy.filters.trend.ema_fast_period` | int | 20 | 5–50 | Быстрая EMA |
| `strategy.filters.trend.ema_slow_period` | int | 50 | 20–200 | Медленная EMA |
| `strategy.filters.volatility.min_atr_pct` | float | 0.05 | 0.01–0.5 | Мин. ATR % |
| `strategy.filters.volatility.max_atr_pct` | float | 5.0 | 1.0–20.0 | Макс. ATR % |
| `strategy.filters.rsi.period` | int | 14 | 5–30 | Период RSI |
| `strategy.filters.rsi.long_min` | int | 40 | 20–60 | RSI min для LONG |
| `strategy.filters.rsi.long_max` | int | 70 | 50–85 | RSI max для LONG |
| `strategy.filters.volume.threshold` | float | 1.1 | 1.0–3.0 | Порог объёма |
| `strategy.sl.atr_mult` | float | 2.0 | 1.0–5.0 | Множитель ATR для SL |
| `strategy.sl.min_sl_pct` | float | 0.1 | 0.05–0.5 | Мин. SL % |
| `strategy.sl.max_sl_pct` | float | 5.0 | 1.0–10.0 | Макс. SL % |
| `strategy.tp.min_rr` | float | 3.0 | 1.5–10.0 | Мин. Risk/Reward |
| `backtest.commission_pct` | float | 0.001 | 0–0.01 | Комиссия |
| `backtest.slippage_pct` | float | 0.0005 | 0–0.005 | Проскальзывание |
| `telegram.daily_report_hour` | int | 20 | 0–23 | Час дневного отчёта |

### 31.3 Переменные Окружения

```bash
# .env файл (никогда не коммитить в git!)

# Биржа
EXCHANGE_API_KEY=your_api_key_here
EXCHANGE_API_SECRET=your_api_secret_here

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=-100123456789

# Опциональные
LOG_LEVEL=INFO
PAPER_TRADE=true
INITIAL_CAPITAL=10000
```

Загрузка переменных окружения:

```python
import os
from dotenv import load_dotenv

load_dotenv()

api_key    = os.getenv("EXCHANGE_API_KEY", "")
api_secret = os.getenv("EXCHANGE_API_SECRET", "")
bot_token  = os.getenv("TELEGRAM_BOT_TOKEN", "")
chat_id    = os.getenv("TELEGRAM_CHAT_ID", "")
```

### 31.4 Валидация Конфига

```python
def validate_config(config: BotConfig) -> list[str]:
    """
    Проверяет конфигурацию и возвращает список ошибок.
    
    Returns:
        list[str] — список ошибок (пустой = конфиг валиден)
    """
    errors = []
    
    # Проверки trading
    if not 0.001 <= config.risk_per_trade <= 0.05:
        errors.append(f"risk_per_trade={config.risk_per_trade} вне диапазона [0.001, 0.05]")
    
    if config.leverage < 1 or config.leverage > 125:
        errors.append(f"leverage={config.leverage} вне диапазона [1, 125]")
    
    if config.max_open_positions < 1:
        errors.append("max_open_positions должен быть >= 1")
    
    # Проверки стратегии
    if config.strategy.tp.min_rr < 1.5:
        errors.append(f"min_rr={config.strategy.tp.min_rr} слишком мал (< 1.5)")
    
    rsi_cfg = config.strategy.filters.rsi
    if rsi_cfg.long_min >= rsi_cfg.long_max:
        errors.append("rsi.long_min должен быть < rsi.long_max")
    
    # Проверки биржи
    if not config.exchange.api_key and not config.trading.paper_trade:
        errors.append("api_key обязателен в live режиме")
    
    return errors
```

---

## Section 32: Error Codes and Recovery — Коды Ошибок и Восстановление

### 32.1 Классификация Ошибок

```
УРОВЕНЬ 1: КРИТИЧЕСКИЕ (остановка бота)
  - Нет подключения к бирже > 10 минут
  - Недостаточно средств для минимальной позиции
  - Повреждён конфиг файл
  - Превышен дневной лимит убытков (circuit breaker)

УРОВЕНЬ 2: ОШИБКИ СЕССИИ (пропустить текущий скан)
  - HTTP 429 Too Many Requests
  - HTTP 503 Service Unavailable
  - Timeout при получении данных
  - Невалидные данные баров

УРОВЕНЬ 3: ПРЕДУПРЕЖДЕНИЯ (логировать, продолжить)
  - Нет уровней для символа
  - Сигнал не прошёл фильтры
  - SL слишком широкий
  - Уведомление Telegram не доставлено
```

### 32.2 Ошибки Биржи и Обработка

```python
EXCHANGE_ERROR_CODES = {
    # Binance коды ошибок
    -1003: {
        "name": "TOO_MANY_REQUESTS",
        "description": "Превышен лимит запросов",
        "action": "exponential_backoff",
        "retry_after": 60,
        "max_retries": 5
    },
    -1013: {
        "name": "FILTER_FAILURE",
        "description": "Ордер не прошёл фильтр биржи (min_notional и др.)",
        "action": "skip_symbol",
        "retry_after": 0,
        "max_retries": 0
    },
    -1021: {
        "name": "TIMESTAMP_OUT_OF_SYNC",
        "description": "Время сервера не синхронизировано",
        "action": "sync_time",
        "retry_after": 1,
        "max_retries": 3
    },
    -2010: {
        "name": "INSUFFICIENT_BALANCE",
        "description": "Недостаточно средств",
        "action": "reduce_position_size",
        "retry_after": 0,
        "max_retries": 1
    },
    -2015: {
        "name": "INVALID_API_KEY",
        "description": "Неверный API ключ",
        "action": "shutdown",
        "retry_after": 0,
        "max_retries": 0
    },
}
```

### 32.3 Rate Limit Handling

```python
class RateLimiter:
    """
    Управление лимитами запросов к API биржи.
    Использует token bucket алгоритм.
    """
    def __init__(self, max_requests: int, window_sec: float):
        self.max_requests = max_requests   # Binance: 1200/мин
        self.window_sec   = window_sec     # 60 сек
        self.tokens       = max_requests
        self.last_refill  = time.monotonic()
        self._lock        = asyncio.Lock()
    
    async def acquire(self, tokens: int = 1):
        async with self._lock:
            await self._refill()
            
            if self.tokens < tokens:
                # Ждём пока накопятся токены
                wait_time = (tokens - self.tokens) / self.rate
                logger.debug(f"Rate limit: ожидание {wait_time:.2f}с")
                await asyncio.sleep(wait_time)
                await self._refill()
            
            self.tokens -= tokens
    
    async def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        new_tokens = elapsed * (self.max_requests / self.window_sec)
        self.tokens = min(self.max_requests, self.tokens + new_tokens)
        self.last_refill = now
    
    @property
    def rate(self) -> float:
        return self.max_requests / self.window_sec
```

Конфигурация лимитов по биржам:

```
БИРЖА        | ЛИМИТ (запросов)  | ОКНО  | ВЕСТ (веса)
-------------|-------------------|-------|------------------
Binance Spot | 1200 weight/мин   | 60с   | GET /klines = 2
Binance Fut. | 2400 weight/мин   | 60с   | GET /klines = 2
Bybit        | 120 req/сек       | 1с    | Все = 1
OKX          | 20 req/2сек       | 2с    | GET = 1
```

### 32.4 Network Timeout Recovery

```python
class RetryableConnector:
    """
    Обёртка над коннектором с retry логикой.
    """
    def __init__(self, connector, max_retries: int = 3,
                 base_delay: float = 1.0, max_delay: float = 60.0):
        self.connector   = connector
        self.max_retries = max_retries
        self.base_delay  = base_delay
        self.max_delay   = max_delay
    
    async def fetch_ohlcv_with_retry(self, symbol: str, timeframe: str,
                                      limit: int) -> list:
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return await self.connector.fetch_ohlcv(symbol, timeframe, limit)
            
            except asyncio.TimeoutError as e:
                last_exception = e
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                logger.warning(
                    f"Timeout для {symbol} (попытка {attempt+1}/{self.max_retries+1}), "
                    f"повтор через {delay:.1f}с"
                )
                await asyncio.sleep(delay)
            
            except ccxt.RateLimitExceeded as e:
                last_exception = e
                # Для rate limit — более длинная пауза
                delay = min(60 * (attempt + 1), self.max_delay)
                logger.warning(f"Rate limit, ожидание {delay}с")
                await asyncio.sleep(delay)
            
            except ccxt.NetworkError as e:
                last_exception = e
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                logger.warning(f"Network error: {e}, повтор через {delay:.1f}с")
                await asyncio.sleep(delay)
            
            except ccxt.ExchangeError as e:
                # Биржевые ошибки — не повторяем
                logger.error(f"Exchange error для {symbol}: {e}")
                raise
        
        # Все попытки исчерпаны
        logger.error(f"Все {self.max_retries} попыток исчерпаны для {symbol}")
        raise last_exception
```

### 32.5 Circuit Breaker (Автовыключатель)

```python
class CircuitBreaker:
    """
    Останавливает торговлю при превышении дневного лимита убытков.
    
    States: CLOSED (normal) → OPEN (trading stopped) → HALF_OPEN (testing)
    """
    def __init__(self, max_daily_loss_pct: float = 5.0,
                 max_consecutive_losses: int = 5,
                 recovery_period_hours: float = 24.0):
        
        self.max_daily_loss_pct      = max_daily_loss_pct
        self.max_consecutive_losses  = max_consecutive_losses
        self.recovery_period_hours   = recovery_period_hours
        
        self.state              = "CLOSED"
        self.daily_loss_pct     = 0.0
        self.consecutive_losses = 0
        self.opened_at: datetime | None = None
    
    def record_trade(self, pnl_pct: float):
        """Записать результат сделки и проверить условия."""
        if pnl_pct < 0:
            self.daily_loss_pct     += abs(pnl_pct)
            self.consecutive_losses += 1
        else:
            self.consecutive_losses  = 0  # Сброс при выигрыше
        
        self._check_conditions()
    
    def _check_conditions(self):
        if self.state == "CLOSED":
            if self.daily_loss_pct >= self.max_daily_loss_pct:
                self._open(f"Дневной лимит убытков {self.daily_loss_pct:.1f}%")
            elif self.consecutive_losses >= self.max_consecutive_losses:
                self._open(f"{self.consecutive_losses} убытков подряд")
    
    def _open(self, reason: str):
        self.state     = "OPEN"
        self.opened_at = datetime.utcnow()
        logger.critical(f"CIRCUIT BREAKER ОТКРЫТ: {reason}")
    
    def is_trading_allowed(self) -> bool:
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            # Проверить истёк ли период восстановления
            elapsed_hours = (datetime.utcnow() - self.opened_at).total_seconds() / 3600
            if elapsed_hours >= self.recovery_period_hours:
                self.state          = "HALF_OPEN"
                self.daily_loss_pct = 0.0
                logger.info("Circuit breaker: переход в HALF_OPEN")
            return False
        
        # HALF_OPEN: разрешить одну сделку для проверки
        return True
```

### 32.6 Обработка Специфичных Ошибок

```
КОД ОШИБКИ / ИСКЛЮЧЕНИЕ          | ДЕЙСТВИЕ
----------------------------------|--------------------------------------------
asyncio.TimeoutError              | Retry с exponential backoff
ccxt.RateLimitExceeded            | Sleep 60с, затем retry
ccxt.NetworkError                 | Retry 3 раза с паузой
ccxt.ExchangeNotAvailable         | Pause 5 мин, уведомить Telegram
ccxt.AuthenticationError          | Shutdown, critical alert
ccxt.InsufficientFunds            | Уменьшить размер позиции, skip если не помогло
ccxt.InvalidOrder                 | Log и skip (не retry)
ccxt.OrderNotFound                | Проверить статус вручную
KeyError (в данных баров)         | Log warning, skip symbol
ValueError (в вычислениях)        | Log error, skip signal
ZeroDivisionError                 | Log error, apply fallback value
```

### 32.7 Логирование Ошибок

```python
# Структурированное логирование с контекстом
import structlog

logger = structlog.get_logger()

# При ошибке сигнала
logger.error(
    "signal_error",
    symbol   = symbol,
    error    = str(e),
    scan_cnt = self.scan_count,
    action   = "skip_symbol"
)

# При ошибке ордера
logger.error(
    "order_error",
    symbol     = symbol,
    side       = signal.signal,
    amount     = sizing.amount,
    entry      = signal.entry_price,
    error_code = getattr(e, 'http_code', None),
    error_msg  = str(e),
    action     = "no_position_opened"
)

# Метрики ошибок (для мониторинга)
ERROR_COUNTER = {
    "timeout":       0,
    "rate_limit":    0,
    "network":       0,
    "exchange":      0,
    "strategy":      0,
    "order":         0,
}
```

### 32.8 Health Check Endpoint

```python
async def health_check() -> dict:
    """
    Возвращает статус здоровья бота.
    Может быть вызван через HTTP (если включён web server)
    или через Telegram команду /health.
    """
    return {
        "status":          "ok" if is_running else "error",
        "uptime_sec":      int(time.monotonic() - start_time),
        "scan_count":      scan_count,
        "open_positions":  len(positions),
        "circuit_breaker": circuit_breaker.state,
        "last_scan_sec":   int(time.monotonic() - last_scan_time),
        "errors_today": {
            "timeout":    ERROR_COUNTER["timeout"],
            "rate_limit": ERROR_COUNTER["rate_limit"],
            "exchange":   ERROR_COUNTER["exchange"],
        },
        "balance_usdt":   current_balance,
        "daily_pnl_pct":  daily_pnl_pct,
        "timestamp":      datetime.utcnow().isoformat()
    }
```

---

## Критические Замечания По Реализации (Продолжение)

### Общие принципы надёжности

**Идемпотентность операций.** Все операции с биржей должны быть спроектированы так, чтобы повторный вызов не создавал дублирующих ордеров. Перед размещением нового ордера проверять открытые ордера по символу.

**Атомарность обновления состояния.** Позиция добавляется в словарь `positions` только после подтверждения от биржи (или создания paper записи). Промежуточные состояния не допускаются.

**Graceful shutdown.** При получении SIGTERM/SIGINT:
1. Прекратить сканирование
2. Не открывать новых позиций
3. Опционально закрыть открытые позиции (если `close_on_shutdown = true`)
4. Сохранить состояние в файл (для восстановления после рестарта)
5. Отправить уведомление в Telegram о завершении

**Восстановление после рестарта.** При запуске бот читает файл состояния `state.json` (если есть) и восстанавливает список открытых позиций. Это предотвращает потерю слежения за позициями после перезапуска.

```python
# state.json структура
{
  "positions": {
    "BTC/USDT": {
      "side": "LONG",
      "entry_price": 50000.0,
      "amount": 0.1,
      "sl_price": 49000.0,
      "tp_price": 53000.0,
      "entry_scan": 42,
      "entry_time": "2024-01-15T10:30:00",
      "order_id": "123456",
      "paper": false
    }
  },
  "scan_count": 150,
  "capital": 9850.0,
  "saved_at": "2024-01-15T12:00:00"
}
```

