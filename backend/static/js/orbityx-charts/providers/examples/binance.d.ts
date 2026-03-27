/**
 * @file providers/examples/binance.ts
 * @description Binance Spot DataProvider adapter with multi-page history loading.
 *
 * Changes vs original:
 *  - TF_LIMIT raised to 1000 (Binance REST max per request)
 *  - fetchCandles() paginates backwards up to MAX_PAGES requests so the
 *    initial load delivers several thousand candles instead of a few hundred.
 *  - Pagination uses endTime offset to avoid duplicate candles at page seams.
 *
 * @example
 * import { BinanceProvider } from './providers/examples/binance.js';
 *
 * chart
 *   .setProvider(new BinanceProvider())
 *   .registerInstruments([
 *     { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
 *     { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
 *     { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana',   icon: '◎', iconColor: '#9945ff' },
 *   ]);
 */
import type { DataProvider, CandleRequest, RawCandle, MarketStats } from '../../types/index.js';
export interface BinanceOptions {
    /** Override base URL, e.g. Binance US: 'https://api.binance.us/api/v3'. */
    baseUrl?: string;
    /**
     * Hard cap on candles per single HTTP request (max 1000).
     * Affects both the initial load and each lazy-load page.
     */
    limit?: number;
    /** Request timeout in milliseconds (default 10 000). */
    timeout?: number;
}
export declare class BinanceProvider implements DataProvider {
    private base;
    private limit;
    private timeout;
    /**
     * Number of backwards pagination requests made during the initial load.
     * 3 pages × 1000 candles = 3 000 × 1m candles ≈ 50 hours of history.
     * Increase for deeper initial history at the cost of extra HTTP requests.
     */
    private readonly INITIAL_PAGES;
    constructor(opts?: BinanceOptions);
    /** Parse a raw Binance kline array into a normalised RawCandle object. */
    private parseRows;
    /** Fetch a single page of klines from Binance. */
    private fetchPage;
    /**
     * Fetch OHLCV candles from Binance klines endpoint.
     *
     * Initial load paginates backwards up to INITIAL_PAGES times so the chart
     * starts with a deep history without requiring the consumer to call this
     * multiple times.
     *
     * For ongoing lazy-loading (user scrolls to the left edge) the caller
     * supplies `req.to` which bypasses pagination and fetches exactly one page
     * of candles older than that timestamp — see DataManager.prependCandles().
     */
    fetchCandles(req: CandleRequest): Promise<RawCandle[]>;
    /**
     * Fetch 24-hour rolling statistics from the Binance ticker endpoint.
     * Maps Binance field names to the library's MarketStats interface.
     */
    fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>>;
}
//# sourceMappingURL=binance.d.ts.map