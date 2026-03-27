import type { Candle } from '../../../types/index.js';
import type { Program } from '../../lang/ast/index.js';
import type { OSValue, ScriptMeta, ScriptOutput } from '../../lang/types.js';
import { Interpreter } from './interpreter.js';

export { Interpreter } from './interpreter.js';

/**
 * Execute an OrbitScript Program against the given candle data.
 */
export function interpret(
    program: Program,
    candles: Candle[],
    inputs?: Map<string, OSValue>,
): { meta: ScriptMeta; outputs: ScriptOutput[] } {
    return new Interpreter().interpret(program, candles, inputs);
}
