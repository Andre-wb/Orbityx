/**
 * Math/number helpers used across the app.
 *
 * Design notes:
 * - All functions are side-effect free and tolerate unknown inputs.
 * - Prefer returning neutral values ('' or NaN/0) instead of throwing.
 */
export function toFixedTrim(value, digits = 2) {
    /**
     * Format a value with fixed fraction digits and trim trailing zeros.
     * Example: (12.3400, 4) → "12.34"; (5, 2) → "5".
     * Returns empty string for non-finite inputs.
     */
    // Coerce to number while preserving existing numbers.
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return '';
    // Remove trailing zeros and an orphan decimal point.
    return n.toFixed(digits).replace(/\.?0+$/, '');
}
/**
 * Lenient parser: extracts a number from a string like "$1,234.56" or " -12e3 ".
 * Returns NaN for invalid/empty inputs.
 */
export function parseNumber(str) {
    if (typeof str === 'number')
        return Number.isFinite(str) ? str : NaN;
    if (typeof str !== 'string')
        return NaN;
    // Strip all characters except digits, sign, decimal point, and exponent.
    const cleaned = str.replace(/[^0-9.+\-Ee]/g, '');
    // Reject strings that don't form a valid numeric literal after cleaning.
    if (cleaned === '' || cleaned === '+' || cleaned === '-' || cleaned === '.')
        return NaN;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}
/**
 * Constrain a number to the inclusive range [min, max].
 */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
/**
 * Type guard: checks that input is a finite number (not NaN/Infinity).
 */
export function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}
/**
 * Round a number to a given number of decimal places (banker’s rounding via Math.round).
 * Returns NaN when input is not a finite number.
 */
export function round(n, precision = 2) {
    if (!isFiniteNumber(n))
        return NaN;
    // Scale-then-round to preserve precision, then scale back.
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
}
/**
 * Sum only the finite numeric values in an array; ignores non-numbers.
 */
export function sum(arr) {
    if (!Array.isArray(arr))
        return 0;
    // Filter with the type guard so downstream has number[].
    const nums = arr.filter(isFiniteNumber);
    return nums.reduce((acc, n) => acc + n, 0);
}
/**
 * Average of finite numeric values in an array; returns 0 for empty input.
 */
export function avg(arr) {
    if (!Array.isArray(arr))
        return 0;
    // Reuse the guard; do not mutate the original array.
    const nums = arr.filter(isFiniteNumber);
    return nums.length ? sum(nums) / nums.length : 0;
}
// Facade: grouped exports for convenient default import.
const math = {
    toFixedTrim,
    parseNumber,
    clamp,
    isFiniteNumber,
    round,
    sum,
    avg,
};
// Default export mirrors named exports for legacy consumers.
export default math;
//# sourceMappingURL=math.js.map