// ─────────────────────────────────────────────────────────────────────────────
// GenericRestProvider
// ─────────────────────────────────────────────────────────────────────────────
export class GenericRestProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async fetchCandles(req) {
        const url = this.config.candlesUrl(req.instrumentId, req.timeframe);
        // FIX TS2769: with exactOptionalPropertyTypes, passing `headers: undefined`
        // is a type error. Build the RequestInit object only with keys that are
        // actually present so the property is absent (not undefined) when omitted.
        const init = this.config.headers
            ? { headers: this.config.headers }
            : {};
        const res = await fetch(url, init);
        if (!res.ok) {
            throw new Error(`[GenericRestProvider] fetchCandles failed: ${res.status} ${res.statusText}\n` +
                `URL: ${url}`);
        }
        let json = await res.json();
        // Unwrap envelope if configured.
        if (this.config.candlesPath) {
            for (const key of this.config.candlesPath) {
                json = json[key];
            }
        }
        if (!Array.isArray(json)) {
            throw new Error(`[GenericRestProvider] Expected an array of candles but got: ${typeof json}\n` +
                `URL: ${url}`);
        }
        if (this.config.mapCandle) {
            return json.map(this.config.mapCandle);
        }
        // Pass through — DataManager's normaliser handles common field aliases.
        return json;
    }
    async fetchMarketStats(instrumentId) {
        if (!this.config.statsUrl) {
            throw new Error('[GenericRestProvider] statsUrl not configured.');
        }
        const url = this.config.statsUrl(instrumentId);
        // Same fix: don't include the headers key when the value would be undefined.
        const init = this.config.headers
            ? { headers: this.config.headers }
            : {};
        const res = await fetch(url, init);
        if (!res.ok) {
            throw new Error(`[GenericRestProvider] fetchMarketStats failed: ${res.status}\nURL: ${url}`);
        }
        const json = await res.json();
        if (this.config.mapStats) {
            return this.config.mapStats(json);
        }
        // Assume the response is already shaped like Partial<MarketStats>.
        return json;
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
    constructor(apiKey, options = {}) {
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
                    return (`https://www.alphavantage.co/query?function=FX_DAILY` +
                        `&from_symbol=${from}&to_symbol=${to}&outputsize=${size}&apikey=${apiKey}`);
                }
                return (`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
                    `&symbol=${id}&outputsize=${size}&apikey=${apiKey}`);
            },
            // `candlesPath` intentionally omitted — AlphaVantage's unusual envelope
            // is handled in the fetchCandles override below, not via a path array.
            mapCandle(row) {
                // This mapper is never actually called (fetchCandles is fully
                // overridden) but is required to satisfy GenericRestConfig's shape.
                const r = row;
                return {
                    timestamp: new Date(r.date).getTime(),
                    open: parseFloat(r.open), high: parseFloat(r.high),
                    low: parseFloat(r.low), close: parseFloat(r.close),
                    volume: 0,
                };
            },
        });
    }
    // Override to un-nest Alpha Vantage's unusual response shape.
    async fetchCandles(req) {
        const url = this.config.candlesUrl(req.instrumentId, req.timeframe);
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`AlphaVantage ${res.status}`);
        const json = await res.json();
        // Key is e.g. "Time Series (Daily)" or "Time Series FX (Daily)"
        const seriesKey = Object.keys(json).find(k => k.startsWith('Time Series'));
        if (!seriesKey) {
            throw new Error(`AlphaVantage: unexpected response shape. Keys: ${Object.keys(json).join(', ')}`);
        }
        const series = json[seriesKey];
        return Object.entries(series).map(([date, vals]) => ({
            timestamp: new Date(date).getTime(),
            open: parseFloat(vals['1. open'] ?? vals['1. open (USD)'] ?? '0'),
            high: parseFloat(vals['2. high'] ?? vals['2. high (USD)'] ?? '0'),
            low: parseFloat(vals['3. low'] ?? vals['3. low (USD)'] ?? '0'),
            close: parseFloat(vals['4. close'] ?? vals['4. close (USD)'] ?? '0'),
            volume: parseFloat(vals['5. volume'] ?? '0'),
        }));
    }
}
//# sourceMappingURL=generic_rest.js.map