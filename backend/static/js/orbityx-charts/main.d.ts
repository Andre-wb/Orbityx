import { registry } from './services/api.js';
import type { DataProvider, Instrument, Timeframe } from './types/index.js';
declare class OrbityxChart {
    private opts;
    private engine;
    private activeId;
    private timeframe;
    private legendUnsub;
    private wsUnsub;
    private statsTimer;
    /**
     * Guards against concurrent backwards history fetches.
     * Set to true while a prependCandles() call is in flight;
     * reset to false (along with engine.fetchingMoreHistory) once it resolves.
     */
    private _loadingMore;
    constructor(opts?: {
        canvasId?: string;
    });
    /** Register the DataProvider that supplies OHLCV candles. Must be called before init(). */
    setProvider(provider: DataProvider): this;
    /** Register a single instrument. */
    registerInstrument(instrument: Instrument): this;
    /** Register multiple instruments at once. */
    registerInstruments(instruments: Instrument[]): this;
    /** Set an optional WebSocket URL for live streaming. Omit for pull-only mode. */
    setWebSocketUrl(url: string): this;
    /** Override the default first instrument (defaults to first registered). */
    setDefaultInstrument(id: string): this;
    /** Override the default timeframe (defaults to '1d'). */
    setDefaultTimeframe(tf: Timeframe | string): this;
    init(): Promise<void>;
    destroy(): void;
    /**
     * Full load — replaces the entire cache, resets the viewport, and redraws.
     * Called on init, symbol change, and timeframe change.
     */
    private loadData;
    /**
     * Lazy backwards history load — called automatically by the engine when
     * the viewport comes within LAZY_LOAD_THRESHOLD candles of the oldest entry.
     *
     * Fetches one page of candles older than the current oldest timestamp,
     * prepends them to the DataManager cache, and shifts offsetCandles forward
     * by the same amount so the visible window does not jump.
     *
     * The fetch is a no-op while _loadingMore is true to prevent concurrent
     * requests from the same scroll event stream.
     */
    private loadMoreHistory;
    /** Refresh 24 h market statistics from the provider. */
    private refreshStats;
    private switchInstrument;
    private handleTimeframeChange;
    private setupWebSocket;
    private showLoading;
    private showError;
    private readonly toggleFullscreen;
    private toggleModal;
    private updateConnectionDot;
    /**
     * Add a compare/overlay instrument. Fetches its data and adds to engine.
     * @param instrumentId Registered instrument ID to overlay.
     * @param color CSS color for the overlay line.
     */
    addCompare(instrumentId: string, color?: string): Promise<void>;
    removeCompare(instrumentId: string): void;
    private showShortcutsHelp;
    private setupAccessibilityRegion;
    private startFPSMonitor;
}
export default OrbityxChart;
export { registry };
export type { DataProvider, Instrument } from './types/index.js';
export { registerIndicator, unregisterIndicator, getRegisteredIndicators } from './core/indicators.js';
export { applyLayout, resetLayout, syncCrosshair } from './core/multi-chart.js';
export type { LayoutMode } from './core/multi-chart.js';
export { OrbitScript, compile as orbitCompile, register as orbitRegister, unregister as orbitUnregister } from './orbitscript/index.js';
export type { CompiledScript, ScriptMeta, InputDef } from './orbitscript/index.js';
//# sourceMappingURL=main.d.ts.map