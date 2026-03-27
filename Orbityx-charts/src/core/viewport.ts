/**
 * @file core/viewport.ts
 * @description Viewport math — plot dimensions, coordinate transforms, and
 * visible-data windowing extracted from ChartEngine for maintainability.
 *
 * All functions are pure and operate on ChartConfig + ChartState.
 */
import type { ChartConfig, ChartState, Candle } from '../types/index.js';
import { clamp } from '../utils/math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Plot Dimensions
// ─────────────────────────────────────────────────────────────────────────────

export interface PlotRect {
    left:   number;
    right:  number;
    top:    number;
    bottom: number;
    width:  number;
    height: number;
}

/** Volume panel height in CSS pixels. */
export function volumePanelH(config: ChartConfig, state: ChartState): number {
    return Math.round(state.height * config.volumePanelRatio);
}

/** Pixel width of one candle step (body + spacing) at current zoom. */
export function candleStep(config: ChartConfig, state: ChartState): number {
    return (config.candleWidth + config.candleSpacing) * state.scaleX;
}

/** Max number of candles that fit in the visible plot area. */
export function maxVisibleCandles(config: ChartConfig, state: ChartState, plotWidth: number): number {
    const step = candleStep(config, state);
    return Math.max(1, Math.floor(plotWidth / step));
}

/**
 * Compute the plot rectangle, accounting for margins, volume panel,
 * and any active sub-panel indicators.
 */
export function computePlotRect(
    config:      ChartConfig,
    state:       ChartState,
    subPanelCount: number,
): PlotRect {
    const left  = config.margin.left;
    const right = state.width - config.margin.right;
    const top   = config.margin.top;

    let bottom = state.height - config.margin.bottom;
    if (state.activeIndicators.has('volume')) {
        bottom -= volumePanelH(config, state) + config.volumePanelGap;
    }
    for (let i = 0; i < subPanelCount; i++) {
        bottom -= config.subPanelHeight + config.volumePanelGap;
    }

    return {
        left,
        right,
        top,
        bottom,
        width:  right - left,
        height: Math.max(1, bottom - top),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate Transforms
// ─────────────────────────────────────────────────────────────────────────────

export function priceToY(price: number, state: ChartState, plot: PlotRect): number {
    const { minPrice, maxPrice } = state;
    if (maxPrice === minPrice) return plot.top + plot.height / 2;

    if (state.scaleType === 'logarithmic' && minPrice > 0 && price > 0) {
        const logMin = Math.log(minPrice);
        const logMax = Math.log(maxPrice);
        if (logMax === logMin) return plot.top + plot.height / 2;
        const ratio = (Math.log(price) - logMin) / (logMax - logMin);
        return plot.bottom - ratio * plot.height;
    }

    if (state.scaleType === 'percentage') {
        const base = state.baselinePrice || minPrice;
        if (base === 0) return plot.top + plot.height / 2;
        const pctPrice = ((price - base) / base) * 100;
        const pctMin   = ((minPrice - base) / base) * 100;
        const pctMax   = ((maxPrice - base) / base) * 100;
        if (pctMax === pctMin) return plot.top + plot.height / 2;
        const ratio = (pctPrice - pctMin) / (pctMax - pctMin);
        return plot.bottom - ratio * plot.height;
    }

    const ratio = (price - minPrice) / (maxPrice - minPrice);
    return plot.bottom - ratio * plot.height;
}

export function yToPrice(y: number, state: ChartState, plot: PlotRect): number {
    const { minPrice, maxPrice } = state;
    if (plot.height === 0 || maxPrice === minPrice) return minPrice;
    const ratio = (plot.bottom - y) / plot.height;

    if (state.scaleType === 'logarithmic' && minPrice > 0) {
        const logMin = Math.log(minPrice);
        const logMax = Math.log(maxPrice);
        return Math.exp(logMin + ratio * (logMax - logMin));
    }

    return minPrice + ratio * (maxPrice - minPrice);
}

export function indexToX(index: number, config: ChartConfig, state: ChartState, plot: PlotRect): number {
    return plot.left + index * candleStep(config, state);
}

export function xToIndex(x: number, config: ChartConfig, state: ChartState, plot: PlotRect): number {
    const relX = x - plot.left;
    if (relX < 0 || relX > plot.width) return -1;
    return Math.floor(relX / candleStep(config, state));
}

export function timestampToX(
    ts: number,
    config: ChartConfig,
    state:  ChartState,
    plot:   PlotRect,
): number {
    const idx = state.data.findIndex(c => c.timestamp === ts);
    if (idx === -1) return -1;
    const visIdx = idx - state.viewportStart;
    if (visIdx < 0 || visIdx >= state.visibleData.length) return -1;
    return indexToX(visIdx, config, state, plot) + (config.candleWidth * state.scaleX) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Visible Data Windowing
// ─────────────────────────────────────────────────────────────────────────────

export interface VisibleDataResult {
    visibleData:   Candle[];
    viewportStart: number;
    offsetCandles: number;
    minPrice:      number;
    maxPrice:      number;
    /** True when the viewport is close to the oldest candle and history should be loaded. */
    needMoreData:  boolean;
}

/**
 * Compute the visible window of candles and price range from the current
 * viewport state. Pure function — does not mutate `state`.
 */
export function computeVisibleData(
    config: ChartConfig,
    state:  ChartState,
    plotWidth: number,
): VisibleDataResult {
    const data = state.data;

    if (!data.length) {
        return {
            visibleData:   [],
            viewportStart: 0,
            offsetCandles: state.offsetCandles,
            minPrice:      0,
            maxPrice:      0,
            needMoreData:  false,
        };
    }

    const maxVis    = maxVisibleCandles(config, state, plotWidth);
    const maxOffset = Math.max(0, data.length - maxVis);
    const clamped   = clamp(state.offsetCandles, 0, maxOffset);
    const offset    = Math.round(clamped);
    const end       = Math.max(0, data.length - offset);
    const start     = Math.max(0, end - maxVis);
    const visible   = data.slice(start, end);

    if (!visible.length) {
        return {
            visibleData:   [],
            viewportStart: start,
            offsetCandles: clamped,
            minPrice:      0,
            maxPrice:      0,
            needMoreData:  false,
        };
    }

    let lo = Infinity, hi = -Infinity;
    for (const c of visible) {
        if (c.low  < lo) lo = c.low;
        if (c.high > hi) hi = c.high;
    }
    const pad = (hi - lo) * config.pricePadding || Math.abs(hi) * config.pricePaddingFlat || 1;

    return {
        visibleData:   visible,
        viewportStart: start,
        offsetCandles: clamped,
        minPrice:      lo - pad,
        maxPrice:      hi + pad,
        needMoreData:  start < config.lazyLoadThreshold,
    };
}
