import type { MacroFn } from '../macro-def.js';
import { OrbitScriptError } from '../../../lang/error.js';

/** panic!("message") — throws a runtime error unconditionally */
export const panicMacro: MacroFn = (args, _rawArgs, _env, line, col) => {
    const msg = args[0] !== undefined ? String(args[0]) : 'explicit panic';
    throw new OrbitScriptError(msg, line, col, 'runtime');
};
