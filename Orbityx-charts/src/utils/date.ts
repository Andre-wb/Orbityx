/**
 * @file utils/date.ts
 * @description UTC-safe date/time utilities for the chart platform.
 *
 * All computations use UTC fields to avoid DST/timezone artefacts.
 * Timestamps are always UNIX epoch milliseconds.
 */

const MIN  = 60 * 1_000;
const HOUR = 60 * MIN;
const DAY  = 24 * HOUR;

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce any timestamp representation into UNIX epoch milliseconds.
 * - number  → returned as-is (assumed ms already)
 * - Date    → .getTime()
 * - string  → ISO 8601; assumed UTC when no timezone designator is present
 * Returns NaN for unparseable input.
 */
export function parseISO(iso: number | string | Date | undefined | null): number {
    if (iso == null) return NaN;
    if (typeof iso === 'number') return iso;
    if (iso instanceof Date) return iso.getTime();
    const s = String(iso).trim();
    const hasTZ = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
    const ms = Date.parse(hasTZ ? s : s + 'Z');
    return Number.isFinite(ms) ? ms : NaN;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/** Supported format tokens: YYYY MM DD HH mm ss */
export function formatDate(ts: number, pattern = 'YYYY-MM-DD HH:mm'): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return pattern
        .replace('YYYY', String(Y))
        .replace('MM', M)
        .replace('DD', D)
        .replace('HH', H)
        .replace('mm', m)
        .replace('ss', s);
}

/**
 * Returns a compact axis label appropriate for the given timeframe.
 * e.g. '1m' data → 'HH:mm'; '1d' data → 'MMM DD'; '1y' data → 'YYYY'
 */
export function axisLabel(ts: number, timeframe: string): string {
    const d = new Date(ts);
    const intraday = ['1m','5m','15m','30m','1h','4h','12h'].includes(timeframe);
    const monthly  = ['1month','3month','6month','1y'].includes(timeframe);

    if (intraday) {
        const H = String(d.getUTCHours()).padStart(2,'0');
        const m = String(d.getUTCMinutes()).padStart(2,'0');
        return `${H}:${m}`;
    }
    if (monthly) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/** Add n minutes to an epoch-ms timestamp. */
export function addMinutes(ts: number, n: number): number {
    return ts + n * MIN;
}

/** Add n hours to an epoch-ms timestamp. */
export function addHours(ts: number, n: number): number {
    return ts + n * HOUR;
}

/** Add n days to an epoch-ms timestamp. */
export function addDays(ts: number, n: number): number {
    return ts + n * DAY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interval bucketing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snap a timestamp down to the start of the specified interval bucket (UTC).
 * Minute/hour buckets use integer division; calendar units use Date UTC math.
 */
export function floorToInterval(ts: number, interval: string): number {
    const d = new Date(ts);
    const by = (minutes: number): number => {
        const ms = minutes * MIN;
        return Math.floor(ts / ms) * ms;
    };

    switch (interval) {
        case '1m':  return by(1);
        case '5m':  return by(5);
        case '15m': return by(15);
        case '30m': return by(30);
        case '1h':  return by(60);
        case '4h':  return by(60 * 4);
        case '12h': return by(60 * 12);
        case '1d':  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        case '3d': {
            const startDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dayIdx = Math.floor(startDay / DAY);
            return Math.floor(dayIdx / 3) * 3 * DAY;
        }
        case '1w': {
            const startDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
            return startDay - dow * DAY;
        }
        case '1month': return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        case '3month': {
            const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
            return Date.UTC(d.getUTCFullYear(), qMonth, 1);
        }
        case '6month': {
            const hMonth = Math.floor(d.getUTCMonth() / 6) * 6;
            return Date.UTC(d.getUTCFullYear(), hMonth, 1);
        }
        case '1y': return Date.UTC(d.getUTCFullYear(), 0, 1);
        default:   return ts;
    }
}

/** Convert a timeframe key to an approximate millisecond duration. */
export function timeframeToMs(tf: string): number {
    const table: Record<string, number> = {
        '1m':     MIN,
        '5m':     5  * MIN,
        '15m':    15 * MIN,
        '30m':    30 * MIN,
        '1h':     HOUR,
        '4h':     4  * HOUR,
        '12h':    12 * HOUR,
        '1d':     DAY,
        '3d':     3  * DAY,
        '1w':     7  * DAY,
        '2w':     14 * DAY,
        '1month': 30 * DAY,
        '3month': 90 * DAY,
        '6month': 180 * DAY,
        '1y':     365 * DAY,
    };
    return table[tf] ?? DAY;
}