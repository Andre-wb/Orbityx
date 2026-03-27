import type { MacroFn } from '../macro-def.js';
import { osValueToString } from '../../color/color-utils.js';

/** println!(val, ...) — prints values to console, returns None */
export const printlnMacro: MacroFn = (args) => {
    console.log(...args.map(a => osValueToString(a)));
    return null;
};
