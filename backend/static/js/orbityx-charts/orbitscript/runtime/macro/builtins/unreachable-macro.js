import { OrbitScriptError } from '../../../lang/error.js';
/** unreachable!() — marks logically unreachable code, always throws */
export const unreachableMacro = (args, _rawArgs, _env, line, col) => {
    const msg = args[0] !== undefined ? String(args[0]) : 'entered unreachable code';
    throw new OrbitScriptError(`unreachable!: ${msg}`, line, col, 'runtime');
};
//# sourceMappingURL=unreachable-macro.js.map