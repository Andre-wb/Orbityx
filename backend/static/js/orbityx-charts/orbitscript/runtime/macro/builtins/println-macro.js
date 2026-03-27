import { osValueToString } from '../../color/color-utils.js';
/** println!(val, ...) — prints values to console, returns None */
export const printlnMacro = (args) => {
    console.log(...args.map(a => osValueToString(a)));
    return null;
};
//# sourceMappingURL=println-macro.js.map