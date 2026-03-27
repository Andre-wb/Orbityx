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
export declare function toFixedTrim(value: number, digits?: number): string;
/**
 * Lenient parser: extracts a number from messy strings like "$1,234.56".
 * Returns NaN for truly invalid input.
 */
export declare function parseNumber(str: unknown): number;
/** Type guard: checks that a value is a finite number. */
export declare function isFiniteNumber(n: unknown): n is number;
/** Constrain a number to the inclusive range [min, max]. */
export declare function clamp(val: number, min: number, max: number): number;
/** Round to a given number of decimal places. Returns NaN on bad input. */
export declare function round(n: number, precision?: number): number;
/** Sum finite values in an array; skips NaN/Infinity. */
export declare function sum(arr: readonly number[]): number;
/** Arithmetic mean of finite values; returns 0 for empty arrays. */
export declare function avg(arr: readonly number[]): number;
/** Simple Moving Average over an array, returns array of same length (NaN for early values). */
export declare function sma(values: readonly number[], period: number): number[];
/** Exponential Moving Average. Seed value is the SMA of the first `period` elements. */
export declare function ema(values: readonly number[], period: number): number[];
/** Standard deviation of an array of numbers. */
export declare function stdDev(values: readonly number[]): number;
/**
 * Compute RSI (Relative Strength Index) for a close-price array.
 * Uses Wilder's smoothing (equivalent to EMA with alpha = 1/period).
 */
export declare function rsi(closes: readonly number[], period?: number): number[];
/**
 * MACD: returns { macd, signal, histogram } arrays of the same length as closes.
 */
export declare function macd(closes: readonly number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): {
    macdLine: number[];
    signalLine: number[];
    histogram: number[];
};
/**
 * Bollinger Bands: returns { upper, middle, lower } arrays.
 * @param multiplier Standard deviation multiplier (default 2).
 */
export declare function bollingerBands(closes: readonly number[], period?: number, multiplier?: number): {
    upper: number[];
    middle: number[];
    lower: number[];
};
/** Weighted Moving Average. */
export declare function wma(values: readonly number[], period: number): number[];
/** Double Exponential Moving Average (DEMA). */
export declare function dema(values: readonly number[], period: number): number[];
/** Triple Exponential Moving Average (TEMA). */
export declare function tema(values: readonly number[], period: number): number[];
/** Hull Moving Average (HMA). Period must be >= 4. */
export declare function hma(values: readonly number[], period: number): number[];
/** Volume Weighted Moving Average (VWMA). */
export declare function vwma(closes: readonly number[], volumes: readonly number[], period: number): number[];
/**
 * Stochastic Oscillator (%K and %D).
 * @returns { k: number[], d: number[] }
 */
export declare function stochastic(highs: readonly number[], lows: readonly number[], closes: readonly number[], kPeriod?: number, dPeriod?: number): {
    k: number[];
    d: number[];
};
/** Stochastic RSI. */
export declare function stochasticRSI(closes: readonly number[], rsiPeriod?: number, stochPeriod?: number, kSmooth?: number, dSmooth?: number): {
    k: number[];
    d: number[];
};
/** Williams %R. */
export declare function williamsR(highs: readonly number[], lows: readonly number[], closes: readonly number[], period?: number): number[];
/** Commodity Channel Index (CCI). */
export declare function cci(highs: readonly number[], lows: readonly number[], closes: readonly number[], period?: number): number[];
/** Money Flow Index (MFI). */
export declare function mfi(highs: readonly number[], lows: readonly number[], closes: readonly number[], volumes: readonly number[], period?: number): number[];
/** Rate of Change (ROC). */
export declare function roc(values: readonly number[], period?: number): number[];
/** Momentum indicator. */
export declare function momentum(values: readonly number[], period?: number): number[];
/** Average True Range (ATR). */
export declare function atr(highs: readonly number[], lows: readonly number[], closes: readonly number[], period?: number): number[];
/**
 * Average Directional Index (ADX).
 * @returns { adx, plusDI, minusDI }
 */
export declare function adx(highs: readonly number[], lows: readonly number[], closes: readonly number[], period?: number): {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
};
/** On Balance Volume (OBV). */
export declare function obv(closes: readonly number[], volumes: readonly number[]): number[];
/** Volume Weighted Average Price (VWAP) — cumulative intraday. */
export declare function vwap(highs: readonly number[], lows: readonly number[], closes: readonly number[], volumes: readonly number[]): number[];
/** Accumulation/Distribution Line. */
export declare function adLine(highs: readonly number[], lows: readonly number[], closes: readonly number[], volumes: readonly number[]): number[];
/** Chaikin Money Flow (CMF). */
export declare function cmf(highs: readonly number[], lows: readonly number[], closes: readonly number[], volumes: readonly number[], period?: number): number[];
/**
 * Donchian Channels.
 * @returns { upper, middle, lower }
 */
export declare function donchianChannels(highs: readonly number[], lows: readonly number[], period?: number): {
    upper: number[];
    middle: number[];
    lower: number[];
};
/**
 * Keltner Channels.
 * @returns { upper, middle, lower }
 */
export declare function keltnerChannels(highs: readonly number[], lows: readonly number[], closes: readonly number[], emaPeriod?: number, atrPeriod?: number, multiplier?: number): {
    upper: number[];
    middle: number[];
    lower: number[];
};
/** Awesome Oscillator (AO). */
export declare function awesomeOscillator(highs: readonly number[], lows: readonly number[]): number[];
/**
 * Parabolic SAR.
 * @returns Array of SAR values (one per candle).
 */
export declare function parabolicSAR(highs: readonly number[], lows: readonly number[], step?: number, maxStep?: number): number[];
/**
 * Ichimoku Cloud components.
 * @returns { tenkan, kijun, senkouA, senkouB, chikou }
 */
export declare function ichimoku(highs: readonly number[], lows: readonly number[], closes: readonly number[], tenkanPeriod?: number, kijunPeriod?: number, senkouBPeriod?: number, displacement?: number): {
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
    chikou: number[];
};
/** Linear interpolation between two values. */
export declare function lerp(a: number, b: number, t: number): number;
/** Map a value from [inMin, inMax] to [outMin, outMax]. */
export declare function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
/** Generate logarithmically-spaced tick values for a log-scale axis. */
export declare function niceLogTicks(min: number, max: number, targetCount?: number): number[];
/** Generate "nice" tick values for an axis between min and max. */
export declare function niceAxisTicks(min: number, max: number, targetCount?: number): number[];
//# sourceMappingURL=math.d.ts.map