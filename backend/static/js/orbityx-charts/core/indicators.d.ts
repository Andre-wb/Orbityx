/**
 * @file core/indicators.ts
 * @description Technical indicator computation engine with plugin registry.
 *
 * All standard technical indicators are registered as plugins. Users can add
 * custom indicators via registerIndicator() without modifying core code.
 */
import type { Candle, IndicatorSeries, IndicatorId } from '../types/index.js';
export interface IndicatorMeta {
    label: string;
    color: string;
    isSubPanel: boolean;
    group: string;
}
export type IndicatorComputeFn = (candles: Candle[]) => IndicatorSeries | null;
/** Human-readable metadata for the indicator picker UI. */
export declare const INDICATOR_META: Record<string, IndicatorMeta>;
/**
 * Register a custom indicator plugin.
 *
 * @example
 * registerIndicator('my_ind', {
 *     label: 'My Indicator',
 *     color: '#ff6b6b',
 *     isSubPanel: false,
 *     group: 'Custom',
 * }, (candles) => { ... });
 */
export declare function registerIndicator(id: string, meta: IndicatorMeta, compute: IndicatorComputeFn): void;
/** Unregister a custom indicator. */
export declare function unregisterIndicator(id: string): void;
/** Get all registered indicator IDs. */
export declare function getRegisteredIndicators(): string[];
/**
 * Compute the requested indicator for a candle dataset.
 * Supports both built-in IndicatorId values and custom string IDs.
 */
export declare function computeIndicator(candles: Candle[], id: IndicatorId | string): IndicatorSeries | null;
/**
 * Compute all active indicators and return as a map keyed by id.
 */
export declare function computeAllIndicators(candles: Candle[], activeIds: Set<IndicatorId | string>): Map<string, IndicatorSeries>;
//# sourceMappingURL=indicators.d.ts.map