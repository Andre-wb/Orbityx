/**
 * @file providers/examples/coingecko.ts
 * @description Optional CoinGecko v3 DataProvider adapter.
 *
 * This file is a ready-made example. The core library never imports it.
 *
 * @example
 * import OrbityxChart from '../../main.js';
 * import { CoinGeckoProvider } from './providers/examples/coingecko.js';
 *
 * const chart = new OrbityxChart();
 * chart
 *   .setProvider(new CoinGeckoProvider())        // optionally: new CoinGeckoProvider({ apiKey: 'CG-xxx' })
 *   .registerInstruments([
 *     // id = CoinGecko coin id  (see https://api.coingecko.com/api/v3/coins/list)
 *     { id: 'bitcoin',   symbol: 'BTC/USD', name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
 *     { id: 'ethereum',  symbol: 'ETH/USD', name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
 *     { id: 'the-graph', symbol: 'GRT/USD', name: 'The Graph',icon: 'G', iconColor: '#6f4cff' },
 *     // ← any of the 13 000+ coins on CoinGecko
 *   ]);
 * await chart.init();
 */
import type { DataProvider, CandleRequest, RawCandle, MarketStats } from '../../types/index.js';

const BASE = 'https://api.coingecko.com/api/v3';

const TF_DAYS: Record<string, number> = {
    '1m': 1, '5m': 1, '15m': 1, '30m': 1,
    '1h': 7, '4h': 30, '12h': 90,
    '1d': 365, '3d': 365, '1w': 730, '2w': 730,
    '1month': 365, '3month': 730, '6month': 1825, '1y': 3650,
};

export interface CoinGeckoOptions {
    /** CoinGecko Pro API key (optional — omit to use the free public endpoint). */
    apiKey?: string;
    /** Quote currency. Default: 'usd'. */
    vsCurrency?: string;
}

export class CoinGeckoProvider implements DataProvider {
    private apiKey: string | undefined;
    private vs:     string;

    constructor(opts: CoinGeckoOptions = {}) {
        this.apiKey = opts.apiKey;
        this.vs     = opts.vsCurrency ?? 'usd';
    }

    private async get<T>(path: string): Promise<T> {
        const headers: HeadersInit = this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {};
        const res = await fetch(`${BASE}${path}`, { headers });
        if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text().catch(() => '')}`);
        return res.json() as Promise<T>;
    }

    async fetchCandles(req: CandleRequest): Promise<RawCandle[]> {
        const days = TF_DAYS[req.timeframe] ?? 30;
        type Row = [number, number, number, number, number];
        const rows = await this.get<Row[]>(
            `/coins/${encodeURIComponent(req.instrumentId)}/ohlc?vs_currency=${this.vs}&days=${days}`,
        );
        return rows.map(([t, o, h, l, c]) => ({ timestamp: t, open: o, high: h, low: l, close: c, volume: 0 }));
    }

    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>> {
        type Row = {
            price_change_24h: number; price_change_percentage_24h: number;
            high_24h: Record<string,number>; low_24h: Record<string,number>;
            total_volume: Record<string,number>; market_cap: Record<string,number>;
        };
        const data = await this.get<Row[]>(
            `/coins/markets?vs_currency=${this.vs}&ids=${encodeURIComponent(instrumentId)}&sparkline=false`,
        );
        const m = data[0];
        if (!m) throw new Error(`CoinGecko: no market data for "${instrumentId}"`);
        return {
            high24h: m.high_24h[this.vs] ?? 0, low24h: m.low_24h[this.vs] ?? 0,
            volume24h: m.total_volume[this.vs] ?? 0, marketCap: m.market_cap[this.vs] ?? null,
            priceChange24h: m.price_change_24h, priceChangePct24h: m.price_change_percentage_24h,
        };
    }
}