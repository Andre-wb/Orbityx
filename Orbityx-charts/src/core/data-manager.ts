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
import type { Candle, RawCandle, MarketStats, ICandleFetcher } from '../types/index.js';
import { parseISO } from '../utils/date.js';
import { registry } from '../services/api.js';

/**
 * Default fetcher — delegates to the ProviderRegistry singleton.
 * Can be overridden via DataManager.setFetcher() for testing or
 * when multiple independent DataManager instances are needed (DIP).
 */
const defaultFetcher: ICandleFetcher = {
    fetchCandles: (req) => registry.fetchCandles(req),
};

type CandleCallback = (candles: Candle[]) => void;

/** Maximum number of candles to keep in memory. Oldest entries are trimmed when exceeded. */
const MAX_CACHE_SIZE = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce any loose candle shape into a strict Candle.
 * Handles:
 *   - Array form:  [timestamp, open, high, low, close, volume?]
 *   - Object form: { timestamp|time|t, open|o, high|h, low|l, close|c, volume|v }
 */
function normalise(item: unknown): Candle {
    if (Array.isArray(item)) {
        const a = item as unknown[];
        return {
            timestamp: parseISO(a[0] as string | number),
            open:      Number(a[1]),
            high:      Number(a[2]),
            low:       Number(a[3]),
            close:     Number(a[4]),
            volume:    Number(a[5] ?? 0),
        };
    }

    const obj = item as Record<string, unknown>;
    return {
        timestamp: parseISO((obj['timestamp'] ?? obj['time'] ?? obj['t']) as string | number),
        open:      Number(obj['open']   ?? obj['o']),
        high:      Number(obj['high']   ?? obj['h']),
        low:       Number(obj['low']    ?? obj['l']),
        close:     Number(obj['close']  ?? obj['c']),
        volume:    Number(obj['volume'] ?? obj['v'] ?? 0),
    };
}

function isValid(c: Candle): boolean {
    return (
        Number.isFinite(c.timestamp) &&
        Number.isFinite(c.open)  &&
        Number.isFinite(c.high)  &&
        Number.isFinite(c.low)   &&
        Number.isFinite(c.close)
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataManager
// ─────────────────────────────────────────────────────────────────────────────

class DataManager {
    /** Candles sorted ascending by timestamp. */
    private cache: Candle[] = [];
    private subscribers: CandleCallback[] = [];
    private maxCacheSize: number = MAX_CACHE_SIZE;

    /** Injected data fetcher (DIP — depends on abstraction, not registry singleton). */
    private fetcher: ICandleFetcher;

    /** Currently active instrument id (informational, for UI modules). */
    currentInstrumentId = '';
    /** Currently active timeframe (informational, for UI modules). */
    currentTimeframe = '';

    constructor(fetcher: ICandleFetcher = defaultFetcher) {
        this.fetcher = fetcher;
    }

    /** Replace the data fetcher (useful for testing or multi-instance setups). */
    setFetcher(fetcher: ICandleFetcher): void {
        this.fetcher = fetcher;
    }

    setMaxCacheSize(size: number): void {
        this.maxCacheSize = Math.max(100, size);
    }

    // ── Loading ──────────────────────────────────────────────────────────────

    /**
     * Full load — replaces the entire cache with fresh data from the provider.
     * Sorts ascending and notifies all subscribers.
     */
    async loadCandles(instrumentId: string, timeframe: string): Promise<Candle[]> {
        this.currentInstrumentId = instrumentId;
        this.currentTimeframe    = timeframe;

        const raw = await this.fetcher.fetchCandles({ instrumentId, timeframe });

        this.cache = (raw as unknown[])
            .map(normalise)
            .filter(isValid)
            .sort((a, b) => a.timestamp - b.timestamp);

        this.trimCache();
        this.notify();
        return [...this.cache];
    }

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
    async prependCandles(
        instrumentId: string,
        timeframe:    string,
        endTime:      number,
    ): Promise<number> {
        const raw = await this.fetcher.fetchCandles({
            instrumentId,
            timeframe,
            to: endTime, // signal to the provider: single backwards page
        });

        // Normalise, validate, and exclude any timestamps already in the cache
        // (avoids duplicates at page seams).
        const oldest = this.cache[0]?.timestamp ?? Infinity;
        const older  = (raw as unknown[])
            .map(normalise)
            .filter(isValid)
            .filter(c => c.timestamp < oldest);

        if (!older.length) return 0;

        // Merge and keep sorted order. Using sort() is cheap here because the
        // two arrays are already individually sorted — one call is enough.
        this.cache = [...older, ...this.cache]
            .sort((a, b) => a.timestamp - b.timestamp);

        this.trimCache();
        this.notify();
        return older.length;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    getData(): Candle[]                          { return [...this.cache]; }
    getSlice(start: number, n: number): Candle[] { return this.cache.slice(start, start + n); }
    get length(): number                         { return this.cache.length; }

    // ── Live streaming ────────────────────────────────────────────────────────

    /**
     * Push a live tick into the cache.
     * If the tick's timestamp matches the last candle, the candle is updated
     * in-place (same period). Otherwise the tick is appended as a new candle.
     *
     * @example
     * mySocket.onmessage = ev => dataManager.processLiveTick(JSON.parse(ev.data));
     */
    processLiveTick(raw: unknown): void {
        const candle = normalise(raw);
        if (!isValid(candle)) return;

        const last = this.cache[this.cache.length - 1];
        if (last && last.timestamp === candle.timestamp) {
            last.high   = Math.max(last.high, candle.high);
            last.low    = Math.min(last.low,  candle.low);
            last.close  = candle.close;
            last.volume = candle.volume > 0 ? candle.volume : last.volume;
        } else {
            this.cache.push(candle);
        }
        this.trimCache();
        this.notify();
    }

    /**
     * Attach a native WebSocket and automatically pipe messages to processLiveTick.
     * Returns a detach function.
     *
     * For custom message formats write your own handler and call
     * processLiveTick() directly — no need to use attachSocket().
     */
    attachSocket(socket: WebSocket): () => void {
        const handler = (ev: MessageEvent<string>) => {
            try { this.processLiveTick(JSON.parse(ev.data) as unknown); }
            catch { /* non-JSON or non-candle frames are silently ignored */ }
        };
        socket.addEventListener('message', handler);
        return () => socket.removeEventListener('message', handler);
    }

    /** Clear all cached candles and notify subscribers. */
    clear(): void {
        this.cache = [];
        this.notify();
    }

    private trimCache(): void {
        if (this.cache.length > this.maxCacheSize) {
            this.cache = this.cache.slice(this.cache.length - this.maxCacheSize);
        }
    }

    // ── Pub/Sub ───────────────────────────────────────────────────────────────

    /** Subscribe to cache changes. Returns an unsubscribe function. */
    subscribe(callback: CandleCallback): () => void {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    private notify(): void {
        const snap = [...this.cache];
        this.subscribers.forEach(cb => cb(snap));
    }

    // ── Stats fallback ────────────────────────────────────────────────────────

    /**
     * Approximate 24-hour market statistics derived from cached candles.
     * Used as a fallback when the DataProvider omits fetchMarketStats().
     */
    computeStats(): MarketStats {
        const now   = Date.now();
        const since = now - 24 * 3_600_000;
        const slice = this.cache.filter(c => c.timestamp >= since);
        const src   = slice.length > 0 ? slice : this.cache.slice(-200);

        if (!src.length) {
            return {
                high24h: 0, low24h: 0, volume24h: 0, marketCap: null,
                priceChange24h: 0, priceChangePct24h: 0,
            };
        }

        const latest = this.cache[this.cache.length - 1]!;
        const first  = src[0]!;
        const high   = Math.max(...src.map(c => c.high));
        const low    = Math.min(...src.map(c => c.low));
        const vol    = src.reduce((s, c) => s + c.volume, 0);
        const chg    = latest.close - first.open;
        const chgPct = first.open !== 0 ? (chg / first.open) * 100 : 0;

        return {
            high24h: high, low24h: low, volume24h: vol,
            marketCap: null, priceChange24h: chg, priceChangePct24h: chgPct,
        };
    }
}

export default new DataManager();