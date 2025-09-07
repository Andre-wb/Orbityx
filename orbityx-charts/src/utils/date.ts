const MIN  = 60 * 1000;
const HOUR = 60 * MIN;
const DAY  = 24 * HOUR;

export function parseISO(iso) {
    if (typeof iso === 'number') return iso;
    if (iso instanceof Date)     return iso.getTime();
    if (typeof iso !== 'string') return NaN;

    const s = iso.trim();
    const hasTZ = /(Z|[+-]\d{2}:\d{2})$/.test(s);
    const sUtc  = hasTZ ? s : s + 'Z';

    const ms = Date.parse(sUtc);
    return Number.isFinite(ms) ? ms : NaN;
}

export function format(ts, pattern = 'YYYY-MM-DD HH:mm:ss') {
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
        .replace('MM',   M)
        .replace('DD',   D)
        .replace('HH',   H)
        .replace('mm',   m)
        .replace('ss',   s);
}

export function addMinutes(ts, n) {
    return Number(ts) + n * MIN;
}

export function addHours(ts, n) {
    return Number(ts) + n * HOUR;
}

export function floorToInterval(ts, interval) {
    const d = new Date(ts);

    const by = (minutes) => {
        const ms = minutes * MIN;
        return Math.floor(ts / ms) * ms;
    };

    switch (interval) {
        case '1m':  return by(1);
        case '2m':  return by(2);
        case '5m':  return by(5);
        case '10m': return by(10);
        case '15m': return by(15);
        case '20m': return by(20);
        case '25m': return by(25);
        case '30m': return by(30);
        case '45m': return by(45);

        case '1h':  return by(60);
        case '2h':  return by(60 * 2);
        case '4h':  return by(60 * 4);
        case '6h':  return by(60 * 6);
        case '12h': return by(60 * 12);
        case '16h': return by(60 * 16);

        case '1d': {
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }

        case '3d': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dayIndex = Math.floor(startDayMs / DAY);
            const groupStartDays = Math.floor(dayIndex / 3) * 3;
            return groupStartDays * DAY;
        }

        case '1w': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dowMon0 = (d.getUTCDay() + 6) % 7;
            const weekStart = startDayMs - dowMon0 * DAY;
            return weekStart;
        }

        case '2w': {
            const startDayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const dowMon0 = (d.getUTCDay() + 6) % 7;
            const weekStart = startDayMs - dowMon0 * DAY;
            const twoWeekStart = Math.floor(weekStart / (14 * DAY)) * (14 * DAY);
            return twoWeekStart;
        }

        case '1month': {
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        }

        case '3month': {
            const year = d.getUTCFullYear();
            const m0   = d.getUTCMonth();
            const mQ   = Math.floor(m0 / 3) * 3;
            return Date.UTC(year, mQ, 1);
        }

        case '6month': {
            const year = d.getUTCFullYear();
            const m0   = d.getUTCMonth();
            const mH   = Math.floor(m0 / 6) * 6;
            return Date.UTC(year, mH, 1);
        }

        case '1y': {
            return Date.UTC(d.getUTCFullYear(), 0, 1);
        }

        case '2y': {
            const year2 = Math.floor(d.getUTCFullYear() / 2) * 2;
            return Date.UTC(year2, 0, 1);
        }

        case '5y': {
            const year5 = Math.floor(d.getUTCFullYear() / 5) * 5;
            return Date.UTC(year5, 0, 1);
        }

        case '10y': {
            const year10 = Math.floor(d.getUTCFullYear() / 10) * 10;
            return Date.UTC(year10, 0, 1);
        }

        default:
            return ts;
    }
}