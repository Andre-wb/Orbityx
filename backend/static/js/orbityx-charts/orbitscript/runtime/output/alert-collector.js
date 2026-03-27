export function addAlert(title, message, barIndex, alerts) {
    let entry = alerts.find(a => a.title === title);
    if (!entry) {
        entry = { type: 'alert', title, message, barIndices: [] };
        alerts.push(entry);
    }
    entry.barIndices.push(barIndex);
}
//# sourceMappingURL=alert-collector.js.map