/**
 * @file core/viewport.ts
 * @description Viewport math — plot dimensions, coordinate transforms, and
 * visible-data windowing extracted from ChartEngine for maintainability.
 *
 * All functions are pure and operate on ChartConfig + ChartState.
 */
import type { ChartConfig, ChartState, Candle } from '../types/index.js';
export interface PlotRect {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}
/** Volume panel height in CSS pixels. */
export declare function volumePanelH(config: ChartConfig, state: ChartState): number;
/** Pixel width of one candle step (body + spacing) at current zoom. */
export declare function candleStep(config: ChartConfig, state: ChartState): number;
/** Max number of candles that fit in the visible plot area. */
export declare function maxVisibleCandles(config: ChartConfig, state: ChartState, plotWidth: number): number;
/**
 * Compute the plot rectangle, accounting for margins, volume panel,
 * and any active sub-panel indicators.
 */
export declare function computePlotRect(config: ChartConfig, state: ChartState, subPanelCount: number): PlotRect;
export declare function priceToY(price: number, state: ChartState, plot: PlotRect): number;
export declare function yToPrice(y: number, state: ChartState, plot: PlotRect): number;
export declare function indexToX(index: number, config: ChartConfig, state: ChartState, plot: PlotRect): number;
export declare function xToIndex(x: number, config: ChartConfig, state: ChartState, plot: PlotRect): number;
export declare function timestampToX(ts: number, config: ChartConfig, state: ChartState, plot: PlotRect): number;
export interface VisibleDataResult {
    visibleData: Candle[];
    viewportStart: number;
    offsetCandles: number;
    minPrice: number;
    maxPrice: number;
    /** True when the viewport is close to the oldest candle and history should be loaded. */
    needMoreData: boolean;
}
/**
 * Compute the visible window of candles and price range from the current
 * viewport state. Pure function — does not mutate `state`.
 */
export declare function computeVisibleData(config: ChartConfig, state: ChartState, plotWidth: number): VisibleDataResult;
//# sourceMappingURL=viewport.d.ts.map