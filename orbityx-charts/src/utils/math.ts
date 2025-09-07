export function toFixedTrim(value, digits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

export function parseNumber(str) {
    if (typeof str === 'number') return str;
    if (typeof str !== 'string') return NaN;
    const cleaned = str.replace(/[^0-9.+-Ee]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

export function round(n, precision = 2) {
    if (!isFiniteNumber(n)) return NaN;
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
}

export function sum(arr) {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, val) => acc + (isFiniteNumber(val) ? val : 0), 0);
}

export function avg(arr) {
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