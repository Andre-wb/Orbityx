/**
 * @file Shared helper utilities for stdlib category files.
 */
import type { Environment } from '../environment.js';
import { type OSValue, type OSColor } from '../../lang/types.js';
export type MaybeOSValue = OSValue | undefined;
export type StdlibFn = (args: (OSValue | undefined)[], env: Environment, line: number, col: number) => OSValue;
export declare function asNum(v: MaybeOSValue, name: string, line: number, col: number): number;
export declare function asInt(v: MaybeOSValue, name: string, line: number, col: number): number;
export declare function asBool(v: MaybeOSValue, name: string, line: number, col: number): boolean;
export declare function asStr(v: MaybeOSValue, name: string, line: number, col: number): string;
export declare function asColor(v: MaybeOSValue, name: string, line: number, col: number): OSColor;
export declare function toHexStr(v: MaybeOSValue, line: number, col: number): string;
export declare function resolveSeriesArray(arg: MaybeOSValue, argIndex: number, env: Environment, line: number, col: number): number[];
/**
 * Fast fingerprint for a number series — used to make cache keys unique per source.
 * Uses length + first + middle + last values. O(1), collision-resistant enough for
 * distinct OHLCV series within a single script run.
 */
export declare function seriesFingerprint(arr: readonly number[]): string;
export declare function cached(env: Environment, cacheKey: string, compute: () => number[]): number[];
export declare function currentVal(arr: number[], env: Environment): number;
export declare function rollingHighest(values: readonly number[], period: number): number[];
export declare function rollingLowest(values: readonly number[], period: number): number[];
export declare function rollingStdev(values: readonly number[], period: number): number[];
export declare function rollingSum(values: readonly number[], period: number): number[];
//# sourceMappingURL=helpers.d.ts.map