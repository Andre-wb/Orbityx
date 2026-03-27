export function addBgColor(color, opacity, barIndex, bgColors) {
    let entry = bgColors.find(b => b.color === color);
    if (!entry) {
        entry = { type: 'bgcolor', color, opacity, barIndices: [] };
        bgColors.push(entry);
    }
    entry.barIndices.push(barIndex);
}
//# sourceMappingURL=bgcolor-collector.js.map