import { describe, it, expect } from 'vitest';
import { computeIndicator, computeAllIndicators, INDICATOR_META } from './indicators.js';
import type { Candle, IndicatorId } from '../types/index.js';

const sampleCandles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
  timestamp: 1700000000000 + i * 86400000,
  open: 100 + Math.sin(i) * 10,
  high: 110 + Math.sin(i) * 10,
  low: 90 + Math.sin(i) * 10,
  close: 105 + Math.sin(i) * 10,
  volume: 1000 + i * 100,
}));

// ---------------------------------------------------------------------------
// computeIndicator — empty candles
// ---------------------------------------------------------------------------
describe('computeIndicator', () => {
  it('returns null for empty candles', () => {
    expect(computeIndicator([], 'sma_20')).toBeNull();
    expect(computeIndicator([], 'rsi_14')).toBeNull();
    expect(computeIndicator([], 'macd')).toBeNull();
  });

  it('returns null for volume indicator', () => {
    expect(computeIndicator(sampleCandles, 'volume')).toBeNull();
  });

  it('returns null for unknown id', () => {
    // Cast to bypass type check
    expect(computeIndicator(sampleCandles, 'unknown_indicator' as IndicatorId)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SMA indicators
// ---------------------------------------------------------------------------
describe('SMA indicators', () => {
  it('sma_20 returns correct structure', () => {
    const result = computeIndicator(sampleCandles, 'sma_20');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('sma_20');
    expect(result!.label).toBe('SMA 20');
    expect(result!.isSubPanel).toBe(false);
    expect(result!.points).toBeDefined();
    expect(result!.points!.length).toBe(sampleCandles.length);
  });

  it('sma_50 has correct length', () => {
    const result = computeIndicator(sampleCandles, 'sma_50');
    expect(result).not.toBeNull();
    expect(result!.points!.length).toBe(sampleCandles.length);
  });

  it('sma_200 returns all NaN points for 50 candles', () => {
    const result = computeIndicator(sampleCandles, 'sma_200');
    expect(result).not.toBeNull();
    // With only 50 candles, period 200 means all NaN
    const valid = result!.points!.filter(p => Number.isFinite(p.value));
    expect(valid.length).toBe(0);
  });

  it('sma_20 has valid values after period', () => {
    const result = computeIndicator(sampleCandles, 'sma_20');
    // Index 19 onward should have finite values
    const validFrom19 = result!.points!.slice(19).filter(p => Number.isFinite(p.value));
    expect(validFrom19.length).toBe(sampleCandles.length - 19);
  });
});

// ---------------------------------------------------------------------------
// EMA indicators
// ---------------------------------------------------------------------------
describe('EMA indicators', () => {
  it('ema_12 returns correct structure', () => {
    const result = computeIndicator(sampleCandles, 'ema_12');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ema_12');
    expect(result!.isSubPanel).toBe(false);
    expect(result!.points).toBeDefined();
  });

  it('ema_26 returns correct structure', () => {
    const result = computeIndicator(sampleCandles, 'ema_26');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ema_26');
  });
});

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------
describe('RSI indicator', () => {
  it('is a sub-panel with range [0, 100]', () => {
    const result = computeIndicator(sampleCandles, 'rsi_14');
    expect(result).not.toBeNull();
    expect(result!.isSubPanel).toBe(true);
    expect(result!.subPanelRange).toEqual([0, 100]);
  });

  it('has points array', () => {
    const result = computeIndicator(sampleCandles, 'rsi_14');
    expect(result!.points).toBeDefined();
    expect(result!.points!.length).toBe(sampleCandles.length);
  });

  it('valid RSI values are between 0 and 100', () => {
    const result = computeIndicator(sampleCandles, 'rsi_14');
    const valid = result!.points!.filter(p => Number.isFinite(p.value));
    expect(valid.length).toBeGreaterThan(0);
    for (const p of valid) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------
describe('MACD indicator', () => {
  it('is a sub-panel', () => {
    const result = computeIndicator(sampleCandles, 'macd');
    expect(result).not.toBeNull();
    expect(result!.isSubPanel).toBe(true);
  });

  it('has macdPoints', () => {
    const result = computeIndicator(sampleCandles, 'macd');
    expect(result!.macdPoints).toBeDefined();
    expect(result!.macdPoints!.length).toBe(sampleCandles.length);
  });

  it('each macdPoint has macd, signal, histogram fields', () => {
    const result = computeIndicator(sampleCandles, 'macd');
    const point = result!.macdPoints![sampleCandles.length - 1]!;
    expect(point).toHaveProperty('macd');
    expect(point).toHaveProperty('signal');
    expect(point).toHaveProperty('histogram');
    expect(point).toHaveProperty('timestamp');
  });
});

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------
describe('Bollinger Bands indicator', () => {
  it('has bollingerPoints', () => {
    const result = computeIndicator(sampleCandles, 'bb_20');
    expect(result).not.toBeNull();
    expect(result!.bollingerPoints).toBeDefined();
    expect(result!.bollingerPoints!.length).toBe(sampleCandles.length);
  });

  it('is NOT a sub-panel', () => {
    const result = computeIndicator(sampleCandles, 'bb_20');
    expect(result!.isSubPanel).toBe(false);
  });

  it('each point has upper, middle, lower', () => {
    const result = computeIndicator(sampleCandles, 'bb_20');
    const point = result!.bollingerPoints![sampleCandles.length - 1]!;
    expect(point).toHaveProperty('upper');
    expect(point).toHaveProperty('middle');
    expect(point).toHaveProperty('lower');
    expect(Number.isFinite(point.upper)).toBe(true);
    expect(Number.isFinite(point.middle)).toBe(true);
    expect(Number.isFinite(point.lower)).toBe(true);
  });

  it('upper >= middle >= lower for valid points', () => {
    const result = computeIndicator(sampleCandles, 'bb_20');
    for (const p of result!.bollingerPoints!) {
      if (Number.isFinite(p.upper) && Number.isFinite(p.middle) && Number.isFinite(p.lower)) {
        expect(p.upper).toBeGreaterThanOrEqual(p.middle);
        expect(p.middle).toBeGreaterThanOrEqual(p.lower);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// computeAllIndicators
// ---------------------------------------------------------------------------
describe('computeAllIndicators', () => {
  it('computes only active ids', () => {
    const active = new Set<IndicatorId>(['sma_20', 'rsi_14']);
    const result = computeAllIndicators(sampleCandles, active);
    expect(result.size).toBe(2);
    expect(result.has('sma_20')).toBe(true);
    expect(result.has('rsi_14')).toBe(true);
    expect(result.has('macd')).toBe(false);
  });

  it('skips volume id', () => {
    const active = new Set<IndicatorId>(['volume', 'sma_20']);
    const result = computeAllIndicators(sampleCandles, active);
    expect(result.size).toBe(1);
    expect(result.has('volume')).toBe(false);
    expect(result.has('sma_20')).toBe(true);
  });

  it('returns empty map for empty candles', () => {
    const active = new Set<IndicatorId>(['sma_20', 'rsi_14']);
    const result = computeAllIndicators([], active);
    expect(result.size).toBe(0);
  });

  it('returns empty map for empty active set', () => {
    const result = computeAllIndicators(sampleCandles, new Set());
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INDICATOR_META
// ---------------------------------------------------------------------------
describe('INDICATOR_META', () => {
  it('has entries for all known ids', () => {
    const ids: IndicatorId[] = [
      'sma_20', 'sma_50', 'sma_200', 'ema_12', 'ema_26',
      'bb_20', 'rsi_14', 'macd', 'volume',
    ];
    for (const id of ids) {
      expect(INDICATOR_META[id]).toBeDefined();
      expect(INDICATOR_META[id]!.label).toBeTruthy();
      expect(INDICATOR_META[id]!.color).toBeTruthy();
    }
  });
});
