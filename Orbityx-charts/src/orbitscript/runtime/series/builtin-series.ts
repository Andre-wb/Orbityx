import type { Candle } from '../../../types/index.js';

export const BUILTIN_SERIES = new Set([
    'open', 'high', 'low', 'close', 'volume', 'bar_index', 'timestamp',
]);

export function getBuiltinSeries(name: string, candles: Candle[], barIndex: number): number {
    const c = candles[barIndex];
    if (!c) return NaN;
    switch (name) {
        case 'open':      return c.open;
        case 'high':      return c.high;
        case 'low':       return c.low;
        case 'close':     return c.close;
        case 'volume':    return c.volume;
        case 'bar_index': return barIndex;
        case 'timestamp': return c.timestamp;
        default: return NaN;
    }
}

export function getBuiltinSeriesArray(name: string, candles: Candle[]): number[] {
    switch (name) {
        case 'open':   return candles.map(c => c.open);
        case 'high':   return candles.map(c => c.high);
        case 'low':    return candles.map(c => c.low);
        case 'close':  return candles.map(c => c.close);
        case 'volume': return candles.map(c => c.volume);
        default:       return [];
    }
}
