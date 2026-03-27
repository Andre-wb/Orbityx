import { describe, it, expect } from 'vitest';
import {
  toFixedTrim,
  parseNumber,
  isFiniteNumber,
  clamp,
  round,
  sum,
  avg,
  sma,
  ema,
  stdDev,
  rsi,
  macd,
  bollingerBands,
  lerp,
  mapRange,
  niceAxisTicks,
} from './math.js';

// ---------------------------------------------------------------------------
// toFixedTrim
// ---------------------------------------------------------------------------
describe('toFixedTrim', () => {
  it('trims trailing zeros', () => {
    expect(toFixedTrim(12.34, 4)).toBe('12.34');
    expect(toFixedTrim(5, 2)).toBe('5');
    expect(toFixedTrim(1.1, 4)).toBe('1.1');
  });

  it('returns full precision when needed', () => {
    expect(toFixedTrim(3.14159, 5)).toBe('3.14159');
  });

  it('handles negative numbers', () => {
    expect(toFixedTrim(-7.5, 3)).toBe('-7.5');
  });

  it('returns empty string for NaN', () => {
    expect(toFixedTrim(NaN, 2)).toBe('');
  });

  it('returns empty string for Infinity', () => {
    expect(toFixedTrim(Infinity, 2)).toBe('');
    expect(toFixedTrim(-Infinity, 2)).toBe('');
  });

  it('uses default 2 digits', () => {
    expect(toFixedTrim(10.0)).toBe('10');
    expect(toFixedTrim(10.12)).toBe('10.12');
  });
});

// ---------------------------------------------------------------------------
// parseNumber
// ---------------------------------------------------------------------------
describe('parseNumber', () => {
  it('returns a number for numeric input', () => {
    expect(parseNumber(42)).toBe(42);
    expect(parseNumber(0)).toBe(0);
    expect(parseNumber(-3.5)).toBe(-3.5);
  });

  it('parses strings with $ and commas', () => {
    expect(parseNumber('$1,234.56')).toBe(1234.56);
    expect(parseNumber('$100')).toBe(100);
  });

  it('returns NaN for null', () => {
    expect(parseNumber(null)).toBeNaN();
  });

  it('returns NaN for undefined', () => {
    expect(parseNumber(undefined)).toBeNaN();
  });

  it('returns NaN for NaN input', () => {
    expect(parseNumber(NaN)).toBeNaN();
  });

  it('returns NaN for Infinity', () => {
    expect(parseNumber(Infinity)).toBeNaN();
  });

  it('returns NaN for empty string', () => {
    expect(parseNumber('')).toBeNaN();
  });

  it('returns NaN for non-numeric string', () => {
    expect(parseNumber('abc')).toBeNaN();
  });

  it('handles boolean and object inputs', () => {
    expect(parseNumber(true)).toBeNaN();
    expect(parseNumber({})).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// isFiniteNumber
// ---------------------------------------------------------------------------
describe('isFiniteNumber', () => {
  it('returns true for finite numbers', () => {
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isFiniteNumber('42')).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------
describe('clamp', () => {
  it('returns value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// round
// ---------------------------------------------------------------------------
describe('round', () => {
  it('rounds to 2 decimal places by default', () => {
    expect(round(3.456)).toBe(3.46);
    expect(round(3.454)).toBe(3.45);
  });

  it('rounds to specified precision', () => {
    expect(round(3.14159, 3)).toBe(3.142);
    expect(round(100, 0)).toBe(100);
  });

  it('returns NaN for NaN input', () => {
    expect(round(NaN)).toBeNaN();
  });

  it('returns NaN for Infinity', () => {
    expect(round(Infinity)).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------
describe('sum', () => {
  it('sums an array', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it('skips NaN values', () => {
    expect(sum([1, NaN, 3])).toBe(4);
  });

  it('returns 0 for empty array', () => {
    expect(sum([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// avg
// ---------------------------------------------------------------------------
describe('avg', () => {
  it('computes average', () => {
    expect(avg([2, 4, 6])).toBe(4);
  });

  it('skips NaN values', () => {
    expect(avg([10, NaN, 20])).toBe(15);
  });

  it('returns 0 for empty array', () => {
    expect(avg([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sma
// ---------------------------------------------------------------------------
describe('sma', () => {
  it('computes SMA correctly for period=3', () => {
    const data = [1, 2, 3, 4, 5];
    const result = sma(data, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBe(2);       // (1+2+3)/3
    expect(result[3]).toBe(3);       // (2+3+4)/3
    expect(result[4]).toBe(4);       // (3+4+5)/3
  });

  it('returns all NaN when period > length', () => {
    const result = sma([1, 2], 5);
    expect(result.every(v => Number.isNaN(v))).toBe(true);
  });

  it('preserves array length', () => {
    const data = [10, 20, 30, 40];
    expect(sma(data, 2).length).toBe(data.length);
  });
});

// ---------------------------------------------------------------------------
// ema
// ---------------------------------------------------------------------------
describe('ema', () => {
  it('seeds with SMA of first period elements', () => {
    const data = [2, 4, 6, 8, 10];
    const result = ema(data, 3);
    // Seed = (2+4+6)/3 = 4
    expect(result[2]).toBe(4);
  });

  it('applies smoothing for subsequent values', () => {
    const data = [2, 4, 6, 8, 10];
    const result = ema(data, 3);
    const k = 2 / (3 + 1);
    // result[3] = 8 * k + 4 * (1-k) = 8*0.5 + 4*0.5 = 6
    expect(result[3]).toBeCloseTo(6, 10);
  });

  it('returns all NaN for short arrays', () => {
    const result = ema([1, 2], 5);
    expect(result.every(v => Number.isNaN(v))).toBe(true);
  });

  it('preserves array length', () => {
    const data = [1, 2, 3, 4, 5, 6];
    expect(ema(data, 3).length).toBe(data.length);
  });
});

// ---------------------------------------------------------------------------
// stdDev
// ---------------------------------------------------------------------------
describe('stdDev', () => {
  it('computes standard deviation of known data', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] => mean=5, variance=4, stddev=2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });

  it('returns 0 for empty array', () => {
    expect(stdDev([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(stdDev([5])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rsi
// ---------------------------------------------------------------------------
describe('rsi', () => {
  it('returns 100 for monotonically rising data', () => {
    // 15 values rising: 0,1,2,...,14 => all gains, no losses
    const closes = Array.from({ length: 15 }, (_, i) => i);
    const result = rsi(closes, 14);
    expect(result[14]).toBe(100);
  });

  it('returns 0 for monotonically falling data', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 - i);
    const result = rsi(closes, 14);
    expect(result[14]).toBe(0);
  });

  it('returns all NaN for short arrays', () => {
    const result = rsi([1, 2, 3], 14);
    expect(result.every(v => Number.isNaN(v))).toBe(true);
  });

  it('RSI values are in [0, 100] range', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 20);
    const result = rsi(closes, 14);
    const finite = result.filter(v => Number.isFinite(v));
    expect(finite.length).toBeGreaterThan(0);
    for (const v of finite) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// macd
// ---------------------------------------------------------------------------
describe('macd', () => {
  const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);

  it('macdLine = fastEMA - slowEMA for valid indices', () => {
    const result = macd(closes, 12, 26, 9);
    const fast = ema(closes, 12);
    const slow = ema(closes, 26);
    for (let i = 25; i < closes.length; i++) {
      expect(result.macdLine[i]).toBeCloseTo(fast[i]! - slow[i]!, 10);
    }
  });

  it('histogram = macdLine - signalLine for valid indices', () => {
    const result = macd(closes, 12, 26, 9);
    for (let i = 0; i < closes.length; i++) {
      if (Number.isFinite(result.macdLine[i]) && Number.isFinite(result.signalLine[i])) {
        expect(result.histogram[i]).toBeCloseTo(
          result.macdLine[i]! - result.signalLine[i]!, 10,
        );
      }
    }
  });

  it('arrays have same length as input', () => {
    const result = macd(closes);
    expect(result.macdLine.length).toBe(closes.length);
    expect(result.signalLine.length).toBe(closes.length);
    expect(result.histogram.length).toBe(closes.length);
  });
});

// ---------------------------------------------------------------------------
// bollingerBands
// ---------------------------------------------------------------------------
describe('bollingerBands', () => {
  const closes = Array.from({ length: 30 }, (_, i) => 100 + i);

  it('middle band equals SMA', () => {
    const bb = bollingerBands(closes, 20, 2);
    const smaValues = sma(closes, 20);
    for (let i = 19; i < closes.length; i++) {
      expect(bb.middle[i]).toBeCloseTo(smaValues[i]!, 10);
    }
  });

  it('upper = middle + 2*stddev, lower = middle - 2*stddev', () => {
    const bb = bollingerBands(closes, 20, 2);
    for (let i = 19; i < closes.length; i++) {
      const slice = closes.slice(i - 19, i + 1);
      const sd = stdDev(slice);
      expect(bb.upper[i]).toBeCloseTo(bb.middle[i]! + 2 * sd, 10);
      expect(bb.lower[i]).toBeCloseTo(bb.middle[i]! - 2 * sd, 10);
    }
  });

  it('early values are NaN', () => {
    const bb = bollingerBands(closes, 20, 2);
    for (let i = 0; i < 19; i++) {
      expect(bb.upper[i]).toBeNaN();
      expect(bb.lower[i]).toBeNaN();
    }
  });
});

// ---------------------------------------------------------------------------
// lerp
// ---------------------------------------------------------------------------
describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('extrapolates beyond 0-1', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

// ---------------------------------------------------------------------------
// mapRange
// ---------------------------------------------------------------------------
describe('mapRange', () => {
  it('maps value from one range to another', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
    expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
    expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
  });

  it('returns outMin when inMin === inMax (division by zero guard)', () => {
    expect(mapRange(5, 5, 5, 0, 100)).toBe(0);
  });

  it('handles inverted ranges', () => {
    expect(mapRange(5, 0, 10, 100, 0)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// niceAxisTicks
// ---------------------------------------------------------------------------
describe('niceAxisTicks', () => {
  it('generates ticks within the range', () => {
    const ticks = niceAxisTicks(0, 100);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(100 + 1); // slight tolerance from step*0.01
    }
  });

  it('returns [min] for zero range', () => {
    expect(niceAxisTicks(50, 50)).toEqual([50]);
  });

  it('returns [min] for negative range', () => {
    expect(niceAxisTicks(100, 50)).toEqual([100]);
  });

  it('handles negative min/max', () => {
    const ticks = niceAxisTicks(-100, -10);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(-100);
    }
  });
});
