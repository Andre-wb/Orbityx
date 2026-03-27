import { OrbitScriptError } from '../../../lang/error.js';
/** todo!() or todo!("reason") — marks unimplemented code, always throws */
export const todoMacro = (args, _rawArgs, _env, line, col) => {
    const msg = args[0] !== undefined ? String(args[0]) : 'not yet implemented';
    throw new OrbitScriptError(`todo!: ${msg}`, line, col, 'runtime');
};
//# sourceMappingURL=todo-macro.js.map