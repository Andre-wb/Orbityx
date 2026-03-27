/**
 * @file utils/format.ts
 * @description Currency, number, percent, and compact formatting helpers.
 *
 * All functions accept `unknown` and return '' for invalid input,
 * making them safe to use directly in DOM assignments.
 */
import { parseNumber } from './math.js';
/** Format as USD currency with explicit min/max fraction digits. */
export declare function formatCurrency(value: unknown, currency?: string, minFrac?: number, maxFrac?: number): string;
/**
 * Auto-precision currency: sub-$0.01 assets show 6 decimals,
 * sub-$1 shows 4, otherwise 2.
 *
 * @param precision - When provided, overrides the auto-precision logic and
 *   uses exactly this many decimal places (min and max). Useful for
 *   instruments that need a fixed number of decimals (e.g. forex: 5,
 *   low-cap tokens: 8).
 */
export declare function formatPrice(value: unknown, currency?: string, precision?: number): string;
export declare function formatNumber(value: unknown, minFrac?: number, maxFrac?: number): string;
/** Accepts 0..1 range. */
export declare function formatPercent(value: unknown, minFrac?: number, maxFrac?: number): string;
/** Accepts 0..100 range and converts internally. */
export declare function formatPct(value: unknown, decimals?: number): string;
/** Format volume with K/M/B suffix, 2 decimal places. */
export declare function formatVolume(value: unknown): string;
/** Generic compact notation via Intl. */
export declare function formatCompact(value: unknown, maxFrac?: number): string;
declare const format: {
    currency: typeof formatCurrency;
    price: typeof formatPrice;
    number: typeof formatNumber;
    percent: typeof formatPercent;
    pct: typeof formatPct;
    volume: typeof formatVolume;
    compact: typeof formatCompact;
    parseNumber: typeof parseNumber;
};
export default format;
//# sourceMappingURL=format.d.ts.map