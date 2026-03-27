import type { MacroFn } from '../macro-def.js';
import { osValueToString } from '../../color/color-utils.js';
import { OrbitScriptError } from '../../../lang/error.js';

/**
 * format!("Hello, {}! Score: {}", name, score)
 * Replaces each `{}` placeholder with the next argument.
 * Returns the formatted string.
 */
export const formatMacro: MacroFn = (args, _rawArgs, _env, line, col) => {
    const template = args[0];
    if (typeof template !== 'string') {
        throw new OrbitScriptError(
            'format!: first argument must be a string template',
            line, col, 'runtime',
        );
    }
    let argIdx = 1;
    return template.replace(/\{\}/g, () => {
        const val = args[argIdx++];
        return val !== undefined ? osValueToString(val) : '';
    });
};
