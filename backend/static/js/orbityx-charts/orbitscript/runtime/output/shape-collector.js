export function addPlotShape(title, shape, location, color, size, barIndex, plotShapes) {
    let entry = plotShapes.find(s => s.title === title);
    if (!entry) {
        entry = { type: 'plotshape', title, shape, location, color, size, barIndices: [] };
        plotShapes.push(entry);
    }
    entry.barIndices.push(barIndex);
}
export function addPlotArrow(title, colorUp, colorDown, value, barIndex, candles, plotArrows) {
    let entry = plotArrows.find(a => a.title === title);
    if (!entry) {
        entry = { type: 'plotarrow', title, colorUp, colorDown, points: [] };
        plotArrows.push(entry);
    }
    const c = candles[barIndex];
    if (c)
        entry.points.push({ timestamp: c.timestamp, value });
}
export function addPlotHistogramBar(title, value, color, barIndex, candles, plotHistograms) {
    let entry = plotHistograms.find(h => h.title === title);
    if (!entry) {
        entry = { type: 'plothistogram', title, points: [] };
        plotHistograms.push(entry);
    }
    const c = candles[barIndex];
    if (c)
        entry.points.push({ timestamp: c.timestamp, value, color });
}
//# sourceMappingURL=shape-collector.js.map