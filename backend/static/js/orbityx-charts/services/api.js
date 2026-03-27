// ─────────────────────────────────────────────────────────────────────────────
// Null provider — active until the user calls setProvider()
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rejects every request with a clear error so missing-provider bugs
 * are loud and obvious instead of producing empty charts silently.
 */
const NULL_PROVIDER = {
    fetchCandles() {
        return Promise.reject(new Error('[Orbityx] No DataProvider registered.\n' +
            'Call chart.setProvider(myProvider) before loading data.\n' +
            'See /providers/examples/ for ready-made adapters.'));
    },
};
// ─────────────────────────────────────────────────────────────────────────────
// ProviderRegistry
// ─────────────────────────────────────────────────────────────────────────────
class ProviderRegistry {
    _provider = NULL_PROVIDER;
    _instruments = new Map();
    _initialized = false;
    // ── Provider management ─────────────────────────────────────────────────
    /**
     * Register the DataProvider that supplies OHLCV candles.
     * Replaces and tears down any previously registered provider.
     *
     * @example
     * registry.setProvider(new BinanceProvider());
     * registry.setProvider(new MyGraphQLProvider({ endpoint: '…' }));
     */
    setProvider(provider) {
        if (this._initialized) {
            this._provider.destroy?.();
            this._initialized = false;
        }
        this._provider = provider;
    }
    /** Initialize the active provider (calls provider.init() when present). */
    async ensureInitialized() {
        if (this._initialized)
            return;
        await this._provider.init?.();
        this._initialized = true;
    }
    get provider() {
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
    registerInstrument(instrument) {
        if (!instrument.id || !instrument.symbol) {
            throw new Error('[Orbityx] registerInstrument() requires at least `id` and `symbol`.');
        }
        this._instruments.set(instrument.id, {
            icon: instrument.symbol[0] ?? '?',
            iconColor: '#888',
            pricePrecision: 2,
            ...instrument,
        });
    }
    /** Register multiple instruments at once. */
    registerInstruments(instruments) {
        for (const i of instruments)
            this.registerInstrument(i);
    }
    /** Remove an instrument by id. */
    unregisterInstrument(id) {
        this._instruments.delete(id);
    }
    /** Look up a registered instrument. Returns undefined when not found. */
    getInstrument(id) {
        return this._instruments.get(id);
    }
    /** All registered instruments in insertion order. */
    getAllInstruments() {
        return Array.from(this._instruments.values());
    }
    get instrumentCount() {
        return this._instruments.size;
    }
    // ── Delegating fetches ──────────────────────────────────────────────────
    /**
     * Fetch candles via the registered provider.
     * Validates the instrument id and throws if it was not registered.
     */
    async fetchCandles(request) {
        await this.ensureInitialized();
        if (!this._instruments.has(request.instrumentId)) {
            throw new Error(`[Orbityx] Instrument "${request.instrumentId}" is not registered.\n` +
                `Call registry.registerInstrument({ id: '${request.instrumentId}', … }) first.`);
        }
        return this._provider.fetchCandles(request);
    }
    /**
     * Fetch market statistics via the registered provider.
     * Returns null when the provider does not implement fetchMarketStats().
     */
    async fetchMarketStats(instrumentId) {
        await this.ensureInitialized();
        if (!this._provider.fetchMarketStats)
            return null;
        return this._provider.fetchMarketStats(instrumentId);
    }
    /** Notify the provider of an instrument / timeframe change. */
    notifyInstrumentChange(instrumentId, timeframe) {
        this._provider.onInstrumentChange?.(instrumentId, timeframe);
    }
    /** Tear down the provider and clear all state. */
    destroy() {
        this._provider.destroy?.();
        this._initialized = false;
        this._provider = NULL_PROVIDER;
    }
}
/** Singleton used by all library modules. */
export const registry = new ProviderRegistry();
// Default export for convenience.
export default registry;
// Re-export the class so power users can create isolated instances
// (e.g. two independent charts on the same page each with their own provider).
export { ProviderRegistry };
//# sourceMappingURL=api.js.map