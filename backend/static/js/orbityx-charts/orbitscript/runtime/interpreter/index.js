import { Interpreter } from './interpreter.js';
export { Interpreter } from './interpreter.js';
/**
 * Execute an OrbitScript Program against the given candle data.
 */
export function interpret(program, candles, inputs) {
    return new Interpreter().interpret(program, candles, inputs);
}
//# sourceMappingURL=index.js.map