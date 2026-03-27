import type { AlertOutput } from '../../lang/types.js';

export function addAlert(
    title: string,
    message: string,
    barIndex: number,
    alerts: AlertOutput[],
): void {
    let entry = alerts.find(a => a.title === title);
    if (!entry) { entry = { type: 'alert', title, message, barIndices: [] }; alerts.push(entry); }
    entry.barIndices.push(barIndex);
}
