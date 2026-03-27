const BASE = 'https://api.coingecko.com/api/v3';
const TF_DAYS = {
    '1m': 1, '5m': 1, '15m': 1, '30m': 1,
    '1h': 7, '4h': 30, '12h': 90,
    '1d': 365, '3d': 365, '1w': 730, '2w': 730,
    '1month': 365, '3month': 730, '6month': 1825, '1y': 3650,
};
export class CoinGeckoProvider {
    apiKey;
    vs;
    constructor(opts = {}) {
        this.apiKey = opts.apiKey;
        this.vs = opts.vsCurrency ?? 'usd';
    }
    async get(path) {
        const headers = this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {};
        const res = await fetch(`${BASE}${path}`, { headers });
        if (!res.ok)
            throw new Error(`CoinGecko ${res.status}: ${await res.text().catch(() => '')}`);
        return res.json();
    }
    async fetchCandles(req) {
        const days = TF_DAYS[req.timeframe] ?? 30;
        const rows = await this.get(`/coins/${encodeURIComponent(req.instrumentId)}/ohlc?vs_currency=${this.vs}&days=${days}`);
        return rows.map(([t, o, h, l, c]) => ({ timestamp: t, open: o, high: h, low: l, close: c, volume: 0 }));
    }
    async fetchMarketStats(instrumentId) {
        const data = await this.get(`/coins/markets?vs_currency=${this.vs}&ids=${encodeURIComponent(instrumentId)}&sparkline=false`);
        const m = data[0];
        if (!m)
            throw new Error(`CoinGecko: no market data for "${instrumentId}"`);
        return {
            high24h: m.high_24h[this.vs] ?? 0, low24h: m.low_24h[this.vs] ?? 0,
            volume24h: m.total_volume[this.vs] ?? 0, marketCap: m.market_cap[this.vs] ?? null,
            priceChange24h: m.price_change_24h, priceChangePct24h: m.price_change_percentage_24h,
        };
    }
}
//# sourceMappingURL=coingecko.js.map