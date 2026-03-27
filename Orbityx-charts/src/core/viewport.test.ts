import { describe, it, expect } from 'vitest';
import {
    computePlotRect,
    computeVisibleData,
    candleStep,
    maxVisibleCandles,
    priceToY,
    yToPrice,
    indexToX,
    xToIndex,
    volumePanelH,
} from './viewport.js';
import type { ChartConfig, ChartState, Candle } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
    return {
        theme: 'dark',
        candleWidth: 8,
        candleSpacing: 2,
        volumePanelRatio: 0.18,
        volumePanelGap: 4,
        margin: { top: 40, right: 80, bottom: 32, left: 10 },
        lazyLoadThreshold: 80,
        pricePadding: 0.05,
        pricePaddingFlat: 0.02,
        subPanelHeight: 100,
        zoomMin: 0.2,
        zoomMax: 20,
        zoomStep: 1.25,
        keyScrollStep: 5,
        font: '11px monospace',
        fontSmall: '10px monospace',
        darkTheme: {} as ChartConfig['darkTheme'],
        lightTheme: {} as ChartConfig['lightTheme'],
        ...overrides,
    };
}

function makeState(overrides: Partial<ChartState> = {}): ChartState {
    return {
        data: [],
        visibleData: [],
        viewportStart: 0,
        scaleX: 1,
        offsetCandles: 0,
        minPrice: 100,
        maxPrice: 200,
        width: 800,
        height: 600,
        currentPrice: 150,
        isDragging: false,
        dragStartX: 0,
        mouseX: -1,
        mouseY: -1,
        mouseInside: false,
        drawingMode: 'none',
        chartType: 'candlestick',
        scaleType: 'linear',
        magnetEnabled: false,
        activeIndicators: new Set(),
        rafPending: false,
        baselinePrice: 0,
        ...overrides,
    };
}

function makeCandle(ts: number, close: number): Candle {
    return {
        timestamp: ts,
        open: close - 1,
        high: close + 5,
        low: close - 5,
        close,
        volume: 1000,
    };
}

// ---------------------------------------------------------------------------
// candleStep
// ---------------------------------------------------------------------------
describe('candleStep', () => {
    it('returns (candleWidth + candleSpacing) * scaleX', () => {
        const config = makeConfig();
        const state = makeState({ scaleX: 1 });
        expect(candleStep(config, state)).toBe(10); // (8 + 2) * 1
    });

    it('scales with zoom', () => {
        const config = makeConfig();
        const state = makeState({ scaleX: 2 });
        expect(candleStep(config, state)).toBe(20);
    });
});

// ---------------------------------------------------------------------------
// maxVisibleCandles
// ---------------------------------------------------------------------------
describe('maxVisibleCandles', () => {
    it('returns at least 1', () => {
        const config = makeConfig();
        const state = makeState({ scaleX: 100 }); // very zoomed in
        expect(maxVisibleCandles(config, state, 10)).toBeGreaterThanOrEqual(1);
    });

    it('returns correct count', () => {
        const config = makeConfig();
        const state = makeState({ scaleX: 1 });
        // plotWidth=710, step=10 → 71 candles
        expect(maxVisibleCandles(config, state, 710)).toBe(71);
    });
});

// ---------------------------------------------------------------------------
// computePlotRect
// ---------------------------------------------------------------------------
describe('computePlotRect', () => {
    it('computes basic plot area', () => {
        const config = makeConfig();
        const state = makeState();
        const plot = computePlotRect(config, state, 0);

        expect(plot.left).toBe(10);
        expect(plot.right).toBe(720); // 800 - 80
        expect(plot.top).toBe(40);
        expect(plot.bottom).toBe(568); // 600 - 32
        expect(plot.width).toBe(710);
        expect(plot.height).toBe(528);
    });

    it('shrinks for volume panel', () => {
        const config = makeConfig();
        const state = makeState({ activeIndicators: new Set(['volume']) as ChartState['activeIndicators'] });
        const plot = computePlotRect(config, state, 0);

        const volH = volumePanelH(config, state);
        expect(plot.bottom).toBe(568 - volH - config.volumePanelGap);
    });

    it('shrinks for sub-panels', () => {
        const config = makeConfig();
        const state = makeState();
        const plotNoSub = computePlotRect(config, state, 0);
        const plotWithSub = computePlotRect(config, state, 2);

        const expectedShrink = 2 * (config.subPanelHeight + config.volumePanelGap);
        expect(plotNoSub.bottom - plotWithSub.bottom).toBe(expectedShrink);
    });

    it('height is at least 1', () => {
        const config = makeConfig();
        const state = makeState({ height: 50 }); // very small
        const plot = computePlotRect(config, state, 0);
        expect(plot.height).toBeGreaterThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// priceToY / yToPrice round-trip
// ---------------------------------------------------------------------------
describe('priceToY / yToPrice', () => {
    it('round-trips correctly', () => {
        const config = makeConfig();
        const state = makeState({ minPrice: 100, maxPrice: 200 });
        const plot = computePlotRect(config, state, 0);

        const price = 150;
        const y = priceToY(price, state, plot);
        const recovered = yToPrice(y, state, plot);
        expect(recovered).toBeCloseTo(price, 6);
    });

    it('maps minPrice to plot.bottom', () => {
        const state = makeState({ minPrice: 100, maxPrice: 200 });
        const config = makeConfig();
        const plot = computePlotRect(config, state, 0);

        expect(priceToY(100, state, plot)).toBeCloseTo(plot.bottom, 6);
    });

    it('maps maxPrice to plot.top', () => {
        const state = makeState({ minPrice: 100, maxPrice: 200 });
        const config = makeConfig();
        const plot = computePlotRect(config, state, 0);

        expect(priceToY(200, state, plot)).toBeCloseTo(plot.top, 6);
    });

    it('handles flat price range (min === max)', () => {
        const state = makeState({ minPrice: 100, maxPrice: 100 });
        const config = makeConfig();
        const plot = computePlotRect(config, state, 0);

        const y = priceToY(100, state, plot);
        expect(y).toBe(plot.top + plot.height / 2);
    });

    it('yToPrice handles zero height safely', () => {
        const state = makeState({ minPrice: 100, maxPrice: 100 });
        const config = makeConfig();
        const plot = { ...computePlotRect(config, state, 0), height: 0 };

        expect(yToPrice(50, state, plot)).toBe(100);
    });
});

// ---------------------------------------------------------------------------
// indexToX / xToIndex
// ---------------------------------------------------------------------------
describe('indexToX / xToIndex', () => {
    it('round-trips for valid positions', () => {
        const config = makeConfig();
        const state = makeState({ scaleX: 1 });
        const plot = computePlotRect(config, state, 0);

        const x = indexToX(5, config, state, plot);
        const idx = xToIndex(x + 1, config, state, plot); // +1 to be inside the candle
        expect(idx).toBe(5);
    });

    it('returns -1 for out-of-bounds x', () => {
        const config = makeConfig();
        const state = makeState();
        const plot = computePlotRect(config, state, 0);

        expect(xToIndex(-10, config, state, plot)).toBe(-1);
        expect(xToIndex(plot.right + 100, config, state, plot)).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// computeVisibleData
// ---------------------------------------------------------------------------
describe('computeVisibleData', () => {
    it('returns empty for no data', () => {
        const config = makeConfig();
        const state = makeState({ data: [] });

        const result = computeVisibleData(config, state, 710);
        expect(result.visibleData).toEqual([]);
        expect(result.minPrice).toBe(0);
        expect(result.maxPrice).toBe(0);
        expect(result.needMoreData).toBe(false);
    });

    it('returns visible slice of data', () => {
        const candles = Array.from({ length: 200 }, (_, i) => makeCandle(i * 1000, 100 + i));
        const config = makeConfig();
        const state = makeState({ data: candles, scaleX: 1, offsetCandles: 0 });

        const result = computeVisibleData(config, state, 710);
        expect(result.visibleData.length).toBeLessThanOrEqual(71);
        expect(result.visibleData.length).toBeGreaterThan(0);
        // Last visible candle should be the last in the dataset (offset=0 → right edge)
        expect(result.visibleData[result.visibleData.length - 1]!.timestamp)
            .toBe(candles[candles.length - 1]!.timestamp);
    });

    it('computes min/max with padding', () => {
        const candles = [
            makeCandle(1000, 100), // low: 95, high: 105
            makeCandle(2000, 110), // low: 105, high: 115
        ];
        const config = makeConfig();
        const state = makeState({ data: candles, scaleX: 1, offsetCandles: 0 });

        const result = computeVisibleData(config, state, 710);
        expect(result.minPrice).toBeLessThan(95);
        expect(result.maxPrice).toBeGreaterThan(115);
    });

    it('clamps offsetCandles', () => {
        const candles = Array.from({ length: 50 }, (_, i) => makeCandle(i * 1000, 100));
        const config = makeConfig();
        const state = makeState({ data: candles, scaleX: 1, offsetCandles: 999 });

        const result = computeVisibleData(config, state, 710);
        expect(result.offsetCandles).toBeLessThanOrEqual(50);
    });

    it('signals needMoreData when close to left edge', () => {
        const candles = Array.from({ length: 100 }, (_, i) => makeCandle(i * 1000, 100));
        const config = makeConfig({ lazyLoadThreshold: 80 });
        const state = makeState({ data: candles, scaleX: 1, offsetCandles: 90 });

        const result = computeVisibleData(config, state, 710);
        // viewportStart should be small, triggering needMoreData
        expect(result.needMoreData).toBe(true);
    });
});
