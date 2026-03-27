import type { BgColorOutput } from '../../lang/types.js';

export function addBgColor(
    color: string,
    opacity: number,
    barIndex: number,
    bgColors: BgColorOutput[],
): void {
    let entry = bgColors.find(b => b.color === color);
    if (!entry) { entry = { type: 'bgcolor', color, opacity, barIndices: [] }; bgColors.push(entry); }
    entry.barIndices.push(barIndex);
}
