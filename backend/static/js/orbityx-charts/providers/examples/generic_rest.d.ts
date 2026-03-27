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
export declare class GenericRestProvider implements DataProvider {
    protected config: GenericRestConfig;
    constructor(config: GenericRestConfig);
    fetchCandles(req: CandleRequest): Promise<RawCandle[] | Candle[]>;
    fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>>;
}
/**
 * Alpha Vantage provider for US equities and FX.
 * Requires a free API key from https://www.alphavantage.co/
 *
 * Register instruments with id = stock ticker or FX pair, e.g.:
 *   { id: 'AAPL',    symbol: 'AAPL',    name: 'Apple Inc.',     icon: 'A',  iconColor: '#555' }
 *   { id: 'EUR/USD', symbol: 'EUR/USD', name: 'Euro/US Dollar', icon: '€', iconColor: '#003399' }
 */
export declare class AlphaVantageProvider extends GenericRestProvider {
    constructor(apiKey: string, options?: {
        outputSize?: 'compact' | 'full';
    });
    fetchCandles(req: CandleRequest): Promise<RawCandle[]>;
}
//# sourceMappingURL=generic_rest.d.ts.map