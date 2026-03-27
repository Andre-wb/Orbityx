/**
 * @file orbitscript/compiler/output-converter.ts
 * @description Converts ScriptOutput[] to IndicatorSeries for the chart engine.
 */
import type { Candle, IndicatorSeries } from '../../types/index.js';
import { interpret } from '../runtime/interpreter/index.js';
import type { Program } from '../lang/ast/index.js';
import type { ScriptMeta } from '../lang/types.js';
export declare function outputsToIndicatorSeries(outputs: ReturnType<typeof interpret>['outputs'], meta: ScriptMeta, candles: Candle[], id: string | null): IndicatorSeries | null;
export declare function registerSecondaryOutputs(outputs: ReturnType<typeof interpret>['outputs'], primaryId: string, meta: ScriptMeta, candles: Candle[], allIds: string[], program: Program, inputs?: Map<string, import('../lang/types.js').OSValue>): void;
//# sourceMappingURL=output-converter.d.ts.map