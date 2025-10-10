/**
 * Orbityx main entrypoint – wires UI widgets, data manager, chart engine,
 * and realtime WebSocket updates.
 *
 * Notes:
 * - This patch adds comments only; no runtime behavior is changed.
 * - Keep DOM ids/classes in sync with templates (e.g., #chartCanvas).
 */
import { initToolBar } from './ui/toolbar.js';
import { initLegend } from './ui/legend.js';
import { initTooltip } from './ui/tooltip.js';
import dataManager from './core/data-manager.js';
import ChartEngine from './core/chart-engine.js';
import WebsocketService from './services/ws.js';
// Static app configuration (defaults & endpoints)
const CONFIG = {
    DEFAULT_SYMBOL: 'bitcoin',
    DEFAULT_TIMEFRAME: '1d',
    // Server endpoint (wss preferred in production)
    WEBSOCKET_URL: 'wss://crypto-ws.example.com/stream'
};
/**
 * App controller – orchestrates UI, data loading, rendering, and realtime.
 */
class OrbityxChartApp {
    /**
     * Initialize instance fields and bind to the canvas-backed ChartEngine.
     */
    constructor(options = {}) {
        this.symbol = options.symbol || CONFIG.DEFAULT_SYMBOL;
        this.timeframe = options.timeframe || CONFIG.DEFAULT_TIMEFRAME;
        this.dataManager = dataManager;
        const canvasId = options.canvasId || 'chartCanvas';
        this.chartEngine = new ChartEngine(canvasId);
        this.appInstance = null;
    }
    /**
     * Boot sequence: build UI, apply theme, load history, start realtime,
     * init chart engine, and start a simple FPS monitor.
     */
    async init() {
        try {
            // Build toolbar, legend, and tooltip modules.
            this.initUI();
            this.applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');
            // Load initial historical candles before enabling realtime.
            await this.loadHistoricalData();
            this.setupRealtimeUpdates();
            // Give the engine its data source and perform the first paint.
            this.chartEngine.init(this.dataManager);
            // Optional UI metric to display current frame rate.
            this.setupPerformanceMonitoring();
            console.log('Quantum Chart Pro initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize application:', error);
            this.showErrorNotification('Initialization Error', 'Failed to initialize application');
        }
    }
    /**
     * Wire up UI modules, passing callbacks or instances as required.
     */
    initUI() {
        // Toolbar receives timeframe/chart-type handlers and engine instance.
        initToolBar(this.handleTimeframeChange.bind(this), this.handleChartTypeChange.bind(this), this.chartEngine);
        // Legend shows symbol and live price/change.
        initLegend(this.symbol);
        // Tooltip attaches to the engine to display O/H/L/C/Volume under cursor.
        initTooltip(this.chartEngine, this.dataManager);
    }
    /**
     * Fetch and set historical candles for the current symbol/timeframe.
     */
    async loadHistoricalData() {
        try {
            this.showLoadingIndicator();
            // Delegate to the data manager (returns normalized Candle[]).
            await this.dataManager.loadCandles(this.symbol, this.timeframe);
            const candles = this.dataManager.getData();
            // Push data into the renderer; redraw handled by engine.
            this.chartEngine.setData(candles);
            console.info(`Loaded ${Array.isArray(candles) ? candles.length : 0} historical candles`);
            this.hideLoadingIndicator();
        }
        catch (error) {
            console.error('Failed to load historical data:', error);
            this.hideLoadingIndicator();
            this.showErrorNotification('Data Load Error', 'Failed to load historical data');
        }
    }
    /**
     * Connect to WS server and subscribe to updates for the current stream.
     */
    setupRealtimeUpdates() {
        const WS = WebsocketService;
        // Configure endpoint if the service exposes a setter.
        WS.setUrl?.(CONFIG.WEBSOCKET_URL);
        // Open the connection; no-op if already connected.
        WS.connect?.();
        // Dispatch based on message type (candle/trade/heartbeat).
        WS.subscribe?.((data) => {
            // On new candle: refresh dataset; engine redraw handles visuals.
            if (data?.type === 'candle' && data?.payload) {
                if (typeof this.dataManager.subscribe === 'function') {
                    this.chartEngine.setData(this.dataManager.getData());
                    this.chartEngine.draw();
                }
                else {
                    this.chartEngine.setData(this.dataManager.getData());
                }
                // On trade tick: update last price and re-render.
            }
            else if (data?.type === 'trade' && typeof data.price === 'number') {
                this.updateLastPrice(data.price);
                // Keep-alive: respond with a 'pong'.
            }
            else if (data?.type === 'heartbeat') {
                WS.send?.({ type: 'pong' });
            }
        });
        // Initial subscription for the current symbol/timeframe.
        WS.send?.({
            type: 'subscribe',
            symbol: this.symbol,
            timeframe: this.timeframe
        });
    }
    /**
     * Toolbar callback: change the timeframe, reload history, and resubscribe.
     */
    handleTimeframeChange(newTimeframe) {
        // Persist new timeframe on the instance.
        const WS = WebsocketService;
        this.timeframe = newTimeframe;
        this.showLoadingIndicator();
        // Reload history, reset view, then update the WS subscription.
        this.loadHistoricalData().then(() => {
            this.chartEngine.resetView();
            this.hideLoadingIndicator();
            WS.send?.({
                type: 'subscribe',
                symbol: this.symbol,
                timeframe: this.timeframe
            });
        }).catch(error => {
            console.error('Timeframe change failed:', error);
            this.hideLoadingIndicator();
        });
    }
    /**
     * Toolbar callback: forward chart type selection to the engine.
     */
    handleChartTypeChange(chartType) {
        this.chartEngine.setChartType?.(chartType);
    }
    /**
     * Apply theme to document + engine and broadcast to interested modules.
     */
    applyTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        this.chartEngine.applyTheme(theme);
        document.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    }
    /**
     * Update the engine's current price and reflect it in the legend header.
     */
    updateLastPrice(price) {
        this.chartEngine.state && (this.chartEngine.state.currentPrice = price);
        // Repaint to show the current price line.
        this.chartEngine.draw();
        // Mirror the price in a dedicated DOM element if present.
        const priceElement = document.querySelector('.symbol-price');
        if (priceElement) {
            priceElement.textContent = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);
        }
    }
    /** Show a full-screen loading overlay if available. */
    showLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }
    /** Hide the loading overlay if present. */
    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    /**
     * Render (or create and render) a dismissible error banner.
     */
    showErrorNotification(title, message) {
        let notification = document.getElementById('error-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'error-notification';
            notification.className = 'error-notification';
            notification.innerHTML = `
        <div class="error-title"></div>
        <div class="error-message"></div>
      `;
            document.body.appendChild(notification);
        }
        // Populate content and display for 5 seconds.
        notification.querySelector('.error-title').textContent = title;
        notification.querySelector('.error-message').textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
    /**
     * Simple FPS monitor using requestAnimationFrame and a moving delta.
     */
    setupPerformanceMonitoring() {
        let lastFrameTime = performance.now();
        const frameRateElement = document.getElementById('frame-rate');
        // rAF-driven loop; writes FPS into #frame-rate when present.
        const monitorFrameRate = () => {
            const now = performance.now();
            const delta = now - lastFrameTime;
            const fps = Math.round(1000 / delta);
            if (frameRateElement) {
                frameRateElement.textContent = `${fps} FPS`;
            }
            lastFrameTime = now;
            requestAnimationFrame(monitorFrameRate);
        };
        requestAnimationFrame(monitorFrameRate);
    }
}
// ----------------------------------------------------------------------------
// Boot script
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Instantiate and boot the app.
    const app = new OrbityxChartApp();
    void app.init();
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        // Surface a non-intrusive notification to the user.
        app.showErrorNotification('Application Error', 'An unexpected error occurred');
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Refresh data when the tab becomes active again.
            app.loadHistoricalData().catch(console.error);
        }
    });
});

// === main.js ===
function initOrbityxChart({ root, canvas, toolbar, loading, error, priceEl } = {}) {
    const scope = root || document;

    // Используем классы вместо ID для избежания конфликтов
    const cvs = canvas || scope.querySelector('.chart-canvas');
    const tb = toolbar || scope.querySelector('.chart-toolbar');
    const ld = loading || scope.querySelector('.loading-indicator');
    const er = error || scope.querySelector('.error-notification');
    const price = priceEl || scope.querySelector('.symbol-price');

    if (!cvs) {
        console.warn('initOrbityxChart: canvas not found');
        return null;
    }

    try {
        // Создаем уникальные ID для этого экземпляра
        const instanceId = 'chart_' + Date.now();
        cvs.id = instanceId + '_canvas';
        if (tb) tb.id = instanceId + '_toolbar';
        if (ld) ld.id = instanceId + '_loading';
        if (er) er.id = instanceId + '_error';
        if (price) price.id = instanceId + '_price';

        // Создаем и инициализируем приложение
        const app = new OrbityxChartApp({
            canvasId: cvs.id,
            toolbarId: tb?.id,
            loadingId: ld?.id,
            errorId: er?.id,
            priceId: price?.id
        });

        app.init().catch(console.error);
        return app;
    } catch (error) {
        console.error('Failed to initialize chart:', error);
        return null;
    }
}

window.initOrbityxChart = initOrbityxChart;

window.initOrbityxChart = initOrbityxChart;

document.addEventListener('orbityx:chart-mount', (e) => {
    initOrbityxChart({ root: e.detail.root });
});

export default OrbityxChartApp;
//# sourceMappingURL=main.js.map