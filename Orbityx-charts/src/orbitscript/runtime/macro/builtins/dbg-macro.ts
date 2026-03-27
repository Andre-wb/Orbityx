import type { MacroFn } from '../macro-def.js';
import { osValueToString } from '../../color/color-utils.js';
import { OrbitScriptError } from '../../../lang/error.js';

/**
 * dbg!(expr) — prints "[dbg] expr = value" and returns the value.
 * Uses the raw AST node to show the original expression text.
 */
export const dbgMacro: MacroFn = (args, rawArgs, _env, line, col) => {
    if (args.length === 0) {
        throw new OrbitScriptError('dbg! requires at least one argument', line, col, 'runtime');
    }
    const val     = args[0]!;
    const rawNode = rawArgs[0];
    const label   = rawNode?.kind === 'Identifier'
        ? (rawNode as { name: string }).name
        : '<expr>';
    console.debug(`[dbg] ${label} = ${osValueToString(val)}`);
    return val;
};
