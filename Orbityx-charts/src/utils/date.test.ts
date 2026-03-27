import { describe, it, expect } from 'vitest';
import {
  parseISO,
  formatDate,
  axisLabel,
  addMinutes,
  addHours,
  addDays,
  floorToInterval,
  timeframeToMs,
} from './date.js';

const MIN  = 60_000;
const HOUR = 60 * MIN;
const DAY  = 24 * HOUR;

// ---------------------------------------------------------------------------
// parseISO
// ---------------------------------------------------------------------------
describe('parseISO', () => {
  it('passes through numbers', () => {
    expect(parseISO(1700000000000)).toBe(1700000000000);
  });

  it('converts Date objects', () => {
    const d = new Date(1700000000000);
    expect(parseISO(d)).toBe(1700000000000);
  });

  it('parses ISO string with Z', () => {
    const ms = parseISO('2023-11-14T22:13:20Z');
    expect(ms).toBe(Date.parse('2023-11-14T22:13:20Z'));
  });

  it('parses ISO string without TZ (assumes UTC)', () => {
    const ms = parseISO('2023-11-14T22:13:20');
    expect(ms).toBe(Date.parse('2023-11-14T22:13:20Z'));
  });

  it('returns NaN for null', () => {
    expect(parseISO(null)).toBeNaN();
  });

  it('returns NaN for undefined', () => {
    expect(parseISO(undefined)).toBeNaN();
  });

  it('returns NaN for invalid string', () => {
    expect(parseISO('not-a-date')).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  // 2023-11-14 22:13:20 UTC
  const ts = Date.UTC(2023, 10, 14, 22, 13, 20);

  it('formats with default pattern YYYY-MM-DD HH:mm', () => {
    expect(formatDate(ts)).toBe('2023-11-14 22:13');
  });

  it('formats with custom pattern', () => {
    expect(formatDate(ts, 'DD/MM/YYYY')).toBe('14/11/2023');
  });

  it('includes seconds', () => {
    expect(formatDate(ts, 'HH:mm:ss')).toBe('22:13:20');
  });

  it('returns empty string for NaN timestamp', () => {
    expect(formatDate(NaN)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// axisLabel
// ---------------------------------------------------------------------------
describe('axisLabel', () => {
  const ts = Date.UTC(2023, 5, 15, 14, 30); // June 15, 2023 14:30 UTC

  it('shows HH:mm for intraday timeframes', () => {
    for (const tf of ['1m', '5m', '15m', '30m', '1h', '4h', '12h']) {
      expect(axisLabel(ts, tf)).toBe('14:30');
    }
  });

  it('shows "Mon YYYY" for monthly timeframes', () => {
    expect(axisLabel(ts, '1month')).toBe('Jun 2023');
    expect(axisLabel(ts, '1y')).toBe('Jun 2023');
  });

  it('shows "Mon DD" for daily timeframes', () => {
    expect(axisLabel(ts, '1d')).toBe('Jun 15');
    expect(axisLabel(ts, '1w')).toBe('Jun 15');
  });
});

// ---------------------------------------------------------------------------
// addMinutes / addHours / addDays
// ---------------------------------------------------------------------------
describe('addMinutes', () => {
  it('adds minutes to timestamp', () => {
    expect(addMinutes(1000, 5)).toBe(1000 + 5 * MIN);
  });

  it('subtracts with negative', () => {
    expect(addMinutes(1_000_000, -10)).toBe(1_000_000 - 10 * MIN);
  });
});

describe('addHours', () => {
  it('adds hours to timestamp', () => {
    expect(addHours(0, 2)).toBe(2 * HOUR);
  });
});

describe('addDays', () => {
  it('adds days to timestamp', () => {
    expect(addDays(0, 7)).toBe(7 * DAY);
  });
});

// ---------------------------------------------------------------------------
// floorToInterval
// ---------------------------------------------------------------------------
describe('floorToInterval', () => {
  // 2023-06-15 14:37:45 UTC
  const ts = Date.UTC(2023, 5, 15, 14, 37, 45, 123);

  it('floors to 1m', () => {
    const result = floorToInterval(ts, '1m');
    expect(result).toBe(Math.floor(ts / MIN) * MIN);
  });

  it('floors to 5m', () => {
    const result = floorToInterval(ts, '5m');
    expect(result).toBe(Math.floor(ts / (5 * MIN)) * (5 * MIN));
  });

  it('floors to 15m', () => {
    const result = floorToInterval(ts, '15m');
    expect(result).toBe(Math.floor(ts / (15 * MIN)) * (15 * MIN));
  });

  it('floors to 30m', () => {
    const result = floorToInterval(ts, '30m');
    expect(result).toBe(Math.floor(ts / (30 * MIN)) * (30 * MIN));
  });

  it('floors to 1h', () => {
    const result = floorToInterval(ts, '1h');
    expect(result).toBe(Math.floor(ts / HOUR) * HOUR);
  });

  it('floors to 4h', () => {
    const result = floorToInterval(ts, '4h');
    expect(result).toBe(Math.floor(ts / (4 * HOUR)) * (4 * HOUR));
  });

  it('floors to 12h', () => {
    const result = floorToInterval(ts, '12h');
    expect(result).toBe(Math.floor(ts / (12 * HOUR)) * (12 * HOUR));
  });

  it('floors to 1d', () => {
    const result = floorToInterval(ts, '1d');
    expect(result).toBe(Date.UTC(2023, 5, 15));
  });

  it('floors to 1w (Monday-based)', () => {
    const result = floorToInterval(ts, '1w');
    // June 15 2023 is Thursday, Monday was June 12
    expect(result).toBe(Date.UTC(2023, 5, 12));
  });

  it('floors to 1month', () => {
    const result = floorToInterval(ts, '1month');
    expect(result).toBe(Date.UTC(2023, 5, 1));
  });

  it('floors to 1y', () => {
    const result = floorToInterval(ts, '1y');
    expect(result).toBe(Date.UTC(2023, 0, 1));
  });

  it('returns original timestamp for unknown interval', () => {
    expect(floorToInterval(ts, 'unknown')).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// timeframeToMs
// ---------------------------------------------------------------------------
describe('timeframeToMs', () => {
  it('returns correct ms for each timeframe', () => {
    expect(timeframeToMs('1m')).toBe(MIN);
    expect(timeframeToMs('5m')).toBe(5 * MIN);
    expect(timeframeToMs('15m')).toBe(15 * MIN);
    expect(timeframeToMs('30m')).toBe(30 * MIN);
    expect(timeframeToMs('1h')).toBe(HOUR);
    expect(timeframeToMs('4h')).toBe(4 * HOUR);
    expect(timeframeToMs('12h')).toBe(12 * HOUR);
    expect(timeframeToMs('1d')).toBe(DAY);
    expect(timeframeToMs('3d')).toBe(3 * DAY);
    expect(timeframeToMs('1w')).toBe(7 * DAY);
    expect(timeframeToMs('1month')).toBe(30 * DAY);
    expect(timeframeToMs('1y')).toBe(365 * DAY);
  });

  it('defaults to DAY for unknown key', () => {
    expect(timeframeToMs('unknown')).toBe(DAY);
  });
});
