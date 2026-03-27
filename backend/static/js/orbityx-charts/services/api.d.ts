/**
 * @file services/api.ts
 * @description Provider Registry — the data-source abstraction layer.
 *
 * This module replaces all direct CoinGecko / Binance / backend calls.
 * The library NEVER fetches data on its own. Everything is delegated to
 * whatever DataProvider the user registers before calling chart.init().
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Your code                                                    │
 * │  ─────────────────────────────────────────────────────────  │
 * │  import { registry } from './services/api.js';               │
 * │                                                              │
 * │  registry.setProvider(new MyExchangeProvider());             │
 * │  registry.registerInstruments([                              │
 * │    { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin' },  │
 * │    { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum' }, │
 * │    // unlimited — any asset class, any exchange             │
 * │  ]);                                                         │
 * └──────────────────────────────────────────────────────────────┘
 *
 * See /providers/examples/ for ready-made adapters:
 *   coingecko.ts  — CoinGecko v3 REST (crypto, no key needed)
 *   binance.ts    — Binance Spot klines (crypto)
 *   generic-rest.ts — template for any REST/JSON API
 *
 * These examples are completely optional. The core never imports them.
 */
import type { DataProvider, Instrument, CandleRequest, RawCandle, Candle, MarketStats } from '../types/index.js';
declare class ProviderRegistry {
    private _provider;
    private _instruments;
    private _initialized;
    /**
     * Register the DataProvider that supplies OHLCV candles.
     * Replaces and tears down any previously registered provider.
     *
     * @example
     * registry.setProvider(new BinanceProvider());
     * registry.setProvider(new MyGraphQLProvider({ endpoint: '…' }));
     */
    setProvider(provider: DataProvider): void;
    /** Initialize the active provider (calls provider.init() when present). */
    ensureInitialized(): Promise<void>;
    get provider(): DataProvider;
    /**
     * Register one instrument.
     *
     * @example
     * registry.registerInstrument({
     *   id:        'eur_usd',
     *   symbol:    'EUR/USD',
     *   name:      'Euro / US Dollar',
     *   icon:      '€',
     *   iconColor: '#003399',
     *   pricePrecision: 5,
     * });
     */
    registerInstrument(instrument: Instrument): void;
    /** Register multiple instruments at once. */
    registerInstruments(instruments: Instrument[]): void;
    /** Remove an instrument by id. */
    unregisterInstrument(id: string): void;
    /** Look up a registered instrument. Returns undefined when not found. */
    getInstrument(id: string): Instrument | undefined;
    /** All registered instruments in insertion order. */
    getAllInstruments(): Instrument[];
    get instrumentCount(): number;
    /**
     * Fetch candles via the registered provider.
     * Validates the instrument id and throws if it was not registered.
     */
    fetchCandles(request: CandleRequest): Promise<RawCandle[] | Candle[]>;
    /**
     * Fetch market statistics via the registered provider.
     * Returns null when the provider does not implement fetchMarketStats().
     */
    fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats> | null>;
    /** Notify the provider of an instrument / timeframe change. */
    notifyInstrumentChange(instrumentId: string, timeframe: string): void;
    /** Tear down the provider and clear all state. */
    destroy(): void;
}
/** Singleton used by all library modules. */
export declare const registry: ProviderRegistry;
export default registry;
export { ProviderRegistry };
//# sourceMappingURL=api.d.ts.map