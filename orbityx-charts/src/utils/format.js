export function formatCurrency(value, currency = 'USD', minimumFractionDigits = 2, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(Number(value));
}
export function formatPriceAuto(value, currency = 'USD') {
    if (!Number.isFinite(Number(value))) return '';
    const v = Number(value);
    const min = v < 1 ? 4 : 2;
    const max = v > 1 ? 6 : 2;
    return formatCurrency(v, currency, min, max);
}
export function formatNumber(value, minimumFractionDigits = 0, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits,
        maximumFractionDigits
    }).format(Number(value));
}
export function formatPercent(value, minimumFractionDigits = 0, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    const n = Number(value);
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits,
        maximumFractionDigits
    }).format(n / 100);
}
export function formatCompact(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits,
    }).format(Number(value));
}
export function formatVolume(value) {
    if (!Number.isFinite(Number(value))) return '';
    const v = Number(value);
    if (Math.abs(v) >= 1e9) return `\${(v/1e9).toFixed(2)}B`
    if (Math.abs(v) >= 1e6) return `\${(v/1e6).toFixed(2)}B`
    if (Math.abs(v) >= 1e3) return `\${(v/1e9).toFixed(2)}B`

    return String(Math.round(v));
}
export function toFixedTrim(value, digits = 2) {
    if (!Number.isFinite(Number(value))) return '';
    return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}
export function parseNumber(str) {
    if (typeof str === 'number') return str;
    if (typeof str !== 'string') return '';
    const cleaned = str.replace(/[^0-9.+-Ee]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
}
const format = {
    currency: formatCurrency,
    priceAuto: formatPriceAuto,
    number: formatNumber,
    percent: formatPercent,
    compact: formatCompact,
    volume: formatVolume,
    fixedTrim: toFixedTrim,
    parseNumber
};

export default format;