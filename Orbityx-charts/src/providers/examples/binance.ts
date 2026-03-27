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

const BASE = 'https://api.binance.com/api/v3';

// Maps library timeframe keys → Binance kline interval strings.
const TF_INTERVAL: Record<string, string> = {
    '1m':  '1m',  '5m':  '5m',  '15m': '15m', '30m': '30m',
    '1h':  '1h',  '4h':  '4h',  '12h': '12h',
    '1d':  '1d',  '3d':  '3d',  '1w':  '1w',  '2w':  '1w',
    '1month': '1M', '3month': '1M', '6month': '1M', '1y': '1M',
};

// Candles fetched per page — 1000 is the Binance REST maximum.
const TF_LIMIT: Record<string, number> = {
    '1m':  1000, '5m':  1000, '15m': 1000, '30m': 1000,
    '1h':  1000, '4h':  1000, '12h': 1000,
    '1d':  1000, '3d':  1000, '1w':  500,
    '1month': 200, '3month': 200, '6month': 200, '1y': 200,
};

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

// Raw kline tuple as returned by GET /api/v3/klines.
type KLine = [number, string, string, string, string, string, ...unknown[]];

export class BinanceProvider implements DataProvider {
    private base:    string;
    private limit:   number | undefined;
    private timeout: number;

    /**
     * Number of backwards pagination requests made during the initial load.
     * 3 pages × 1000 candles = 3 000 × 1m candles ≈ 50 hours of history.
     * Increase for deeper initial history at the cost of extra HTTP requests.
     */
    private readonly INITIAL_PAGES = 3;

    constructor(opts: BinanceOptions = {}) {
        this.base    = (opts.baseUrl ?? BASE).replace(/\/$/, '');
        this.limit   = opts.limit;
        this.timeout = opts.timeout ?? 10_000;
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    /** Parse a raw Binance kline array into a normalised RawCandle object. */
    private parseRows(rows: KLine[]): RawCandle[] {
        return rows.map(([t, o, h, l, c, v]) => ({
            timestamp: t,
            open:      parseFloat(o as string),
            high:      parseFloat(h as string),
            low:       parseFloat(l as string),
            close:     parseFloat(c as string),
            volume:    parseFloat(v as string),
        }));
    }

    /** Fetch a single page of klines from Binance. */
    private async fetchPage(
        symbol:   string,
        interval: string,
        limit:    number,
        endTime?: number,
        startTime?: number,
    ): Promise<KLine[]> {
        let url = `${this.base}/klines?symbol=${encodeURIComponent(symbol)}`
            + `&interval=${interval}&limit=${limit}`;
        if (startTime !== undefined) url += `&startTime=${startTime}`;
        if (endTime   !== undefined) url += `&endTime=${endTime}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(this.timeout) });
        if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text().catch(() => '')}`);
        return res.json() as Promise<KLine[]>;
    }

    // ── DataProvider interface ─────────────────────────────────────────────────

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
    async fetchCandles(req: CandleRequest): Promise<RawCandle[]> {
        const interval = TF_INTERVAL[req.timeframe] ?? '1d';
        const limit    = Math.min(this.limit ?? TF_LIMIT[req.timeframe] ?? 200, 1000);

        // ── Single-page path (lazy history load from DataManager) ──
        // When req.to is provided we are fetching one page of older candles;
        // no further pagination needed.
        if (req.to !== undefined) {
            const rows = await this.fetchPage(
                req.instrumentId, interval, limit,
                req.to,
                req.from,
            );
            return this.parseRows(rows);
        }

        // ── Multi-page initial load ──
        // Fetch the most-recent page first, then paginate backwards.
        let rows = await this.fetchPage(req.instrumentId, interval, limit);
        const all: RawCandle[] = this.parseRows(rows);

        let page = 1;
        while (rows.length === limit && page < this.INITIAL_PAGES) {
            // Use the timestamp of the oldest received candle as the upper
            // boundary for the next (earlier) page.
            const firstRow = rows[0];
            if (!firstRow) break;
            const oldestTs = firstRow[0] as number;

            rows = await this.fetchPage(
                req.instrumentId, interval, limit,
                oldestTs - 1, // endTime just before the oldest candle we have
            );
            if (!rows.length) break;

            // Prepend older candles; the final array will be sorted ascending.
            all.unshift(...this.parseRows(rows));
            page++;
        }

        return all;
    }

    /**
     * Fetch 24-hour rolling statistics from the Binance ticker endpoint.
     * Maps Binance field names to the library's MarketStats interface.
     */
    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>> {
        type T24 = {
            priceChange: string;
            priceChangePercent: string;
            highPrice: string;
            lowPrice: string;
            quoteVolume: string;
        };

        const res = await fetch(
            `${this.base}/ticker/24hr?symbol=${encodeURIComponent(instrumentId)}`,
            { signal: AbortSignal.timeout(this.timeout) },
        );
        if (!res.ok) throw new Error(`Binance ticker ${res.status}`);

        const t = await res.json() as T24;
        return {
            high24h:           parseFloat(t.highPrice),
            low24h:            parseFloat(t.lowPrice),
            volume24h:         parseFloat(t.quoteVolume),
            marketCap:         null,
            priceChange24h:    parseFloat(t.priceChange),
            priceChangePct24h: parseFloat(t.priceChangePercent),
        };
    }
}