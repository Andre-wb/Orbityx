/**
 * @file orbitscript/compiler/index.ts
 * @description Bridge between OrbitScript and the Orbityx Charts indicator plugin system.
 */
import type { Candle, IndicatorSeries } from '../../types/index.js';
import type { Program } from '../lang/ast/index.js';
import type { ScriptMeta, OSValue } from '../lang/types.js';
export interface CompiledScript {
    meta: ScriptMeta;
    computeFn: (candles: Candle[]) => IndicatorSeries | null;
    program: Program;
}
export declare function compile(source: string, inputOverrides?: Record<string, OSValue>): CompiledScript;
export declare function register(source: string, inputOverrides?: Record<string, OSValue>): string;
export declare function unregister(id: string): void;
//# sourceMappingURL=index.d.ts.map