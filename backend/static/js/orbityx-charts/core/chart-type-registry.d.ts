/**
 * @file core/chart-type-registry.ts
 * @description Plugin registry for chart type renderers (OCP).
 *
 * Open/Closed: add new chart types (Renko, Kagi, P&F, etc.) via
 * registerChartType() without modifying the renderer's switch statement.
 */
import type { RenderContext } from './chart-renderer.js';
import type { ChartType } from '../types/index.js';
export type ChartTypeRenderer = (r: RenderContext) => void;
/** Register a renderer for a chart type. Overwrites existing if present. */
export declare function registerChartType(type: ChartType, renderer: ChartTypeRenderer): void;
/** Get the registered renderer for a chart type. */
export declare function getChartTypeRenderer(type: ChartType): ChartTypeRenderer | undefined;
/** List all registered chart types. */
export declare function getRegisteredChartTypes(): ChartType[];
//# sourceMappingURL=chart-type-registry.d.ts.map