import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Candle } from '../types/index.js';

// Mock the registry module before importing data-manager
vi.mock('../services/api.js', () => {
  return {
    registry: {
      fetchCandles: vi.fn(),
    },
  };
});

// We need to get a fresh DataManager for each test. Since data-manager.ts
// exports a singleton, we use vi.resetModules() and dynamic imports.

async function getDataManager() {
  const mod = await import('./data-manager.js');
  return mod.default;
}

async function getMockedRegistry() {
  const mod = await import('../services/api.js');
  return mod.registry as unknown as { fetchCandles: ReturnType<typeof vi.fn> };
}

function makeCandle(ts: number, close: number): Candle {
  return {
    timestamp: ts,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 1000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DataManager', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // Re-apply mock after reset
    vi.mock('../services/api.js', () => ({
      registry: {
        fetchCandles: vi.fn(),
      },
    }));
  });

  // ── loadCandles ──────────────────────────────────────────────────────────

  describe('loadCandles', () => {
    it('loads, normalises, sorts, and notifies subscribers', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      const rawCandles = [
        { timestamp: 3000, open: 10, high: 12, low: 9, close: 11, volume: 500 },
        { timestamp: 1000, open: 5, high: 7, low: 4, close: 6, volume: 300 },
        { timestamp: 2000, open: 8, high: 9, low: 7, close: 8, volume: 400 },
      ];
      reg.fetchCandles.mockResolvedValue(rawCandles);

      const callback = vi.fn();
      dm.subscribe(callback);

      const result = await dm.loadCandles('btc', '1d');

      expect(reg.fetchCandles).toHaveBeenCalledWith({
        instrumentId: 'btc',
        timeframe: '1d',
      });
      // Sorted ascending
      expect(result[0]!.timestamp).toBe(1000);
      expect(result[1]!.timestamp).toBe(2000);
      expect(result[2]!.timestamp).toBe(3000);
      // Subscriber notified
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('normalises array-format candles', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValue([
        [1000, 10, 12, 9, 11, 500],
      ]);

      const result = await dm.loadCandles('btc', '1h');
      expect(result[0]).toEqual({
        timestamp: 1000,
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 500,
      });
    });

    it('normalises object with aliases (o, h, l, c, v, t)', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValue([
        { t: 1000, o: 10, h: 12, l: 9, c: 11, v: 500 },
      ]);

      const result = await dm.loadCandles('btc', '1h');
      expect(result[0]).toEqual({
        timestamp: 1000,
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 500,
      });
    });

    it('filters out invalid candles (NaN fields)', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValue([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 500 },
        { timestamp: NaN, open: 10, high: 12, low: 9, close: 11, volume: 500 },
        { timestamp: 2000, open: NaN, high: 12, low: 9, close: 11, volume: 500 },
      ]);

      const result = await dm.loadCandles('btc', '1h');
      expect(result.length).toBe(1);
      expect(result[0]!.timestamp).toBe(1000);
    });
  });

  // ── prependCandles ───────────────────────────────────────────────────────

  describe('prependCandles', () => {
    it('prepends older candles and avoids duplicates', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      // Load initial data
      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 3000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        { timestamp: 4000, open: 11, high: 13, low: 10, close: 12, volume: 200 },
      ]);
      await dm.loadCandles('btc', '1d');

      // Prepend older data (one overlaps at 3000)
      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 5, high: 7, low: 4, close: 6, volume: 50 },
        { timestamp: 2000, open: 7, high: 9, low: 6, close: 8, volume: 60 },
        { timestamp: 3000, open: 10, high: 12, low: 9, close: 11, volume: 100 }, // overlap
      ]);

      const count = await dm.prependCandles('btc', '1d', 3000);
      expect(count).toBe(2); // only 1000, 2000 are new
      const data = dm.getData();
      expect(data.length).toBe(4);
      expect(data[0]!.timestamp).toBe(1000);
    });

    it('returns 0 when no new candles', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      ]);
      await dm.loadCandles('btc', '1d');

      reg.fetchCandles.mockResolvedValueOnce([]);
      const count = await dm.prependCandles('btc', '1d', 1000);
      expect(count).toBe(0);
    });
  });

  // ── processLiveTick ──────────────────────────────────────────────────────

  describe('processLiveTick', () => {
    it('updates last candle when timestamps match', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      ]);
      await dm.loadCandles('btc', '1d');

      dm.processLiveTick({
        timestamp: 1000, open: 10, high: 15, low: 8, close: 14, volume: 200,
      });

      const data = dm.getData();
      expect(data.length).toBe(1);
      expect(data[0]!.high).toBe(15);   // max(12, 15)
      expect(data[0]!.low).toBe(8);     // min(9, 8)
      expect(data[0]!.close).toBe(14);  // updated
      expect(data[0]!.volume).toBe(200);
    });

    it('appends new candle when timestamps differ', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      ]);
      await dm.loadCandles('btc', '1d');

      dm.processLiveTick({
        timestamp: 2000, open: 12, high: 14, low: 11, close: 13, volume: 150,
      });

      const data = dm.getData();
      expect(data.length).toBe(2);
      expect(data[1]!.timestamp).toBe(2000);
    });

    it('ignores invalid ticks', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      ]);
      await dm.loadCandles('btc', '1d');

      dm.processLiveTick({ timestamp: NaN, open: 10, high: 12, low: 9, close: 11 });
      expect(dm.getData().length).toBe(1);
    });
  });

  // ── subscribe / unsubscribe ──────────────────────────────────────────────

  describe('subscribe / unsubscribe', () => {
    it('notifies subscribers on live tick', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([]);
      await dm.loadCandles('btc', '1d');

      const callback = vi.fn();
      dm.subscribe(callback);

      dm.processLiveTick({
        timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100,
      });

      // loadCandles notified once, processLiveTick another
      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([]);
      await dm.loadCandles('btc', '1d');

      const callback = vi.fn();
      const unsub = dm.subscribe(callback);
      callback.mockClear(); // clear the call from loadCandles notify

      unsub();

      dm.processLiveTick({
        timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── computeStats ─────────────────────────────────────────────────────────

  describe('computeStats', () => {
    it('returns zeroed stats for empty cache', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([]);
      await dm.loadCandles('btc', '1d');

      const stats = dm.computeStats();
      expect(stats.high24h).toBe(0);
      expect(stats.low24h).toBe(0);
      expect(stats.volume24h).toBe(0);
      expect(stats.marketCap).toBe(null);
    });

    it('computes stats from cached data', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      const now = Date.now();
      const candles = [
        { timestamp: now - 3600_000, open: 100, high: 120, low: 90, close: 110, volume: 500 },
        { timestamp: now - 1800_000, open: 110, high: 130, low: 95, close: 125, volume: 600 },
      ];
      reg.fetchCandles.mockResolvedValueOnce(candles);
      await dm.loadCandles('btc', '1h');

      const stats = dm.computeStats();
      expect(stats.high24h).toBe(130);
      expect(stats.low24h).toBe(90);
      expect(stats.volume24h).toBe(1100);
    });
  });

  // ── getData returns copy ─────────────────────────────────────────────────

  describe('getData', () => {
    it('returns a copy, not a reference', async () => {
      const dm = await getDataManager();
      const reg = await getMockedRegistry();

      reg.fetchCandles.mockResolvedValueOnce([
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      ]);
      await dm.loadCandles('btc', '1d');

      const data1 = dm.getData();
      const data2 = dm.getData();
      expect(data1).not.toBe(data2);
      expect(data1).toEqual(data2);
    });
  });
});
