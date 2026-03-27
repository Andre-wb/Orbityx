/**
 * @file core/indicators.ts
 * @description Technical indicator computation engine with plugin registry.
 *
 * All standard technical indicators are registered as plugins. Users can add
 * custom indicators via registerIndicator() without modifying core code.
 */
import type { Candle, IndicatorSeries, IndicatorId, IndicatorPoint, BollingerPoint, MACDPoint } from '../types/index.js';
import {
    sma, ema, wma, dema, tema, hma, vwma,
    rsi as rsiCalc, macd as macdCalc, bollingerBands,
    stochastic as stochasticCalc, stochasticRSI as stochRSICalc,
    williamsR as williamsRCalc, cci as cciCalc, mfi as mfiCalc,
    roc as rocCalc, momentum as momentumCalc,
    atr as atrCalc, adx as adxCalc,
    obv as obvCalc, vwap as vwapCalc, adLine as adLineCalc, cmf as cmfCalc,
    donchianChannels, keltnerChannels,
    awesomeOscillator as aoCalc,
    parabolicSAR as psarCalc,
    ichimoku as ichimokuCalc,
    isFiniteNumber,
} from '../utils/math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Indicator Plugin Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface IndicatorMeta {
    label: string;
    color: string;
    isSubPanel: boolean;
    group: string;
}

export type IndicatorComputeFn = (candles: Candle[]) => IndicatorSeries | null;

interface IndicatorPlugin {
    meta: IndicatorMeta;
    compute: IndicatorComputeFn;
}

const indicatorPlugins = new Map<string, IndicatorPlugin>();

/** Human-readable metadata for the indicator picker UI. */
export const INDICATOR_META: Record<string, IndicatorMeta> = {};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toPoints(timestamps: number[], values: number[]): IndicatorPoint[] {
    return timestamps.map((t, i) => ({ timestamp: t, value: values[i] ?? NaN }));
}

function seriesFromValues(
    candles: Candle[],
    id:      string,
    meta:    IndicatorMeta,
    values:  number[],
): IndicatorSeries {
    return {
        id: id as IndicatorId,
        label: meta.label,
        color: meta.color,
        points: toPoints(candles.map(c => c.timestamp), values),
        isSubPanel: meta.isSubPanel,
    };
}

function subPanelSeries(
    candles: Candle[],
    id:      string,
    meta:    IndicatorMeta,
    values:  number[],
    range?:  [number, number],
): IndicatorSeries {
    return {
        id: id as IndicatorId,
        label: meta.label,
        color: meta.color,
        points: toPoints(candles.map(c => c.timestamp), values),
        isSubPanel: true,
        ...(range ? { subPanelRange: range } : {}),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a custom indicator plugin.
 *
 * @example
 * registerIndicator('my_ind', {
 *     label: 'My Indicator',
 *     color: '#ff6b6b',
 *     isSubPanel: false,
 *     group: 'Custom',
 * }, (candles) => { ... });
 */
export function registerIndicator(
    id: string,
    meta: IndicatorMeta,
    compute: IndicatorComputeFn,
): void {
    indicatorPlugins.set(id, { meta, compute });
    INDICATOR_META[id] = meta;
}

/** Unregister a custom indicator. */
export function unregisterIndicator(id: string): void {
    indicatorPlugins.delete(id);
    delete INDICATOR_META[id];
}

/** Get all registered indicator IDs. */
export function getRegisteredIndicators(): string[] {
    return Array.from(indicatorPlugins.keys());
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Indicators
// ─────────────────────────────────────────────────────────────────────────────

function registerBuiltins(): void {
    const closes  = (c: Candle[]) => c.map(x => x.close);
    const highs   = (c: Candle[]) => c.map(x => x.high);
    const lows    = (c: Candle[]) => c.map(x => x.low);
    const volumes = (c: Candle[]) => c.map(x => x.volume);
    const ts      = (c: Candle[]) => c.map(x => x.timestamp);

    // ── Moving Averages ───────────────────────────────────────────────────

    const maGroup = 'Moving Averages';

    registerIndicator('sma_10',  { label: 'SMA 10',   color: '#fb923c', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'sma_10',  INDICATOR_META['sma_10']!,  sma(closes(c), 10)));
    registerIndicator('sma_20',  { label: 'SMA 20',   color: '#f59e0b', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'sma_20',  INDICATOR_META['sma_20']!,  sma(closes(c), 20)));
    registerIndicator('sma_50',  { label: 'SMA 50',   color: '#3b82f6', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'sma_50',  INDICATOR_META['sma_50']!,  sma(closes(c), 50)));
    registerIndicator('sma_100', { label: 'SMA 100',  color: '#14b8a6', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'sma_100', INDICATOR_META['sma_100']!, sma(closes(c), 100)));
    registerIndicator('sma_200', { label: 'SMA 200',  color: '#ef4444', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'sma_200', INDICATOR_META['sma_200']!, sma(closes(c), 200)));

    registerIndicator('ema_9',   { label: 'EMA 9',    color: '#fbbf24', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_9',   INDICATOR_META['ema_9']!,   ema(closes(c), 9)));
    registerIndicator('ema_12',  { label: 'EMA 12',   color: '#a855f7', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_12',  INDICATOR_META['ema_12']!,  ema(closes(c), 12)));
    registerIndicator('ema_20',  { label: 'EMA 20',   color: '#f472b6', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_20',  INDICATOR_META['ema_20']!,  ema(closes(c), 20)));
    registerIndicator('ema_26',  { label: 'EMA 26',   color: '#ec4899', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_26',  INDICATOR_META['ema_26']!,  ema(closes(c), 26)));
    registerIndicator('ema_50',  { label: 'EMA 50',   color: '#8b5cf6', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_50',  INDICATOR_META['ema_50']!,  ema(closes(c), 50)));
    registerIndicator('ema_100', { label: 'EMA 100',  color: '#6366f1', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_100', INDICATOR_META['ema_100']!, ema(closes(c), 100)));
    registerIndicator('ema_200', { label: 'EMA 200',  color: '#e11d48', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'ema_200', INDICATOR_META['ema_200']!, ema(closes(c), 200)));

    registerIndicator('wma_20',  { label: 'WMA 20',   color: '#0ea5e9', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'wma_20',  INDICATOR_META['wma_20']!,  wma(closes(c), 20)));
    registerIndicator('dema_20', { label: 'DEMA 20',  color: '#10b981', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'dema_20', INDICATOR_META['dema_20']!, dema(closes(c), 20)));
    registerIndicator('tema_20', { label: 'TEMA 20',  color: '#f43f5e', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'tema_20', INDICATOR_META['tema_20']!, tema(closes(c), 20)));
    registerIndicator('hma_20',  { label: 'HMA 20',   color: '#84cc16', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'hma_20',  INDICATOR_META['hma_20']!,  hma(closes(c), 20)));
    registerIndicator('vwma_20', { label: 'VWMA 20',  color: '#d946ef', isSubPanel: false, group: maGroup },
        c => seriesFromValues(c, 'vwma_20', INDICATOR_META['vwma_20']!, vwma(closes(c), volumes(c), 20)));

    // ── Volatility ────────────────────────────────────────────────────────

    const volGroup = 'Volatility';

    registerIndicator('bb_20', { label: 'Bollinger Bands', color: '#06b6d4', isSubPanel: false, group: volGroup },
        c => {
            const cl = closes(c);
            const { upper, middle, lower } = bollingerBands(cl, 20, 2);
            const bollingerPoints: BollingerPoint[] = c.map((candle, i) => ({
                timestamp: candle.timestamp,
                upper: upper[i] ?? NaN, middle: middle[i] ?? NaN, lower: lower[i] ?? NaN,
            }));
            return { id: 'bb_20' as IndicatorId, label: 'Bollinger Bands', color: '#06b6d4', bollingerPoints, isSubPanel: false };
        });

    registerIndicator('keltner_20', { label: 'Keltner Channels', color: '#e879f9', isSubPanel: false, group: volGroup },
        c => {
            const { upper, middle, lower } = keltnerChannels(highs(c), lows(c), closes(c), 20, 10, 1.5);
            const bollingerPoints: BollingerPoint[] = c.map((candle, i) => ({
                timestamp: candle.timestamp,
                upper: upper[i] ?? NaN, middle: middle[i] ?? NaN, lower: lower[i] ?? NaN,
            }));
            return { id: 'keltner_20' as IndicatorId, label: 'Keltner Channels', color: '#e879f9', bollingerPoints, isSubPanel: false };
        });

    registerIndicator('donchian_20', { label: 'Donchian Channels', color: '#22d3ee', isSubPanel: false, group: volGroup },
        c => {
            const { upper, middle, lower } = donchianChannels(highs(c), lows(c), 20);
            const bollingerPoints: BollingerPoint[] = c.map((candle, i) => ({
                timestamp: candle.timestamp,
                upper: upper[i] ?? NaN, middle: middle[i] ?? NaN, lower: lower[i] ?? NaN,
            }));
            return { id: 'donchian_20' as IndicatorId, label: 'Donchian Channels', color: '#22d3ee', bollingerPoints, isSubPanel: false };
        });

    registerIndicator('atr_14', { label: 'ATR 14', color: '#f97316', isSubPanel: true, group: volGroup },
        c => subPanelSeries(c, 'atr_14', INDICATOR_META['atr_14']!, atrCalc(highs(c), lows(c), closes(c), 14)));

    registerIndicator('psar', { label: 'Parabolic SAR', color: '#facc15', isSubPanel: false, group: volGroup },
        c => seriesFromValues(c, 'psar', INDICATOR_META['psar']!, psarCalc(highs(c), lows(c))));

    // ── Momentum ──────────────────────────────────────────────────────────

    const momGroup = 'Momentum';

    registerIndicator('rsi_14', { label: 'RSI 14', color: '#8b5cf6', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'rsi_14', INDICATOR_META['rsi_14']!, rsiCalc(closes(c), 14), [0, 100]));

    registerIndicator('macd', { label: 'MACD', color: '#22c55e', isSubPanel: true, group: momGroup },
        c => {
            const cl = closes(c);
            const { macdLine, signalLine, histogram } = macdCalc(cl, 12, 26, 9);
            const macdPoints: MACDPoint[] = c.map((candle, i) => ({
                timestamp: candle.timestamp,
                macd: macdLine[i] ?? NaN, signal: signalLine[i] ?? NaN, histogram: histogram[i] ?? NaN,
            }));
            return { id: 'macd' as IndicatorId, label: 'MACD', color: '#22c55e', macdPoints, isSubPanel: true };
        });

    registerIndicator('stoch_14', { label: 'Stochastic (14,3)', color: '#3b82f6', isSubPanel: true, group: momGroup },
        c => {
            const { k, d } = stochasticCalc(highs(c), lows(c), closes(c), 14, 3);
            // Return %K as primary line; %D as points array won't work directly,
            // so we store %K in the points and note the indicator handles dual-line rendering.
            return subPanelSeries(c, 'stoch_14', INDICATOR_META['stoch_14']!, k, [0, 100]);
        });

    registerIndicator('stoch_rsi', { label: 'Stochastic RSI', color: '#06b6d4', isSubPanel: true, group: momGroup },
        c => {
            const { k } = stochRSICalc(closes(c), 14, 14, 3, 3);
            return subPanelSeries(c, 'stoch_rsi', INDICATOR_META['stoch_rsi']!, k, [0, 100]);
        });

    registerIndicator('williams_r', { label: 'Williams %R', color: '#ef4444', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'williams_r', INDICATOR_META['williams_r']!, williamsRCalc(highs(c), lows(c), closes(c), 14), [-100, 0]));

    registerIndicator('cci_20', { label: 'CCI 20', color: '#f59e0b', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'cci_20', INDICATOR_META['cci_20']!, cciCalc(highs(c), lows(c), closes(c), 20)));

    registerIndicator('mfi_14', { label: 'MFI 14', color: '#a855f7', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'mfi_14', INDICATOR_META['mfi_14']!, mfiCalc(highs(c), lows(c), closes(c), volumes(c), 14), [0, 100]));

    registerIndicator('roc_12', { label: 'ROC 12', color: '#ec4899', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'roc_12', INDICATOR_META['roc_12']!, rocCalc(closes(c), 12)));

    registerIndicator('momentum_10', { label: 'Momentum 10', color: '#14b8a6', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'momentum_10', INDICATOR_META['momentum_10']!, momentumCalc(closes(c), 10)));

    registerIndicator('ao', { label: 'Awesome Oscillator', color: '#22c55e', isSubPanel: true, group: momGroup },
        c => subPanelSeries(c, 'ao', INDICATOR_META['ao']!, aoCalc(highs(c), lows(c))));

    // ── Trend ─────────────────────────────────────────────────────────────

    const trendGroup = 'Trend';

    registerIndicator('adx_14', { label: 'ADX 14', color: '#f97316', isSubPanel: true, group: trendGroup },
        c => {
            const { adx: adxValues } = adxCalc(highs(c), lows(c), closes(c), 14);
            return subPanelSeries(c, 'adx_14', INDICATOR_META['adx_14']!, adxValues, [0, 100]);
        });

    registerIndicator('ichimoku', { label: 'Ichimoku Cloud', color: '#ef4444', isSubPanel: false, group: trendGroup },
        c => {
            const { tenkan, kijun } = ichimokuCalc(highs(c), lows(c), closes(c));
            // Show Tenkan-sen as the primary overlay line.
            // Full Ichimoku cloud rendering would need a custom renderer,
            // but we expose Tenkan + Kijun as overlay lines for now.
            const points = ts(c).map((t, i) => ({ timestamp: t, value: tenkan[i] ?? NaN }));
            return {
                id: 'ichimoku' as IndicatorId,
                label: 'Ichimoku (Tenkan)',
                color: '#ef4444',
                points,
                isSubPanel: false,
            };
        });

    registerIndicator('ichimoku_kijun', { label: 'Ichimoku Kijun', color: '#2563eb', isSubPanel: false, group: trendGroup },
        c => {
            const { kijun: kijunValues } = ichimokuCalc(highs(c), lows(c), closes(c));
            return seriesFromValues(c, 'ichimoku_kijun', INDICATOR_META['ichimoku_kijun']!, kijunValues);
        });

    // ── Volume ─────────────────────────────────────────────────────────────

    const volIndicatorGroup = 'Volume';

    registerIndicator('volume', { label: 'Volume', color: '#64748b', isSubPanel: false, group: volIndicatorGroup },
        () => null);

    registerIndicator('obv', { label: 'OBV', color: '#22c55e', isSubPanel: true, group: volIndicatorGroup },
        c => subPanelSeries(c, 'obv', INDICATOR_META['obv']!, obvCalc(closes(c), volumes(c))));

    registerIndicator('vwap', { label: 'VWAP', color: '#f43f5e', isSubPanel: false, group: volIndicatorGroup },
        c => seriesFromValues(c, 'vwap', INDICATOR_META['vwap']!, vwapCalc(highs(c), lows(c), closes(c), volumes(c))));

    registerIndicator('ad_line', { label: 'A/D Line', color: '#0ea5e9', isSubPanel: true, group: volIndicatorGroup },
        c => subPanelSeries(c, 'ad_line', INDICATOR_META['ad_line']!, adLineCalc(highs(c), lows(c), closes(c), volumes(c))));

    registerIndicator('cmf_20', { label: 'CMF 20', color: '#d946ef', isSubPanel: true, group: volIndicatorGroup },
        c => subPanelSeries(c, 'cmf_20', INDICATOR_META['cmf_20']!, cmfCalc(highs(c), lows(c), closes(c), volumes(c), 20)));
}

registerBuiltins();

// ─────────────────────────────────────────────────────────────────────────────
// Public Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the requested indicator for a candle dataset.
 * Supports both built-in IndicatorId values and custom string IDs.
 */
export function computeIndicator(candles: Candle[], id: IndicatorId | string): IndicatorSeries | null {
    if (candles.length === 0) return null;
    const plugin = indicatorPlugins.get(id);
    if (!plugin) return null;
    return plugin.compute(candles);
}

/**
 * Compute all active indicators and return as a map keyed by id.
 */
export function computeAllIndicators(
    candles: Candle[],
    activeIds: Set<IndicatorId | string>,
): Map<string, IndicatorSeries> {
    const result = new Map<string, IndicatorSeries>();
    for (const id of activeIds) {
        const series = computeIndicator(candles, id);
        if (series) result.set(id, series);
    }
    return result;
}
