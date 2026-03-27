export function addPlotPoint(seriesIndex, title, color, linewidth, style, value, plotBuilders, candles, barIndex) {
    let builder = plotBuilders.get(seriesIndex);
    if (!builder) {
        builder = { type: 'plot', seriesIndex, title, color, linewidth, style, points: [] };
        plotBuilders.set(seriesIndex, builder);
    }
    const c = candles[barIndex];
    if (c)
        builder.points.push({ timestamp: c.timestamp, value });
}
//# sourceMappingURL=plot-collector.js.map