import { BUILTIN_SERIES } from './builtin-series.js';
export function recordBarValue(name, value, barIndex, seriesHistory) {
    if (typeof value !== 'number')
        return;
    let arr = seriesHistory.get(name);
    if (!arr) {
        arr = [];
        seriesHistory.set(name, arr);
    }
    arr[barIndex] = value;
}
export function getHistory(seriesName, offset, barIndex, candles, seriesHistory, line = 0, col = 0) {
    const idx = barIndex - offset;
    if (idx < 0)
        return NaN;
    if (BUILTIN_SERIES.has(seriesName)) {
        const c = candles[idx];
        if (!c)
            return NaN;
        switch (seriesName) {
            case 'open': return c.open;
            case 'high': return c.high;
            case 'low': return c.low;
            case 'close': return c.close;
            case 'volume': return c.volume;
            default: return NaN;
        }
    }
    const arr = seriesHistory.get(seriesName);
    if (!arr)
        return NaN;
    return arr[idx] ?? NaN;
}
//# sourceMappingURL=series-history.js.map