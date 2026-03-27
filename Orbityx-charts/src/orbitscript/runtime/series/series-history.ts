import type { Candle } from '../../../types/index.js';
import type { OSValue } from '../../lang/types.js';
import { BUILTIN_SERIES } from './builtin-series.js';

export function recordBarValue(
    name: string,
    value: OSValue,
    barIndex: number,
    seriesHistory: Map<string, number[]>,
): void {
    if (typeof value !== 'number') return;
    let arr = seriesHistory.get(name);
    if (!arr) { arr = []; seriesHistory.set(name, arr); }
    arr[barIndex] = value;
}

export function getHistory(
    seriesName: string,
    offset: number,
    barIndex: number,
    candles: Candle[],
    seriesHistory: Map<string, number[]>,
    line = 0,
    col = 0,
): number {
    const idx = barIndex - offset;
    if (idx < 0) return NaN;
    if (BUILTIN_SERIES.has(seriesName)) {
        const c = candles[idx];
        if (!c) return NaN;
        switch (seriesName) {
            case 'open':   return c.open;
            case 'high':   return c.high;
            case 'low':    return c.low;
            case 'close':  return c.close;
            case 'volume': return c.volume;
            default:       return NaN;
        }
    }
    const arr = seriesHistory.get(seriesName);
    if (!arr) return NaN;
    return arr[idx] ?? NaN;
}
