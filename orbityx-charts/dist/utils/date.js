/**
 * Date/time utilities (UTC-only) used across the chart engine.
 *
 * Design notes:
 * - All calculations are done in UTC to avoid DST/timezone pitfalls.
 * - Helpers return numeric UNIX epoch milliseconds.
 * - `floorToInterval` snaps timestamps down to the start of a logical bucket.
 */
// One minute in milliseconds.
const MIN = 60 * 1000;
// One hour in milliseconds.
const HOUR = 60 * MIN;
// One day in milliseconds (24h, UTC – no DST adjustment).
const DAY = 24 * HOUR;
/**
 * Parse various timestamp representations into epoch milliseconds.
 * - number → returned as-is (assumed ms)
 * - Date   → .getTime()
 * - string → ISO 8601; if timezone is missing, assume UTC by appending 'Z'
 * Returns NaN for unparseable inputs.
 */
export function parseISO(iso) {
    if (typeof iso === 'number')
        return iso;
    if (iso instanceof Date)
        return iso.getTime();
    if (typeof iso !== 'string')
        return NaN;
    // Normalize and trim input string.
    const s = iso.trim();
    // Detect explicit timezone designator (Z or ±HH:MM at the end).
    const hasTZ = /(Z|[+-]\d{2}:\d{2})$/.test(s);
    // Assume UTC when no TZ is provided to avoid locale-dependent parses.
    const sUtc = hasTZ ? s : s + 'Z';
    // Delegate to built-in parser; returns NaN on failure.
    const ms = Date.parse(sUtc);
    return Number.isFinite(ms) ? ms : NaN;
}
/**
 * Format a timestamp using a tiny pattern language (UTC fields only).
 * Supported tokens: YYYY, MM, DD, HH, mm, ss
 */
export function format(ts, pattern = 'YYYY-MM-DD HH:mm:ss') {
    // Construct Date from epoch milliseconds.
    const d = new Date(ts);
    if (Number.isNaN(d.getTime()))
        return '';
    // Extract zero-padded UTC components.
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    // Simple token replacement (order matters to avoid partial overlaps).
    return pattern
        .replace('YYYY', String(Y))
        .replace('MM', M)
        .replace('DD', D)
        .replace('HH', H)
        .replace('mm', m)
        .replace('ss', s);
}
/** Add n minutes to a timestamp (ms). */
export function addMinutes(ts, n) {
    return Number(ts) + n * MIN;
}
/** Add n hours to a timestamp (ms). */
export function addHours(ts, n) {
    return Number(ts) + n * HOUR;
}
/**
 * Snap a timestamp down to the start of the specified interval bucket (UTC).
 * Minute/hour buckets use integer division; day/week/month/year use calendar math.
 */
export function floorToInterval(ts, interval) {
    // Work with a Date object for calendar-based computations.
    const d = new Date(ts);
    // Helper: floor to a multiple of N minutes using integer arithmetic.
    const by = (minutes) => {
        const ms = minutes * MIN;
        return Math.floor(ts / ms) * ms;
    };
    switch (interval) {
        case '1m': return by(1);
        case '2m': return by(2);
        case '5m': return by(5);
        case '10m': return by(10);
        case '15m': return by(15);
        case '20m': return by(20);
        case '25m': return by(25);
        case '30m': return by(30);
        case '45m': return by(45);
        case '1h': return by(60);
        case '2h': return by(60 * 2);
        case '4h': return by(60 * 4);
        case '6h': return by(60 * 6);
        case '12h': return by(60 * 12);
        case '16h': return by(60 * 16);
        // Floor to 00:00:00 UTC of the current day.
        case '1d': {
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
        // Group days into 3-day buckets aligned to epoch (…0,1,2 → 0; 3,4,5 → 3; etc.).
        case '3d': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dayIndex = Math.floor(startDayMs / DAY);
            const groupStartDays = Math.floor(dayIndex / 3) * 3;
            return groupStartDays * DAY;
        }
        // ISO-like week start: Monday (Mon=0 after remapping), 7-day buckets.
        case '1w': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dowMon0 = (d.getUTCDay() + 6) % 7;
            return startDayMs - dowMon0 * DAY;
        }
        // Two-week buckets aligned to Monday-start weeks.
        case '2w': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dowMon0 = (d.getUTCDay() + 6) % 7;
            return Math.floor((startDayMs - dowMon0 * DAY) / (14 * DAY)) * (14 * DAY);
        }
        // First day of the current month at 00:00:00 UTC.
        case '1month': {
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        }
        // Quarter start (Jan/Apr/Jul/Oct) at day 1, 00:00:00 UTC.
        case '3month': {
            const year = d.getUTCFullYear();
            const m0 = d.getUTCMonth();
            const mQ = Math.floor(m0 / 3) * 3;
            return Date.UTC(year, mQ, 1);
        }
        // Half-year start (Jan/Jul) at day 1, 00:00:00 UTC.
        case '6month': {
            const year = d.getUTCFullYear();
            const m0 = d.getUTCMonth();
            const mH = Math.floor(m0 / 6) * 6;
            return Date.UTC(year, mH, 1);
        }
        // Jan 1st of the current year, 00:00:00 UTC.
        case '1y': {
            return Date.UTC(d.getUTCFullYear(), 0, 1);
        }
        // Even-year boundary (…2018, 2020, 2022…), Jan 1st 00:00:00 UTC.
        case '2y': {
            const year2 = Math.floor(d.getUTCFullYear() / 2) * 2;
            return Date.UTC(year2, 0, 1);
        }
        // 5-year boundary aligned to years divisible by 5.
        case '5y': {
            const year5 = Math.floor(d.getUTCFullYear() / 5) * 5;
            return Date.UTC(year5, 0, 1);
        }
        // Decade boundary aligned to years divisible by 10.
        case '10y': {
            const year10 = Math.floor(d.getUTCFullYear() / 10) * 10;
            return Date.UTC(year10, 0, 1);
        }
        // Unknown interval – return original timestamp (no snapping).
        default:
            return ts;
    }
}
//# sourceMappingURL=date.js.map