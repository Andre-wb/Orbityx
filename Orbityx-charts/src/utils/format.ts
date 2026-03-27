/**
 * @file utils/format.ts
 * @description Currency, number, percent, and compact formatting helpers.
 *
 * All functions accept `unknown` and return '' for invalid input,
 * making them safe to use directly in DOM assignments.
 */
import { parseNumber, isFiniteNumber, toFixedTrim, clamp } from './math.js';

const LOCALE = 'en-US';

function toNum(value: unknown): number | null {
    const n = parseNumber(value);
    return isFiniteNumber(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency
// ─────────────────────────────────────────────────────────────────────────────

/** Format as USD currency with explicit min/max fraction digits. */
export function formatCurrency(
    value: unknown,
    currency = 'USD',
    minFrac = 2,
    maxFrac = 2,
): string {
    const n = toNum(value);
    if (n === null) return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}

/**
 * Auto-precision currency: sub-$0.01 assets show 6 decimals,
 * sub-$1 shows 4, otherwise 2.
 *
 * @param precision - When provided, overrides the auto-precision logic and
 *   uses exactly this many decimal places (min and max). Useful for
 *   instruments that need a fixed number of decimals (e.g. forex: 5,
 *   low-cap tokens: 8).
 */
export function formatPrice(value: unknown, currency = 'USD', precision?: number): string {
    const n = toNum(value);
    if (n === null) return '';
    if (precision !== undefined) {
        return formatCurrency(n, currency, precision, precision);
    }
    const abs = Math.abs(n);
    let min: number, max: number;
    if (abs < 0.01)      { min = 6; max = 8; }
    else if (abs < 1)    { min = 4; max = 6; }
    else if (abs < 100)  { min = 2; max = 4; }
    else                  { min = 2; max = 2; }
    return formatCurrency(n, currency, min, max);
}

// ─────────────────────────────────────────────────────────────────────────────
// Numbers & Percent
// ─────────────────────────────────────────────────────────────────────────────

export function formatNumber(value: unknown, minFrac = 0, maxFrac = 2): string {
    const n = toNum(value);
    if (n === null) return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}

/** Accepts 0..1 range. */
export function formatPercent(value: unknown, minFrac = 2, maxFrac = 2): string {
    const n = toNum(value);
    if (n === null) return '';
    return new Intl.NumberFormat(LOCALE, {
        style: 'percent',
        minimumFractionDigits: clamp(minFrac, 0, 20),
        maximumFractionDigits: clamp(maxFrac, 0, 20),
    }).format(n);
}

/** Accepts 0..100 range and converts internally. */
export function formatPct(value: unknown, decimals = 2): string {
    const n = toNum(value);
    if (n === null) return '';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(decimals)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume / Compact
// ─────────────────────────────────────────────────────────────────────────────

/** Format volume with K/M/B suffix, 2 decimal places. */
export function formatVolume(value: unknown): string {
    const n = toNum(value);
    if (n === null) return '';
    const av = Math.abs(n);
    if (av >= 1e9) return `${toFixedTrim(n / 1e9, 2)}B`;
    if (av >= 1e6) return `${toFixedTrim(n / 1e6, 2)}M`;
    if (av >= 1e3) return `${toFixedTrim(n / 1e3, 2)}K`;
    return String(Math.round(n));
}

/** Generic compact notation via Intl. */
export function formatCompact(value: unknown, maxFrac = 2): string {
    const n = toNum(value);
    if (n === null) return '';
    return new Intl.NumberFormat(LOCALE, {
        notation: 'compact',
        maximumFractionDigits: clamp(maxFrac, 0, 6),
    } as Intl.NumberFormatOptions).format(n);
}

// Default facade.
const format = {
    currency: formatCurrency,
    price: formatPrice,
    number: formatNumber,
    percent: formatPercent,
    pct: formatPct,
    volume: formatVolume,
    compact: formatCompact,
    parseNumber,
};
export default format;