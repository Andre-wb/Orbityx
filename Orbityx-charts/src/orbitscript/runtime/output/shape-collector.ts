import type { Candle } from '../../../types/index.js';
import type {
    PlotShapeOutput, PlotShapeStyle, PlotShapeLocation,
    PlotArrowOutput, PlotHistogramOutput,
} from '../../lang/types.js';

export function addPlotShape(
    title: string,
    shape: PlotShapeStyle,
    location: PlotShapeLocation,
    color: string,
    size: 'tiny' | 'small' | 'normal' | 'large',
    barIndex: number,
    plotShapes: PlotShapeOutput[],
): void {
    let entry = plotShapes.find(s => s.title === title);
    if (!entry) { entry = { type: 'plotshape', title, shape, location, color, size, barIndices: [] }; plotShapes.push(entry); }
    entry.barIndices.push(barIndex);
}

export function addPlotArrow(
    title: string,
    colorUp: string,
    colorDown: string,
    value: number,
    barIndex: number,
    candles: Candle[],
    plotArrows: PlotArrowOutput[],
): void {
    let entry = plotArrows.find(a => a.title === title);
    if (!entry) { entry = { type: 'plotarrow', title, colorUp, colorDown, points: [] }; plotArrows.push(entry); }
    const c = candles[barIndex];
    if (c) entry.points.push({ timestamp: c.timestamp, value });
}

export function addPlotHistogramBar(
    title: string,
    value: number,
    color: string,
    barIndex: number,
    candles: Candle[],
    plotHistograms: PlotHistogramOutput[],
): void {
    let entry = plotHistograms.find(h => h.title === title);
    if (!entry) { entry = { type: 'plothistogram', title, points: [] }; plotHistograms.push(entry); }
    const c = candles[barIndex];
    if (c) entry.points.push({ timestamp: c.timestamp, value, color });
}
