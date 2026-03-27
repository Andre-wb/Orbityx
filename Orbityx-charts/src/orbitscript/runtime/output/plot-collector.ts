import type { Candle } from '../../../types/index.js';
import type { PlotOutput, PlotStyle } from '../../lang/types.js';

export function addPlotPoint(
    seriesIndex: number,
    title: string,
    color: string,
    linewidth: number,
    style: PlotStyle,
    value: number,
    plotBuilders: Map<number, PlotOutput>,
    candles: Candle[],
    barIndex: number,
): void {
    let builder = plotBuilders.get(seriesIndex);
    if (!builder) {
        builder = { type: 'plot', seriesIndex, title, color, linewidth, style, points: [] };
        plotBuilders.set(seriesIndex, builder);
    }
    const c = candles[barIndex];
    if (c) builder.points.push({ timestamp: c.timestamp, value });
}
