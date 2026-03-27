/**
 * @file orbitscript/runtime/environment.ts
 * @description Runtime environment for OrbitScript.
 */
import type { Candle } from '../../types/index.js';
import type { FnDef, StructDef, EnumDef, TraitDef, ImplBlock } from '../lang/ast/index.js';
import type { OSValue, OSColor, ScriptOutput, PlotShapeStyle, PlotShapeLocation } from '../lang/types.js';
export { ReturnSignal, BreakSignal, ContinueSignal, ErrPropagateSignal } from './signal/control-signals.js';
export { hexToColor, colorToHex, isOSColor, osValueToString } from './color/color-utils.js';
export declare class Environment {
    private scopeStack;
    readonly seriesHistory: Map<string, number[]>;
    readonly seriesCache: Map<string, number[]>;
    candles: Candle[];
    barIndex: number;
    readonly structDefs: Map<string, StructDef>;
    readonly enumDefs: Map<string, EnumDef>;
    readonly traitDefs: Map<string, TraitDef>;
    readonly implBlocks: Map<string, ImplBlock[]>;
    readonly fnRegistry: Map<string, FnDef>;
    private plotBuilders;
    private hlines;
    private bgColors;
    private alerts;
    private plotShapes;
    private plotArrows;
    private plotHistograms;
    initRun(candles: Candle[], inputs: Map<string, OSValue>): void;
    setBar(index: number): void;
    pushScope(): void;
    popScope(): void;
    define(name: string, value: OSValue, mutable: boolean): void;
    get(name: string, line?: number, col?: number): OSValue;
    set(name: string, value: OSValue, line?: number, col?: number): void;
    has(name: string): boolean;
    getBuiltinSeriesArray(name: string): number[];
    recordBarValue(name: string, value: OSValue): void;
    getHistory(seriesName: string, offset: number, line?: number, col?: number): number;
    resolveColorConst(name: string): OSColor | null;
    resolveMethod(typeName: string, methodName: string): FnDef | null;
    addPlotPoint(seriesIndex: number, title: string, color: string, linewidth: number, style: import('../lang/types.js').PlotStyle, value: number): void;
    addHLine(price: number, title: string, color: string, style?: 'solid' | 'dashed' | 'dotted'): void;
    addBgColor(color: string, opacity: number): void;
    addAlert(title: string, message: string): void;
    addPlotShape(title: string, shape: PlotShapeStyle, location: PlotShapeLocation, color: string, size: 'tiny' | 'small' | 'normal' | 'large'): void;
    addPlotArrow(title: string, colorUp: string, colorDown: string, value: number): void;
    addPlotHistogramBar(title: string, value: number, color: string): void;
    getOutputs(): ScriptOutput[];
}
//# sourceMappingURL=environment.d.ts.map