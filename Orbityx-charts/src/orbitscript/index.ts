/**
 * @file orbitscript/index.ts
 * @description Public API for OrbitScript — the Rust-inspired DSL for Orbityx Charts.
 */

export { compile, register, unregister, type CompiledScript } from './compiler/index.js';
export { tokenize }    from './frontend/lexer/index.js';
export { parse }       from './frontend/parser/index.js';
export { interpret }   from './runtime/interpreter/index.js';
export {
    type OSValue, type OSColor, type OSStruct, type OSEnum, type OSClosure,
    type ScriptMeta, type InputDef, type ScriptOutput,
    type PlotOutput, type HLineOutput, type BgColorOutput,
    type AlertOutput, type PlotShapeOutput,
    OrbitScriptError,
} from './lang/types.js';

import { compile, register, unregister } from './compiler/index.js';

/**
 * Convenience namespace — mirrors TradingView's Pine Script workflow:
 *   1. OrbitScript.register(source) → returns indicator ID
 *   2. engine.toggleIndicator(id)   → activates on chart
 *   3. OrbitScript.unregister(id)   → removes from registry
 */
export const OrbitScript = {
    compile,
    register,
    unregister,
} as const;
