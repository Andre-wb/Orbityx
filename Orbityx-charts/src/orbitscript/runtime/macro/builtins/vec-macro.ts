import type { MacroFn } from '../macro-def.js';

/**
 * vec![1.0, 2.0, 3.0] — constructs an array.
 * Equivalent to the `[...]` array literal syntax but explicit.
 */
export const vecMacro: MacroFn = (args) => [...args];
