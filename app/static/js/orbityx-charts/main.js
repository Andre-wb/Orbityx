/**
 * Orbityx main entrypoint – wires UI widgets, data manager, chart engine,
 * and realtime WebSocket updates.
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

        try {
            this.chartEngine = new ChartEngine(canvasId);
        } catch (error) {
            console.error('Failed to create ChartEngine:', error);
            throw error;
        }

        this.appInstance = null;
        this.options = options;
        this.wsConnected = false;
        this.wsReconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
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

            // Initialize chart engine before setting up WebSocket
            this.chartEngine.init(this.dataManager);

            // Setup realtime updates (but don't force connection)
            this.setupRealtimeUpdates();

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

        // Only setup if WebSocket service is available
        if (!WS || typeof WS.connect !== 'function') {
            console.warn('WebSocket service not available, running in offline mode');
            return;
        }

        // Configure endpoint if the service exposes a setter.
        if (WS.setUrl) {
            WS.setUrl(CONFIG.WEBSOCKET_URL);
        }

        // Setup connection status handlers
        this.setupConnectionHandlers(WS);

        // Try to connect (but don't force it)
        try {
            WS.connect();
            this.wsConnected = true;
        } catch (error) {
            console.warn('WebSocket connection failed, running in offline mode:', error);
            this.wsConnected = false;
        }

        // Dispatch based on message type (candle/trade/heartbeat).
        if (WS.subscribe) {
            WS.subscribe((data) => {
                this.handleWebSocketMessage(data, WS);
            });
        }
    }

    /**
     * Handle WebSocket connection events
     */
    setupConnectionHandlers(WS) {
        if (WS.onConnect) {
            WS.onConnect(() => {
                console.log('WebSocket connected');
                this.wsConnected = true;
                this.wsReconnectAttempts = 0;
                this.subscribeToSymbol(WS);
            });
        }

        if (WS.onDisconnect) {
            WS.onDisconnect(() => {
                console.log('WebSocket disconnected');
                this.wsConnected = false;
                this.handleDisconnection(WS);
            });
        }

        if (WS.onError) {
            WS.onError((error) => {
                console.error('WebSocket error:', error);
                this.wsConnected = false;
            });
        }
    }

    /**
     * Handle WebSocket message based on type
     */
    handleWebSocketMessage(data, WS) {
        // On new candle: refresh dataset; engine redraw handles visuals.
        if (data?.type === 'candle' && data?.payload) {
            if (typeof this.dataManager.subscribe === 'function') {
                this.chartEngine.setData(this.dataManager.getData());
                this.chartEngine.draw();
            } else {
                this.chartEngine.setData(this.dataManager.getData());
            }
        }
        // On trade tick: update last price and re-render.
        else if (data?.type === 'trade' && typeof data.price === 'number') {
            this.updateLastPrice(data.price);
        }
        // Keep-alive: respond with a 'pong'.
        else if (data?.type === 'heartbeat') {
            this.sendSafe(WS, { type: 'pong' });
        }
    }

    /**
     * Handle disconnection and attempt reconnect
     */
    handleDisconnection(WS) {
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
            this.wsReconnectAttempts++;
            const delay = Math.min(1000 * this.wsReconnectAttempts, 10000);

            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.wsReconnectAttempts})`);

            setTimeout(() => {
                if (!this.wsConnected) {
                    try {
                        WS.connect();
                    } catch (error) {
                        console.warn('Reconnection attempt failed:', error);
                    }
                }
            }, delay);
        } else {
            console.warn('Max reconnection attempts reached, running in offline mode');
        }
    }

    /**
     * Safely send WebSocket message with connection check
     */
    sendSafe(WS, message) {
        if (this.wsConnected && WS.send) {
            try {
                WS.send(message);
            } catch (error) {
                console.warn('Failed to send WebSocket message:', error);
                this.wsConnected = false;
            }
        }
    }

    /**
     * Subscribe to symbol updates
     */
    subscribeToSymbol(WS) {
        if (this.wsConnected) {
            this.sendSafe(WS, {
                type: 'subscribe',
                symbol: this.symbol,
                timeframe: this.timeframe
            });
        }
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

            // Only resubscribe if connected
            if (this.wsConnected) {
                this.subscribeToSymbol(WS);
            }
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
        if (this.chartEngine.state) {
            this.chartEngine.state.currentPrice = price;
        }
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

    /**
     * Clean up resources when chart is destroyed
     */
    destroy() {
        const WS = WebsocketService;
        if (WS && WS.disconnect) {
            try {
                WS.disconnect();
            } catch (error) {
                console.warn('Error disconnecting WebSocket:', error);
            }
        }
        this.wsConnected = false;
    }
}

// === Chart initialization function ===
function initOrbityxChart({ root, canvas, toolbar, loading, error, priceEl } = {}) {
    const scope = root || document;

    const cvs = canvas || scope.querySelector('#chartCanvas, .chart-canvas');
    const tb = toolbar || scope.querySelector('.chart-toolbar');
    const ld = loading || scope.querySelector('.loading-indicator');
    const er = error || scope.querySelector('.error-notification');
    const price = priceEl || scope.querySelector('.symbol-price');

    if (!cvs) {
        console.warn('initOrbityxChart: canvas not found in scope:', scope);
        return null;
    }

    if (cvs.tagName !== 'CANVAS') {
        console.error('initOrbityxChart: Element is not a canvas:', cvs);
        return null;
    }

    if (cvs.__chartInitialized) {
        console.log('Chart already initialized on this canvas:', cvs.id || 'unnamed');
        return null;
    }

    try {

        const instanceId = 'chart_' + Date.now();
        if (!cvs.id) {
            cvs.id = instanceId + '_canvas';
        }
        if (tb && !tb.id) tb.id = instanceId + '_toolbar';
        if (ld && !ld.id) ld.id = instanceId + '_loading';
        if (er && !er.id) er.id = instanceId + '_error';
        if (price && !price.id) price.id = instanceId + '_price';


        const app = new OrbityxChartApp({
            canvasId: cvs.id,
            toolbarId: tb?.id,
            loadingId: ld?.id,
            errorId: er?.id,
            priceId: price?.id
        });

        app.init().catch(console.error);

        cvs.__chartInitialized = true;
        cvs.__chartApp = app;

        console.log('Chart initialized successfully on canvas:', cvs.id);

        return app;
    } catch (error) {
        console.error('Failed to initialize chart:', error);
        return null;
    }
}

// === Automatic chart detection and initialization ===
function initializeCharts() {
    const canvases = document.querySelectorAll('#chartCanvas, .chart-canvas');
    let initializedCount = 0;

    canvases.forEach((canvas, index) => {
        if (canvas.__chartInitialized) return;

        if (canvas.tagName === 'CANVAS') {
            try {
                const app = initOrbityxChart({ canvas: canvas });
                if (app) {
                    initializedCount++;
                }
            } catch (error) {
                console.error('Error initializing chart on canvas:', canvas, error);
            }
        } else {
            console.warn('Element found but not a canvas:', canvas);
        }
    });

    if (initializedCount > 0) {
        console.log(`Initialized ${initializedCount} chart(s)`);
    }
}

function initChartsWithRetry() {
    initializeCharts();

    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.matches && (node.matches('#chartCanvas, .chart-canvas') ||
                            node.querySelector('#chartCanvas, .chart-canvas'))) {
                            shouldCheck = true;
                        }
                    }
                });
            }
        });
        if (shouldCheck) {
            setTimeout(initializeCharts, 10);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

document.addEventListener('DOMContentLoaded', initChartsWithRetry);

document.addEventListener('contentLoaded', initChartsWithRetry);

window.initOrbityxChart = initOrbityxChart;
window.initializeCharts = initializeCharts;
window.OrbityxChartApp = OrbityxChartApp;

export default OrbityxChartApp;