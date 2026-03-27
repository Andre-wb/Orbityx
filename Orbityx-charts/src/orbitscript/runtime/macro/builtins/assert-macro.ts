import type { MacroFn } from '../macro-def.js';
import { OrbitScriptError } from '../../../lang/error.js';

/**
 * assert!(condition)
 * assert!(condition, "message")
 * Throws a runtime error when condition is falsy.
 */
function isTruthy(v: unknown): boolean {
    if (v === null || v === false) return false;
    if (typeof v === 'number') return !isNaN(v) && v !== 0;
    if (typeof v === 'string') return v.length > 0;
    return true;
}

export const assertMacro: MacroFn = (args, _rawArgs, _env, line, col) => {
    const cond = args[0];
    if (!isTruthy(cond)) {
        const msg = args[1] !== undefined ? String(args[1]) : 'assertion failed';
        throw new OrbitScriptError(`assert!: ${msg}`, line, col, 'runtime');
    }
    return null;
};
