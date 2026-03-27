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
import type {
    DataProvider,
    Instrument,
    CandleRequest,
    RawCandle,
    Candle,
    MarketStats,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Null provider — active until the user calls setProvider()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rejects every request with a clear error so missing-provider bugs
 * are loud and obvious instead of producing empty charts silently.
 */
const NULL_PROVIDER: DataProvider = {
    fetchCandles(): Promise<never> {
        return Promise.reject(
            new Error(
                '[Orbityx] No DataProvider registered.\n' +
                'Call chart.setProvider(myProvider) before loading data.\n' +
                'See /providers/examples/ for ready-made adapters.',
            ),
        );
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ProviderRegistry
// ─────────────────────────────────────────────────────────────────────────────

class ProviderRegistry {
    private _provider:    DataProvider = NULL_PROVIDER;
    private _instruments: Map<string, Instrument> = new Map();
    private _initialized  = false;

    // ── Provider management ─────────────────────────────────────────────────

    /**
     * Register the DataProvider that supplies OHLCV candles.
     * Replaces and tears down any previously registered provider.
     *
     * @example
     * registry.setProvider(new BinanceProvider());
     * registry.setProvider(new MyGraphQLProvider({ endpoint: '…' }));
     */
    setProvider(provider: DataProvider): void {
        if (this._initialized) {
            this._provider.destroy?.();
            this._initialized = false;
        }
        this._provider = provider;
    }

    /** Initialize the active provider (calls provider.init() when present). */
    async ensureInitialized(): Promise<void> {
        if (this._initialized) return;
        await this._provider.init?.();
        this._initialized = true;
    }

    get provider(): DataProvider {
        return this._provider;
    }

    // ── Instrument registry ─────────────────────────────────────────────────

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
    registerInstrument(instrument: Instrument): void {
        if (!instrument.id || !instrument.symbol) {
            throw new Error(
                '[Orbityx] registerInstrument() requires at least `id` and `symbol`.',
            );
        }
        this._instruments.set(instrument.id, {
            icon:           instrument.symbol[0] ?? '?',
            iconColor:      '#888',
            pricePrecision: 2,
            ...instrument,
        });
    }

    /** Register multiple instruments at once. */
    registerInstruments(instruments: Instrument[]): void {
        for (const i of instruments) this.registerInstrument(i);
    }

    /** Remove an instrument by id. */
    unregisterInstrument(id: string): void {
        this._instruments.delete(id);
    }

    /** Look up a registered instrument. Returns undefined when not found. */
    getInstrument(id: string): Instrument | undefined {
        return this._instruments.get(id);
    }

    /** All registered instruments in insertion order. */
    getAllInstruments(): Instrument[] {
        return Array.from(this._instruments.values());
    }

    get instrumentCount(): number {
        return this._instruments.size;
    }

    // ── Delegating fetches ──────────────────────────────────────────────────

    /**
     * Fetch candles via the registered provider.
     * Validates the instrument id and throws if it was not registered.
     */
    async fetchCandles(request: CandleRequest): Promise<RawCandle[] | Candle[]> {
        await this.ensureInitialized();

        if (!this._instruments.has(request.instrumentId)) {
            throw new Error(
                `[Orbityx] Instrument "${request.instrumentId}" is not registered.\n` +
                `Call registry.registerInstrument({ id: '${request.instrumentId}', … }) first.`,
            );
        }
        return this._provider.fetchCandles(request);
    }

    /**
     * Fetch market statistics via the registered provider.
     * Returns null when the provider does not implement fetchMarketStats().
     */
    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats> | null> {
        await this.ensureInitialized();
        if (!this._provider.fetchMarketStats) return null;
        return this._provider.fetchMarketStats(instrumentId);
    }

    /** Notify the provider of an instrument / timeframe change. */
    notifyInstrumentChange(instrumentId: string, timeframe: string): void {
        this._provider.onInstrumentChange?.(instrumentId, timeframe);
    }

    /** Tear down the provider and clear all state. */
    destroy(): void {
        this._provider.destroy?.();
        this._initialized  = false;
        this._provider     = NULL_PROVIDER;
    }
}

/** Singleton used by all library modules. */
export const registry = new ProviderRegistry();

// Default export for convenience.
export default registry;

// Re-export the class so power users can create isolated instances
// (e.g. two independent charts on the same page each with their own provider).
export { ProviderRegistry };