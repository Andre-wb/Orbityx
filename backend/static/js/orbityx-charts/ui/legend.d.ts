/**
 * @file ui/legend.ts
 * @description Market legend panel — live price, 24 h stats, instrument info.
 *
 * All instrument metadata comes from user-registered Instrument objects.
 * There is no hard-coded symbol list and no CoinGecko reference anywhere.
 * Market stats come from the DataProvider; the library falls back to
 * computing approximate stats from cached candles when unavailable.
 */
import type { MarketStats } from '../types/index.js';
/**
 * Initialise the legend for the given instrument id.
 * Subscribes to DataManager for live candle updates.
 * Returns an unsubscribe function — call it before switching instruments.
 */
export declare function initLegend(instrumentId: string): () => void;
/**
 * Push provider-supplied market stats into the legend.
 * Called by OrbityxChart after fetchMarketStats() resolves.
 */
export declare function applyMarketStats(stats: Partial<MarketStats>, instrumentId: string): void;
/**
 * Populate the instrument <select> element from the registry.
 * Called once during chart.init() after registerInstruments().
 */
export declare function populateSymbolSelector(selectEl: HTMLSelectElement): void;
//# sourceMappingURL=legend.d.ts.map