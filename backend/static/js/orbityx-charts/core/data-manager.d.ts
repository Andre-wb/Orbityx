/**
 * @file core/data-manager.ts
 * @description In-memory OHLCV cache with loading, live-tick streaming, and pub/sub.
 *
 * DataManager never fetches data on its own. It delegates every load request
 * to the ProviderRegistry, which in turn calls the user's DataProvider.
 * This keeps all exchange/source-specific logic outside the library core.
 *
 * Changes vs original:
 *  - prependCandles() added: fetches a page of candles older than a given
 *    timestamp and merges them into the front of the cache. Used by
 *    OrbityxChart.loadMoreHistory() for seamless infinite-scroll backwards.
 */
import type { Candle, MarketStats, ICandleFetcher } from '../types/index.js';
type CandleCallback = (candles: Candle[]) => void;
declare class DataManager {
    /** Candles sorted ascending by timestamp. */
    private cache;
    private subscribers;
    private maxCacheSize;
    /** Injected data fetcher (DIP — depends on abstraction, not registry singleton). */
    private fetcher;
    /** Currently active instrument id (informational, for UI modules). */
    currentInstrumentId: string;
    /** Currently active timeframe (informational, for UI modules). */
    currentTimeframe: string;
    constructor(fetcher?: ICandleFetcher);
    /** Replace the data fetcher (useful for testing or multi-instance setups). */
    setFetcher(fetcher: ICandleFetcher): void;
    setMaxCacheSize(size: number): void;
    /**
     * Full load — replaces the entire cache with fresh data from the provider.
     * Sorts ascending and notifies all subscribers.
     */
    loadCandles(instrumentId: string, timeframe: string): Promise<Candle[]>;
    /**
     * Lazy history load — fetches one page of candles that are strictly older
     * than `endTime` and prepends them to the existing cache.
     *
     * Called by OrbityxChart.loadMoreHistory() when the user scrolls to the
     * left edge of the chart. The provider receives `req.to = endTime` so it
     * knows to fetch a single backwards page rather than the full initial load.
     *
     * Returns the number of new candles added (0 = no more history available).
     */
    prependCandles(instrumentId: string, timeframe: string, endTime: number): Promise<number>;
    getData(): Candle[];
    getSlice(start: number, n: number): Candle[];
    get length(): number;
    /**
     * Push a live tick into the cache.
     * If the tick's timestamp matches the last candle, the candle is updated
     * in-place (same period). Otherwise the tick is appended as a new candle.
     *
     * @example
     * mySocket.onmessage = ev => dataManager.processLiveTick(JSON.parse(ev.data));
     */
    processLiveTick(raw: unknown): void;
    /**
     * Attach a native WebSocket and automatically pipe messages to processLiveTick.
     * Returns a detach function.
     *
     * For custom message formats write your own handler and call
     * processLiveTick() directly — no need to use attachSocket().
     */
    attachSocket(socket: WebSocket): () => void;
    /** Clear all cached candles and notify subscribers. */
    clear(): void;
    private trimCache;
    /** Subscribe to cache changes. Returns an unsubscribe function. */
    subscribe(callback: CandleCallback): () => void;
    private notify;
    /**
     * Approximate 24-hour market statistics derived from cached candles.
     * Used as a fallback when the DataProvider omits fetchMarketStats().
     */
    computeStats(): MarketStats;
}
declare const _default: DataManager;
export default _default;
//# sourceMappingURL=data-manager.d.ts.map