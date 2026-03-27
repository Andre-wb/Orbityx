import type { StdlibFn } from './helpers.js';
import { asNum } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['abs',   (args, _, line, col) => Math.abs(asNum(args[0], 'abs', line, col))],
    ['sqrt',  (args, _, line, col) => Math.sqrt(asNum(args[0], 'sqrt', line, col))],
    ['log',   (args, _, line, col) => Math.log(asNum(args[0], 'log', line, col))],
    ['log10', (args, _, line, col) => Math.log10(asNum(args[0], 'log10', line, col))],
    ['round', (args, _, line, col) => Math.round(asNum(args[0], 'round', line, col))],
    ['ceil',  (args, _, line, col) => Math.ceil(asNum(args[0], 'ceil', line, col))],
    ['floor', (args, _, line, col) => Math.floor(asNum(args[0], 'floor', line, col))],
    ['pow',   (args, _, line, col) => Math.pow(asNum(args[0], 'pow:x', line, col), asNum(args[1], 'pow:y', line, col))],
    ['max',   (args, _, line, col) => { if (Array.isArray(args[0])) return Math.max(...(args[0] as number[])); return Math.max(asNum(args[0], 'max:a', line, col), asNum(args[1], 'max:b', line, col)); }],
    ['min',   (args, _, line, col) => { if (Array.isArray(args[0])) return Math.min(...(args[0] as number[])); return Math.min(asNum(args[0], 'min:a', line, col), asNum(args[1], 'min:b', line, col)); }],
    ['clamp', (args, _, line, col) => { const x = asNum(args[0], 'clamp:x', line, col); const lo = asNum(args[1], 'clamp:lo', line, col); const hi = asNum(args[2], 'clamp:hi', line, col); return Math.max(lo, Math.min(hi, x)); }],
];
