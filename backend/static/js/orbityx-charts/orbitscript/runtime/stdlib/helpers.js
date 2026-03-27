import { hexToColor, colorToHex, isOSColor } from '../environment.js';
import { OrbitScriptError } from '../../lang/types.js';
export function asNum(v, name, line, col) {
    if (typeof v !== 'number')
        throw new OrbitScriptError(`'${name}' expects a number, got ${typeof v}`, line, col, 'runtime');
    return v;
}
export function asInt(v, name, line, col) {
    return Math.round(asNum(v, name, line, col));
}
export function asBool(v, name, line, col) {
    if (typeof v !== 'boolean')
        throw new OrbitScriptError(`'${name}' expects a bool, got ${typeof v}`, line, col, 'runtime');
    return v;
}
export function asStr(v, name, line, col) {
    if (typeof v !== 'string')
        throw new OrbitScriptError(`'${name}' expects a str, got ${typeof v}`, line, col, 'runtime');
    return v;
}
export function asColor(v, name, line, col) {
    if (typeof v === 'string')
        return hexToColor(v);
    if (v !== null && v !== undefined && isOSColor(v))
        return v;
    throw new OrbitScriptError(`'${name}' expects a color, got ${typeof v}`, line, col, 'runtime');
}
export function toHexStr(v, line, col) {
    if (typeof v === 'string')
        return v;
    if (v !== null && v !== undefined && isOSColor(v))
        return colorToHex(v);
    throw new OrbitScriptError(`Expected color value, got ${typeof v}`, line, col, 'runtime');
}
export function resolveSeriesArray(arg, argIndex, env, line, col) {
    if (Array.isArray(arg) && arg.every(v => typeof v === 'number'))
        return arg;
    if (typeof arg === 'number') {
        const len = env.getBuiltinSeriesArray('close').length;
        return new Array(len).fill(arg);
    }
    throw new OrbitScriptError(`Argument ${argIndex + 1} must be a series (open, close, high, low, volume, or a computed series)`, line, col, 'runtime');
}
/**
 * Fast fingerprint for a number series — used to make cache keys unique per source.
 * Uses length + first + middle + last values. O(1), collision-resistant enough for
 * distinct OHLCV series within a single script run.
 */
export function seriesFingerprint(arr) {
    const n = arr.length;
    if (n === 0)
        return 'empty';
    const mid = arr[n >> 1] ?? NaN;
    // Use \x01 separator to avoid "1:10" == "11:0" style collisions
    return `${n}\x01${arr[0]}\x01${mid}\x01${arr[n - 1]}`;
}
export function cached(env, cacheKey, compute) {
    let arr = env.seriesCache.get(cacheKey);
    if (!arr) {
        arr = compute();
        env.seriesCache.set(cacheKey, arr);
    }
    return arr;
}
export function currentVal(arr, env) {
    return arr[env.barIndex] ?? NaN;
}
export function rollingHighest(values, period) {
    const result = new Array(values.length).fill(NaN);
    for (let i = period - 1; i < values.length; i++) {
        let hi = -Infinity;
        for (let j = 0; j < period; j++) {
            if ((values[i - j] ?? NaN) > hi)
                hi = values[i - j];
        }
        result[i] = hi;
    }
    return result;
}
export function rollingLowest(values, period) {
    const result = new Array(values.length).fill(NaN);
    for (let i = period - 1; i < values.length; i++) {
        let lo = Infinity;
        for (let j = 0; j < period; j++) {
            if ((values[i - j] ?? NaN) < lo)
                lo = values[i - j];
        }
        result[i] = lo;
    }
    return result;
}
export function rollingStdev(values, period) {
    const result = new Array(values.length).fill(NaN);
    for (let i = period - 1; i < values.length; i++) {
        const slice = values.slice(i - period + 1, i + 1);
        const mean = slice.reduce((s, v) => s + v, 0) / period;
        const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
        result[i] = Math.sqrt(variance);
    }
    return result;
}
export function rollingSum(values, period) {
    const result = new Array(values.length).fill(NaN);
    for (let i = period - 1; i < values.length; i++) {
        let s = 0;
        for (let j = 0; j < period; j++)
            s += values[i - j] ?? 0;
        result[i] = s;
    }
    return result;
}
//# sourceMappingURL=helpers.js.map