// ─── Sub-module exports (re-exported for backwards compat) ────────────────────
export { ReturnSignal, BreakSignal, ContinueSignal, ErrPropagateSignal } from './signal/control-signals.js';
export { hexToColor, colorToHex, isOSColor, osValueToString } from './color/color-utils.js';
import { ScopeStack } from './scope/scope-stack.js';
import { BUILTIN_SERIES, getBuiltinSeries, getBuiltinSeriesArray } from './series/builtin-series.js';
import { recordBarValue as _recordBarValue, getHistory as _getHistory } from './series/series-history.js';
import { COLOR_CONSTS } from './color/color-consts.js';
import { hexToColor } from './color/color-utils.js';
import { addPlotPoint as _addPlotPoint } from './output/plot-collector.js';
import { addHLine as _addHLine } from './output/hline-collector.js';
import { addBgColor as _addBgColor } from './output/bgcolor-collector.js';
import { addAlert as _addAlert } from './output/alert-collector.js';
import { addPlotShape as _addPlotShape, addPlotArrow as _addPlotArrow, addPlotHistogramBar as _addPlotHistogramBar } from './output/shape-collector.js';
// ─── Environment ─────────────────────────────────────────────────────────────
export class Environment {
    scopeStack = new ScopeStack();
    seriesHistory = new Map();
    seriesCache = new Map();
    candles = [];
    barIndex = 0;
    structDefs = new Map();
    enumDefs = new Map();
    traitDefs = new Map();
    implBlocks = new Map();
    fnRegistry = new Map();
    plotBuilders = new Map();
    hlines = [];
    bgColors = [];
    alerts = [];
    plotShapes = [];
    plotArrows = [];
    plotHistograms = [];
    initRun(candles, inputs) {
        this.candles = candles;
        this.barIndex = 0;
        this.scopeStack.reset();
        this.seriesHistory.clear();
        this.seriesCache.clear();
        this.plotBuilders.clear();
        this.hlines = [];
        this.bgColors = [];
        this.alerts = [];
        this.plotShapes = [];
        this.plotArrows = [];
        this.plotHistograms = [];
        for (const [name, value] of inputs)
            this.define(name, value, false);
    }
    setBar(index) { this.barIndex = index; }
    pushScope() { this.scopeStack.push(); }
    popScope() { this.scopeStack.pop(); }
    define(name, value, mutable) {
        this.scopeStack.define(name, value, mutable);
    }
    get(name, line = 0, col = 0) {
        if (BUILTIN_SERIES.has(name))
            return getBuiltinSeries(name, this.candles, this.barIndex);
        return this.scopeStack.get(name, line, col);
    }
    set(name, value, line = 0, col = 0) {
        this.scopeStack.set(name, value, line, col);
    }
    has(name) {
        if (BUILTIN_SERIES.has(name))
            return true;
        return this.scopeStack.has(name);
    }
    getBuiltinSeriesArray(name) {
        return getBuiltinSeriesArray(name, this.candles);
    }
    recordBarValue(name, value) {
        _recordBarValue(name, value, this.barIndex, this.seriesHistory);
    }
    getHistory(seriesName, offset, line = 0, col = 0) {
        return _getHistory(seriesName, offset, this.barIndex, this.candles, this.seriesHistory, line, col);
    }
    resolveColorConst(name) {
        const hex = COLOR_CONSTS[name];
        if (!hex)
            return null;
        return hexToColor(hex);
    }
    resolveMethod(typeName, methodName) {
        const blocks = this.implBlocks.get(typeName) ?? [];
        for (const block of blocks) {
            const fn = block.methods.find(m => m.name === methodName);
            if (fn)
                return fn;
        }
        return null;
    }
    addPlotPoint(seriesIndex, title, color, linewidth, style, value) {
        _addPlotPoint(seriesIndex, title, color, linewidth, style, value, this.plotBuilders, this.candles, this.barIndex);
    }
    addHLine(price, title, color, style = 'dashed') {
        _addHLine(price, title, color, style, this.hlines);
    }
    addBgColor(color, opacity) {
        _addBgColor(color, opacity, this.barIndex, this.bgColors);
    }
    addAlert(title, message) {
        _addAlert(title, message, this.barIndex, this.alerts);
    }
    addPlotShape(title, shape, location, color, size) {
        _addPlotShape(title, shape, location, color, size, this.barIndex, this.plotShapes);
    }
    addPlotArrow(title, colorUp, colorDown, value) {
        _addPlotArrow(title, colorUp, colorDown, value, this.barIndex, this.candles, this.plotArrows);
    }
    addPlotHistogramBar(title, value, color) {
        _addPlotHistogramBar(title, value, color, this.barIndex, this.candles, this.plotHistograms);
    }
    getOutputs() {
        const plots = Array.from(this.plotBuilders.values()).sort((a, b) => a.seriesIndex - b.seriesIndex);
        return [...plots, ...this.hlines, ...this.bgColors, ...this.alerts, ...this.plotShapes, ...this.plotArrows, ...this.plotHistograms];
    }
}
//# sourceMappingURL=environment.js.map