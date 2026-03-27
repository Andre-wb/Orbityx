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

const renderers = new Map<ChartType, ChartTypeRenderer>();

/** Register a renderer for a chart type. Overwrites existing if present. */
export function registerChartType(type: ChartType, renderer: ChartTypeRenderer): void {
    renderers.set(type, renderer);
}

/** Get the registered renderer for a chart type. */
export function getChartTypeRenderer(type: ChartType): ChartTypeRenderer | undefined {
    return renderers.get(type);
}

/** List all registered chart types. */
export function getRegisteredChartTypes(): ChartType[] {
    return Array.from(renderers.keys());
}
