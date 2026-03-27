/**
 * @file orbitscript/compiler/index.ts
 * @description Bridge between OrbitScript and the Orbityx Charts indicator plugin system.
 */

import type { Candle, IndicatorSeries } from '../../types/index.js';
import {
    registerIndicator,
    unregisterIndicator,
    type IndicatorMeta,
} from '../../core/indicators.js';
import { tokenize }  from '../frontend/lexer/index.js';
import { parse }     from '../frontend/parser/index.js';
import { interpret } from '../runtime/interpreter/index.js';
import type { Program } from '../lang/ast/index.js';
import type { ScriptMeta, OSValue } from '../lang/types.js';
import { OrbitScriptError } from '../lang/error.js';
import { outputsToIndicatorSeries, registerSecondaryOutputs } from './output-converter.js';

// ─── Compiled script result ───────────────────────────────────────────────────

export interface CompiledScript {
    meta:       ScriptMeta;
    computeFn:  (candles: Candle[]) => IndicatorSeries | null;
    program:    Program;
}

// ─── Internal registry ────────────────────────────────────────────────────────

const registeredIds = new Map<string, string[]>();
let _idCounter = 0;

// ─── compile() ───────────────────────────────────────────────────────────────

export function compile(
    source: string,
    inputOverrides?: Record<string, OSValue>,
): CompiledScript {
    const tokens = tokenize(source);
    const program = parse(tokens);

    const tokens2  = tokenize(source);
    const program2 = parse(tokens2);

    const dummyCandles: Candle[] = [{
        timestamp: Date.now(), open: 100, high: 101, low: 99, close: 100, volume: 1000,
    }];
    const inputs = inputOverrides ? new Map(Object.entries(inputOverrides)) : undefined;

    let meta: ScriptMeta;
    try {
        const result = interpret(program2, dummyCandles, inputs);
        meta = result.meta;
    } catch {
        meta = extractMetaOnly(program);
    }

    const computeFn = (candles: Candle[]): IndicatorSeries | null => {
        if (candles.length === 0) return null;
        try {
            const { outputs } = interpret(program, candles, inputs);
            return outputsToIndicatorSeries(outputs, meta, candles, null);
        } catch (e) {
            if (e instanceof OrbitScriptError) console.error(`[OrbitScript] ${e.message}`);
            else console.error('[OrbitScript] Runtime error:', e);
            return null;
        }
    };

    return { meta, computeFn, program };
}

// ─── register() ──────────────────────────────────────────────────────────────

export function register(
    source: string,
    inputOverrides?: Record<string, OSValue>,
): string {
    const compiled = compile(source, inputOverrides);
    const { meta }  = compiled;

    if (meta.kind === 'library') {
        // Libraries expose functions but do not render as chart indicators.
        const safeTitle = meta.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return `orbitscript_library_${safeTitle}_${++_idCounter}`;
    }

    const safeTitle = meta.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const primaryId = `orbitscript_${safeTitle}_${++_idCounter}`;
    const allIds: string[] = [primaryId];

    const primaryMeta: IndicatorMeta = {
        label:      meta.name,
        color:      '#2196F3',
        isSubPanel: !meta.overlay,
        group:      'OrbitScript',
    };

    registerIndicator(primaryId, primaryMeta, (candles: Candle[]): IndicatorSeries | null => {
        if (candles.length === 0) return null;
        try {
            const inputs = inputOverrides ? new Map(Object.entries(inputOverrides)) : undefined;
            const { outputs } = interpret(compiled.program, candles, inputs);
            registerSecondaryOutputs(outputs, primaryId, meta, candles, allIds, compiled.program, inputs);
            return outputsToIndicatorSeries(outputs, meta, candles, primaryId);
        } catch (e) {
            if (e instanceof OrbitScriptError) console.error(`[OrbitScript:${meta.name}] ${e.message}`);
            else console.error(`[OrbitScript:${meta.name}] Runtime error:`, e);
            return null;
        }
    });

    registeredIds.set(primaryId, allIds);
    return primaryId;
}

// ─── unregister() ────────────────────────────────────────────────────────────

export function unregister(id: string): void {
    const allIds = registeredIds.get(id) ?? [id];
    for (const indicatorId of allIds) unregisterIndicator(indicatorId);
    registeredIds.delete(id);
}

// ─── Minimal meta extraction ─────────────────────────────────────────────────

function extractMetaOnly(program: Program): ScriptMeta {
    let name = 'Custom Script';
    let overlay = false;
    let kind: 'indicator' | 'strategy' | 'library' = 'indicator';

    for (const dir of program.directives) {
        if (dir.name === 'indicator' || dir.name === 'strategy' || dir.name === 'library') {
            kind = dir.name as 'indicator' | 'strategy' | 'library';
            for (const arg of dir.args) {
                if (arg.key === '0' || arg.key === 'name') {
                    if (arg.value.kind === 'StringLit') name = arg.value.value;
                }
                if (arg.key === 'overlay') {
                    if (arg.value.kind === 'BoolLit') overlay = arg.value.value;
                }
            }
        }
    }
    return { kind, name, overlay, inputs: [] };
}
