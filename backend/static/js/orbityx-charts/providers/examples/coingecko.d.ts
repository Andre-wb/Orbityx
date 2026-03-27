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
export interface CoinGeckoOptions {
    /** CoinGecko Pro API key (optional — omit to use the free public endpoint). */
    apiKey?: string;
    /** Quote currency. Default: 'usd'. */
    vsCurrency?: string;
}
export declare class CoinGeckoProvider implements DataProvider {
    private apiKey;
    private vs;
    constructor(opts?: CoinGeckoOptions);
    private get;
    fetchCandles(req: CandleRequest): Promise<RawCandle[]>;
    fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>>;
}
//# sourceMappingURL=coingecko.d.ts.map