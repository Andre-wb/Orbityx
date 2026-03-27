import { sma, ema, wma, dema, tema, hma, vwma } from '../../../utils/math.js';
import type { StdlibFn } from './helpers.js';
import { asInt, asNum, resolveSeriesArray, cached, currentVal, seriesFingerprint } from './helpers.js';

function smmaCalc(values: readonly number[], period: number): number[] {
    const result: number[] = new Array(values.length).fill(NaN);
    if (values.length < period) return result;
    // Seed with SMA of first period bars
    let prev = 0;
    for (let i = 0; i < period; i++) prev += values[i]!;
    prev /= period;
    result[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
        prev = (prev * (period - 1) + values[i]!) / period;
        result[i] = prev;
    }
    return result;
}

function kamaCalc(values: readonly number[], period: number): number[] {
    const n = values.length;
    const result: number[] = new Array(n).fill(NaN);
    if (n < period + 1) return result;
    const fast_sc = 2 / 3;
    const slow_sc = 2 / 31;
    // Seed KAMA at first available value
    let prev = values[period]!;
    result[period] = prev;
    for (let i = period + 1; i < n; i++) {
        // Efficiency ratio
        const direction = Math.abs(values[i]! - values[i - period]!);
        let volatility = 0;
        for (let j = 0; j < period; j++) volatility += Math.abs(values[i - j]! - values[i - j - 1]!);
        const er = volatility === 0 ? 0 : direction / volatility;
        const sc = Math.pow(er * (fast_sc - slow_sc) + slow_sc, 2);
        prev = prev + sc * (values[i]! - prev);
        result[i] = prev;
    }
    return result;
}

function t3Calc(values: readonly number[], period: number, factor: number): number[] {
    // T3 = GD(GD(GD(src))) where GD(x) = EMA(x,p)*(1+f) - EMA(EMA(x,p),p)*f
    const e1 = ema(values, period);
    const e2 = ema(e1.map((v, i) => isNaN(v) ? 0 : v), period);
    const e3 = ema(e2.map((v, i) => isNaN(v) ? 0 : v), period);
    const e4 = ema(e3.map((v, i) => isNaN(v) ? 0 : v), period);
    const e5 = ema(e4.map((v, i) => isNaN(v) ? 0 : v), period);
    const e6 = ema(e5.map((v, i) => isNaN(v) ? 0 : v), period);
    const c1 = -(factor ** 3);
    const c2 = 3 * factor ** 2 + 3 * factor ** 3;
    const c3 = -6 * factor ** 2 - 3 * factor - 3 * factor ** 3;
    const c4 = 1 + 3 * factor + factor ** 3 + 3 * factor ** 2;
    return e1.map((_, i) => {
        if (isNaN(e6[i]!)) return NaN;
        return c1 * e6[i]! + c2 * e5[i]! + c3 * e4[i]! + c4 * e3[i]!;
    });
}

export const entries: Array<[string, StdlibFn]> = [
    ['sma',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'sma:length', line, col); return currentVal(cached(env, `sma:${seriesFingerprint(src)}:${len}`, () => sma(src, len)), env); }],
    ['ema',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'ema:length', line, col); return currentVal(cached(env, `ema:${seriesFingerprint(src)}:${len}`, () => ema(src, len)), env); }],
    ['wma',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'wma:length', line, col); return currentVal(cached(env, `wma:${seriesFingerprint(src)}:${len}`, () => wma(src, len)), env); }],
    ['dema', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'dema:length', line, col); return currentVal(cached(env, `dema:${seriesFingerprint(src)}:${len}`, () => dema(src, len)), env); }],
    ['tema', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'tema:length', line, col); return currentVal(cached(env, `tema:${seriesFingerprint(src)}:${len}`, () => tema(src, len)), env); }],
    ['hma',  (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'hma:length', line, col); return currentVal(cached(env, `hma:${seriesFingerprint(src)}:${len}`, () => hma(src, len)), env); }],
    ['vwma', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const vol = resolveSeriesArray(args[1], 1, env, line, col); const len = asInt(args[2], 'vwma:length', line, col); return currentVal(cached(env, `vwma:${seriesFingerprint(src)}:${seriesFingerprint(vol)}:${len}`, () => vwma(src, vol, len)), env); }],
    ['smma', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 'smma:length', line, col); return currentVal(cached(env, `smma:${seriesFingerprint(src)}:${len}`, () => smmaCalc(src, len)), env); }],
    ['kama', (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1] ?? 10, 'kama:length', line, col); return currentVal(cached(env, `kama:${seriesFingerprint(src)}:${len}`, () => kamaCalc(src, len)), env); }],
    ['t3',   (args, env, line, col) => { const src = resolveSeriesArray(args[0], 0, env, line, col); const len = asInt(args[1], 't3:length', line, col); const factor = typeof args[2] === 'number' ? asNum(args[2], 't3:factor', line, col) : 0.7; return currentVal(cached(env, `t3:${seriesFingerprint(src)}:${len}:${factor}`, () => t3Calc(src, len, factor)), env); }],
];
