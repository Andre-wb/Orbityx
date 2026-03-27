/**
 * @file orbitscript/runtime/environment.ts
 * @description Runtime environment for OrbitScript.
 */
import type { Candle } from '../../types/index.js';
import type { FnDef, StructDef, EnumDef, TraitDef, ImplBlock } from '../lang/ast/index.js';
import type {
    OSValue, OSColor,
    ScriptOutput, PlotOutput, HLineOutput, BgColorOutput,
    AlertOutput, PlotShapeOutput, PlotShapeStyle,
    PlotShapeLocation, PlotArrowOutput, PlotHistogramOutput,
} from '../lang/types.js';

// ─── Sub-module exports (re-exported for backwards compat) ────────────────────

export { ReturnSignal, BreakSignal, ContinueSignal, ErrPropagateSignal } from './signal/control-signals.js';
export { hexToColor, colorToHex, isOSColor, osValueToString } from './color/color-utils.js';

import { ScopeStack } from './scope/scope-stack.js';
import { BUILTIN_SERIES, getBuiltinSeries, getBuiltinSeriesArray } from './series/builtin-series.js';
import { recordBarValue as _recordBarValue, getHistory as _getHistory } from './series/series-history.js';
import { COLOR_CONSTS } from './color/color-consts.js';
import { hexToColor } from './color/color-utils.js';
import type { OSColor as OSColorType } from '../lang/types.js';
import { addPlotPoint as _addPlotPoint } from './output/plot-collector.js';
import { addHLine as _addHLine } from './output/hline-collector.js';
import { addBgColor as _addBgColor } from './output/bgcolor-collector.js';
import { addAlert as _addAlert } from './output/alert-collector.js';
import { addPlotShape as _addPlotShape, addPlotArrow as _addPlotArrow, addPlotHistogramBar as _addPlotHistogramBar } from './output/shape-collector.js';

// ─── Environment ─────────────────────────────────────────────────────────────

export class Environment {
    private scopeStack = new ScopeStack();

    readonly seriesHistory = new Map<string, number[]>();
    readonly seriesCache   = new Map<string, number[]>();

    candles:  Candle[] = [];
    barIndex: number   = 0;

    readonly structDefs  = new Map<string, StructDef>();
    readonly enumDefs    = new Map<string, EnumDef>();
    readonly traitDefs   = new Map<string, TraitDef>();
    readonly implBlocks  = new Map<string, ImplBlock[]>();
    readonly fnRegistry  = new Map<string, FnDef>();

    private plotBuilders      = new Map<number, PlotOutput>();
    private hlines:            HLineOutput[]          = [];
    private bgColors:          BgColorOutput[]        = [];
    private alerts:            AlertOutput[]          = [];
    private plotShapes:        PlotShapeOutput[]      = [];
    private plotArrows:        PlotArrowOutput[]      = [];
    private plotHistograms:    PlotHistogramOutput[]  = [];

    initRun(candles: Candle[], inputs: Map<string, OSValue>): void {
        this.candles       = candles;
        this.barIndex      = 0;
        this.scopeStack.reset();
        this.seriesHistory.clear();
        this.seriesCache.clear();
        this.plotBuilders.clear();
        this.hlines        = [];
        this.bgColors      = [];
        this.alerts        = [];
        this.plotShapes    = [];
        this.plotArrows    = [];
        this.plotHistograms = [];
        for (const [name, value] of inputs) this.define(name, value, false);
    }

    setBar(index: number): void { this.barIndex = index; }

    pushScope(): void  { this.scopeStack.push(); }
    popScope(): void   { this.scopeStack.pop(); }

    define(name: string, value: OSValue, mutable: boolean): void {
        this.scopeStack.define(name, value, mutable);
    }

    get(name: string, line = 0, col = 0): OSValue {
        if (BUILTIN_SERIES.has(name)) return getBuiltinSeries(name, this.candles, this.barIndex);
        return this.scopeStack.get(name, line, col);
    }

    set(name: string, value: OSValue, line = 0, col = 0): void {
        this.scopeStack.set(name, value, line, col);
    }

    has(name: string): boolean {
        if (BUILTIN_SERIES.has(name)) return true;
        return this.scopeStack.has(name);
    }

    getBuiltinSeriesArray(name: string): number[] {
        return getBuiltinSeriesArray(name, this.candles);
    }

    recordBarValue(name: string, value: OSValue): void {
        _recordBarValue(name, value, this.barIndex, this.seriesHistory);
    }

    getHistory(seriesName: string, offset: number, line = 0, col = 0): number {
        return _getHistory(seriesName, offset, this.barIndex, this.candles, this.seriesHistory, line, col);
    }

    resolveColorConst(name: string): OSColor | null {
        const hex = COLOR_CONSTS[name];
        if (!hex) return null;
        return hexToColor(hex);
    }

    resolveMethod(typeName: string, methodName: string): FnDef | null {
        const blocks = this.implBlocks.get(typeName) ?? [];
        for (const block of blocks) {
            const fn = block.methods.find(m => m.name === methodName);
            if (fn) return fn;
        }
        return null;
    }

    addPlotPoint(seriesIndex: number, title: string, color: string, linewidth: number, style: import('../lang/types.js').PlotStyle, value: number): void {
        _addPlotPoint(seriesIndex, title, color, linewidth, style, value, this.plotBuilders, this.candles, this.barIndex);
    }

    addHLine(price: number, title: string, color: string, style: 'solid' | 'dashed' | 'dotted' = 'dashed'): void {
        _addHLine(price, title, color, style, this.hlines);
    }

    addBgColor(color: string, opacity: number): void {
        _addBgColor(color, opacity, this.barIndex, this.bgColors);
    }

    addAlert(title: string, message: string): void {
        _addAlert(title, message, this.barIndex, this.alerts);
    }

    addPlotShape(title: string, shape: PlotShapeStyle, location: PlotShapeLocation, color: string, size: 'tiny' | 'small' | 'normal' | 'large'): void {
        _addPlotShape(title, shape, location, color, size, this.barIndex, this.plotShapes);
    }

    addPlotArrow(title: string, colorUp: string, colorDown: string, value: number): void {
        _addPlotArrow(title, colorUp, colorDown, value, this.barIndex, this.candles, this.plotArrows);
    }

    addPlotHistogramBar(title: string, value: number, color: string): void {
        _addPlotHistogramBar(title, value, color, this.barIndex, this.candles, this.plotHistograms);
    }

    getOutputs(): ScriptOutput[] {
        const plots = Array.from(this.plotBuilders.values()).sort((a, b) => a.seriesIndex - b.seriesIndex);
        return [...plots, ...this.hlines, ...this.bgColors, ...this.alerts, ...this.plotShapes, ...this.plotArrows, ...this.plotHistograms];
    }
}
