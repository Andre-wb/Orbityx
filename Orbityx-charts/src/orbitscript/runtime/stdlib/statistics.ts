import type { StdlibFn } from './helpers.js';
import { asInt, resolveSeriesArray, cached, currentVal, seriesFingerprint, rollingStdev, rollingHighest, rollingLowest, rollingSum } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['stdev',   (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1] ?? 20, 'stdev:length', line, col); return currentVal(cached(env, `stdev:${seriesFingerprint(src)}:${len}`, () => rollingStdev(src, len)), env); }],
    ['highest', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'highest:length', line, col); return currentVal(cached(env, `highest:${seriesFingerprint(src)}:${len}`, () => rollingHighest(src, len)), env); }],
    ['lowest',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'lowest:length', line, col); return currentVal(cached(env, `lowest:${seriesFingerprint(src)}:${len}`, () => rollingLowest(src, len)), env); }],
    ['sum',     (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'sum:length', line, col); return currentVal(cached(env, `sum:${seriesFingerprint(src)}:${len}`, () => rollingSum(src, len)), env); }],
    ['avg',     (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'avg:length', line, col); return currentVal(cached(env, `avg:${seriesFingerprint(src)}:${len}`, () => rollingSum(src, len).map((s, i) => i < len - 1 ? NaN : s / len)), env); }],
    ['change',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1] ?? 1, 'change:length', line, col); return currentVal(cached(env, `change:${seriesFingerprint(src)}:${len}`, () => src.map((v, i) => i < len ? NaN : v - (src[i - len] ?? NaN))), env); }],
];
