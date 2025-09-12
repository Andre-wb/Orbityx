/**
 * Formatting utilities for currency, numbers, percents, and compact notations.
 *
 * Design goals:
 *  - Accept `unknown` and fail safely (return empty string on invalid input).
 *  - Centralize locale handling (default LOCALE = 'en-US').
 *  - Keep precision bounds explicit via `clamp(min,max)` guards.
 */
import { parseNumber, isFiniteNumber, toFixedTrim, clamp } from './math.js';
// Default locale used across all Intl.NumberFormat calls.
const LOCALE = 'en-US';
/**
 * Convert arbitrary input to a finite number using math.parseNumber.
 * Returns null for NaN/Infinity to signal formatting functions to bail out.
 */
function toNum(value) {
    const n = parseNumber(value);
    return isFiniteNumber(n) ? n : null;
}
/**
 * Format a number as localized currency.
 * @param value    Any parseable numeric input
 * @param currency ISO 4217 code (e.g., 'USD')
 * @param minFrac  Minimum fraction digits (clamped to [0,20])
 * @param maxFrac  Maximum fraction digits (>= minFrac, clamped to [min,20])
 */
export function formatCurrency(value, currency = 'USD', minFrac = 2, maxFrac = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    // Guardrails for precision: avoid RangeErrors and keep UI consistent.
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    // Construct a NumberFormat with explicit currency style and precision.
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: min,
        maximumFractionDigits: max,
        // NOTE: Rounding is banker’s rounding per ECMA-402; adjust upstream if needed.
    }).format(n);
}
/**
 * Currency helper with auto precision: sub-$1 shows 4–6 decimals, otherwise 2.
 */
export function formatPriceAuto(value, currency = 'USD') {
    const n = toNum(value);
    if (n === null)
        return '';
    // Finer precision for penny-priced assets; coarse for regular prices.
    const min = n < 1 ? 4 : 2;
    const max = n < 1 ? 6 : 2;
    return formatCurrency(n, currency, min, max);
}
/**
 * Format a plain number with configurable fraction digits.
 */
export function formatNumber(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    // Clamp requested precision to reasonable bounds.
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}
/**
 * Format a value as percentage (expects 0..1 range).
 */
export function formatPercent(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    // Use Intl percent style; caller controls min/max fraction digits.
    return new Intl.NumberFormat(LOCALE, {
        style: 'percent',
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}
/**
 * Convenience: accepts a 0..100 value and converts to 0..1 before formatting.
 */
export function formatPercentFrom100(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    return formatPercent(n / 100, minFrac, maxFrac);
}
/**
 * Compact notation (e.g., 12K, 3.4M) using Intl.NumberFormat.
 */
export function formatCompact(value, maxFrac = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    // Keep compact numbers readable; cap fractional digits at 6.
    const mf = clamp(maxFrac, 0, 6);
    // Options object kept narrow for performance; extended if needed later.
    const opts = {
        notation: 'compact',
        maximumFractionDigits: mf,
    };
    return new Intl.NumberFormat(LOCALE, opts).format(n);
}
/**
 * Abbreviated volume formatter: rounds to integer below 1K, then K/M/B with 2 dp.
 */
export function formatVolume(value) {
    const n = toNum(value);
    if (n === null)
        return '';
    const av = Math.abs(n);
    // Scale thresholds: 1e3 → K, 1e6 → M, 1e9 → B.
    if (av >= 1e9)
        return `${toFixedTrim(n / 1e9, 2)}B`;
    if (av >= 1e6)
        return `${toFixedTrim(n / 1e6, 2)}M`;
    if (av >= 1e3)
        return `${toFixedTrim(n / 1e3, 2)}K`;
    return String(Math.round(n));
}
/**
 * Public wrapper for math.toFixedTrim (trims trailing zeros after rounding).
 */
export function toFixedTrimPublic(value, digits = 2) {
    const n = toNum(value);
    if (n === null)
        return '';
    return toFixedTrim(n, digits);
}
// Facade: convenient named access to all formatters.
const format = {
    currency: formatCurrency,
    priceAuto: formatPriceAuto,
    number: formatNumber,
    percent: formatPercent,
    percentFrom100: formatPercentFrom100,
    compact: formatCompact,
    volume: formatVolume,
    fixedTrim: toFixedTrimPublic,
    parseNumber,
};
export default format;
//# sourceMappingURL=format.js.map