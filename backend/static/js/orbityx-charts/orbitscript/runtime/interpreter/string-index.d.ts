import type { OSValue } from '../../lang/value/index.js';
/**
 * Single-character access on a string.
 * Supports negative indices: -1 → last char, -2 → second to last, etc.
 * Returns null when the index is out of bounds.
 */
export declare function indexString(s: string, i: number): string | null;
/**
 * Substring slice using range syntax: s[start..end] or s[start..=end].
 * Supports negative start/end indices.
 * Returns empty string when range is empty or inverted.
 */
export declare function sliceString(s: string, start: number, end: number, inclusive: boolean): string;
/**
 * Slice an OSValue array using range syntax.
 */
export declare function sliceArray(arr: OSValue[], start: number, end: number, inclusive: boolean): OSValue[];
//# sourceMappingURL=string-index.d.ts.map