/**
 * @file ui/toolbar.ts
 * @description Chart toolbar – timeframes, chart type, drawing tools,
 * indicator picker, scale, alerts, replay, compare, screenshot, zoom controls.
 *
 * Pure UI layer; all actions delegated via callbacks or directly
 * to the injected ChartEngine instance.
 */
import type { ChartType, IChartControls } from '../types/index.js';
/**
 * Build and mount toolbar DOM inside #toolbar.
 * @param onTimeframeChange  App-level callback for timeframe switches.
 * @param onChartTypeChange  App-level callback for chart type switches.
 * @param engine             Chart engine for zoom/reset/drawing/indicators.
 */
export declare function initToolBar(onTimeframeChange: (tf: string) => void, onChartTypeChange: (type: ChartType) => void, engine: IChartControls): void;
export declare function timeframeLabel(tf: string): string;
//# sourceMappingURL=toolbar.d.ts.map