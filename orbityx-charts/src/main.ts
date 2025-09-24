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
import dataManager, { type Candle } from './core/data-manager.js';
import ChartEngine from './core/chart-engine.js';
import WebsocketService from './services/ws.js';

/**
 * Minimal data-provider surface required by the app.
 */
type DataManagerLike = {
    loadCandles(symbol: string, timeframe: string): Promise<Candle[]>;
    getData(): Candle[];
    subscribe?(cb: (candle: Candle) => void): unknown;
};
/**
 * Lightweight WebSocket facade used by this module.
 */
type WebsocketLike = {
    setUrl?(url: string): void;
    connect?(): void;
    subscribe?(cb: (msg: any) => void): void;
    send?(msg: any): void;
};

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
    private readonly symbol: string;
    private timeframe: string;
    private readonly dataManager: DataManagerLike;
    private readonly chartEngine: ChartEngine;

    /**
     * Initialize instance fields and bind to the canvas-backed ChartEngine.
     */
    constructor() {
        this.symbol = CONFIG.DEFAULT_SYMBOL;
        this.timeframe = CONFIG.DEFAULT_TIMEFRAME;
        this.dataManager = dataManager as unknown as DataManagerLike;
        this.chartEngine = new ChartEngine('chartCanvas');
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
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showErrorNotification('Initialization Error', 'Failed to initialize application');
        }
    }

    /**
     * Wire up UI modules, passing callbacks or instances as required.
     */
    private initUI() {
        // Toolbar receives timeframe/chart-type handlers and engine instance.
        (initToolBar as unknown as (...args: any[]) => void)(
            this.handleTimeframeChange.bind(this),
            this.handleChartTypeChange.bind(this),
            this.chartEngine
        );

        // Legend shows symbol and live price/change.
        (initLegend as unknown as (...args: any[]) => void)(this.symbol);

        // Tooltip attaches to the engine to display O/H/L/C/Volume under cursor.
        (initTooltip as unknown as (...args: any[]) => void)(
            this.chartEngine,
            this.dataManager as any
        );
    }

    /**
     * Fetch and set historical candles for the current symbol/timeframe.
     */
    public async loadHistoricalData() {
        try {
            this.showLoadingIndicator();

            // Delegate to the data manager (returns normalized Candle[]).
            await this.dataManager.loadCandles(this.symbol, this.timeframe);
            const candles = this.dataManager.getData();
            // Push data into the renderer; redraw handled by engine.
            this.chartEngine.setData(candles as any);

            console.info(`Loaded ${Array.isArray(candles) ? candles.length : 0} historical candles`);
            this.hideLoadingIndicator();
        } catch (error) {
            console.error('Failed to load historical data:', error);
            this.hideLoadingIndicator();
            this.showErrorNotification('Data Load Error', 'Failed to load historical data');
        }
    }

    /**
     * Connect to WS server and subscribe to updates for the current stream.
     */
    private setupRealtimeUpdates() {
        const WS = (WebsocketService as unknown as WebsocketLike);

        // Configure endpoint if the service exposes a setter.
        WS.setUrl?.(CONFIG.WEBSOCKET_URL);

        // Open the connection; no-op if already connected.
        WS.connect?.();

        // Dispatch based on message type (candle/trade/heartbeat).
        WS.subscribe?.((data: any) => {
            // On new candle: refresh dataset; engine redraw handles visuals.
            if (data?.type === 'candle' && data?.payload) {
                if (this.dataManager.subscribe) {
                    this.chartEngine.setData(this.dataManager.getData() as any);
                    this.chartEngine.draw();
                } else {
                    this.chartEngine.setData(this.dataManager.getData() as any);
                }
            // On trade tick: update last price and re-render.
            } else if (data?.type === 'trade' && typeof data.price === 'number') {
                this.updateLastPrice(data.price);
            // Keep-alive: respond with a 'pong'.
            } else if (data?.type === 'heartbeat') {
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
    private handleTimeframeChange(newTimeframe: string) {
        // Persist new timeframe on the instance.
        const WS = (WebsocketService as unknown as WebsocketLike);
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
    private handleChartTypeChange(chartType: string) {
        (this.chartEngine as any).setChartType?.(chartType);
    }

    /**
     * Apply theme to document + engine and broadcast to interested modules.
     */
    private applyTheme(theme: 'dark' | 'light') {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        this.chartEngine.applyTheme(theme);
        document.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    }

    /**
     * Update the engine's current price and reflect it in the legend header.
     */
    private updateLastPrice(price: number) {
        (this.chartEngine as any).state && ((this.chartEngine as any).state.currentPrice = price);
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
    private showLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }

    /** Hide the loading overlay if present. */
    private hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Render (or create and render) a dismissible error banner.
     */
    public showErrorNotification(title: string, message: string) {
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
        notification.querySelector('.error-title')!.textContent = title;
        notification.querySelector('.error-message')!.textContent = message;
        notification.style.display = 'block';

        setTimeout(() => {
            notification!.style.display = 'none';
        }, 5000);
    }

    /**
     * Simple FPS monitor using requestAnimationFrame and a moving delta.
     */
    private setupPerformanceMonitoring() {
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

export default OrbityxChartApp;