/**
 * @file providers/examples/generic-rest.ts
 * @description Generic REST provider template.
 *
 * Copy and adapt this file to connect Orbityx to any REST/JSON data source:
 * your own backend, a broker API, Alpha Vantage, Polygon.io, OANDA, etc.
 *
 * @example — adapt for your backend
 * export class MyBackendProvider extends GenericRestProvider {
 *   constructor() {
 *     super({
 *       candlesUrl: (id, tf) => `https://api.myapp.com/ohlcv/${id}?tf=${tf}&limit=500`,
 *       statsUrl:   (id)     => `https://api.myapp.com/stats/${id}`,
 *       mapCandle:  row => ({
 *         timestamp: row.time * 1000,
 *         open: row.o, high: row.h, low: row.l, close: row.c, volume: row.v,
 *       }),
 *       mapStats: s => ({
 *         high24h: s.h, low24h: s.l, volume24h: s.vol,
 *         marketCap: null, priceChange24h: s.chg, priceChangePct24h: s.chgPct,
 *       }),
 *     });
 *   }
 * }
 */
import type { DataProvider, CandleRequest, RawCandle, Candle, MarketStats } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration shape
// ─────────────────────────────────────────────────────────────────────────────

export interface GenericRestConfig {
    /**
     * Build the candle-fetch URL from instrument id + timeframe.
     * Must return a URL that responds with a JSON array.
     */
    candlesUrl: (instrumentId: string, timeframe: string) => string;

    /**
     * Build the market-stats URL from instrument id.
     * Omit to disable stats (legend will compute approximate values from candles).
     */
    statsUrl?: (instrumentId: string) => string;

    /**
     * Map a single row from your API response to a RawCandle or Candle.
     * Receive the raw JSON object as-is.
     *
     * @example
     * mapCandle: row => ({
     *   timestamp: row.openTime,  // epoch ms
     *   open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume,
     * })
     */
    mapCandle?: (row: unknown) => RawCandle | Candle;

    /**
     * Map your stats response to a Partial<MarketStats>.
     * Omit fields you don't have — the library falls back gracefully.
     */
    mapStats?: (stats: unknown) => Partial<MarketStats>;

    /**
     * Optional request headers (e.g. Authorization, API-Key).
     * When present, sent with every fetch. Omit the key entirely (don't set to
     * undefined) because exactOptionalPropertyTypes is enabled in tsconfig.
     */
    headers?: Record<string, string>;

    /**
     * If your API wraps the candle array in an envelope, provide the key path.
     * E.g. if response is { data: { candles: [...] } } use ['data', 'candles'].
     * Omit the key entirely when not needed.
     */
    candlesPath?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GenericRestProvider
// ─────────────────────────────────────────────────────────────────────────────

export class GenericRestProvider implements DataProvider {
    constructor(protected config: GenericRestConfig) {}

    async fetchCandles(req: CandleRequest): Promise<RawCandle[] | Candle[]> {
        const url = this.config.candlesUrl(req.instrumentId, req.timeframe);

        // FIX TS2769: with exactOptionalPropertyTypes, passing `headers: undefined`
        // is a type error. Build the RequestInit object only with keys that are
        // actually present so the property is absent (not undefined) when omitted.
        const init: RequestInit = this.config.headers
            ? { headers: this.config.headers }
            : {};

        const res = await fetch(url, init);

        if (!res.ok) {
            throw new Error(
                `[GenericRestProvider] fetchCandles failed: ${res.status} ${res.statusText}\n` +
                `URL: ${url}`,
            );
        }

        let json: unknown = await res.json();

        // Unwrap envelope if configured.
        if (this.config.candlesPath) {
            for (const key of this.config.candlesPath) {
                json = (json as Record<string, unknown>)[key];
            }
        }

        if (!Array.isArray(json)) {
            throw new Error(
                `[GenericRestProvider] Expected an array of candles but got: ${typeof json}\n` +
                `URL: ${url}`,
            );
        }

        if (this.config.mapCandle) {
            return (json as unknown[]).map(this.config.mapCandle);
        }

        // Pass through — DataManager's normaliser handles common field aliases.
        return json as RawCandle[];
    }

    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>> {
        if (!this.config.statsUrl) {
            throw new Error('[GenericRestProvider] statsUrl not configured.');
        }

        const url = this.config.statsUrl(instrumentId);

        // Same fix: don't include the headers key when the value would be undefined.
        const init: RequestInit = this.config.headers
            ? { headers: this.config.headers }
            : {};

        const res = await fetch(url, init);

        if (!res.ok) {
            throw new Error(`[GenericRestProvider] fetchMarketStats failed: ${res.status}\nURL: ${url}`);
        }

        const json: unknown = await res.json();

        if (this.config.mapStats) {
            return this.config.mapStats(json);
        }

        // Assume the response is already shaped like Partial<MarketStats>.
        return json as Partial<MarketStats>;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage examples (run-able code, not just comments)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alpha Vantage provider for US equities and FX.
 * Requires a free API key from https://www.alphavantage.co/
 *
 * Register instruments with id = stock ticker or FX pair, e.g.:
 *   { id: 'AAPL',    symbol: 'AAPL',    name: 'Apple Inc.',     icon: 'A',  iconColor: '#555' }
 *   { id: 'EUR/USD', symbol: 'EUR/USD', name: 'Euro/US Dollar', icon: '€', iconColor: '#003399' }
 */
export class AlphaVantageProvider extends GenericRestProvider {
    constructor(apiKey: string, options: { outputSize?: 'compact' | 'full' } = {}) {
        const size = options.outputSize ?? 'full';

        // FIX TS2379: with exactOptionalPropertyTypes, passing `candlesPath: undefined`
        // in an object literal is a type error — the key must be absent, not set to
        // undefined. We simply omit the property from the config object.
        super({
            // TIME_SERIES_DAILY for equities; FX_DAILY for forex pairs
            candlesUrl(id, _tf) {
                const isForex = id.includes('/');
                if (isForex) {
                    const [from, to] = id.split('/');
                    return (
                        `https://www.alphavantage.co/query?function=FX_DAILY` +
                        `&from_symbol=${from}&to_symbol=${to}&outputsize=${size}&apikey=${apiKey}`
                    );
                }
                return (
                    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
                    `&symbol=${id}&outputsize=${size}&apikey=${apiKey}`
                );
            },
            // `candlesPath` intentionally omitted — AlphaVantage's unusual envelope
            // is handled in the fetchCandles override below, not via a path array.
            mapCandle(row: unknown) {
                // This mapper is never actually called (fetchCandles is fully
                // overridden) but is required to satisfy GenericRestConfig's shape.
                const r = row as { date: string; open: string; high: string; low: string; close: string };
                return {
                    timestamp: new Date(r.date).getTime(),
                    open: parseFloat(r.open), high: parseFloat(r.high),
                    low:  parseFloat(r.low),  close: parseFloat(r.close),
                    volume: 0,
                };
            },
        });
    }

    // Override to un-nest Alpha Vantage's unusual response shape.
    override async fetchCandles(req: CandleRequest): Promise<RawCandle[]> {
        const url = this.config.candlesUrl(req.instrumentId, req.timeframe);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`AlphaVantage ${res.status}`);

        const json = await res.json() as Record<string, unknown>;

        // Key is e.g. "Time Series (Daily)" or "Time Series FX (Daily)"
        const seriesKey = Object.keys(json).find(k => k.startsWith('Time Series'));
        if (!seriesKey) {
            throw new Error(
                `AlphaVantage: unexpected response shape. Keys: ${Object.keys(json).join(', ')}`,
            );
        }

        const series = json[seriesKey] as Record<string, Record<string, string>>;

        return Object.entries(series).map(([date, vals]) => ({
            timestamp: new Date(date).getTime(),
            open:   parseFloat(vals['1. open']   ?? vals['1. open (USD)']   ?? '0'),
            high:   parseFloat(vals['2. high']   ?? vals['2. high (USD)']   ?? '0'),
            low:    parseFloat(vals['3. low']    ?? vals['3. low (USD)']    ?? '0'),
            close:  parseFloat(vals['4. close']  ?? vals['4. close (USD)']  ?? '0'),
            volume: parseFloat(vals['5. volume'] ?? '0'),
        }));
    }
}