export type { OSColor } from './os-color.js';
export type { OSStruct } from './os-struct.js';
export type { OSEnum } from './os-enum.js';
export type { OSClosure } from './os-closure.js';
export type { OSArray } from './os-array.js';

import type { OSColor } from './os-color.js';
import type { OSStruct } from './os-struct.js';
import type { OSEnum } from './os-enum.js';
import type { OSClosure } from './os-closure.js';
import type { OSArray } from './os-array.js';

/**
 * All value types that can exist at runtime in OrbitScript.
 * `series` values are f64 numbers — series semantics live in the Environment.
 */
export type OSValue =
    | number       // f64 / i64 / series value at current bar
    | boolean
    | string
    | OSColor
    | OSArray
    | OSStruct
    | OSEnum
    | OSClosure
    | null;        // None / void
