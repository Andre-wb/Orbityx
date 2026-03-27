/**
 * @file core/chart-engine.ts
 * @description Chart engine — state management, event handling, render scheduling.
 *
 * SOLID refactoring:
 *   - SRP: Delegates alerts to AlertManager, replay to ReplayController,
 *          drawings to DrawingManager, screenshots to ScreenshotService.
 *   - OCP: Chart types via ChartTypeRegistry, drawing tools via DrawingToolRegistry.
 *   - DIP: Implements IChartControls so UI modules depend on the interface.
 *   - ISP: State split into ViewportState, CanvasState, InteractionState, DisplayState.
 */
import type {
    Candle, ChartConfig, ChartState, ThemeColors, ChartType,
    DrawingMode, IndicatorId, IndicatorSeries, PricePoint,
    ScaleType, PriceAlert, CompareSeriesData, ReplayState,
    IChartControls,
} from '../types/index.js';
import { clamp } from '../utils/math.js';
import { computeAllIndicators, computeIndicator } from './indicators.js';
import {
    computePlotRect, computeVisibleData, candleStep,
    priceToY as vpPriceToY,
    indexToX as vpIndexToX,
    xToIndex as vpXToIndex,
    yToPrice as vpYToPrice,
    timestampToX as vpTimestampToX,
    maxVisibleCandles,
    type PlotRect,
} from './viewport.js';
import { renderFrame, renderError, type RenderContext } from './chart-renderer.js';
import { AlertManager } from './alert-manager.js';
import { ReplayController } from './replay-controller.js';
import { DrawingManager } from './drawing-manager.js';
import { ScreenshotService } from './screenshot-service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Readonly<ChartConfig> = {
    theme: 'dark',
    candleWidth: 8,
    candleSpacing: 2,
    volumePanelRatio: 0.18,
    volumePanelGap: 4,
    margin: { top: 40, right: 80, bottom: 32, left: 10 },
    lazyLoadThreshold: 80,
    pricePadding: 0.05,
    pricePaddingFlat: 0.02,
    subPanelHeight: 100,
    zoomMin: 0.2,
    zoomMax: 20,
    zoomStep: 1.25,
    keyScrollStep: 5,
    font: '11px "JetBrains Mono", "Roboto Mono", monospace',
    fontSmall: '10px "JetBrains Mono", "Roboto Mono", monospace',
    darkTheme: {
        upColor: 'rgba(34,197,94,0.85)', downColor: 'rgba(239,68,68,0.85)',
        upWick: 'rgba(34,197,94,0.7)', downWick: 'rgba(239,68,68,0.7)',
        bgColor: '#0f141b', panelBg: '#0b0f14',
        gridColor: 'rgba(42,58,72,0.7)', axisColor: 'rgba(55,75,90,0.9)',
        textColor: 'rgba(200,210,220,0.9)', mutedText: 'rgba(120,140,160,0.7)',
        priceLineColor: 'rgba(96,195,255,0.8)', crosshairColor: 'rgba(120,160,200,0.6)',
        selectionColor: 'rgba(96,195,255,0.12)',
        volumeUp: 'rgba(34,197,94,0.35)', volumeDown: 'rgba(239,68,68,0.35)',
    },
    lightTheme: {
        upColor: 'rgba(22,163,74,0.85)', downColor: 'rgba(220,38,38,0.85)',
        upWick: 'rgba(22,163,74,0.7)', downWick: 'rgba(220,38,38,0.7)',
        bgColor: '#f8fafc', panelBg: '#f1f5f9',
        gridColor: 'rgba(200,210,220,0.6)', axisColor: 'rgba(160,175,190,0.9)',
        textColor: 'rgba(30,40,55,0.9)', mutedText: 'rgba(100,115,130,0.8)',
        priceLineColor: 'rgba(37,99,235,0.7)', crosshairColor: 'rgba(37,99,235,0.4)',
        selectionColor: 'rgba(37,99,235,0.1)',
        volumeUp: 'rgba(22,163,74,0.3)', volumeDown: 'rgba(220,38,38,0.3)',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart Engine — implements IChartControls (DIP)
// ─────────────────────────────────────────────────────────────────────────────

export default class ChartEngine implements IChartControls {
    readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private dpr = 1;

    config: ChartConfig;
    state: ChartState;

    // ── Composed managers (SRP) ───────────────────────────────────────────
    private readonly alertMgr      = new AlertManager();
    private readonly replayCtrl    = new ReplayController();
    private readonly drawingMgr    = new DrawingManager();
    private readonly screenshotSvc: ScreenshotService;

    private timeframe = '1d';
    private indicatorCache = new Map<string, IndicatorSeries>();

    /** Compare/overlay instrument series. */
    compareSeries: CompareSeriesData[] = [];

    onNeedMoreData: (() => void) | null = null;
    fetchingMoreHistory = false;

    private _onResize: () => void;
    private _onWheel:  (e: WheelEvent) => void;
    private _onMDown:  (e: MouseEvent) => void;
    private _onMMove:  (e: MouseEvent) => void;
    private _onMUp:    (e: MouseEvent) => void;
    private _onMLeave: (e: MouseEvent) => void;
    private _onKey:    (e: KeyboardEvent) => void;
    private _onTStart: (e: TouchEvent) => void;
    private _onTMove:  (e: TouchEvent) => void;
    private _onTEnd:   (e: TouchEvent) => void;

    constructor(canvasId: string) {
        const el = document.getElementById(canvasId);
        if (!(el instanceof HTMLCanvasElement)) {
            throw new Error(`#${canvasId} is not a <canvas> element or does not exist`);
        }
        this.canvas = el;
        this.canvas.setAttribute('role', 'img');
        this.canvas.setAttribute('aria-label', 'Financial chart');
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.touchAction = 'none';

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Could not acquire 2D rendering context');
        this.ctx = ctx;

        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ChartConfig;
        this.screenshotSvc = new ScreenshotService(this.canvas);

        this.state = {
            data: [], visibleData: [], viewportStart: 0, scaleX: 1,
            offsetCandles: 0, minPrice: 0, maxPrice: 0,
            width: 0, height: 0, currentPrice: 0,
            isDragging: false, dragStartX: 0,
            mouseX: -1, mouseY: -1, mouseInside: false,
            drawingMode: 'none', chartType: 'candlestick',
            scaleType: 'linear', magnetEnabled: false,
            activeIndicators: new Set(), rafPending: false, baselinePrice: 0,
        };

        // Wire replay controller
        this.replayCtrl.onUpdate = (slice) => {
            this.state.data = slice;
            this.state.currentPrice = slice.length ? slice[slice.length - 1]!.close : 0;
            this.invalidateIndicatorCache();
            this.recomputeIndicators();
            this.state.offsetCandles = 0;
            this.updateVisibleData();
            this.requestDraw();
        };

        this._onResize = this.handleResize.bind(this);
        this._onWheel  = this.handleWheel.bind(this);
        this._onMDown  = this.handleMouseDown.bind(this);
        this._onMMove  = this.handleMouseMove.bind(this);
        this._onMUp    = this.handleMouseUp.bind(this);
        this._onMLeave = this.handleMouseLeave.bind(this);
        this._onKey    = this.handleKey.bind(this);
        this._onTStart = this.handleTouchStart.bind(this);
        this._onTMove  = this.handleTouchMove.bind(this);
        this._onTEnd   = this.handleTouchEnd.bind(this);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    init(dataManager: { getData(): Candle[] }): void {
        this.dpr = window.devicePixelRatio || 1;
        this.resizeCanvas();
        this.setData(dataManager.getData());
        this.setupEventListeners();
        this.requestDraw();
    }

    update(): void { this.requestDraw(); }

    destroy(): void {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('keydown', this._onKey);
        this.canvas.removeEventListener('wheel', this._onWheel);
        this.canvas.removeEventListener('mousedown', this._onMDown);
        this.canvas.removeEventListener('mousemove', this._onMMove);
        this.canvas.removeEventListener('mouseup', this._onMUp);
        this.canvas.removeEventListener('mouseleave', this._onMLeave);
        this.canvas.removeEventListener('touchstart', this._onTStart);
        this.canvas.removeEventListener('touchmove', this._onTMove);
        this.canvas.removeEventListener('touchend', this._onTEnd);
        this.replayCtrl.destroy();
    }

    // ── Data ──────────────────────────────────────────────────────────────────

    setData(data: Candle[]): void {
        this.state.data = data;
        this.state.currentPrice = data.length ? data[data.length - 1]!.close : 0;
        const last = data[data.length - 1];
        if (last) {
            this.canvas.setAttribute('aria-label',
                `Financial chart. Latest price: ${last.close.toFixed(2)}, ` +
                `High: ${last.high.toFixed(2)}, Low: ${last.low.toFixed(2)}`);
        }
        this.invalidateIndicatorCache();
        this.recomputeIndicators();
        this.updateVisibleData();
        this.requestDraw();
    }

    setTimeframe(tf: string): void {
        this.timeframe = tf;
        this.requestDraw();
    }

    // ── View Controls ─────────────────────────────────────────────────────────

    resetView(): void {
        this.state.scaleX = 1;
        this.state.offsetCandles = 0;
        this.updateVisibleData();
        this.requestDraw();
    }

    zoomIn(): void {
        this.state.scaleX = clamp(this.state.scaleX * this.config.zoomStep, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }

    zoomOut(): void {
        this.state.scaleX = clamp(this.state.scaleX / this.config.zoomStep, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }

    // ── Chart Type & Drawing Mode ─────────────────────────────────────────────

    setChartType(type: ChartType): void {
        this.state.chartType = type;
        this.requestDraw();
    }

    setDrawingMode(mode: DrawingMode): void {
        this.state.drawingMode = mode;
        this.canvas.style.cursor = mode === 'none' ? 'default' : 'crosshair';
    }

    clearDrawings(): void {
        this.drawingMgr.clearAll();
        this.requestDraw();
    }

    // ── Scale Type (delegated from IChartControls) ────────────────────────────

    setScaleType(scale: ScaleType): void {
        this.state.scaleType = scale;
        this.updateVisibleData();
        this.requestDraw();
    }

    cycleScaleType(): void {
        const order: ScaleType[] = ['linear', 'logarithmic', 'percentage'];
        const idx = order.indexOf(this.state.scaleType);
        this.setScaleType(order[(idx + 1) % order.length]!);
    }

    // ── Magnet Mode ────────────────────────────────────────────────────────

    toggleMagnet(): void {
        this.state.magnetEnabled = !this.state.magnetEnabled;
        this.requestDraw();
    }

    private snapToOHLC(mx: number, my: number): number {
        if (!this.state.magnetEnabled) return my;
        const idx = this.xToIndex(mx);
        if (idx < 0 || idx >= this.state.visibleData.length) return my;
        const candle = this.state.visibleData[idx];
        if (!candle) return my;
        const candidates = [candle.open, candle.high, candle.low, candle.close];
        let bestY = my, bestDist = Infinity;
        for (const price of candidates) {
            const y = this.priceToY(price);
            const dist = Math.abs(y - my);
            if (dist < bestDist) { bestDist = dist; bestY = y; }
        }
        return bestDist < 20 ? bestY : my;
    }

    // ── Alerts — delegated to AlertManager (SRP) ──────────────────────────

    get alerts(): readonly PriceAlert[] { return this.alertMgr.alerts; }

    set onAlertTriggered(fn: ((alert: PriceAlert) => void) | null) {
        this.alertMgr.onTriggered = fn;
    }

    addAlert(alert: PriceAlert): void {
        this.alertMgr.add(alert);
        this.requestDraw();
    }

    removeAlert(id: string): void {
        this.alertMgr.remove(id);
        this.requestDraw();
    }

    loadAlerts(): void { this.alertMgr.load(); }

    private checkAlerts(): void {
        const price = this.state.currentPrice;
        if (!price) return;
        const prev = this.state.data.length > 1
            ? this.state.data[this.state.data.length - 2]?.close ?? price
            : price;
        this.alertMgr.check(price, prev);
    }

    // ── Replay — delegated to ReplayController (SRP) ──────────────────────

    get replay(): ReplayState { return this.replayCtrl.state as ReplayState; }

    startReplay(): void { this.replayCtrl.start(this.state.data); }

    stopReplay(): void {
        this.replayCtrl.stop();
        // stop() triggers onUpdate with full data, which restores state
        this.invalidateIndicatorCache();
        this.recomputeIndicators();
        this.updateVisibleData();
        this.requestDraw();
    }

    toggleReplayPause(): void { this.replayCtrl.togglePause(); }
    setReplaySpeed(speed: number): void { this.replayCtrl.setSpeed(speed); }
    replayStep(): void { this.replayCtrl.stepForward(); }
    replayStepBack(): void { this.replayCtrl.stepBack(); }

    // ── Compare Instruments ─────────────────────────────────────────────────

    addCompareSeries(series: CompareSeriesData): void {
        this.compareSeries.push(series);
        this.requestDraw();
    }

    removeCompareSeries(instrumentId: string): void {
        this.compareSeries = this.compareSeries.filter(s => s.instrumentId !== instrumentId);
        this.requestDraw();
    }

    clearCompareSeries(): void {
        this.compareSeries = [];
        this.requestDraw();
    }

    // ── Screenshot — delegated to ScreenshotService (SRP) ─────────────────

    screenshot(): string { this.draw(); return this.screenshotSvc.toDataURL(); }
    downloadScreenshot(filename?: string): void { this.draw(); this.screenshotSvc.download(filename); }
    async copyScreenshotToClipboard(): Promise<void> { this.draw(); return this.screenshotSvc.copyToClipboard(); }

    // ── Indicators ────────────────────────────────────────────────────────

    toggleIndicator(id: IndicatorId): void {
        if (this.state.activeIndicators.has(id)) {
            this.state.activeIndicators.delete(id);
            this.indicatorCache.delete(id);
        } else {
            this.state.activeIndicators.add(id);
            const series = computeIndicator(this.state.data, id);
            if (series) this.indicatorCache.set(id, series);
        }
        this.requestDraw();
    }

    private invalidateIndicatorCache(): void { this.indicatorCache.clear(); }

    private recomputeIndicators(): void {
        if (this.state.activeIndicators.size === 0) { this.indicatorCache.clear(); return; }
        this.indicatorCache = computeAllIndicators(this.state.data, this.state.activeIndicators);
    }

    // ── Theme ─────────────────────────────────────────────────────────────

    applyTheme(theme: 'dark' | 'light'): void {
        this.config.theme = theme;
        this.requestDraw();
    }

    getColors(): ThemeColors {
        return this.config.theme === 'dark' ? this.config.darkTheme : this.config.lightTheme;
    }

    // ── Canvas Sizing ─────────────────────────────────────────────────────

    resizeCanvas(): void {
        const container = this.canvas.parentElement;
        if (!container) return;
        this.dpr = window.devicePixelRatio || 1;
        const cssW = container.clientWidth;
        const cssH = container.clientHeight;
        this.canvas.width = Math.round(cssW * this.dpr);
        this.canvas.height = Math.round(cssH * this.dpr);
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
        this.ctx.scale(this.dpr, this.dpr);
        this.state.width = cssW;
        this.state.height = cssH;
        this.updateVisibleData();
    }

    private handleResize(): void { this.resizeCanvas(); this.requestDraw(); }

    // ── Viewport ───────────────────────────────────────────────────────────

    private getPlot(): PlotRect {
        return computePlotRect(this.config, this.state, this.getSubPanelCount());
    }

    private getSubPanelCount(): number {
        let count = 0;
        for (const [, series] of this.indicatorCache) { if (series.isSubPanel) count++; }
        return count;
    }

    updateVisibleData(): void {
        const plot = this.getPlot();
        const result = computeVisibleData(this.config, this.state, plot.width);
        this.state.visibleData = result.visibleData;
        this.state.viewportStart = result.viewportStart;
        this.state.offsetCandles = result.offsetCandles;
        this.state.minPrice = result.minPrice;
        this.state.maxPrice = result.maxPrice;
        if (result.needMoreData && !this.fetchingMoreHistory && this.onNeedMoreData) {
            this.fetchingMoreHistory = true;
            this.onNeedMoreData();
        }
    }

    // ── Coordinate helpers ─────────────────────────────────────────────────

    priceToY(price: number): number { return vpPriceToY(price, this.state, this.getPlot()); }
    indexToX(index: number): number { return vpIndexToX(index, this.config, this.state, this.getPlot()); }
    xToIndex(x: number): number { return vpXToIndex(x, this.config, this.state, this.getPlot()); }
    yToPrice(y: number): number { return vpYToPrice(y, this.state, this.getPlot()); }
    timestampToX(ts: number): number { return vpTimestampToX(ts, this.config, this.state, this.getPlot()); }

    // ── rAF Draw Queue ────────────────────────────────────────────────────

    requestDraw(): void {
        if (this.state.rafPending) return;
        this.state.rafPending = true;
        requestAnimationFrame(() => { this.state.rafPending = false; this.draw(); });
    }

    // ── Render ─────────────────────────────────────────────────────────────

    draw(): void {
        const { width, height } = this.state;
        if (!width || !height) return;
        if (this.state.visibleData.length > 0) {
            this.state.baselinePrice = this.state.visibleData[0]!.close;
        }
        const rc: RenderContext = {
            ctx: this.ctx, config: this.config, state: this.state,
            colors: this.getColors(), plot: this.getPlot(),
            timeframe: this.timeframe, indicatorCache: this.indicatorCache,
            drawings: this.drawingMgr.drawings as any,
            draftDrawing: this.drawingMgr.draftDrawing,
            alerts: this.alertMgr.alerts as PriceAlert[],
            compareSeries: this.compareSeries,
            replay: this.replayCtrl.state as ReplayState,
        };
        try {
            this.ctx.clearRect(0, 0, width, height);
            renderFrame(rc);
        } catch (err) {
            console.error('[Orbityx] Render error:', err);
            renderError(rc, err);
        }
        this.checkAlerts();
    }

    drawVolumePanel(): void { this.requestDraw(); }

    getCandleAtCursor(): Candle | null {
        const idx = this.xToIndex(this.state.mouseX);
        if (idx < 0 || idx >= this.state.visibleData.length) return null;
        return this.state.visibleData[idx] ?? null;
    }

    // ── Event Listeners ───────────────────────────────────────────────────

    private setupEventListeners(): void {
        window.addEventListener('resize', this._onResize, { passive: true });
        window.addEventListener('keydown', this._onKey);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('mousedown', this._onMDown);
        this.canvas.addEventListener('mousemove', this._onMMove);
        this.canvas.addEventListener('mouseup', this._onMUp);
        this.canvas.addEventListener('mouseleave', this._onMLeave);
        this.canvas.addEventListener('touchstart', this._onTStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTMove, { passive: false });
        this.canvas.addEventListener('touchend', this._onTEnd);
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.state.scaleX = clamp(this.state.scaleX * factor, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }

    private handleMouseDown(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        if (this.state.drawingMode !== 'none') {
            this.handleDrawingClick(mx, my);
            return;
        }
        this.state.isDragging = true;
        this.state.dragStartX = mx;
        this.canvas.style.cursor = 'grabbing';
    }

    private handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const my = this.snapToOHLC(mx, rawY);
        this.state.mouseX = mx;
        this.state.mouseY = my;
        this.state.mouseInside = true;
        if (this.state.isDragging) {
            const delta = mx - this.state.dragStartX;
            this.state.dragStartX = mx;
            const plot = this.getPlot();
            const maxVis = maxVisibleCandles(this.config, this.state, plot.width);
            const maxOffset = Math.max(0, this.state.data.length - maxVis);
            this.state.offsetCandles = clamp(
                this.state.offsetCandles + delta / candleStep(this.config, this.state), 0, maxOffset);
            this.updateVisibleData();
        }
        // Update draft drawing endpoint
        const pp = this.canvasToPrice(mx, my);
        if (pp && this.drawingMgr.draftDrawing) {
            this.drawingMgr.updateDraftEndpoint(pp);
        }
        this.requestDraw();
    }

    private handleMouseUp(e: MouseEvent): void {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.canvas.style.cursor = this.state.drawingMode === 'none' ? 'default' : 'crosshair';
        }
    }

    private handleMouseLeave(): void {
        this.state.mouseInside = false;
        this.state.isDragging = false;
        this.drawingMgr.cancelDraft();
        this.canvas.style.cursor = 'default';
        this.requestDraw();
    }

    private handleKey(e: KeyboardEvent): void {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        const plot = this.getPlot();
        const maxVis = maxVisibleCandles(this.config, this.state, plot.width);
        const maxOffset = Math.max(0, this.state.data.length - maxVis);
        switch (e.key) {
            case '+': case '=': this.zoomIn(); break;
            case '-': case '_': this.zoomOut(); break;
            case 'ArrowLeft':
                this.state.offsetCandles = clamp(this.state.offsetCandles + this.config.keyScrollStep, 0, maxOffset);
                this.updateVisibleData(); this.requestDraw(); break;
            case 'ArrowRight':
                this.state.offsetCandles = clamp(this.state.offsetCandles - this.config.keyScrollStep, 0, maxOffset);
                this.updateVisibleData(); this.requestDraw(); break;
            case 'Home': case '0': this.resetView(); break;
            case 'Escape':
                this.setDrawingMode('none');
                this.drawingMgr.cancelDraft();
                if (this.replay.active) this.stopReplay();
                break;
            case 'l': case 'L': this.cycleScaleType(); break;
            case 'm': case 'M': this.toggleMagnet(); break;
            case 's': case 'S':
                if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.downloadScreenshot(); }
                break;
            case '?': window.dispatchEvent(new CustomEvent('orbityx:showShortcuts')); break;
            case ' ':
                if (this.replay.active) { e.preventDefault(); this.toggleReplayPause(); }
                break;
        }
    }

    // ── Touch Events ──────────────────────────────────────────────────────

    private lastTouchDist = 0;
    private lastTouchX = 0;

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        if (e.touches.length === 2) {
            const t0 = e.touches[0]!, t1 = e.touches[1]!;
            this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        } else if (e.touches.length === 1) {
            const t = e.touches[0]!;
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = t.clientX - rect.left;
            this.state.isDragging = true;
            this.state.mouseX = t.clientX - rect.left;
            this.state.mouseY = t.clientY - rect.top;
            this.state.mouseInside = true;
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();
        if (e.touches.length === 2) {
            const t0 = e.touches[0]!, t1 = e.touches[1]!;
            const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            if (this.lastTouchDist > 0) {
                this.state.scaleX = clamp(this.state.scaleX * (dist / this.lastTouchDist), this.config.zoomMin, this.config.zoomMax);
                this.updateVisibleData();
            }
            this.lastTouchDist = dist;
            this.requestDraw();
        } else if (e.touches.length === 1 && this.state.isDragging) {
            const t = e.touches[0]!;
            const rect = this.canvas.getBoundingClientRect();
            const mx = t.clientX - rect.left;
            const delta = mx - this.lastTouchX;
            this.lastTouchX = mx;
            const plot = this.getPlot();
            const maxVis = maxVisibleCandles(this.config, this.state, plot.width);
            const maxOffset = Math.max(0, this.state.data.length - maxVis);
            this.state.offsetCandles = clamp(
                this.state.offsetCandles + delta / candleStep(this.config, this.state), 0, maxOffset);
            this.state.mouseX = mx;
            this.state.mouseY = t.clientY - rect.top;
            this.state.mouseInside = true;
            this.updateVisibleData();
            this.requestDraw();
        }
    }

    private handleTouchEnd(e: TouchEvent): void {
        if (e.touches.length === 0) {
            this.state.isDragging = false;
            this.state.mouseInside = false;
            this.lastTouchDist = 0;
            this.requestDraw();
        } else if (e.touches.length === 1) {
            const t = e.touches[0]!;
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = t.clientX - rect.left;
            this.lastTouchDist = 0;
        }
    }

    // ── Drawing Tool Helpers — delegated to DrawingManager ─────────────────

    private handleDrawingClick(cx: number, cy: number): void {
        const pp = this.canvasToPrice(cx, cy);
        if (!pp) return;

        // Text labels need a prompt
        if (this.state.drawingMode === 'text') {
            const text = prompt('Enter text label:');
            if (!text) { this.setDrawingMode('none'); return; }
            this.drawingMgr.addTextDrawing(pp, text, this.getColors().textColor);
            this.setDrawingMode('none');
            this.requestDraw();
            return;
        }

        const done = this.drawingMgr.handleClick(this.state.drawingMode, pp, this.getColors());
        if (done) this.setDrawingMode('none');
        this.requestDraw();
    }

    private canvasToPrice(cx: number, cy: number): PricePoint | null {
        const idx = this.xToIndex(cx);
        if (idx < 0 || idx >= this.state.visibleData.length) return null;
        const candle = this.state.visibleData[idx];
        if (!candle) return null;
        return { timestamp: candle.timestamp, price: this.yToPrice(cy) };
    }
}
