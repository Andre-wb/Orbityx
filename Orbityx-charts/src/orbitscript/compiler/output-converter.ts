/**
 * @file orbitscript/compiler/output-converter.ts
 * @description Converts ScriptOutput[] to IndicatorSeries for the chart engine.
 */

import type { Candle, IndicatorSeries, IndicatorPoint, IndicatorId } from '../../types/index.js';
import { registerIndicator } from '../../core/indicators.js';
import type { IndicatorMeta } from '../../core/indicators.js';
import { interpret } from '../runtime/interpreter/index.js';
import type { Program } from '../lang/ast/index.js';
import type { ScriptMeta, PlotOutput, HLineOutput, PlotHistogramOutput } from '../lang/types.js';

const _secondaryRegistered = new Set<string>();

export function outputsToIndicatorSeries(
    outputs: ReturnType<typeof interpret>['outputs'],
    meta:    ScriptMeta,
    candles: Candle[],
    id:      string | null,
): IndicatorSeries | null {
    const primaryId = id ?? 'orbitscript_inline';
    const primaryPlot = outputs.find(o => o.type === 'plot') as PlotOutput | undefined;
    if (!primaryPlot && outputs.filter(o => o.type === 'hline').length === 0) return null;

    if (primaryPlot) {
        return {
            id:         primaryId as IndicatorId,
            label:      meta.name,
            color:      primaryPlot.color,
            points:     primaryPlot.points as IndicatorPoint[],
            isSubPanel: !meta.overlay,
            lineStyle:  primaryPlot.style,
            lineWidth:  primaryPlot.linewidth,
        };
    }

    const firstHline = outputs.find(o => o.type === 'hline') as HLineOutput;
    if (firstHline) {
        return {
            id:         primaryId as IndicatorId,
            label:      meta.name,
            color:      firstHline.color,
            points:     candles.map(c => ({ timestamp: c.timestamp, value: firstHline.price })),
            isSubPanel: !meta.overlay,
        };
    }
    return null;
}

export function registerSecondaryOutputs(
    outputs: ReturnType<typeof interpret>['outputs'],
    primaryId: string,
    meta: ScriptMeta,
    candles: Candle[],
    allIds: string[],
    program: Program,
    inputs?: Map<string, import('../lang/types.js').OSValue>,
): void {
    const plotOutputs  = outputs.filter(o => o.type === 'plot') as PlotOutput[];
    const histOutputs  = outputs.filter(o => o.type === 'plothistogram') as PlotHistogramOutput[];
    const hlineOutputs = outputs.filter(o => o.type === 'hline') as HLineOutput[];

    for (let i = 1; i < plotOutputs.length; i++) {
        const plot  = plotOutputs[i]!;
        const secId = `${primaryId}_plot_${i + 1}`;
        if (!_secondaryRegistered.has(secId)) {
            _secondaryRegistered.add(secId);
            allIds.push(secId);
            const capturedPlotIndex = i;
            registerIndicator(secId, {
                label:      plot.title || `${meta.name} (${i + 1})`,
                color:      plot.color,
                isSubPanel: !meta.overlay,
                group:      'OrbitScript',
            }, (c: Candle[]): IndicatorSeries | null => {
                if (c.length === 0) return null;
                try {
                    const { outputs: outs } = interpret(program, c, inputs);
                    const plots = outs.filter(o => o.type === 'plot') as PlotOutput[];
                    const p = plots[capturedPlotIndex];
                    if (!p) return null;
                    return { id: secId as IndicatorId, label: p.title || `${meta.name} (${capturedPlotIndex + 1})`, color: p.color, points: p.points as IndicatorPoint[], isSubPanel: !meta.overlay, lineStyle: p.style, lineWidth: p.linewidth };
                } catch { return null; }
            });
        }
    }

    for (let i = 0; i < hlineOutputs.length; i++) {
        const hl    = hlineOutputs[i]!;
        const hlId  = `${primaryId}_hline_${i}`;
        if (!_secondaryRegistered.has(hlId)) {
            _secondaryRegistered.add(hlId);
            allIds.push(hlId);
            const capturedPrice = hl.price;
            const capturedColor = hl.color;
            const capturedLabel = hl.title;
            registerIndicator(hlId, {
                label:      hl.title || `${meta.name} level`,
                color:      hl.color,
                isSubPanel: !meta.overlay,
                group:      'OrbitScript',
            }, (c: Candle[]): IndicatorSeries => ({
                id:         hlId as IndicatorId,
                label:      capturedLabel || 'Level',
                color:      capturedColor,
                points:     c.map(candle => ({ timestamp: candle.timestamp, value: capturedPrice })),
                isSubPanel: !meta.overlay,
            }));
        }
    }

    for (let i = 0; i < histOutputs.length; i++) {
        const hist   = histOutputs[i]!;
        const histId = `${primaryId}_hist_${i}`;
        if (!_secondaryRegistered.has(histId)) {
            _secondaryRegistered.add(histId);
            allIds.push(histId);
            const capturedTitle = hist.title;
            const capturedPts   = hist.points;
            registerIndicator(histId, {
                label:      hist.title || `${meta.name} histogram`,
                color:      '#2196F3',
                isSubPanel: true,
                group:      'OrbitScript',
            }, (_c: Candle[]): IndicatorSeries => ({
                id:         histId as IndicatorId,
                label:      capturedTitle,
                color:      '#2196F3',
                points:     capturedPts.map(p => ({ timestamp: p.timestamp, value: p.value })),
                isSubPanel: true,
            }));
        }
    }
}
