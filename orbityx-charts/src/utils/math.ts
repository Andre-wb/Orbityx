export function toFixedTrim(value: unknown, digits: number = 2): string {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(digits).replace(/\.?0+$/, '');
}

export function parseNumber(str: unknown): number {
    if (typeof str === 'number') return Number.isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    const cleaned = str.replace(/[^0-9.+\-Ee]/g, '');
    if (cleaned === '' || cleaned === '+' || cleaned === '-' || cleaned === '.') return NaN;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

export function round(n: number, precision: number = 2): number {
    if (!isFiniteNumber(n)) return NaN;
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
}

export function sum(arr: unknown[]): number {
    if (!Array.isArray(arr)) return 0;
    const nums = arr.filter(isFiniteNumber) as number[];
    return nums.reduce((acc, n) => acc + n, 0);
}

export function avg(arr: unknown[]): number {
    if (!Array.isArray(arr)) return 0;
    const nums = arr.filter(isFiniteNumber);
    return nums.length ? sum(nums) / nums.length : 0;
}

const math = {
    toFixedTrim,
    parseNumber,
    clamp,
    isFiniteNumber,
    round,
    sum,
    avg,
};

export default math;