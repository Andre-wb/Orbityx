import type { HLineOutput } from '../../lang/types.js';

export function addHLine(
    price: number,
    title: string,
    color: string,
    style: 'solid' | 'dashed' | 'dotted' = 'dashed',
    hlines: HLineOutput[],
): void {
    if (!hlines.find(h => h.price === price && h.title === title)) {
        hlines.push({ type: 'hline', price, title, color, style });
    }
}
