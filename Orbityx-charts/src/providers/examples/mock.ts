/**
 * @file providers/examples/mock.ts
 * @description In-memory mock provider for testing, demos, and offline development.
 *
 * Generates realistic OHLCV data using a random walk. No network calls.
 *
 * @example
 * import { MockProvider } from './providers/examples/mock.js';
 *
 * chart
 *   .setProvider(new MockProvider())
 *   .registerInstruments([
 *     { id: 'DEMO_BTC', symbol: 'BTC/USDT', name: 'Demo Bitcoin', icon: '₿', iconColor: '#f7931a' },
 *     { id: 'DEMO_ETH', symbol: 'ETH/USDT', name: 'Demo Ethereum',icon: 'Ξ', iconColor: '#627eea' },
 *   ]);
 * await chart.init();
 */
import type { DataProvider, CandleRequest, Candle, MarketStats } from '../../types/index.js';

const SEED_PRICES: Record<string, number> = {
    DEMO_BTC: 65_000,
    DEMO_ETH:  3_400,
    DEMO_SOL:    145,
};
const DEFAULT_PRICE = 1_000;

const TF_MS: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '1h': 3_600_000, '4h': 14_400_000, '12h': 43_200_000,
    '1d': 86_400_000, '3d': 259_200_000, '1w': 604_800_000,
    '1month': 2_592_000_000,
};

const TF_COUNT: Record<string, number> = {
    '1m': 500, '5m': 500, '15m': 400, '30m': 300,
    '1h': 500, '4h': 400, '12h': 365,
    '1d': 500, '3d': 365, '1w': 200,
    '1month': 60,
};

function randomWalk(
    count: number,
    startPrice: number,
    periodMs: number,
): Candle[] {
    const candles: Candle[] = [];
    const now    = Date.now();
    let price    = startPrice;
    let ts       = now - count * periodMs;

    for (let i = 0; i < count; i++) {
        const volatility = price * 0.012;
        const open  = price;
        const close = open + (Math.random() - 0.495) * volatility;
        const high  = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low   = Math.min(open, close) - Math.random() * volatility * 0.5;
        const vol   = startPrice * (50 + Math.random() * 150);

        candles.push({ timestamp: ts, open, high, low, close: Math.max(close, 0.0001), volume: vol });
        price = close > 0 ? close : open;
        ts   += periodMs;
    }
    return candles;
}

export interface MockOptions {
    /** Add a simulated delay in ms (default 0). Useful for testing loading states. */
    delayMs?: number;
}

export class MockProvider implements DataProvider {
    private delay: number;
    constructor(opts: MockOptions = {}) { this.delay = opts.delayMs ?? 0; }

    async fetchCandles(req: CandleRequest): Promise<Candle[]> {
        if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay));
        const seed  = SEED_PRICES[req.instrumentId] ?? DEFAULT_PRICE;
        const ms    = TF_MS[req.timeframe]    ?? 86_400_000;
        const count = TF_COUNT[req.timeframe] ?? 200;
        return randomWalk(count, seed, ms);
    }

    async fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>> {
        const seed  = SEED_PRICES[instrumentId] ?? DEFAULT_PRICE;
        const delta = seed * (Math.random() * 0.08 - 0.04);
        return {
            high24h: seed * 1.04, low24h: seed * 0.96,
            volume24h: seed * 1_000, marketCap: seed * 19_000_000,
            priceChange24h: delta, priceChangePct24h: (delta / seed) * 100,
        };
    }
}