/**
 * @file utils/math.ts
 * @description Pure, side-effect-free numeric helpers used across the platform.
 *
 * All functions handle non-finite inputs gracefully, returning NaN or safe
 * fallbacks rather than throwing exceptions.
 */

/**
 * Format a number to fixed decimal places and trim trailing zeros.
 *
 * @example toFixedTrim(12.3400, 4) → "12.34"
 * @example toFixedTrim(5, 2)       → "5"
 */
export function toFixedTrim(value: number, digits = 2): string {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(digits).replace(/\.?0+$/, '');
}

/**
 * Lenient parser: extracts a number from messy strings like "$1,234.56".
 * Returns NaN for truly invalid input.
 */
export function parseNumber(str: unknown): number {
    if (typeof str === 'number') return Number.isFinite(str) ? str : NaN;
    if (str == null) return NaN;
    if (typeof str !== 'string') return NaN;
    const cleaned = String(str).replace(/[^0-9.+\-Ee]/g, '');
    if (!cleaned || cleaned === '+' || cleaned === '-' || cleaned === '.') return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
}

/** Type guard: checks that a value is a finite number. */
export function isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

/** Constrain a number to the inclusive range [min, max]. */
export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

/** Round to a given number of decimal places. Returns NaN on bad input. */
export function round(n: number, precision = 2): number {
    if (!isFiniteNumber(n)) return NaN;
    const factor = 10 ** precision;
    return Math.round(n * factor) / factor;
}

/** Sum finite values in an array; skips NaN/Infinity. */
export function sum(arr: readonly number[]): number {
    return arr.reduce((acc, n) => acc + (isFiniteNumber(n) ? n : 0), 0);
}

/** Arithmetic mean of finite values; returns 0 for empty arrays. */
export function avg(arr: readonly number[]): number {
    const nums = arr.filter(isFiniteNumber);
    return nums.length ? sum(nums) / nums.length : 0;
}

/** Simple Moving Average over an array, returns array of same length (NaN for early values). */
export function sma(values: readonly number[], period: number): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    for (let i = period - 1; i < values.length; i++) {
        let s = 0;
        for (let j = 0; j < period; j++) s += values[i - j]!;
        result[i] = s / period;
    }
    return result;
}

/** Exponential Moving Average. Seed value is the SMA of the first `period` elements. */
export function ema(values: readonly number[], period: number): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    if (values.length < period) return result;
    const k = 2 / (period + 1);
    // Seed with simple average.
    let prev = 0;
    for (let i = 0; i < period; i++) prev += values[i]!;
    prev /= period;
    result[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
        prev = values[i]! * k + prev * (1 - k);
        result[i] = prev;
    }
    return result;
}

/** Standard deviation of an array of numbers. */
export function stdDev(values: readonly number[]): number {
    if (!values.length) return 0;
    const mean = avg(values as number[]);
    const variance = avg(values.map((v) => (v - mean) ** 2) as number[]);
    return Math.sqrt(variance);
}

/**
 * Compute RSI (Relative Strength Index) for a close-price array.
 * Uses Wilder's smoothing (equivalent to EMA with alpha = 1/period).
 */
export function rsi(closes: readonly number[], period = 14): number[] {
    const result: number[] = new Array(closes.length).fill(NaN);
    if (closes.length <= period) return result;

    let avgGain = 0;
    let avgLoss = 0;

    // Initial average gain/loss over the first period.
    for (let i = 1; i <= period; i++) {
        const diff = closes[i]! - closes[i - 1]!;
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // Wilder's smoothing for subsequent values.
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i]! - closes[i - 1]!;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return result;
}

/**
 * MACD: returns { macd, signal, histogram } arrays of the same length as closes.
 */
export function macd(
    closes: readonly number[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
    const fastEma = ema(closes, fastPeriod);
    const slowEma = ema(closes, slowPeriod);
    const macdLine = closes.map((_, i) =>
        isFiniteNumber(fastEma[i]) && isFiniteNumber(slowEma[i])
            ? fastEma[i] - slowEma[i]
            : NaN,
    );
    // Compute signal EMA only over non-NaN MACD values.
    const signalLine = ema(macdLine, signalPeriod);
    const histogram = macdLine.map((m, i) =>
        isFiniteNumber(m) && isFiniteNumber(signalLine[i]) ? m - signalLine[i] : NaN,
    );
    return { macdLine, signalLine, histogram };
}

/**
 * Bollinger Bands: returns { upper, middle, lower } arrays.
 * @param multiplier Standard deviation multiplier (default 2).
 */
export function bollingerBands(
    closes: readonly number[],
    period = 20,
    multiplier = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = sma(closes, period);
    const upper: number[] = new Array(closes.length).fill(NaN);
    const lower: number[] = new Array(closes.length).fill(NaN);

    for (let i = period - 1; i < closes.length; i++) {
        const slice = closes.slice(i - period + 1, i + 1) as number[];
        const sd = stdDev(slice);
        upper[i] = middle[i]! + multiplier * sd;
        lower[i] = middle[i]! - multiplier * sd;
    }
    return { upper, middle, lower };
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Technical Indicators
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted Moving Average. */
export function wma(values: readonly number[], period: number): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    const divisor = (period * (period + 1)) / 2;
    for (let i = period - 1; i < values.length; i++) {
        let s = 0;
        for (let j = 0; j < period; j++) {
            s += values[i - j]! * (period - j);
        }
        result[i] = s / divisor;
    }
    return result;
}

/** Double Exponential Moving Average (DEMA). */
export function dema(values: readonly number[], period: number): number[] {
    const e1 = ema(values, period);
    const e2 = ema(e1, period);
    return values.map((_, i) =>
        isFiniteNumber(e1[i]) && isFiniteNumber(e2[i])
            ? 2 * e1[i] - e2[i]
            : NaN,
    );
}

/** Triple Exponential Moving Average (TEMA). */
export function tema(values: readonly number[], period: number): number[] {
    const e1 = ema(values, period);
    const e2 = ema(e1, period);
    const e3 = ema(e2, period);
    return values.map((_, i) =>
        isFiniteNumber(e1[i]) && isFiniteNumber(e2[i]) && isFiniteNumber(e3[i])
            ? 3 * e1[i] - 3 * e2[i] + e3[i]
            : NaN,
    );
}

/** Hull Moving Average (HMA). Period must be >= 4. */
export function hma(values: readonly number[], period: number): number[] {
    const halfWma = wma(values, Math.floor(period / 2));
    const fullWma = wma(values, period);
    const diff = values.map((_, i) =>
        isFiniteNumber(halfWma[i]) && isFiniteNumber(fullWma[i])
            ? 2 * halfWma[i] - fullWma[i]
            : NaN,
    );
    const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));
    return wma(diff, sqrtPeriod);
}

/** Volume Weighted Moving Average (VWMA). */
export function vwma(
    closes: readonly number[],
    volumes: readonly number[],
    period: number,
): number[] {
    const result: number[] = new Array(closes.length).fill(NaN);
    for (let i = period - 1; i < closes.length; i++) {
        let sumPV = 0, sumV = 0;
        for (let j = 0; j < period; j++) {
            sumPV += closes[i - j]! * volumes[i - j]!;
            sumV  += volumes[i - j]!;
        }
        result[i] = sumV !== 0 ? sumPV / sumV : NaN;
    }
    return result;
}

/**
 * Stochastic Oscillator (%K and %D).
 * @returns { k: number[], d: number[] }
 */
export function stochastic(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    kPeriod = 14,
    dPeriod = 3,
): { k: number[]; d: number[] } {
    const kLine: number[] = new Array(closes.length).fill(NaN);
    for (let i = kPeriod - 1; i < closes.length; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = 0; j < kPeriod; j++) {
            if (highs[i - j]! > hi) hi = highs[i - j]!;
            if (lows[i - j]!  < lo) lo = lows[i - j]!;
        }
        kLine[i] = hi === lo ? 50 : ((closes[i]! - lo) / (hi - lo)) * 100;
    }
    const dLine = sma(kLine, dPeriod);
    return { k: kLine, d: dLine };
}

/** Stochastic RSI. */
export function stochasticRSI(
    closes: readonly number[],
    rsiPeriod = 14,
    stochPeriod = 14,
    kSmooth = 3,
    dSmooth = 3,
): { k: number[]; d: number[] } {
    const rsiValues = rsi(closes, rsiPeriod);
    const stochK: number[] = new Array(closes.length).fill(NaN);
    for (let i = rsiPeriod + stochPeriod - 1; i < closes.length; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = 0; j < stochPeriod; j++) {
            const v = rsiValues[i - j];
            if (v !== undefined && isFiniteNumber(v)) {
                if (v > hi) hi = v;
                if (v < lo) lo = v;
            }
        }
        const rsiVal = rsiValues[i];
        if (isFiniteNumber(rsiVal)) {
            stochK[i] = hi === lo ? 50 : ((rsiVal - lo) / (hi - lo)) * 100;
        }
    }
    const k = sma(stochK, kSmooth);
    const d = sma(k, dSmooth);
    return { k, d };
}

/** Williams %R. */
export function williamsR(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    period = 14,
): number[] {
    const result: number[] = new Array(closes.length).fill(NaN);
    for (let i = period - 1; i < closes.length; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = 0; j < period; j++) {
            if (highs[i - j]! > hi) hi = highs[i - j]!;
            if (lows[i - j]!  < lo) lo = lows[i - j]!;
        }
        result[i] = hi === lo ? -50 : ((hi - closes[i]!) / (hi - lo)) * -100;
    }
    return result;
}

/** Commodity Channel Index (CCI). */
export function cci(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    period = 20,
): number[] {
    const tp = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
    const tpSma = sma(tp, period);
    const result: number[] = new Array(closes.length).fill(NaN);
    for (let i = period - 1; i < closes.length; i++) {
        let meanDev = 0;
        for (let j = 0; j < period; j++) {
            meanDev += Math.abs(tp[i - j]! - tpSma[i]!);
        }
        meanDev /= period;
        result[i] = meanDev !== 0 ? (tp[i]! - tpSma[i]!) / (0.015 * meanDev) : 0;
    }
    return result;
}

/** Money Flow Index (MFI). */
export function mfi(
    highs:   readonly number[],
    lows:    readonly number[],
    closes:  readonly number[],
    volumes: readonly number[],
    period = 14,
): number[] {
    const tp = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
    const result: number[] = new Array(closes.length).fill(NaN);
    for (let i = period; i < closes.length; i++) {
        let posFlow = 0, negFlow = 0;
        for (let j = 0; j < period; j++) {
            const mf = tp[i - j]! * volumes[i - j]!;
            if (tp[i - j]! > tp[i - j - 1]!) posFlow += mf;
            else negFlow += mf;
        }
        result[i] = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
    }
    return result;
}

/** Rate of Change (ROC). */
export function roc(values: readonly number[], period = 12): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    for (let i = period; i < values.length; i++) {
        const prev = values[i - period]!;
        result[i] = prev !== 0 ? ((values[i]! - prev) / prev) * 100 : 0;
    }
    return result;
}

/** Momentum indicator. */
export function momentum(values: readonly number[], period = 10): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    for (let i = period; i < values.length; i++) {
        result[i] = values[i]! - values[i - period]!;
    }
    return result;
}

/** Average True Range (ATR). */
export function atr(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    period = 14,
): number[] {
    const tr: number[] = [highs[0]! - lows[0]!];
    for (let i = 1; i < closes.length; i++) {
        tr.push(Math.max(
            highs[i]! - lows[i]!,
            Math.abs(highs[i]! - closes[i - 1]!),
            Math.abs(lows[i]!  - closes[i - 1]!),
        ));
    }
    // Wilder's smoothing (same as RSI smoothing)
    const result: number[] = new Array(closes.length).fill(NaN);
    if (closes.length < period) return result;
    let val = 0;
    for (let i = 0; i < period; i++) val += tr[i]!;
    val /= period;
    result[period - 1] = val;
    for (let i = period; i < closes.length; i++) {
        val = (val * (period - 1) + tr[i]!) / period;
        result[i] = val;
    }
    return result;
}

/**
 * Average Directional Index (ADX).
 * @returns { adx, plusDI, minusDI }
 */
export function adx(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    period = 14,
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
    const len = closes.length;
    const plusDM: number[]  = [0];
    const minusDM: number[] = [0];
    const tr: number[] = [highs[0]! - lows[0]!];

    for (let i = 1; i < len; i++) {
        const upMove   = highs[i]! - highs[i - 1]!;
        const downMove = lows[i - 1]! - lows[i]!;
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(
            highs[i]! - lows[i]!,
            Math.abs(highs[i]! - closes[i - 1]!),
            Math.abs(lows[i]!  - closes[i - 1]!),
        ));
    }

    const smoothed = (arr: number[]): number[] => {
        const out: number[] = new Array(len).fill(NaN);
        if (len < period) return out;
        let s = 0;
        for (let i = 0; i < period; i++) s += arr[i]!;
        out[period - 1] = s;
        for (let i = period; i < len; i++) {
            s = s - s / period + arr[i]!;
            out[i] = s;
        }
        return out;
    };

    const sTR    = smoothed(tr);
    const sPlusDM  = smoothed(plusDM);
    const sMinusDM = smoothed(minusDM);

    const plusDIArr:  number[] = new Array(len).fill(NaN);
    const minusDIArr: number[] = new Array(len).fill(NaN);
    const dx: number[] = new Array(len).fill(NaN);

    for (let i = period - 1; i < len; i++) {
        if (!isFiniteNumber(sTR[i]) || sTR[i] === 0) continue;
        plusDIArr[i]  = (sPlusDM[i]!  / sTR[i]!) * 100;
        minusDIArr[i] = (sMinusDM[i]! / sTR[i]!) * 100;
        const diSum = plusDIArr[i]! + minusDIArr[i]!;
        dx[i] = diSum !== 0 ? (Math.abs(plusDIArr[i]! - minusDIArr[i]!) / diSum) * 100 : 0;
    }

    // ADX = smoothed DX
    const adxArr: number[] = new Array(len).fill(NaN);
    const adxStart = 2 * period - 2;
    if (len > adxStart) {
        let s = 0, cnt = 0;
        for (let i = period - 1; i < adxStart + 1 && i < len; i++) {
            if (isFiniteNumber(dx[i])) { s += dx[i]!; cnt++; }
        }
        if (cnt > 0) {
            adxArr[adxStart] = s / cnt;
            for (let i = adxStart + 1; i < len; i++) {
                if (isFiniteNumber(dx[i]) && isFiniteNumber(adxArr[i - 1])) {
                    adxArr[i] = (adxArr[i - 1]! * (period - 1) + dx[i]!) / period;
                }
            }
        }
    }

    return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
}

/** On Balance Volume (OBV). */
export function obv(closes: readonly number[], volumes: readonly number[]): number[] {
    const result: number[] = [volumes[0] ?? 0];
    for (let i = 1; i < closes.length; i++) {
        const prev = result[i - 1]!;
        if (closes[i]! > closes[i - 1]!) result.push(prev + volumes[i]!);
        else if (closes[i]! < closes[i - 1]!) result.push(prev - volumes[i]!);
        else result.push(prev);
    }
    return result;
}

/** Volume Weighted Average Price (VWAP) — cumulative intraday. */
export function vwap(
    highs:   readonly number[],
    lows:    readonly number[],
    closes:  readonly number[],
    volumes: readonly number[],
): number[] {
    const result: number[] = [];
    let cumPV = 0, cumV = 0;
    for (let i = 0; i < closes.length; i++) {
        const tp = (highs[i]! + lows[i]! + closes[i]!) / 3;
        cumPV += tp * volumes[i]!;
        cumV  += volumes[i]!;
        result.push(cumV !== 0 ? cumPV / cumV : tp);
    }
    return result;
}

/** Accumulation/Distribution Line. */
export function adLine(
    highs:   readonly number[],
    lows:    readonly number[],
    closes:  readonly number[],
    volumes: readonly number[],
): number[] {
    const result: number[] = [];
    let cum = 0;
    for (let i = 0; i < closes.length; i++) {
        const hl = highs[i]! - lows[i]!;
        const mfm = hl !== 0
            ? ((closes[i]! - lows[i]!) - (highs[i]! - closes[i]!)) / hl
            : 0;
        cum += mfm * volumes[i]!;
        result.push(cum);
    }
    return result;
}

/** Chaikin Money Flow (CMF). */
export function cmf(
    highs:   readonly number[],
    lows:    readonly number[],
    closes:  readonly number[],
    volumes: readonly number[],
    period = 20,
): number[] {
    const result: number[] = new Array(closes.length).fill(NaN);
    for (let i = period - 1; i < closes.length; i++) {
        let sumMFV = 0, sumV = 0;
        for (let j = 0; j < period; j++) {
            const idx = i - j;
            const hl = highs[idx]! - lows[idx]!;
            const mfm = hl !== 0
                ? ((closes[idx]! - lows[idx]!) - (highs[idx]! - closes[idx]!)) / hl
                : 0;
            sumMFV += mfm * volumes[idx]!;
            sumV   += volumes[idx]!;
        }
        result[i] = sumV !== 0 ? sumMFV / sumV : 0;
    }
    return result;
}

/**
 * Donchian Channels.
 * @returns { upper, middle, lower }
 */
export function donchianChannels(
    highs: readonly number[],
    lows:  readonly number[],
    period = 20,
): { upper: number[]; middle: number[]; lower: number[] } {
    const upper: number[] = new Array(highs.length).fill(NaN);
    const lower: number[] = new Array(highs.length).fill(NaN);
    const middle: number[] = new Array(highs.length).fill(NaN);
    for (let i = period - 1; i < highs.length; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = 0; j < period; j++) {
            if (highs[i - j]! > hi) hi = highs[i - j]!;
            if (lows[i - j]!  < lo) lo = lows[i - j]!;
        }
        upper[i]  = hi;
        lower[i]  = lo;
        middle[i] = (hi + lo) / 2;
    }
    return { upper, middle, lower };
}

/**
 * Keltner Channels.
 * @returns { upper, middle, lower }
 */
export function keltnerChannels(
    highs: readonly number[],
    lows:  readonly number[],
    closes: readonly number[],
    emaPeriod = 20,
    atrPeriod = 10,
    multiplier = 1.5,
): { upper: number[]; middle: number[]; lower: number[] } {
    const mid = ema(closes, emaPeriod);
    const atrValues = atr(highs, lows, closes, atrPeriod);
    const upper: number[] = new Array(closes.length).fill(NaN);
    const lower: number[] = new Array(closes.length).fill(NaN);
    for (let i = 0; i < closes.length; i++) {
        if (isFiniteNumber(mid[i]) && isFiniteNumber(atrValues[i])) {
            upper[i] = mid[i]! + multiplier * atrValues[i]!;
            lower[i] = mid[i]! - multiplier * atrValues[i]!;
        }
    }
    return { upper, middle: mid, lower };
}

/** Awesome Oscillator (AO). */
export function awesomeOscillator(
    highs: readonly number[],
    lows:  readonly number[],
): number[] {
    const mp = highs.map((h, i) => (h + lows[i]!) / 2);
    const fast = sma(mp, 5);
    const slow = sma(mp, 34);
    return mp.map((_, i) =>
        isFiniteNumber(fast[i]) && isFiniteNumber(slow[i])
            ? fast[i] - slow[i]
            : NaN,
    );
}

/**
 * Parabolic SAR.
 * @returns Array of SAR values (one per candle).
 */
export function parabolicSAR(
    highs: readonly number[],
    lows:  readonly number[],
    step = 0.02,
    maxStep = 0.2,
): number[] {
    const len = highs.length;
    if (len < 2) return new Array(len).fill(NaN);

    const result: number[] = new Array(len).fill(NaN);
    let isLong = highs[1]! >= highs[0]!;
    let af = step;
    let ep = isLong ? highs[0]! : lows[0]!;
    let sar = isLong ? lows[0]! : highs[0]!;
    result[0] = sar;

    for (let i = 1; i < len; i++) {
        const prevSar = sar;
        sar = prevSar + af * (ep - prevSar);

        if (isLong) {
            sar = Math.min(sar, lows[i - 1]!);
            if (i >= 2) sar = Math.min(sar, lows[i - 2]!);

            if (lows[i]! < sar) {
                isLong = false;
                sar = ep;
                ep = lows[i]!;
                af = step;
            } else {
                if (highs[i]! > ep) {
                    ep = highs[i]!;
                    af = Math.min(af + step, maxStep);
                }
            }
        } else {
            sar = Math.max(sar, highs[i - 1]!);
            if (i >= 2) sar = Math.max(sar, highs[i - 2]!);

            if (highs[i]! > sar) {
                isLong = true;
                sar = ep;
                ep = highs[i]!;
                af = step;
            } else {
                if (lows[i]! < ep) {
                    ep = lows[i]!;
                    af = Math.min(af + step, maxStep);
                }
            }
        }
        result[i] = sar;
    }
    return result;
}

/**
 * Ichimoku Cloud components.
 * @returns { tenkan, kijun, senkouA, senkouB, chikou }
 */
export function ichimoku(
    highs:  readonly number[],
    lows:   readonly number[],
    closes: readonly number[],
    tenkanPeriod = 9,
    kijunPeriod  = 26,
    senkouBPeriod = 52,
    displacement  = 26,
): {
    tenkan:  number[];
    kijun:   number[];
    senkouA: number[];
    senkouB: number[];
    chikou:  number[];
} {
    const len = closes.length;
    const midline = (period: number, idx: number): number => {
        if (idx < period - 1) return NaN;
        let hi = -Infinity, lo = Infinity;
        for (let j = 0; j < period; j++) {
            if (highs[idx - j]! > hi) hi = highs[idx - j]!;
            if (lows[idx - j]!  < lo) lo = lows[idx - j]!;
        }
        return (hi + lo) / 2;
    };

    const tenkan:  number[] = [];
    const kijun:   number[] = [];
    const senkouA: number[] = new Array(len + displacement).fill(NaN);
    const senkouB: number[] = new Array(len + displacement).fill(NaN);
    const chikou:  number[] = new Array(len).fill(NaN);

    for (let i = 0; i < len; i++) {
        const t = midline(tenkanPeriod, i);
        const k = midline(kijunPeriod, i);
        tenkan.push(t);
        kijun.push(k);
        if (isFiniteNumber(t) && isFiniteNumber(k)) {
            senkouA[i + displacement] = (t + k) / 2;
        }
        const sb = midline(senkouBPeriod, i);
        if (isFiniteNumber(sb)) {
            senkouB[i + displacement] = sb;
        }
        if (i >= displacement) {
            chikou[i - displacement] = closes[i]!;
        }
    }

    // Trim to original length
    return {
        tenkan,
        kijun,
        senkouA: senkouA.slice(0, len),
        senkouB: senkouB.slice(0, len),
        chikou,
    };
}

/** Linear interpolation between two values. */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Map a value from [inMin, inMax] to [outMin, outMax]. */
export function mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
): number {
    if (inMax === inMin) return outMin;
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

/** Generate logarithmically-spaced tick values for a log-scale axis. */
export function niceLogTicks(min: number, max: number, targetCount = 8): number[] {
    if (min <= 0 || max <= 0 || max <= min) return niceAxisTicks(min, max, targetCount);
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const ticks: number[] = [];
    const multiples = [1, 2, 5];
    const startDecade = Math.floor(logMin);
    const endDecade   = Math.ceil(logMax);
    for (let decade = startDecade; decade <= endDecade; decade++) {
        for (const m of multiples) {
            const val = m * Math.pow(10, decade);
            if (val >= min && val <= max) ticks.push(val);
        }
    }
    // If too many ticks, thin out
    while (ticks.length > targetCount * 2) {
        const step = Math.ceil(ticks.length / targetCount);
        const filtered: number[] = [];
        for (let i = 0; i < ticks.length; i += step) filtered.push(ticks[i]!);
        ticks.length = 0;
        ticks.push(...filtered);
    }
    return ticks.length ? ticks : niceAxisTicks(min, max, targetCount);
}

/** Generate "nice" tick values for an axis between min and max. */
export function niceAxisTicks(min: number, max: number, targetCount = 8): number[] {
    const range = max - min;
    if (range <= 0) return [min];
    const rawStep = range / targetCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;
    let step: number;
    if (normalised <= 1.5) step = magnitude;
    else if (normalised <= 3) step = 2 * magnitude;
    else if (normalised <= 7) step = 5 * magnitude;
    else step = 10 * magnitude;
    const start = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= max + step * 0.01; v += step) {
        ticks.push(round(v, 10));
    }
    return ticks;
}