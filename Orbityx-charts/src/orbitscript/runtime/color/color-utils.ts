import type { OSValue, OSColor, OSStruct } from '../../lang/types.js';

export function hexToColor(hex: string): OSColor {
    const h = hex.replace('#', '');
    const len = h.length;
    if (len !== 6 && len !== 8) return { r: 0, g: 0, b: 0, a: 1, hex };
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = len === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a, hex: '#' + h.toUpperCase() };
}

export function colorToHex(c: OSColor): string {
    const toHex = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0');
    const hex = '#' + toHex(c.r) + toHex(c.g) + toHex(c.b);
    return c.a < 1 ? hex + toHex(c.a) : hex;
}

export function isOSColor(v: OSValue): v is OSColor {
    return typeof v === 'object' && v !== null && !Array.isArray(v) &&
        '__type' in v === false && 'r' in (v as object) && 'hex' in (v as object);
}

export function osValueToString(v: OSValue | undefined): string {
    if (v === undefined) return 'undefined';
    if (v === null) return 'None';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number')  return isNaN(v) ? 'NaN' : String(v);
    if (typeof v === 'string')  return v;
    if (isOSColor(v))           return (v as OSColor).hex;
    if (Array.isArray(v))       return '[' + (v as OSValue[]).map(osValueToString).join(', ') + ']';
    if (typeof v === 'object' && '__type' in (v as object)) {
        const obj = v as OSStruct;
        if (obj.__type === 'struct') return `${obj.__name} { ${Object.entries(obj.fields).map(([k, fv]) => `${k}: ${osValueToString(fv)}`).join(', ')} }`;
        if ((v as import('../../lang/types.js').OSEnum).__type === 'enum') {
            const e = v as import('../../lang/types.js').OSEnum;
            const data = e.__data.length ? `(${e.__data.map(osValueToString).join(', ')})` : '';
            return `${e.__name}::${e.__variant}${data}`;
        }
    }
    return String(v);
}
