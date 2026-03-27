import {
    atr as atrCalc,
    adx as adxCalc,
    bollingerBands,
    keltnerChannels,
    donchianChannels,
    parabolicSAR as psarCalc,
    ichimoku as ichimokuCalc,
} from '../../../utils/math.js';
import type { OSStruct } from '../../lang/types.js';
import type { StdlibFn } from './helpers.js';
import { asInt, resolveSeriesArray, cached, currentVal, seriesFingerprint } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['atr', (args, env, line, col) => {
        const h = resolveSeriesArray(args[0], 0, env, line, col);
        const l = resolveSeriesArray(args[1], 1, env, line, col);
        const c = resolveSeriesArray(args[2], 2, env, line, col);
        const p = asInt(args[3] ?? 14, 'atr:length', line, col);
        return currentVal(cached(env, `atr:${seriesFingerprint(h)}:${seriesFingerprint(l)}:${seriesFingerprint(c)}:${p}`, () => atrCalc(h, l, c, p)), env);
    }],
    ['adx', (args, env, line, col) => {
        const h = resolveSeriesArray(args[0], 0, env, line, col);
        const l = resolveSeriesArray(args[1], 1, env, line, col);
        const c = resolveSeriesArray(args[2], 2, env, line, col);
        const p = asInt(args[3] ?? 14, 'adx:length', line, col);
        const fp = `${seriesFingerprint(h)}:${seriesFingerprint(l)}:${seriesFingerprint(c)}`;
        const key = `adx:${fp}:${p}`;
        cached(env, key + ':adx', () => { const r = adxCalc(h, l, c, p); env.seriesCache.set(key + ':adx', r.adx); env.seriesCache.set(key + ':plusDI', r.plusDI); env.seriesCache.set(key + ':minusDI', r.minusDI); return r.adx; });
        const i = env.barIndex;
        return { __type: 'struct', __name: 'ADXResult', fields: { adx: (env.seriesCache.get(key + ':adx') ?? [])[i] ?? NaN, plus_di: (env.seriesCache.get(key + ':plusDI') ?? [])[i] ?? NaN, minus_di: (env.seriesCache.get(key + ':minusDI') ?? [])[i] ?? NaN } } as OSStruct;
    }],
    ['bollinger', (args, env, line, col) => {
        const src  = resolveSeriesArray(args[0], 0, env, line, col);
        const len  = asInt(args[1] ?? 20, 'bollinger:length', line, col);
        const mult = typeof args[2] === 'number' ? args[2] : 2.0;
        const key  = `bb:${seriesFingerprint(src)}:${len}:${mult}`;
        cached(env, key + ':u', () => { const r = bollingerBands(src, len, mult); env.seriesCache.set(key + ':u', r.upper); env.seriesCache.set(key + ':m', r.middle); env.seriesCache.set(key + ':l', r.lower); return r.upper; });
        const i = env.barIndex;
        return { __type: 'struct', __name: 'BandsResult', fields: { upper: (env.seriesCache.get(key + ':u') ?? [])[i] ?? NaN, middle: (env.seriesCache.get(key + ':m') ?? [])[i] ?? NaN, lower: (env.seriesCache.get(key + ':l') ?? [])[i] ?? NaN } } as OSStruct;
    }],
    ['keltner', (args, env, line, col) => {
        const h    = resolveSeriesArray(args[0], 0, env, line, col);
        const l    = resolveSeriesArray(args[1], 1, env, line, col);
        const c    = resolveSeriesArray(args[2], 2, env, line, col);
        const eLen = asInt(args[3] ?? 20, 'keltner:ema_len', line, col);
        const aLen = asInt(args[4] ?? 20, 'keltner:atr_len', line, col);
        const mult = typeof args[5] === 'number' ? args[5] : 1.5;
        const fp = `${seriesFingerprint(h)}:${seriesFingerprint(l)}:${seriesFingerprint(c)}`;
        const key  = `kc:${fp}:${eLen}:${aLen}:${mult}`;
        cached(env, key + ':u', () => { const r = keltnerChannels(h, l, c, eLen, aLen, mult); env.seriesCache.set(key + ':u', r.upper); env.seriesCache.set(key + ':m', r.middle); env.seriesCache.set(key + ':l', r.lower); return r.upper; });
        const i = env.barIndex;
        return { __type: 'struct', __name: 'BandsResult', fields: { upper: (env.seriesCache.get(key + ':u') ?? [])[i] ?? NaN, middle: (env.seriesCache.get(key + ':m') ?? [])[i] ?? NaN, lower: (env.seriesCache.get(key + ':l') ?? [])[i] ?? NaN } } as OSStruct;
    }],
    ['donchian', (args, env, line, col) => {
        const h   = resolveSeriesArray(args[0], 0, env, line, col);
        const l   = resolveSeriesArray(args[1], 1, env, line, col);
        const len = asInt(args[2] ?? 20, 'donchian:length', line, col);
        const fp = `${seriesFingerprint(h)}:${seriesFingerprint(l)}`;
        const key = `dc:${fp}:${len}`;
        cached(env, key + ':u', () => { const r = donchianChannels(h, l, len); env.seriesCache.set(key + ':u', r.upper); env.seriesCache.set(key + ':m', r.middle); env.seriesCache.set(key + ':l', r.lower); return r.upper; });
        const i = env.barIndex;
        return { __type: 'struct', __name: 'BandsResult', fields: { upper: (env.seriesCache.get(key + ':u') ?? [])[i] ?? NaN, middle: (env.seriesCache.get(key + ':m') ?? [])[i] ?? NaN, lower: (env.seriesCache.get(key + ':l') ?? [])[i] ?? NaN } } as OSStruct;
    }],
    ['parabolic_sar', (args, env, line, col) => {
        const h    = resolveSeriesArray(args[0], 0, env, line, col);
        const l    = resolveSeriesArray(args[1], 1, env, line, col);
        const step = typeof args[2] === 'number' ? args[2] : 0.02;
        const max  = typeof args[3] === 'number' ? args[3] : 0.2;
        return currentVal(cached(env, `psar:${seriesFingerprint(h)}:${seriesFingerprint(l)}:${step}:${max}`, () => psarCalc(h, l, step, max)), env);
    }],
    ['ichimoku', (args, env, line, col) => {
        const h  = resolveSeriesArray(args[0], 0, env, line, col);
        const l  = resolveSeriesArray(args[1], 1, env, line, col);
        const c  = resolveSeriesArray(args[2], 2, env, line, col);
        const tk = asInt(args[3] ?? 9,  'ichimoku:tenkan', line, col);
        const kj = asInt(args[4] ?? 26, 'ichimoku:kijun', line, col);
        const sb = asInt(args[5] ?? 52, 'ichimoku:senkou_b', line, col);
        const d  = asInt(args[6] ?? 26, 'ichimoku:displacement', line, col);
        const fpI = `${seriesFingerprint(h)}:${seriesFingerprint(l)}:${seriesFingerprint(c)}`;
        const key = `ichi:${fpI}:${tk}:${kj}:${sb}:${d}`;
        cached(env, key + ':tk', () => { const r = ichimokuCalc(h, l, c, tk, kj, sb, d); env.seriesCache.set(key + ':tk', r.tenkan); env.seriesCache.set(key + ':kj', r.kijun); env.seriesCache.set(key + ':sa', r.senkouA); env.seriesCache.set(key + ':sb2', r.senkouB); env.seriesCache.set(key + ':ck', r.chikou); return r.tenkan; });
        const i = env.barIndex;
        const g = (k: string) => (env.seriesCache.get(k) ?? [])[i] ?? NaN;
        return { __type: 'struct', __name: 'IchimokuResult', fields: { tenkan: g(key + ':tk'), kijun: g(key + ':kj'), senkou_a: g(key + ':sa'), senkou_b: g(key + ':sb2'), chikou: g(key + ':ck') } } as OSStruct;
    }],
];
