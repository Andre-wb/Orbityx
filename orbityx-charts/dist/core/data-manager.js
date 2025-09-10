import api from '../services/api.js';
import { parseISO } from '../utils/date.js';
function normalizeRaw(item) {
    const ts = item.timestamp ??
        item.time ??
        item.t ??
        (Array.isArray(item) ? item[0] : undefined);
    const open = item.open ?? item.o ?? (Array.isArray(item) ? item[1] : undefined);
    const high = item.high ?? item.h ?? (Array.isArray(item) ? item[2] : undefined);
    const low = item.low ?? item.l ?? (Array.isArray(item) ? item[3] : undefined);
    const close = item.close ?? item.c ?? (Array.isArray(item) ? item[4] : undefined);
    const volume = item.volume ?? item.v ?? (Array.isArray(item) ? item[5] : undefined);
    return { timestamp: ts, open, high, low, close, volume };
}
async function fetchCandlesAdapted(symbol, interval) {
    const res = await api.fetchCandles(symbol, interval);
    if (!Array.isArray(res))
        return [];
    return res.map(normalizeRaw);
}
class DataManager {
    constructor() {
        this._cache = [];
        this._subscribers = [];
    }
    async loadCandles(symbol, interval) {
        const raw = await fetchCandlesAdapted(symbol, interval);
        this._cache = raw
            .map((item) => ({
            timestamp: parseISO(item.timestamp),
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume),
        }))
            .filter(c => Number.isFinite(c.timestamp));
        this._cache.sort((a, b) => a.timestamp - b.timestamp);
        return [...this._cache];
    }
    getData() {
        return [...this._cache];
    }
    getSlice(start, count) {
        return this._cache.slice(start, start + count);
    }
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    }
    _notify(candle) {
        for (const cb of this._subscribers)
            cb(candle);
    }
    attachSocket(socket) {
        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            const raw = normalizeRaw(data);
            const candle = {
                timestamp: parseISO(raw.timestamp),
                open: Number(raw.open),
                high: Number(raw.high),
                low: Number(raw.low),
                close: Number(raw.close),
                volume: Number(raw.volume),
            };
            this._cache.push(candle);
            this._notify(candle);
        });
    }
}
export default new DataManager();
