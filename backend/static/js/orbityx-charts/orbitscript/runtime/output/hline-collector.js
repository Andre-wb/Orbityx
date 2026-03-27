export function addHLine(price, title, color, style = 'dashed', hlines) {
    if (!hlines.find(h => h.price === price && h.title === title)) {
        hlines.push({ type: 'hline', price, title, color, style });
    }
}
//# sourceMappingURL=hline-collector.js.map