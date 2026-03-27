import { clamp } from '../utils/math.js';
import { computeAllIndicators, computeIndicator } from './indicators.js';
import { computePlotRect, computeVisibleData, candleStep, priceToY as vpPriceToY, indexToX as vpIndexToX, xToIndex as vpXToIndex, yToPrice as vpYToPrice, timestampToX as vpTimestampToX, maxVisibleCandles, } from './viewport.js';
import { renderFrame, renderError } from './chart-renderer.js';
import { AlertManager } from './alert-manager.js';
import { ReplayController } from './replay-controller.js';
import { DrawingManager } from './drawing-manager.js';
import { ScreenshotService } from './screenshot-service.js';
// ─────────────────────────────────────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
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
export default class ChartEngine {
    canvas;
    ctx;
    dpr = 1;
    config;
    state;
    // ── Composed managers (SRP) ───────────────────────────────────────────
    alertMgr = new AlertManager();
    replayCtrl = new ReplayController();
    drawingMgr = new DrawingManager();
    screenshotSvc;
    timeframe = '1d';
    indicatorCache = new Map();
    /** Compare/overlay instrument series. */
    compareSeries = [];
    onNeedMoreData = null;
    fetchingMoreHistory = false;
    _onResize;
    _onWheel;
    _onMDown;
    _onMMove;
    _onMUp;
    _onMLeave;
    _onKey;
    _onTStart;
    _onTMove;
    _onTEnd;
    constructor(canvasId) {
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
        if (!ctx)
            throw new Error('Could not acquire 2D rendering context');
        this.ctx = ctx;
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
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
            this.state.currentPrice = slice.length ? slice[slice.length - 1].close : 0;
            this.invalidateIndicatorCache();
            this.recomputeIndicators();
            this.state.offsetCandles = 0;
            this.updateVisibleData();
            this.requestDraw();
        };
        this._onResize = this.handleResize.bind(this);
        this._onWheel = this.handleWheel.bind(this);
        this._onMDown = this.handleMouseDown.bind(this);
        this._onMMove = this.handleMouseMove.bind(this);
        this._onMUp = this.handleMouseUp.bind(this);
        this._onMLeave = this.handleMouseLeave.bind(this);
        this._onKey = this.handleKey.bind(this);
        this._onTStart = this.handleTouchStart.bind(this);
        this._onTMove = this.handleTouchMove.bind(this);
        this._onTEnd = this.handleTouchEnd.bind(this);
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    init(dataManager) {
        this.dpr = window.devicePixelRatio || 1;
        this.resizeCanvas();
        this.setData(dataManager.getData());
        this.setupEventListeners();
        this.requestDraw();
    }
    update() { this.requestDraw(); }
    destroy() {
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
    setData(data) {
        this.state.data = data;
        this.state.currentPrice = data.length ? data[data.length - 1].close : 0;
        const last = data[data.length - 1];
        if (last) {
            this.canvas.setAttribute('aria-label', `Financial chart. Latest price: ${last.close.toFixed(2)}, ` +
                `High: ${last.high.toFixed(2)}, Low: ${last.low.toFixed(2)}`);
        }
        this.invalidateIndicatorCache();
        this.recomputeIndicators();
        this.updateVisibleData();
        this.requestDraw();
    }
    setTimeframe(tf) {
        this.timeframe = tf;
        this.requestDraw();
    }
    // ── View Controls ─────────────────────────────────────────────────────────
    resetView() {
        this.state.scaleX = 1;
        this.state.offsetCandles = 0;
        this.updateVisibleData();
        this.requestDraw();
    }
    zoomIn() {
        this.state.scaleX = clamp(this.state.scaleX * this.config.zoomStep, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }
    zoomOut() {
        this.state.scaleX = clamp(this.state.scaleX / this.config.zoomStep, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }
    // ── Chart Type & Drawing Mode ─────────────────────────────────────────────
    setChartType(type) {
        this.state.chartType = type;
        this.requestDraw();
    }
    setDrawingMode(mode) {
        this.state.drawingMode = mode;
        this.canvas.style.cursor = mode === 'none' ? 'default' : 'crosshair';
    }
    clearDrawings() {
        this.drawingMgr.clearAll();
        this.requestDraw();
    }
    // ── Scale Type (delegated from IChartControls) ────────────────────────────
    setScaleType(scale) {
        this.state.scaleType = scale;
        this.updateVisibleData();
        this.requestDraw();
    }
    cycleScaleType() {
        const order = ['linear', 'logarithmic', 'percentage'];
        const idx = order.indexOf(this.state.scaleType);
        this.setScaleType(order[(idx + 1) % order.length]);
    }
    // ── Magnet Mode ────────────────────────────────────────────────────────
    toggleMagnet() {
        this.state.magnetEnabled = !this.state.magnetEnabled;
        this.requestDraw();
    }
    snapToOHLC(mx, my) {
        if (!this.state.magnetEnabled)
            return my;
        const idx = this.xToIndex(mx);
        if (idx < 0 || idx >= this.state.visibleData.length)
            return my;
        const candle = this.state.visibleData[idx];
        if (!candle)
            return my;
        const candidates = [candle.open, candle.high, candle.low, candle.close];
        let bestY = my, bestDist = Infinity;
        for (const price of candidates) {
            const y = this.priceToY(price);
            const dist = Math.abs(y - my);
            if (dist < bestDist) {
                bestDist = dist;
                bestY = y;
            }
        }
        return bestDist < 20 ? bestY : my;
    }
    // ── Alerts — delegated to AlertManager (SRP) ──────────────────────────
    get alerts() { return this.alertMgr.alerts; }
    set onAlertTriggered(fn) {
        this.alertMgr.onTriggered = fn;
    }
    addAlert(alert) {
        this.alertMgr.add(alert);
        this.requestDraw();
    }
    removeAlert(id) {
        this.alertMgr.remove(id);
        this.requestDraw();
    }
    loadAlerts() { this.alertMgr.load(); }
    checkAlerts() {
        const price = this.state.currentPrice;
        if (!price)
            return;
        const prev = this.state.data.length > 1
            ? this.state.data[this.state.data.length - 2]?.close ?? price
            : price;
        this.alertMgr.check(price, prev);
    }
    // ── Replay — delegated to ReplayController (SRP) ──────────────────────
    get replay() { return this.replayCtrl.state; }
    startReplay() { this.replayCtrl.start(this.state.data); }
    stopReplay() {
        this.replayCtrl.stop();
        // stop() triggers onUpdate with full data, which restores state
        this.invalidateIndicatorCache();
        this.recomputeIndicators();
        this.updateVisibleData();
        this.requestDraw();
    }
    toggleReplayPause() { this.replayCtrl.togglePause(); }
    setReplaySpeed(speed) { this.replayCtrl.setSpeed(speed); }
    replayStep() { this.replayCtrl.stepForward(); }
    replayStepBack() { this.replayCtrl.stepBack(); }
    // ── Compare Instruments ─────────────────────────────────────────────────
    addCompareSeries(series) {
        this.compareSeries.push(series);
        this.requestDraw();
    }
    removeCompareSeries(instrumentId) {
        this.compareSeries = this.compareSeries.filter(s => s.instrumentId !== instrumentId);
        this.requestDraw();
    }
    clearCompareSeries() {
        this.compareSeries = [];
        this.requestDraw();
    }
    // ── Screenshot — delegated to ScreenshotService (SRP) ─────────────────
    screenshot() { this.draw(); return this.screenshotSvc.toDataURL(); }
    downloadScreenshot(filename) { this.draw(); this.screenshotSvc.download(filename); }
    async copyScreenshotToClipboard() { this.draw(); return this.screenshotSvc.copyToClipboard(); }
    // ── Indicators ────────────────────────────────────────────────────────
    toggleIndicator(id) {
        if (this.state.activeIndicators.has(id)) {
            this.state.activeIndicators.delete(id);
            this.indicatorCache.delete(id);
        }
        else {
            this.state.activeIndicators.add(id);
            const series = computeIndicator(this.state.data, id);
            if (series)
                this.indicatorCache.set(id, series);
        }
        this.requestDraw();
    }
    invalidateIndicatorCache() { this.indicatorCache.clear(); }
    recomputeIndicators() {
        if (this.state.activeIndicators.size === 0) {
            this.indicatorCache.clear();
            return;
        }
        this.indicatorCache = computeAllIndicators(this.state.data, this.state.activeIndicators);
    }
    // ── Theme ─────────────────────────────────────────────────────────────
    applyTheme(theme) {
        this.config.theme = theme;
        this.requestDraw();
    }
    getColors() {
        return this.config.theme === 'dark' ? this.config.darkTheme : this.config.lightTheme;
    }
    // ── Canvas Sizing ─────────────────────────────────────────────────────
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container)
            return;
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
    handleResize() { this.resizeCanvas(); this.requestDraw(); }
    // ── Viewport ───────────────────────────────────────────────────────────
    getPlot() {
        return computePlotRect(this.config, this.state, this.getSubPanelCount());
    }
    getSubPanelCount() {
        let count = 0;
        for (const [, series] of this.indicatorCache) {
            if (series.isSubPanel)
                count++;
        }
        return count;
    }
    updateVisibleData() {
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
    priceToY(price) { return vpPriceToY(price, this.state, this.getPlot()); }
    indexToX(index) { return vpIndexToX(index, this.config, this.state, this.getPlot()); }
    xToIndex(x) { return vpXToIndex(x, this.config, this.state, this.getPlot()); }
    yToPrice(y) { return vpYToPrice(y, this.state, this.getPlot()); }
    timestampToX(ts) { return vpTimestampToX(ts, this.config, this.state, this.getPlot()); }
    // ── rAF Draw Queue ────────────────────────────────────────────────────
    requestDraw() {
        if (this.state.rafPending)
            return;
        this.state.rafPending = true;
        requestAnimationFrame(() => { this.state.rafPending = false; this.draw(); });
    }
    // ── Render ─────────────────────────────────────────────────────────────
    draw() {
        const { width, height } = this.state;
        if (!width || !height)
            return;
        if (this.state.visibleData.length > 0) {
            this.state.baselinePrice = this.state.visibleData[0].close;
        }
        const rc = {
            ctx: this.ctx, config: this.config, state: this.state,
            colors: this.getColors(), plot: this.getPlot(),
            timeframe: this.timeframe, indicatorCache: this.indicatorCache,
            drawings: this.drawingMgr.drawings,
            draftDrawing: this.drawingMgr.draftDrawing,
            alerts: this.alertMgr.alerts,
            compareSeries: this.compareSeries,
            replay: this.replayCtrl.state,
        };
        try {
            this.ctx.clearRect(0, 0, width, height);
            renderFrame(rc);
        }
        catch (err) {
            console.error('[Orbityx] Render error:', err);
            renderError(rc, err);
        }
        this.checkAlerts();
    }
    drawVolumePanel() { this.requestDraw(); }
    getCandleAtCursor() {
        const idx = this.xToIndex(this.state.mouseX);
        if (idx < 0 || idx >= this.state.visibleData.length)
            return null;
        return this.state.visibleData[idx] ?? null;
    }
    // ── Event Listeners ───────────────────────────────────────────────────
    setupEventListeners() {
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
    handleWheel(e) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.state.scaleX = clamp(this.state.scaleX * factor, this.config.zoomMin, this.config.zoomMax);
        this.updateVisibleData();
        this.requestDraw();
    }
    handleMouseDown(e) {
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
    handleMouseMove(e) {
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
            this.state.offsetCandles = clamp(this.state.offsetCandles + delta / candleStep(this.config, this.state), 0, maxOffset);
            this.updateVisibleData();
        }
        // Update draft drawing endpoint
        const pp = this.canvasToPrice(mx, my);
        if (pp && this.drawingMgr.draftDrawing) {
            this.drawingMgr.updateDraftEndpoint(pp);
        }
        this.requestDraw();
    }
    handleMouseUp(e) {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.canvas.style.cursor = this.state.drawingMode === 'none' ? 'default' : 'crosshair';
        }
    }
    handleMouseLeave() {
        this.state.mouseInside = false;
        this.state.isDragging = false;
        this.drawingMgr.cancelDraft();
        this.canvas.style.cursor = 'default';
        this.requestDraw();
    }
    handleKey(e) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')
            return;
        const plot = this.getPlot();
        const maxVis = maxVisibleCandles(this.config, this.state, plot.width);
        const maxOffset = Math.max(0, this.state.data.length - maxVis);
        switch (e.key) {
            case '+':
            case '=':
                this.zoomIn();
                break;
            case '-':
            case '_':
                this.zoomOut();
                break;
            case 'ArrowLeft':
                this.state.offsetCandles = clamp(this.state.offsetCandles + this.config.keyScrollStep, 0, maxOffset);
                this.updateVisibleData();
                this.requestDraw();
                break;
            case 'ArrowRight':
                this.state.offsetCandles = clamp(this.state.offsetCandles - this.config.keyScrollStep, 0, maxOffset);
                this.updateVisibleData();
                this.requestDraw();
                break;
            case 'Home':
            case '0':
                this.resetView();
                break;
            case 'Escape':
                this.setDrawingMode('none');
                this.drawingMgr.cancelDraft();
                if (this.replay.active)
                    this.stopReplay();
                break;
            case 'l':
            case 'L':
                this.cycleScaleType();
                break;
            case 'm':
            case 'M':
                this.toggleMagnet();
                break;
            case 's':
            case 'S':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.downloadScreenshot();
                }
                break;
            case '?':
                window.dispatchEvent(new CustomEvent('orbityx:showShortcuts'));
                break;
            case ' ':
                if (this.replay.active) {
                    e.preventDefault();
                    this.toggleReplayPause();
                }
                break;
        }
    }
    // ── Touch Events ──────────────────────────────────────────────────────
    lastTouchDist = 0;
    lastTouchX = 0;
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            const t0 = e.touches[0], t1 = e.touches[1];
            this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        }
        else if (e.touches.length === 1) {
            const t = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = t.clientX - rect.left;
            this.state.isDragging = true;
            this.state.mouseX = t.clientX - rect.left;
            this.state.mouseY = t.clientY - rect.top;
            this.state.mouseInside = true;
        }
    }
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            const t0 = e.touches[0], t1 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            if (this.lastTouchDist > 0) {
                this.state.scaleX = clamp(this.state.scaleX * (dist / this.lastTouchDist), this.config.zoomMin, this.config.zoomMax);
                this.updateVisibleData();
            }
            this.lastTouchDist = dist;
            this.requestDraw();
        }
        else if (e.touches.length === 1 && this.state.isDragging) {
            const t = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const mx = t.clientX - rect.left;
            const delta = mx - this.lastTouchX;
            this.lastTouchX = mx;
            const plot = this.getPlot();
            const maxVis = maxVisibleCandles(this.config, this.state, plot.width);
            const maxOffset = Math.max(0, this.state.data.length - maxVis);
            this.state.offsetCandles = clamp(this.state.offsetCandles + delta / candleStep(this.config, this.state), 0, maxOffset);
            this.state.mouseX = mx;
            this.state.mouseY = t.clientY - rect.top;
            this.state.mouseInside = true;
            this.updateVisibleData();
            this.requestDraw();
        }
    }
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.state.isDragging = false;
            this.state.mouseInside = false;
            this.lastTouchDist = 0;
            this.requestDraw();
        }
        else if (e.touches.length === 1) {
            const t = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = t.clientX - rect.left;
            this.lastTouchDist = 0;
        }
    }
    // ── Drawing Tool Helpers — delegated to DrawingManager ─────────────────
    handleDrawingClick(cx, cy) {
        const pp = this.canvasToPrice(cx, cy);
        if (!pp)
            return;
        // Text labels need a prompt
        if (this.state.drawingMode === 'text') {
            const text = prompt('Enter text label:');
            if (!text) {
                this.setDrawingMode('none');
                return;
            }
            this.drawingMgr.addTextDrawing(pp, text, this.getColors().textColor);
            this.setDrawingMode('none');
            this.requestDraw();
            return;
        }
        const done = this.drawingMgr.handleClick(this.state.drawingMode, pp, this.getColors());
        if (done)
            this.setDrawingMode('none');
        this.requestDraw();
    }
    canvasToPrice(cx, cy) {
        const idx = this.xToIndex(cx);
        if (idx < 0 || idx >= this.state.visibleData.length)
            return null;
        const candle = this.state.visibleData[idx];
        if (!candle)
            return null;
        return { timestamp: candle.timestamp, price: this.yToPrice(cy) };
    }
}
//# sourceMappingURL=chart-engine.js.map