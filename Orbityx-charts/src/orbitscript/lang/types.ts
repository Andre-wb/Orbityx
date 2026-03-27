/**
 * @file orbitscript/lang/types.ts
 * @description Central type definitions for the OrbitScript language runtime.
 * Re-exports all types from the modular sub-directories.
 */

// Token types
export type { TokenType } from './token/token-type.js';
export type { Token } from './token/token.js';

// Value types
export type { OSColor } from './value/os-color.js';
export type { OSStruct } from './value/os-struct.js';
export type { OSEnum } from './value/os-enum.js';
export type { OSClosure } from './value/os-closure.js';
export type { OSArray } from './value/os-array.js';
export type { OSValue } from './value/index.js';

// Meta
export type { InputType, ScriptKind, InputDef, ScriptMeta } from './meta.js';

// Output types
export type { PlotOutput, HLineOutput, PlotStyle } from './output/plot-output.js';
export type {
    BgColorOutput,
    PlotShapeStyle,
    PlotShapeLocation,
    PlotShapeOutput,
    PlotArrowOutput,
    PlotHistogramOutput,
} from './output/visual-output.js';
export type { AlertOutput } from './output/alert-output.js';
export type { ScriptOutput } from './output/index.js';

// Error
export type { ErrorPhase } from './error.js';
export { OrbitScriptError } from './error.js';

// Type system (OSType kept here as it was in original)
export type OSType =
    | 'f64' | 'i64' | 'bool' | 'str' | 'color'
    | 'series'
    | 'void'
    | 'unknown'
    | { kind: 'array';    elem: OSType }
    | { kind: 'tuple';    elems: OSType[] }
    | { kind: 'option';   inner: OSType }
    | { kind: 'result';   ok: OSType; err: OSType }
    | { kind: 'struct';   name: string }
    | { kind: 'enum';     name: string }
    | { kind: 'fn';       params: OSType[]; ret: OSType }
    | { kind: 'closure';  params: OSType[]; ret: OSType };
