import api from '../services/api.js';
import { parseISO } from '../utils/date.js';

/**
 * Normalized OHLCV candle used throughout the app.
 * @property {number} timestamp - UNIX epoch in milliseconds.
 * @property {number} open - Opening price.
 * @property {number} high - Highest price of the interval.
 * @property {number} low - Lowest price of the interval.
 * @property {number} close - Closing price.
 * @property {number} volume - Traded volume.
 */
export type Candle = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

/**
 * Raw candle shape as it may arrive from various APIs or sockets.
 * Strings or numbers are accepted; timestamps can be ISO, epoch, or Date.
 */
type RawCandle = {
    timestamp: string | number | Date;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
};

/**
 * Callback invoked when a new candle is appended to the stream.
 */
type Subscriber = (candle: Candle) => void;

/**
 * Minimal API contract the DataManager expects from `../services/api`.
 */
type ApiLike = {
    fetchCandles(symbol: string, interval: string): Promise<any>;
    fetchMarketChart?: (symbol: string, days?: number) => Promise<any>;
};

/**
 * Coerce a variety of incoming candle shapes into a unified RawCandle.
 * Accepts either object-shaped data with common aliases (o/h/l/c/v)
 * or array-shaped data in the order [t, o, h, l, c, v].
 */
function normalizeRaw(item: any): RawCandle {
    // Timestamp may be provided as `timestamp`, `time`, `t`, or at index 0.
    const ts =
        item.timestamp ??
        item.time ??
        item.t ??
        (Array.isArray(item) ? item[0] : undefined);

    // Map price/volume fields from common aliases or array indices.
    const open =
        item.open ?? item.o ?? (Array.isArray(item) ? item[1] : undefined);
    const high =
        item.high ?? item.h ?? (Array.isArray(item) ? item[2] : undefined);
    const low =
        item.low ?? item.l ?? (Array.isArray(item) ? item[3] : undefined);
    const close =
        item.close ?? item.c ?? (Array.isArray(item) ? item[4] : undefined);
    const volume =
        item.volume ?? item.v ?? (Array.isArray(item) ? item[5] : undefined);

    return { timestamp: ts, open, high, low, close, volume };
}

/**
 * Adapter that calls the API and normalizes the response into RawCandle[].
 * Returns an empty array if the API payload isn't an array.
 */
async function fetchCandlesAdapted(symbol: string, interval: string): Promise<RawCandle[]> {
    const res = await (api as ApiLike).fetchCandles(symbol, interval);
    // Guard against unexpected payloads (e.g., object with error/info).
    if (!Array.isArray(res)) return [];
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
    /** In-memory cache of normalized candles (ascending by timestamp). */
    private _cache: Candle[] = [];

    /** Listeners interested in newly appended candles. */
    private _subscribers: Subscriber[] = [];

    /**
     * Fetch historical candles and populate the cache.
     * Ensures numeric typing and consistent millisecond timestamps.
     */
    async loadCandles(symbol: string, interval: string): Promise<Candle[]> {
        const raw = await fetchCandlesAdapted(symbol, interval);

        // Normalize types: parse timestamp and coerce numeric fields.
        this._cache = raw
            .map((item): Candle => ({
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
    getData(): Candle[] {
        return [...this._cache];
    }

    /**
     * Return a window of candles without mutating the underlying cache.
     */
    getSlice(start: number, count: number): Candle[] {
        return this._cache.slice(start, start + count);
    }

    /**
     * Register a listener for live candle updates. Returns an unsubscribe fn.
     */
    subscribe(callback: Subscriber): () => void {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    }

    /** Notify all subscribers about an appended candle. */
    private _notify(candle: Candle): void {
        for (const cb of this._subscribers) cb(candle);
    }

    /**
     * Attach a WebSocket providing live candles; each message is normalized and
     * appended to the cache, then subscribers are notified.
     */
    attachSocket(socket: WebSocket): void {
        socket.addEventListener('message', (event: MessageEvent<string>) => {
            // Expect JSON-encoded candle messages from the server.
            const data = JSON.parse(event.data) as any;
            const raw = normalizeRaw(data);
            // Convert raw fields to finalized Candle with numeric types.
            const candle: Candle = {
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