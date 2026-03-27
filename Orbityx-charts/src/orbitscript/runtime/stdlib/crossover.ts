import type { StdlibFn } from './helpers.js';
import { asInt, resolveSeriesArray } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['crossover',  (args, env, line, col) => { const a = resolveSeriesArray(args[0], 0, env, line, col); const b = resolveSeriesArray(args[1], 1, env, line, col); const i = env.barIndex; if (i < 1) return false; return (a[i - 1]! <= b[i - 1]!) && (a[i]! > b[i]!); }],
    ['crossunder', (args, env, line, col) => { const a = resolveSeriesArray(args[0], 0, env, line, col); const b = resolveSeriesArray(args[1], 1, env, line, col); const i = env.barIndex; if (i < 1) return false; return (a[i - 1]! >= b[i - 1]!) && (a[i]! < b[i]!); }],
    ['rising',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'rising:length', line, col); const i = env.barIndex; if (i < len) return false; for (let j = 0; j < len; j++) { if ((src[i - j] ?? NaN) <= (src[i - j - 1] ?? NaN)) return false; } return true; }],
    ['falling', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'falling:length', line, col); const i = env.barIndex; if (i < len) return false; for (let j = 0; j < len; j++) { if ((src[i - j] ?? NaN) >= (src[i - j - 1] ?? NaN)) return false; } return true; }],
];
