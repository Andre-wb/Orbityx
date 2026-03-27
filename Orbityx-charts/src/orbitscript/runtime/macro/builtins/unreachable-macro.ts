import type { MacroFn } from '../macro-def.js';
import { OrbitScriptError } from '../../../lang/error.js';

/** unreachable!() — marks logically unreachable code, always throws */
export const unreachableMacro: MacroFn = (args, _rawArgs, _env, line, col) => {
    const msg = args[0] !== undefined ? String(args[0]) : 'entered unreachable code';
    throw new OrbitScriptError(`unreachable!: ${msg}`, line, col, 'runtime');
};
