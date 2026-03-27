/**
 * @file utils/date.ts
 * @description UTC-safe date/time utilities for the chart platform.
 *
 * All computations use UTC fields to avoid DST/timezone artefacts.
 * Timestamps are always UNIX epoch milliseconds.
 */
/**
 * Coerce any timestamp representation into UNIX epoch milliseconds.
 * - number  → returned as-is (assumed ms already)
 * - Date    → .getTime()
 * - string  → ISO 8601; assumed UTC when no timezone designator is present
 * Returns NaN for unparseable input.
 */
export declare function parseISO(iso: number | string | Date | undefined | null): number;
/** Supported format tokens: YYYY MM DD HH mm ss */
export declare function formatDate(ts: number, pattern?: string): string;
/**
 * Returns a compact axis label appropriate for the given timeframe.
 * e.g. '1m' data → 'HH:mm'; '1d' data → 'MMM DD'; '1y' data → 'YYYY'
 */
export declare function axisLabel(ts: number, timeframe: string): string;
/** Add n minutes to an epoch-ms timestamp. */
export declare function addMinutes(ts: number, n: number): number;
/** Add n hours to an epoch-ms timestamp. */
export declare function addHours(ts: number, n: number): number;
/** Add n days to an epoch-ms timestamp. */
export declare function addDays(ts: number, n: number): number;
/**
 * Snap a timestamp down to the start of the specified interval bucket (UTC).
 * Minute/hour buckets use integer division; calendar units use Date UTC math.
 */
export declare function floorToInterval(ts: number, interval: string): number;
/** Convert a timeframe key to an approximate millisecond duration. */
export declare function timeframeToMs(tf: string): number;
//# sourceMappingURL=date.d.ts.map