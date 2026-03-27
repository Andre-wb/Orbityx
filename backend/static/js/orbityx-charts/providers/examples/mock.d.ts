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
export interface MockOptions {
    /** Add a simulated delay in ms (default 0). Useful for testing loading states. */
    delayMs?: number;
}
export declare class MockProvider implements DataProvider {
    private delay;
    constructor(opts?: MockOptions);
    fetchCandles(req: CandleRequest): Promise<Candle[]>;
    fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>>;
}
//# sourceMappingURL=mock.d.ts.map