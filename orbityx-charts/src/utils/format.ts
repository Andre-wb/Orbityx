import { parseNumber, isFiniteNumber, toFixedTrim, clamp } from './math.js';

const LOCALE = 'en-US';

function toNum(value) {
    const n = parseNumber(value);
    return isFiniteNumber(n) ? n : null;
}

export function formatCurrency(value, currency = 'USD', minFrac = 2, maxFrac = 2) {
    const n = toNum(value);
    if (n === null) return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}

export function formatPriceAuto(value, currency = 'USD') {
    const n = toNum(value);
    if (n === null) return '';
    const min = n < 1 ? 4 : 2;
    const max = n < 1 ? 6 : 2;
    return formatCurrency(n, currency, min, max);
}

export function formatNumber(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null) return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}

export function formatPercent(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null) return '';
    const min = clamp(minFrac, 0, 20);
    const max = clamp(maxFrac, min, 20);
    return new Intl.NumberFormat(LOCALE, {
        style: 'percent',
        minimumFractionDigits: min,
        maximumFractionDigits: max,
    }).format(n);
}

export function formatPercentFrom100(value, minFrac = 0, maxFrac = 2) {
    const n = toNum(value);
    if (n === null) return '';
    return formatPercent(n / 100, minFrac, maxFrac);
}

export function formatCompact(value, maxFrac = 2) {
    const n = toNum(value);
    if (n === null) return '';
    const mf = clamp(maxFrac, 0, 6);
    return new Intl.NumberFormat(LOCALE, {
        notation: 'compact',
        maximumFractionDigits: mf,
    }).format(n);
}

export function formatVolume(value) {
    const n = toNum(value);
    if (n === null) return '';
    const av = Math.abs(n);
    if (av >= 1e9) return `${toFixedTrim(n / 1e9, 2)}B`;
    if (av >= 1e6) return `${toFixedTrim(n / 1e6, 2)}M`;
    if (av >= 1e3) return `${toFixedTrim(n / 1e3, 2)}K`;
    return String(Math.round(n));
}

export function toFixedTrimPublic(value, digits = 2) {
    const n = toNum(value);
    if (n === null) return '';
    return toFixedTrim(n, digits);
}

const format = {
    currency: formatCurrency,
    priceAuto: formatPriceAuto,
    number: formatNumber,
    percent: formatPercent,
    percentFrom100: formatPercentFrom100,
    compact: formatCompact,
    volume: formatVolume,
    fixedTrim: toFixedTrimPublic,
    parseNumber,
};

export default format;