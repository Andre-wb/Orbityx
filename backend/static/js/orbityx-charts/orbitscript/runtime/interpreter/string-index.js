/**
 * Single-character access on a string.
 * Supports negative indices: -1 → last char, -2 → second to last, etc.
 * Returns null when the index is out of bounds.
 */
export function indexString(s, i) {
    const pos = i < 0 ? s.length + i : i;
    return s[pos] ?? null;
}
/**
 * Substring slice using range syntax: s[start..end] or s[start..=end].
 * Supports negative start/end indices.
 * Returns empty string when range is empty or inverted.
 */
export function sliceString(s, start, end, inclusive) {
    const len = s.length;
    const normStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const rawEnd = inclusive ? end + 1 : end;
    const normEnd = rawEnd < 0 ? Math.max(0, len + rawEnd) : Math.min(rawEnd, len);
    return s.slice(normStart, normEnd);
}
/**
 * Slice an OSValue array using range syntax.
 */
export function sliceArray(arr, start, end, inclusive) {
    const len = arr.length;
    const normStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const rawEnd = inclusive ? end + 1 : end;
    const normEnd = rawEnd < 0 ? Math.max(0, len + rawEnd) : Math.min(rawEnd, len);
    return arr.slice(normStart, normEnd);
}
//# sourceMappingURL=string-index.js.map