import type { Candle } from '../../../types/index.js';
import type { OSValue } from '../../lang/types.js';
export declare function recordBarValue(name: string, value: OSValue, barIndex: number, seriesHistory: Map<string, number[]>): void;
export declare function getHistory(seriesName: string, offset: number, barIndex: number, candles: Candle[], seriesHistory: Map<string, number[]>, line?: number, col?: number): number;
//# sourceMappingURL=series-history.d.ts.map