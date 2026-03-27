import type { Candle } from '../../../types/index.js';
import type { PlotShapeOutput, PlotShapeStyle, PlotShapeLocation, PlotArrowOutput, PlotHistogramOutput } from '../../lang/types.js';
export declare function addPlotShape(title: string, shape: PlotShapeStyle, location: PlotShapeLocation, color: string, size: 'tiny' | 'small' | 'normal' | 'large', barIndex: number, plotShapes: PlotShapeOutput[]): void;
export declare function addPlotArrow(title: string, colorUp: string, colorDown: string, value: number, barIndex: number, candles: Candle[], plotArrows: PlotArrowOutput[]): void;
export declare function addPlotHistogramBar(title: string, value: number, color: string, barIndex: number, candles: Candle[], plotHistograms: PlotHistogramOutput[]): void;
//# sourceMappingURL=shape-collector.d.ts.map