/**
 * @file core/chart-renderer.ts
 * @description Canvas rendering methods extracted from ChartEngine.
 *
 * ChartRenderer is a stateless helper — all data is passed through the
 * RenderContext that ChartEngine builds on every frame. This keeps the
 * renderer unit-testable and the engine file under 500 lines.
 */
import type { ChartConfig, ChartState, ThemeColors, IndicatorSeries, Drawing, PriceAlert, CompareSeriesData, ReplayState } from '../types/index.js';
import type { PlotRect } from './viewport.js';
export interface RenderContext {
    ctx: CanvasRenderingContext2D;
    config: ChartConfig;
    state: ChartState;
    colors: ThemeColors;
    plot: PlotRect;
    timeframe: string;
    indicatorCache: Map<string, IndicatorSeries>;
    drawings: Drawing[];
    draftDrawing: Drawing | null;
    alerts: PriceAlert[];
    compareSeries: CompareSeriesData[];
    replay: ReplayState;
}
/** Full render pipeline. Called once per frame by ChartEngine. */
export declare function renderFrame(r: RenderContext): void;
/** Fallback when renderFrame throws. */
export declare function renderError(r: RenderContext, err: unknown): void;
export declare function drawVolumePanel(r: RenderContext): void;
//# sourceMappingURL=chart-renderer.d.ts.map