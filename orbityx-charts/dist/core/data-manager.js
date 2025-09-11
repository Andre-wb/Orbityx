import api from '../services/api.js';
import { parseISO } from '../utils/date.js';
/**
 * Coerce a variety of incoming candle shapes into a unified RawCandle.
 * Accepts either object-shaped data with common aliases (o/h/l/c/v)
 * or array-shaped data in the order [t, o, h, l, c, v].
 */
function normalizeRaw(item) {
    // Timestamp may be provided as `timestamp`, `time`, `t`, or at index 0.
    const ts = item.timestamp ??
        item.time ??
        item.t ??
        (Array.isArray(item) ? item[0] : undefined);
    // Map price/volume fields from common aliases or array indices.
    const open = item.open ?? item.o ?? (Array.isArray(item) ? item[1] : undefined);
    const high = item.high ?? item.h ?? (Array.isArray(item) ? item[2] : undefined);
    const low = item.low ?? item.l ?? (Array.isArray(item) ? item[3] : undefined);
    const close = item.close ?? item.c ?? (Array.isArray(item) ? item[4] : undefined);
    const volume = item.volume ?? item.v ?? (Array.isArray(item) ? item[5] : undefined);
    return { timestamp: ts, open, high, low, close, volume };
}
/**
 * Adapter that calls the API and normalizes the response into RawCandle[].
 * Returns an empty array if the API payload isn't an array.
 */
async function fetchCandlesAdapted(symbol, interval) {
    const res = await api.fetchCandles(symbol, interval);
    // Guard against unexpected payloads (e.g., object with error/info).
    if (!Array.isArray(res))
        return [];
    return res.map(normalizeRaw);
}
/**
 * DataManager – fetches, normalizes, caches, and streams candle data.
 *
 * Responsibilities:
 *  - Load historical candles via REST-like API.
 *  - Maintain an in-memory cache sorted by timestamp.
 *  - Provide slices for rendering and immutable getters.
 *  - Push live updates from a WebSocket and notify subscribers.
 */
class DataManager {
    constructor() {
        /** In-memory cache of normalized candles (ascending by timestamp). */
        this._cache = [];
        /** Listeners interested in newly appended candles. */
        this._subscribers = [];
    }
    /**
     * Fetch historical candles and populate the cache.
     * Ensures numeric typing and consistent millisecond timestamps.
     */
    async loadCandles(symbol, interval) {
        const raw = await fetchCandlesAdapted(symbol, interval);
        // Normalize types: parse timestamp and coerce numeric fields.
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
        // Keep cache ordered for fast binary operations/slicing downstream.
        this._cache.sort((a, b) => a.timestamp - b.timestamp);
        return [...this._cache];
    }
    /**
     * Return a shallow copy of the full cache to preserve immutability.
     */
    getData() {
        return [...this._cache];
    }
    /**
     * Return a window of candles without mutating the underlying cache.
     */
    getSlice(start, count) {
        return this._cache.slice(start, start + count);
    }
    /**
     * Register a listener for live candle updates. Returns an unsubscribe fn.
     */
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    }
    /** Notify all subscribers about an appended candle. */
    _notify(candle) {
        for (const cb of this._subscribers)
            cb(candle);
    }
    /**
     * Attach a WebSocket providing live candles; each message is normalized and
     * appended to the cache, then subscribers are notified.
     */
    attachSocket(socket) {
        socket.addEventListener('message', (event) => {
            // Expect JSON-encoded candle messages from the server.
            const data = JSON.parse(event.data);
            const raw = normalizeRaw(data);
            // Convert raw fields to finalized Candle with numeric types.
            const candle = {
                timestamp: parseISO(raw.timestamp),
                open: Number(raw.open),
                high: Number(raw.high),
                low: Number(raw.low),
                close: Number(raw.close),
                volume: Number(raw.volume),
            };
            // Append without re-sorting; assumes stream is time-ordered.
            this._cache.push(candle);
            // Emit to listeners (e.g., chart engine) for real-time updates.
            this._notify(candle);
        });
    }
}
export default new DataManager();
//# sourceMappingURL=data-manager.js.map