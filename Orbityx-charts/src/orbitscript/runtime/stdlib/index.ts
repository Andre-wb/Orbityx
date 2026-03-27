/**
 * @file orbitscript/runtime/stdlib/index.ts
 * @description Standard library for OrbitScript - assembles STDLIB from all categories.
 */

import type { Environment } from '../environment.js';
import type { OSValue } from '../../lang/types.js';

// ─── Stdlib function signature ────────────────────────────────────────────────

export type StdlibFn = (args: (OSValue | undefined)[], env: Environment, line: number, col: number) => OSValue;

// ─── Category imports ─────────────────────────────────────────────────────────

import { entries as movingAverageEntries }  from './moving-averages.js';
import { entries as oscillatorEntries }     from './oscillators.js';
import { entries as volatilityEntries }     from './volatility.js';
import { entries as volumeEntries }         from './volume.js';
import { entries as statisticsEntries }     from './statistics.js';
import { entries as crossoverEntries }      from './crossover.js';
import { entries as mathFnEntries }         from './math-fns.js';
import { entries as stringFnEntries }       from './string-fns.js';
import { entries as utilityEntries }        from './utility.js';
import { entries as colorFnEntries }        from './color-fns.js';
import { entries as outputFnEntries, resetPlotCounter as _resetPlotCounter } from './output-fns.js';
import { entries as timeFnEntries }         from './time-fns.js';

// ─── Re-export resetPlotCounter ───────────────────────────────────────────────

export { resetPlotCounter } from './output-fns.js';

// ─── STDLIB registry ──────────────────────────────────────────────────────────

export const STDLIB = new Map<string, StdlibFn>([
    ...movingAverageEntries,
    ...oscillatorEntries,
    ...volatilityEntries,
    ...volumeEntries,
    ...statisticsEntries,
    ...crossoverEntries,
    ...mathFnEntries,
    ...stringFnEntries,
    ...utilityEntries,
    ...colorFnEntries,
    ...outputFnEntries,
    ...timeFnEntries,
]);
