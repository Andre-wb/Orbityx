import type { DataProvider, CandleRequest, Candle, MarketStats } from '../../types/index.js';

export class FastAPIProvider implements DataProvider {
    private baseUrl: string;

    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    async fetchCandles(req: CandleRequest): Promise<Candle[]> {
        const params = new URLSearchParams({
            symbol: req.instrumentId,
            timeframe: req.timeframe,
            limit: String(req.limit ?? 500),
        });

        if (req.to !== undefined) {
            params.set('to', String(req.to));
        }

        const res = await fetch(`${this.baseUrl}/api/candles?${params}`);
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
        return res.json();
    }

    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>> {
        const coinMap: Record<string, string> = {
            'BTC/USDT': 'bitcoin',
            'ETH/USDT': 'ethereum',
            'SOL/USDT': 'solana',
            'BNB/USDT': 'binancecoin',
        };
        const coinId = coinMap[instrumentId] ?? instrumentId.toLowerCase();
        const res = await fetch(`${this.baseUrl}/api/market/stats/${coinId}`);
        if (!res.ok) return {};
        const data = await res.json();
        return {
            high24h: data.high_24h,
            low24h: data.low_24h,
            volume24h: data.volume_24h,
            marketCap: data.market_cap,
            priceChange24h: data.price_change_24h,
            priceChangePct24h: data.price_change_24h,
        };
    }
}