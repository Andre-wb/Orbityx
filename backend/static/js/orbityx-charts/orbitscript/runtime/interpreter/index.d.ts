import type { Candle } from '../../../types/index.js';
import type { Program } from '../../lang/ast/index.js';
import type { OSValue, ScriptMeta, ScriptOutput } from '../../lang/types.js';
export { Interpreter } from './interpreter.js';
/**
 * Execute an OrbitScript Program against the given candle data.
 */
export declare function interpret(program: Program, candles: Candle[], inputs?: Map<string, OSValue>): {
    meta: ScriptMeta;
    outputs: ScriptOutput[];
};
//# sourceMappingURL=index.d.ts.map