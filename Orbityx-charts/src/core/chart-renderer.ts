/**
 * @file core/chart-renderer.ts
 * @description Canvas rendering methods extracted from ChartEngine.
 *
 * ChartRenderer is a stateless helper — all data is passed through the
 * RenderContext that ChartEngine builds on every frame. This keeps the
 * renderer unit-testable and the engine file under 500 lines.
 */
import type {
    Candle, ChartConfig, ChartState, ThemeColors,
    IndicatorSeries, Drawing, PricePoint,
    PriceAlert, CompareSeriesData, ReplayState,
} from '../types/index.js';
import type { PlotRect } from './viewport.js';
import {
    priceToY as vpPriceToY,
    indexToX as vpIndexToX,
    xToIndex as vpXToIndex,
    yToPrice as vpYToPrice,
    timestampToX as vpTimestampToX,
    candleStep,
    volumePanelH,
} from './viewport.js';
import { niceAxisTicks, niceLogTicks, isFiniteNumber } from '../utils/math.js';
import { axisLabel, formatDate } from '../utils/date.js';
import { formatPrice } from '../utils/format.js';

// ─────────────────────────────────────────────────────────────────────────────
// Render Context — everything the renderer needs for one frame
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderContext {
    ctx:            CanvasRenderingContext2D;
    config:         ChartConfig;
    state:          ChartState;
    colors:         ThemeColors;
    plot:           PlotRect;
    timeframe:      string;
    indicatorCache: Map<string, IndicatorSeries>;
    drawings:       Drawing[];
    draftDrawing:   Drawing | null;
    alerts:         PriceAlert[];
    compareSeries:  CompareSeriesData[];
    replay:         ReplayState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shorthand helpers
// ─────────────────────────────────────────────────────────────────────────────

function priceToY(r: RenderContext, price: number): number {
    return vpPriceToY(price, r.state, r.plot);
}
function indexToX(r: RenderContext, idx: number): number {
    return vpIndexToX(idx, r.config, r.state, r.plot);
}
function xToIndex(r: RenderContext, x: number): number {
    return vpXToIndex(x, r.config, r.state, r.plot);
}
function yToPrice(r: RenderContext, y: number): number {
    return vpYToPrice(y, r.state, r.plot);
}
function timestampToX(r: RenderContext, ts: number): number {
    return vpTimestampToX(ts, r.config, r.state, r.plot);
}
function step(r: RenderContext): number {
    return candleStep(r.config, r.state);
}
function bodyW(r: RenderContext): number {
    return Math.max(1, r.config.candleWidth * r.state.scaleX);
}
function halfW(r: RenderContext): number {
    return (r.config.candleWidth * r.state.scaleX) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Full render pipeline. Called once per frame by ChartEngine. */
export function renderFrame(r: RenderContext): void {
    drawBackground(r);
    drawGrid(r);
    drawPriceAxis(r);
    drawTimeAxis(r);
    drawCandles(r);
    drawCompareSeries(r);
    drawIndicatorOverlays(r);
    drawAlertLines(r);
    drawCurrentPriceLine(r);
    drawVolumePanelIfActive(r);
    drawSubPanels(r);
    drawDrawings(r);
    if (r.state.mouseInside) drawCrosshair(r);
    drawScaleBadge(r);
    drawMagnetBadge(r);
    if (r.replay.active) drawReplayOverlay(r);
}

/** Fallback when renderFrame throws. */
export function renderError(r: RenderContext, err: unknown): void {
    const { ctx, state, colors } = r;
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = colors.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = colors.textColor;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ Render error — see console for details', state.width / 2, state.height / 2);
    ctx.font = '11px monospace';
    ctx.fillStyle = colors.mutedText;
    ctx.fillText(
        String(err instanceof Error ? err.message : err).slice(0, 80),
        state.width / 2,
        state.height / 2 + 24,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Background
// ─────────────────────────────────────────────────────────────────────────────

function drawBackground(r: RenderContext): void {
    const { ctx, colors, plot, state } = r;
    ctx.fillStyle = colors.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = colors.panelBg;
    ctx.fillRect(plot.left, plot.top, plot.width, plot.height);
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid
// ─────────────────────────────────────────────────────────────────────────────

function drawGrid(r: RenderContext): void {
    const { ctx, colors, state, plot } = r;
    ctx.save();
    ctx.strokeStyle = colors.gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);

    const ticks = state.scaleType === 'logarithmic' && state.minPrice > 0
        ? niceLogTicks(state.minPrice, state.maxPrice, 8)
        : niceAxisTicks(state.minPrice, state.maxPrice, 8);
    for (const price of ticks) {
        const y = Math.round(priceToY(r, price)) + 0.5;
        if (y < plot.top || y > plot.bottom) continue;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
    }

    const vLines = Math.max(1, Math.floor(plot.width / 80));
    for (let i = 0; i <= vLines; i++) {
        const x = Math.round(plot.left + (i / vLines) * plot.width) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Axis (right)
// ─────────────────────────────────────────────────────────────────────────────

function drawPriceAxis(r: RenderContext): void {
    const { ctx, colors, state, plot, config } = r;
    ctx.save();
    ctx.fillStyle   = colors.textColor;
    ctx.font        = config.font;
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'middle';

    const ticks = state.scaleType === 'logarithmic' && state.minPrice > 0
        ? niceLogTicks(state.minPrice, state.maxPrice, 8)
        : niceAxisTicks(state.minPrice, state.maxPrice, 8);
    for (const price of ticks) {
        const y = Math.round(priceToY(r, price));
        if (y < plot.top || y > plot.bottom) continue;
        ctx.strokeStyle = colors.axisColor;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(plot.right, y);
        ctx.lineTo(plot.right + 4, y);
        ctx.stroke();
        ctx.fillText(formatPrice(price), plot.right + 7, y);
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Time Axis (bottom)
// ─────────────────────────────────────────────────────────────────────────────

function drawTimeAxis(r: RenderContext): void {
    const { ctx, colors, state, plot, config, timeframe } = r;
    if (!state.visibleData.length) return;
    ctx.save();
    ctx.fillStyle    = colors.mutedText;
    ctx.font         = config.fontSmall;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    const labelStep = Math.max(1, Math.round(state.visibleData.length / 8));
    for (let i = 0; i < state.visibleData.length; i += labelStep) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const x = indexToX(r, i) + halfW(r);
        if (x < plot.left + 20 || x > plot.right - 20) continue;
        ctx.fillText(axisLabel(candle.timestamp, timeframe), x, plot.bottom + 5);
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Candle Rendering
// ─────────────────────────────────────────────────────────────────────────────

function drawCandles(r: RenderContext): void {
    switch (r.state.chartType) {
        case 'line':           return drawLineChart(r);
        case 'area':           return drawAreaChart(r);
        case 'heikin_ashi':    return drawHeikinAshi(r);
        case 'bars':           return drawBars(r);
        case 'hollow_candle':  return drawHollowCandlesticks(r);
        case 'baseline':       return drawBaselineChart(r);
        default:               return drawCandlesticks(r);
    }
}

function drawCandlesticks(r: RenderContext): void {
    const { ctx, colors, state } = r;
    const bw = bodyW(r);
    ctx.save();

    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const isUp   = candle.close >= candle.open;
        const x      = indexToX(r, i);
        const cx     = x + bw / 2;
        const openY  = priceToY(r, candle.open);
        const closeY = priceToY(r, candle.close);
        const highY  = priceToY(r, candle.high);
        const lowY   = priceToY(r, candle.low);

        ctx.strokeStyle = isUp ? colors.upWick : colors.downWick;
        ctx.lineWidth   = Math.max(1, state.scaleX * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, highY);
        ctx.lineTo(cx, lowY);
        ctx.stroke();

        const bodyTop = Math.min(openY, closeY);
        const bodyH   = Math.max(1, Math.abs(openY - closeY));
        ctx.fillStyle = isUp ? colors.upColor : colors.downColor;
        ctx.fillRect(x, bodyTop, bw, bodyH);

        if (bw > 3) {
            ctx.strokeStyle = isUp ? colors.upColor : colors.downColor;
            ctx.lineWidth   = 1;
            ctx.strokeRect(x, bodyTop, bw, bodyH);
        }
    }
    ctx.restore();
}

function drawHeikinAshi(r: RenderContext): void {
    const ha  = computeHeikinAshi(r.state.visibleData);
    const { ctx, colors } = r;
    const bw = bodyW(r);
    ctx.save();

    for (let i = 0; i < ha.length; i++) {
        const candle = ha[i];
        if (!candle) continue;
        const isUp = candle.close >= candle.open;
        const x    = indexToX(r, i);
        const cx   = x + bw / 2;

        ctx.strokeStyle = isUp ? colors.upWick : colors.downWick;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cx, priceToY(r, candle.high));
        ctx.lineTo(cx, priceToY(r, candle.low));
        ctx.stroke();

        const bodyTop = Math.min(priceToY(r, candle.open), priceToY(r, candle.close));
        const bodyH   = Math.max(1, Math.abs(priceToY(r, candle.open) - priceToY(r, candle.close)));
        ctx.fillStyle = isUp ? colors.upColor : colors.downColor;
        ctx.fillRect(x, bodyTop, bw, bodyH);
    }
    ctx.restore();
}

function computeHeikinAshi(candles: Candle[]): Candle[] {
    const ha: Candle[] = [];
    for (let i = 0; i < candles.length; i++) {
        const cur = candles[i];
        if (!cur) continue;
        const haClose = (cur.open + cur.high + cur.low + cur.close) / 4;
        const prev    = ha[i - 1];
        const haOpen  = i === 0 || !prev
            ? (cur.open + cur.close) / 2
            : (prev.open + prev.close) / 2;
        ha.push({
            timestamp: cur.timestamp,
            open:      haOpen,
            high:      Math.max(cur.high, haOpen, haClose),
            low:       Math.min(cur.low,  haOpen, haClose),
            close:     haClose,
            volume:    cur.volume,
        });
    }
    return ha;
}

function drawBars(r: RenderContext): void {
    const { ctx, colors, state } = r;
    const st = step(r);
    ctx.save();

    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const isUp = candle.close >= candle.open;
        const cx   = indexToX(r, i) + st / 2;
        const tick = Math.min(4, st * 0.35);

        ctx.strokeStyle = isUp ? colors.upColor : colors.downColor;
        ctx.lineWidth   = Math.max(1, state.scaleX * 0.8);

        ctx.beginPath();
        ctx.moveTo(cx, priceToY(r, candle.high));
        ctx.lineTo(cx, priceToY(r, candle.low));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - tick, priceToY(r, candle.open));
        ctx.lineTo(cx, priceToY(r, candle.open));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, priceToY(r, candle.close));
        ctx.lineTo(cx + tick, priceToY(r, candle.close));
        ctx.stroke();
    }
    ctx.restore();
}

function drawLineChart(r: RenderContext): void {
    const { ctx, colors, state } = r;
    ctx.save();
    ctx.strokeStyle = colors.priceLineColor;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();

    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const x = indexToX(r, i) + halfW(r);
        const y = priceToY(r, candle.close);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

function drawAreaChart(r: RenderContext): void {
    const { ctx, colors, state, plot } = r;
    if (!state.visibleData.length) return;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineJoin  = 'round';

    const grad = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    grad.addColorStop(0, 'rgba(34,197,94,0.25)');
    grad.addColorStop(1, 'rgba(34,197,94,0.01)');
    ctx.fillStyle = grad;

    const hw = halfW(r);

    ctx.beginPath();
    ctx.moveTo(indexToX(r, 0) + hw, plot.bottom);
    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        ctx.lineTo(indexToX(r, i) + hw, priceToY(r, candle.close));
    }
    ctx.lineTo(indexToX(r, state.visibleData.length - 1) + hw, plot.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colors.priceLineColor;
    ctx.beginPath();
    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const x = indexToX(r, i) + hw;
        const y = priceToY(r, candle.close);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Current Price Line
// ─────────────────────────────────────────────────────────────────────────────

function drawCurrentPriceLine(r: RenderContext): void {
    const { ctx, colors, state, plot, config } = r;
    if (!state.currentPrice) return;
    const y = priceToY(r, state.currentPrice);
    if (y < plot.top || y > plot.bottom) return;

    ctx.save();
    ctx.strokeStyle = colors.priceLineColor;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const label   = formatPrice(state.currentPrice);
    const padding = 4;
    const tagW    = ctx.measureText(label).width + padding * 2 + 10;
    ctx.fillStyle = colors.priceLineColor;
    ctx.beginPath();
    ctx.roundRect(plot.right + 2, y - 9, tagW, 18, 3);
    ctx.fill();
    ctx.fillStyle    = colors.bgColor;
    ctx.font         = `bold ${config.fontSmall}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, plot.right + 7, y + 0.5);
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume Panel
// ─────────────────────────────────────────────────────────────────────────────

function drawVolumePanelIfActive(r: RenderContext): void {
    if (!r.state.activeIndicators.has('volume')) return;
    drawVolumePanel(r);
}

export function drawVolumePanel(r: RenderContext): void {
    const { ctx, colors, state, plot, config } = r;
    if (!state.visibleData.length) return;
    const panelTop = plot.bottom + config.volumePanelGap;
    const panelH   = volumePanelH(config, state);
    const bw       = bodyW(r);
    const maxVol   = Math.max(1, ...state.visibleData.map(c => c.volume));

    ctx.fillStyle = colors.panelBg;
    ctx.fillRect(plot.left, panelTop, plot.width, panelH);

    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const isUp = candle.close >= candle.open;
        const barH = Math.max(1, (candle.volume / maxVol) * panelH);
        ctx.fillStyle = isUp ? colors.volumeUp : colors.volumeDown;
        ctx.fillRect(indexToX(r, i), panelTop + panelH - barH, bw, barH);
    }

    ctx.strokeStyle = colors.axisColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, panelTop);
    ctx.lineTo(plot.right, panelTop);
    ctx.stroke();

    ctx.fillStyle    = colors.mutedText;
    ctx.font         = '10px sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('VOL', plot.left + 4, panelTop + 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator Overlays
// ─────────────────────────────────────────────────────────────────────────────

function drawIndicatorOverlays(r: RenderContext): void {
    for (const [, series] of r.indicatorCache) {
        if (series.isSubPanel) continue;
        if (series.bollingerPoints) {
            drawBollingerBands(r, series);
        } else if (series.points) {
            drawLineSeries(r, series.points, series.color ?? 'rgba(96,195,255,0.8)');
        }
    }
}

function drawLineSeries(
    r:      RenderContext,
    points: { timestamp: number; value: number }[],
    color:  string,
): void {
    const { ctx, state } = r;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < state.visibleData.length; i++) {
        const pt = points[state.viewportStart + i];
        if (!pt || !isFiniteNumber(pt.value)) { started = false; continue; }
        const x = indexToX(r, i) + halfW(r);
        const y = priceToY(r, pt.value);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.restore();
}

function drawBollingerBands(r: RenderContext, series: IndicatorSeries): void {
    if (!series.bollingerPoints) return;
    const { ctx, state } = r;
    const pts = series.bollingerPoints;
    const seriesColor = series.color ?? 'rgba(6,182,212,0.8)';

    const drawBand = (
        getter: (p: typeof pts[0]) => number,
        color:  string,
        dash?:  number[],
    ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = pts[state.viewportStart + i];
            if (!pt || !isFiniteNumber(getter(pt))) { started = false; continue; }
            const x = indexToX(r, i) + halfW(r);
            const y = priceToY(r, getter(pt));
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        if (dash) ctx.setLineDash([]);
        ctx.restore();
    };

    drawBand(p => p.upper,  seriesColor);
    drawBand(p => p.lower,  seriesColor);
    drawBand(p => p.middle, seriesColor, [4, 4]);

    const fillColor: string = seriesColor.includes('rgb')
        ? seriesColor.replace(')', ', 0.06)').replace('rgb(', 'rgba(')
        : 'rgba(6,182,212,0.06)';

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < state.visibleData.length; i++) {
        const pt = pts[state.viewportStart + i];
        if (!pt || !isFiniteNumber(pt.upper)) { started = false; continue; }
        const x = indexToX(r, i) + halfW(r);
        if (!started) { ctx.moveTo(x, priceToY(r, pt.upper)); started = true; }
        else { ctx.lineTo(x, priceToY(r, pt.upper)); }
    }
    for (let i = state.visibleData.length - 1; i >= 0; i--) {
        const pt = pts[state.viewportStart + i];
        if (!pt || !isFiniteNumber(pt.lower)) continue;
        const x = indexToX(r, i) + halfW(r);
        ctx.lineTo(x, priceToY(r, pt.lower));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Panels (RSI, MACD)
// ─────────────────────────────────────────────────────────────────────────────

function getSubPanelIds(r: RenderContext): string[] {
    const ids: string[] = [];
    for (const [id, series] of r.indicatorCache) {
        if (series.isSubPanel) ids.push(id);
    }
    return ids;
}

function drawSubPanels(r: RenderContext): void {
    const ids = getSubPanelIds(r);
    if (!ids.length) return;

    const { config, plot, state } = r;
    let panelTop = plot.bottom + config.volumePanelGap;
    if (state.activeIndicators.has('volume')) {
        panelTop += volumePanelH(config, state) + config.volumePanelGap;
    }
    for (const id of ids) {
        const series = r.indicatorCache.get(id);
        if (!series) continue;
        drawSubPanel(r, series, panelTop);
        panelTop += config.subPanelHeight + config.volumePanelGap;
    }
}

function drawSubPanel(r: RenderContext, series: IndicatorSeries, panelTop: number): void {
    const { ctx, colors, state, config, plot } = r;
    const panelH = config.subPanelHeight;

    ctx.fillStyle = colors.panelBg;
    ctx.fillRect(plot.left, panelTop, plot.width, panelH);

    ctx.strokeStyle = colors.axisColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, panelTop);
    ctx.lineTo(plot.right, panelTop);
    ctx.stroke();

    ctx.fillStyle    = colors.mutedText;
    ctx.font         = '10px sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(series.label, plot.left + 4, panelTop + 3);

    let rangeMin = 0, rangeMax = 100;
    if (series.subPanelRange) {
        [rangeMin, rangeMax] = series.subPanelRange;
    } else if (series.macdPoints) {
        const vals: number[] = [];
        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = series.macdPoints[state.viewportStart + i];
            if (pt) vals.push(pt.macd, pt.signal, pt.histogram);
        }
        const v = vals.filter(isFiniteNumber);
        if (v.length) {
            const rng = Math.max(Math.abs(Math.min(...v)), Math.abs(Math.max(...v)));
            rangeMin = -rng * 1.1;
            rangeMax =  rng * 1.1;
        }
    }

    const toY = (v: number) =>
        panelTop + panelH - ((v - rangeMin) / (rangeMax - rangeMin)) * panelH;

    if (series.id === 'rsi_14') {
        for (const ref of [30, 50, 70]) {
            const y = toY(ref);
            ctx.strokeStyle = ref === 50 ? colors.mutedText : colors.gridColor;
            ctx.lineWidth   = 1;
            ctx.setLineDash(ref === 50 ? [] : [3, 5]);
            ctx.beginPath();
            ctx.moveTo(plot.left, y);
            ctx.lineTo(plot.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle    = colors.mutedText;
            ctx.font         = '9px monospace';
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(ref), plot.right - 2, y);
        }
    }

    if (series.points) {
        const seriesColor = series.color ?? 'rgba(96,195,255,0.8)';
        ctx.save();
        ctx.strokeStyle = seriesColor;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = series.points[state.viewportStart + i];
            if (!pt || !isFiniteNumber(pt.value)) { started = false; continue; }
            const x = indexToX(r, i) + halfW(r);
            const y = toY(pt.value);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.restore();
    }

    if (series.macdPoints) {
        const zeroY = toY(0);
        const bw = bodyW(r);

        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = series.macdPoints[state.viewportStart + i];
            if (!pt || !isFiniteNumber(pt.histogram)) continue;
            const x      = indexToX(r, i);
            const histY  = toY(pt.histogram);
            const barTop = Math.min(histY, zeroY);
            const barH   = Math.abs(histY - zeroY);
            ctx.fillStyle = pt.histogram >= 0
                ? 'rgba(34,197,94,0.5)'
                : 'rgba(239,68,68,0.5)';
            ctx.fillRect(x, barTop, bw, barH);
        }

        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        let s = false;
        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = series.macdPoints[state.viewportStart + i];
            if (!pt || !isFiniteNumber(pt.macd)) { s = false; continue; }
            const x = indexToX(r, i) + bw / 2;
            const y = toY(pt.macd);
            if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        s = false;
        for (let i = 0; i < state.visibleData.length; i++) {
            const pt = series.macdPoints[state.viewportStart + i];
            if (!pt || !isFiniteNumber(pt.signal)) { s = false; continue; }
            const x = indexToX(r, i) + bw / 2;
            const y = toY(pt.signal);
            if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crosshair
// ─────────────────────────────────────────────────────────────────────────────

function drawCrosshair(r: RenderContext): void {
    const { ctx, colors, state, plot } = r;
    const { mouseX: mx, mouseY: my } = state;
    if (mx < plot.left || mx > plot.right) return;
    if (my < plot.top  || my > plot.bottom) return;

    ctx.save();
    ctx.strokeStyle = colors.crosshairColor;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);

    ctx.beginPath();
    ctx.moveTo(plot.left, my);
    ctx.lineTo(plot.right, my);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mx, plot.top);
    ctx.lineTo(mx, plot.bottom);
    ctx.stroke();

    ctx.setLineDash([]);

    const price  = yToPrice(r, my);
    const pLabel = formatPrice(price);
    const tagW   = ctx.measureText(pLabel).width + 14;
    ctx.fillStyle    = colors.crosshairColor;
    ctx.beginPath();
    ctx.roundRect(plot.right + 2, my - 9, tagW, 18, 3);
    ctx.fill();
    ctx.fillStyle    = '#fff';
    ctx.font         = '10px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(pLabel, plot.right + 6, my + 0.5);

    const idx = xToIndex(r, mx);
    if (idx >= 0 && idx < state.visibleData.length) {
        const candle = state.visibleData[idx];
        if (candle) {
            const tLabel = formatDate(candle.timestamp, 'DD MMM YY HH:mm');
            const tW     = ctx.measureText(tLabel).width + 14;
            const tX     = Math.max(plot.left, Math.min(mx - tW / 2, plot.right - tW));
            ctx.fillStyle = colors.crosshairColor;
            ctx.beginPath();
            ctx.roundRect(tX, plot.bottom + 2, tW, 16, 3);
            ctx.fill();
            ctx.fillStyle  = '#fff';
            ctx.textAlign  = 'center';
            ctx.fillText(tLabel, tX + tW / 2, plot.bottom + 10);
        }
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing Tools
// ─────────────────────────────────────────────────────────────────────────────

function drawDrawings(r: RenderContext): void {
    const all = [...r.drawings, ...(r.draftDrawing ? [r.draftDrawing] : [])];
    for (const drawing of all) renderDrawing(r, drawing);
}

function renderDrawing(r: RenderContext, drawing: Drawing): void {
    if (!drawing.points.length) return;
    const { ctx, colors, plot } = r;
    ctx.save();
    ctx.strokeStyle = drawing.isDraft ? colors.crosshairColor : drawing.color;
    ctx.lineWidth   = drawing.lineWidth;
    ctx.setLineDash(drawing.isDraft ? [4, 4] : []);

    const toXY = (pp: PricePoint): [number, number] => [
        timestampToX(r, pp.timestamp),
        priceToY(r, pp.price),
    ];

    switch (drawing.type) {
        case 'trendline': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0];
            const p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
        }
        case 'horizontal': {
            const p0 = drawing.points[0];
            if (!p0) break;
            const y = priceToY(r, p0.price);
            ctx.beginPath();
            ctx.moveTo(plot.left, y);
            ctx.lineTo(plot.right, y);
            ctx.stroke();
            ctx.fillStyle    = drawing.color;
            ctx.font         = '10px monospace';
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(formatPrice(p0.price), plot.right - 4, y - 2);
            break;
        }
        case 'fibonacci': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0];
            const p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [, y1] = toXY(p0);
            const [, y2] = toXY(p1);
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const fibColors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];
            for (let li = 0; li < levels.length; li++) {
                const level = levels[li];
                if (level === undefined) continue;
                const y = y2 + (y1 - y2) * level;
                ctx.strokeStyle  = fibColors[li % fibColors.length] ?? '#ffffff';
                ctx.beginPath();
                ctx.moveTo(plot.left, y);
                ctx.lineTo(plot.right, y);
                ctx.stroke();
                ctx.fillStyle    = fibColors[li % fibColors.length] ?? '#ffffff';
                ctx.font         = '9px monospace';
                ctx.textAlign    = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${(level * 100).toFixed(1)}%`, plot.right - 4, y - 1);
            }
            break;
        }
        case 'rectangle': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0];
            const p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
            ctx.fillStyle = drawing.color
                .replace(')', ', 0.08)')
                .replace('rgb(', 'rgba(');
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
            break;
        }
        case 'vertical': {
            const p0 = drawing.points[0];
            if (!p0) break;
            const x = timestampToX(r, p0.timestamp);
            if (x < 0) break;
            ctx.beginPath();
            ctx.moveTo(x, plot.top);
            ctx.lineTo(x, plot.bottom);
            ctx.stroke();
            break;
        }
        case 'ray': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0], p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            const dx = x2 - x1, dy = y2 - y1;
            const ext = Math.max(plot.width, plot.height) * 3;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 + (dx / len) * ext, y1 + (dy / len) * ext);
            ctx.stroke();
            drawEndpoint(ctx, x1, y1, drawing.color);
            break;
        }
        case 'extended_line': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0], p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            const dx = x2 - x1, dy = y2 - y1;
            const ext = Math.max(plot.width, plot.height) * 3;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            ctx.beginPath();
            ctx.moveTo(x1 - (dx / len) * ext, y1 - (dy / len) * ext);
            ctx.lineTo(x1 + (dx / len) * ext, y1 + (dy / len) * ext);
            ctx.stroke();
            break;
        }
        case 'parallel_channel': {
            if (drawing.points.length < 3) break;
            const p0 = drawing.points[0], p1 = drawing.points[1], p2 = drawing.points[2];
            if (!p0 || !p1 || !p2) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            const [, y3] = toXY(p2);
            if (x1 < 0 || x2 < 0) break;
            const dy = y3 - y1;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x1, y1 + dy); ctx.lineTo(x2, y2 + dy); ctx.stroke();
            ctx.fillStyle = drawing.color.replace(')', ', 0.06)').replace('rgb(', 'rgba(');
            ctx.beginPath();
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.lineTo(x2, y2 + dy); ctx.lineTo(x1, y1 + dy);
            ctx.closePath(); ctx.fill();
            break;
        }
        case 'pitchfork': {
            if (drawing.points.length < 3) break;
            const pA = drawing.points[0], pB = drawing.points[1], pC = drawing.points[2];
            if (!pA || !pB || !pC) break;
            const [xA, yA] = toXY(pA);
            const [xB, yB] = toXY(pB);
            const [xC, yC] = toXY(pC);
            if (xA < 0 || xB < 0 || xC < 0) break;
            const midX = (xB + xC) / 2, midY = (yB + yC) / 2;
            // Median line
            const dx = midX - xA, dy = midY - yA;
            const ext = Math.max(plot.width, plot.height) * 2;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            ctx.beginPath(); ctx.moveTo(xA, yA);
            ctx.lineTo(xA + (dx / len) * ext, yA + (dy / len) * ext); ctx.stroke();
            // Upper prong (from B)
            ctx.beginPath(); ctx.moveTo(xB, yB);
            ctx.lineTo(xB + (dx / len) * ext, yB + (dy / len) * ext); ctx.stroke();
            // Lower prong (from C)
            ctx.beginPath(); ctx.moveTo(xC, yC);
            ctx.lineTo(xC + (dx / len) * ext, yC + (dy / len) * ext); ctx.stroke();
            drawEndpoint(ctx, xA, yA, drawing.color);
            drawEndpoint(ctx, xB, yB, drawing.color);
            drawEndpoint(ctx, xC, yC, drawing.color);
            break;
        }
        case 'arrow': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0], p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            // Arrowhead
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 12;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
            break;
        }
        case 'text': {
            const p0 = drawing.points[0];
            if (!p0 || !drawing.text) break;
            const x = timestampToX(r, p0.timestamp);
            const y = priceToY(r, p0.price);
            if (x < 0) break;
            ctx.fillStyle = drawing.color;
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(drawing.text, x + 4, y - 4);
            break;
        }
        case 'measure': {
            if (drawing.points.length < 2) break;
            const p0 = drawing.points[0], p1 = drawing.points[1];
            if (!p0 || !p1) break;
            const [x1, y1] = toXY(p0);
            const [x2, y2] = toXY(p1);
            if (x1 < 0 || x2 < 0) break;
            // Dashed connecting line
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.setLineDash([]);
            // Measure box
            const priceDelta = p1.price - p0.price;
            const pricePct = p0.price !== 0 ? (priceDelta / p0.price) * 100 : 0;
            const timeDelta = Math.abs(p1.timestamp - p0.timestamp);
            const days = Math.floor(timeDelta / 86400000);
            const hours = Math.floor((timeDelta % 86400000) / 3600000);
            const sign = priceDelta >= 0 ? '+' : '';
            const label = `${sign}${formatPrice(priceDelta)} (${sign}${pricePct.toFixed(2)}%)  ${days}d ${hours}h`;
            const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
            const tw = ctx.measureText(label).width + 12;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath(); ctx.roundRect(midX - tw / 2, midY - 12, tw, 20, 4); ctx.fill();
            ctx.fillStyle = priceDelta >= 0 ? '#22c55e' : '#ef4444';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
            drawEndpoint(ctx, x1, y1, drawing.color);
            drawEndpoint(ctx, x2, y2, drawing.color);
            break;
        }
    }
    ctx.setLineDash([]);
    ctx.restore();
}

function drawEndpoint(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hollow Candlesticks
// ─────────────────────────────────────────────────────────────────────────────

function drawHollowCandlesticks(r: RenderContext): void {
    const { ctx, colors, state } = r;
    const bw = bodyW(r);
    ctx.save();

    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        const isUp   = candle.close >= candle.open;
        const x      = indexToX(r, i);
        const cx     = x + bw / 2;
        const openY  = priceToY(r, candle.open);
        const closeY = priceToY(r, candle.close);
        const highY  = priceToY(r, candle.high);
        const lowY   = priceToY(r, candle.low);

        // Wicks
        ctx.strokeStyle = isUp ? colors.upWick : colors.downWick;
        ctx.lineWidth   = Math.max(1, state.scaleX * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, highY);
        ctx.lineTo(cx, lowY);
        ctx.stroke();

        const bodyTop = Math.min(openY, closeY);
        const bodyH   = Math.max(1, Math.abs(openY - closeY));

        if (isUp) {
            // Hollow body — stroke only
            ctx.strokeStyle = colors.upColor;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, bodyTop, bw, bodyH);
        } else {
            // Filled body
            ctx.fillStyle = colors.downColor;
            ctx.fillRect(x, bodyTop, bw, bodyH);
        }
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline Chart
// ─────────────────────────────────────────────────────────────────────────────

function drawBaselineChart(r: RenderContext): void {
    const { ctx, state, plot } = r;
    if (!state.visibleData.length) return;
    ctx.save();

    const baseline = state.baselinePrice || state.visibleData[0]!.close;
    const baseY    = priceToY(r, baseline);
    const hw       = halfW(r);

    // Draw area above baseline (green) and below (red)
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        if (!candle) continue;
        xs.push(indexToX(r, i) + hw);
        ys.push(priceToY(r, candle.close));
    }
    if (!xs.length) { ctx.restore(); return; }

    // Green fill (above baseline)
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.left, plot.top, plot.width, baseY - plot.top);
    ctx.clip();
    ctx.fillStyle = 'rgba(34,197,94,0.12)';
    ctx.beginPath();
    ctx.moveTo(xs[0]!, baseY);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i]!, ys[i]!);
    ctx.lineTo(xs[xs.length - 1]!, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Red fill (below baseline)
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.left, baseY, plot.width, plot.bottom - baseY);
    ctx.clip();
    ctx.fillStyle = 'rgba(239,68,68,0.12)';
    ctx.beginPath();
    ctx.moveTo(xs[0]!, baseY);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i]!, ys[i]!);
    ctx.lineTo(xs[xs.length - 1]!, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Line (green above, red below — use single color for simplicity)
    ctx.strokeStyle = 'rgba(96,195,255,0.9)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
        i === 0 ? ctx.moveTo(xs[i]!, ys[i]!) : ctx.lineTo(xs[i]!, ys[i]!);
    }
    ctx.stroke();

    // Baseline dashed line
    ctx.strokeStyle = 'rgba(120,140,160,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.left, baseY);
    ctx.lineTo(plot.right, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Lines
// ─────────────────────────────────────────────────────────────────────────────

function drawAlertLines(r: RenderContext): void {
    if (!r.alerts.length) return;
    const { ctx, plot, config } = r;
    ctx.save();

    for (const alert of r.alerts) {
        if (!alert.enabled) continue;
        const y = priceToY(r, alert.price);
        if (y < plot.top || y > plot.bottom) continue;

        ctx.strokeStyle = alert.color || '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Alert label
        const label = `⚠ ${formatPrice(alert.price)}`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = alert.triggered ? 'rgba(239,68,68,0.8)' : (alert.color || '#f59e0b');
        ctx.beginPath();
        ctx.roundRect(plot.right + 2, y - 9, tw, 18, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${config.fontSmall}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, plot.right + 5, y + 0.5);
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare / Overlay Series
// ─────────────────────────────────────────────────────────────────────────────

function drawCompareSeries(r: RenderContext): void {
    if (!r.compareSeries.length || !r.state.visibleData.length) return;
    const { ctx, state, plot } = r;
    const hw = halfW(r);
    const mainBase = state.visibleData[0]!.close;
    if (mainBase === 0) return;

    ctx.save();
    for (const series of r.compareSeries) {
        if (!series.data.length) continue;
        ctx.strokeStyle = series.color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.setLineDash([4, 2]);
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < state.visibleData.length; i++) {
            const mainCandle = state.visibleData[i];
            if (!mainCandle) continue;
            // Find matching candle in compare data by timestamp
            const cmpCandle = series.data.find(c => c.timestamp === mainCandle.timestamp);
            if (!cmpCandle) continue;
            // Normalize to percentage of base
            const pctMain = ((mainCandle.close - mainBase) / mainBase);
            const pctCmp  = ((cmpCandle.close - series.basePrice) / series.basePrice);
            // Map compare % to main chart price space
            const mappedPrice = mainBase * (1 + pctCmp);
            const x = indexToX(r, i) + hw;
            const y = priceToY(r, mappedPrice);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        if (started) {
            ctx.fillStyle = series.color;
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(series.symbol, plot.left + 6, plot.top + 6 + r.compareSeries.indexOf(series) * 14);
        }
    }
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale & Magnet Badges
// ─────────────────────────────────────────────────────────────────────────────

function drawScaleBadge(r: RenderContext): void {
    if (r.state.scaleType === 'linear') return;
    const { ctx, plot } = r;
    const label = r.state.scaleType === 'logarithmic' ? 'LOG' : '%';
    ctx.save();
    ctx.fillStyle = 'rgba(96,195,255,0.15)';
    const tw = ctx.measureText(label).width + 12;
    ctx.beginPath();
    ctx.roundRect(plot.right - tw - 4, plot.top + 4, tw, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(96,195,255,0.9)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, plot.right - tw / 2 - 4, plot.top + 13);
    ctx.restore();
}

function drawMagnetBadge(r: RenderContext): void {
    if (!r.state.magnetEnabled) return;
    const { ctx, plot } = r;
    ctx.save();
    ctx.fillStyle = 'rgba(250,204,21,0.15)';
    ctx.beginPath();
    ctx.roundRect(plot.right - 52, plot.top + 26, 48, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(250,204,21,0.9)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAGNET', plot.right - 28, plot.top + 35);
    ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Replay Overlay
// ─────────────────────────────────────────────────────────────────────────────

function drawReplayOverlay(r: RenderContext): void {
    const { ctx, state, replay } = r;
    ctx.save();
    // Replay progress bar
    const barW = 200, barH = 4;
    const barX = (state.width - barW) / 2, barY = 12;
    const progress = replay.fullData.length > 0 ? replay.cursor / (replay.fullData.length - 1) : 0;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 2); ctx.fill();
    ctx.fillStyle = 'rgba(96,195,255,0.8)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 2); ctx.fill();

    // Status text
    const status = replay.paused ? '⏸ PAUSED' : `▶ ${replay.speed}x`;
    const dateStr = state.data.length ? formatDate(state.data[state.data.length - 1]!.timestamp, 'DD MMM YYYY') : '';
    ctx.fillStyle = 'rgba(96,195,255,0.9)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`REPLAY  ${status}  ${dateStr}  [${replay.cursor + 1}/${replay.fullData.length}]`, state.width / 2, barY + 8);
    ctx.restore();
}
