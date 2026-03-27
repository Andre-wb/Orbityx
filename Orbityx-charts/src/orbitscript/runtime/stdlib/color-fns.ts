import type { StdlibFn } from './helpers.js';
import { asNum, asColor } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['color::with_alpha', (args, _, line, col) => {
        const c = asColor(args[0], 'color::with_alpha:color', line, col);
        const a = asNum(args[1], 'color::with_alpha:alpha', line, col);
        return { ...c, a: Math.max(0, Math.min(1, a)), hex: c.hex };
    }],
];
