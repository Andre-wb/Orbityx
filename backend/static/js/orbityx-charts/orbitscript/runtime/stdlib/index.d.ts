/**
 * @file orbitscript/runtime/stdlib/index.ts
 * @description Standard library for OrbitScript - assembles STDLIB from all categories.
 */
import type { Environment } from '../environment.js';
import type { OSValue } from '../../lang/types.js';
export type StdlibFn = (args: (OSValue | undefined)[], env: Environment, line: number, col: number) => OSValue;
export { resetPlotCounter } from './output-fns.js';
export declare const STDLIB: Map<string, StdlibFn>;
//# sourceMappingURL=index.d.ts.map