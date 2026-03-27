/**
 * @file types/index.ts
 * @description Central type registry for Orbityx Chart Pro.
 *
 * The library is completely provider-agnostic. There are no references to
 * CoinGecko, Binance, or any specific data source anywhere in the core.
 * All data flows through the DataProvider interface that the user implements.
 */
/** Raw candle accepted from any external source before normalisation. */
export interface RawCandle {
    timestamp: number | string | Date;
    open: number | string;
    high: number | string;
    low: number | string;
    close: number | string;
    volume?: number | string;
}
/** Normalised, validated candle used by the rendering engine. */
export interface Candle {
    /** Unix epoch milliseconds (UTC). */
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    /** Volume in base-currency units; 0 when source omits it. */
    volume: number;
}
/**
 * Describes a single tradable instrument shown in the symbol selector.
 * Created and registered by the user — the library never hard-codes any list.
 *
 * @example
 * chart.registerInstrument({
 *   id:             'btc_usdt',
 *   symbol:         'BTC/USDT',
 *   name:           'Bitcoin',
 *   icon:           '₿',
 *   iconColor:      '#f7931a',
 *   pricePrecision: 2,
 * });
 */
export interface Instrument {
    /**
     * Unique key used throughout the library.
     * Passed verbatim to DataProvider.fetchCandles() and fetchMarketStats().
     * Can be anything: 'btc_usdt', 'AAPL', 'EUR/USD', 'my-custom-index', etc.
     */
    id: string;
    /**
     * Short label shown in the UI (e.g. 'BTC/USDT', 'AAPL', 'EUR/USD').
     */
    symbol: string;
    /** Full name shown in the legend panel (e.g. 'Bitcoin', 'Apple Inc.'). */
    name: string;
    /**
     * Single character or emoji for the icon badge.
     * Defaults to the first character of `symbol`.
     */
    icon?: string;
    /** CSS colour for the icon badge background/text. */
    iconColor?: string;
    /**
     * Decimal places used to format prices.
     * Default: 2. Increase for low-priced assets (e.g. 6 for SHIB/USDT).
     */
    pricePrecision?: number;
    /**
     * Arbitrary user metadata — never read by the library.
     */
    meta?: Record<string, unknown>;
}
/**
 * Well-known timeframe keys used by the toolbar.
 * Passed verbatim to DataProvider.fetchCandles() so the provider can
 * map them to its own exchange API parameters.
 */
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' | '3d' | '1w' | '2w' | '1month' | '3month' | '6month' | '1y';
/** Arguments passed to DataProvider.fetchCandles(). */
export interface CandleRequest {
    /** Instrument id as registered with chart.registerInstrument(). */
    instrumentId: string;
    /** Timeframe key selected in the toolbar (e.g. '1h', '1d'). */
    timeframe: Timeframe | string;
    /** Optional: fetch candles starting from this epoch-ms. */
    from?: number;
    /** Optional: fetch candles up to this epoch-ms. */
    to?: number;
    /** Optional: maximum number of candles to return. */
    limit?: number;
}
/** Optional 24-hour market statistics shown in the legend panel. */
export interface MarketStats {
    high24h: number;
    low24h: number;
    volume24h: number;
    /** Market cap in quote-currency units; null when not available. */
    marketCap: number | null;
    priceChange24h: number;
    priceChangePct24h: number;
}
/**
 * The sole interface users must implement to connect Orbityx to any
 * data source: REST API, WebSocket, local DB, CSV files, mock data, etc.
 *
 * Only `fetchCandles` is required. All other methods progressively
 * enhance the UI when present.
 *
 * @example — minimal provider
 * ```ts
 * const myProvider: DataProvider = {
 *   async fetchCandles({ instrumentId, timeframe }) {
 *     const rows = await myApi.getOHLCV(instrumentId, timeframe);
 *     return rows.map(r => ({
 *       timestamp: r.time * 1000,
 *       open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v,
 *     }));
 *   },
 * };
 * chart.setProvider(myProvider);
 * ```
 */
export interface DataProvider {
    /**
     * Fetch OHLCV candles for the given request.
     * Return an array of RawCandle or Candle objects — the library normalises either.
     * Throw (or return a rejected Promise) to surface the error in the UI.
     */
    fetchCandles(request: CandleRequest): Promise<RawCandle[] | Candle[]>;
    /**
     * Optionally fetch 24-hour market statistics shown in the legend.
     * When omitted, the library approximates stats from the loaded candles.
     */
    fetchMarketStats?(instrumentId: string): Promise<Partial<MarketStats>>;
    /**
     * Called once during chart.init(). Use it to authenticate, open connections,
     * or fetch a dynamic instrument list.
     */
    init?(): Promise<void>;
    /**
     * Called when the user changes the active instrument or timeframe so the
     * provider can update live subscriptions.
     */
    onInstrumentChange?(instrumentId: string, timeframe: string): void;
    /** Called when the chart is destroyed — close connections, clear timers. */
    destroy?(): void;
}
/**
 * Message shape expected by the built-in ws.ts service.
 * You can bypass ws.ts entirely and push ticks directly via
 * DataManager.processLiveTick() if your streaming format differs.
 */
export interface WSMessage {
    type: 'candle' | 'trade' | 'heartbeat' | 'pong' | 'subscribe' | 'error';
    payload?: RawCandle;
    price?: number;
    symbol?: string;
    timeframe?: string;
    stats?: Partial<MarketStats>;
    [key: string]: unknown;
}
export type ChartType = 'candlestick' | 'line' | 'area' | 'bars' | 'heikin_ashi' | 'hollow_candle' | 'baseline';
export type DrawingMode = 'none' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci' | 'rectangle' | 'ray' | 'extended_line' | 'parallel_channel' | 'pitchfork' | 'arrow' | 'text' | 'measure';
export type ScaleType = 'linear' | 'logarithmic' | 'percentage';
export type ThemeName = 'dark' | 'light';
export type IndicatorId = 'sma_20' | 'sma_50' | 'sma_200' | 'ema_12' | 'ema_26' | 'bb_20' | 'rsi_14' | 'macd' | 'volume';
/**
 * Custom indicator IDs are plain strings — not restricted to the IndicatorId union.
 * Use `registerIndicator()` to add custom indicators at runtime.
 */
export interface Margin {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface ThemeColors {
    upColor: string;
    downColor: string;
    upWick: string;
    downWick: string;
    bgColor: string;
    panelBg: string;
    gridColor: string;
    axisColor: string;
    textColor: string;
    mutedText: string;
    priceLineColor: string;
    crosshairColor: string;
    selectionColor: string;
    volumeUp: string;
    volumeDown: string;
}
export interface ChartConfig {
    theme: ThemeName;
    darkTheme: ThemeColors;
    lightTheme: ThemeColors;
    candleWidth: number;
    candleSpacing: number;
    margin: Margin;
    volumePanelRatio: number;
    volumePanelGap: number;
    /** Number of candles from the left edge that triggers lazy history loading. */
    lazyLoadThreshold: number;
    /** Price range padding multiplier (fraction of hi-lo range). */
    pricePadding: number;
    /** Fallback padding when hi === lo (fraction of price). */
    pricePaddingFlat: number;
    /** Height in CSS pixels of each sub-panel (RSI, MACD). */
    subPanelHeight: number;
    /** Min/max zoom bounds for scaleX. */
    zoomMin: number;
    zoomMax: number;
    /** Zoom factor applied per step (wheel click or +/- key). */
    zoomStep: number;
    /** Number of candles to scroll per arrow key press. */
    keyScrollStep: number;
    /** Font used for axis labels and price tags. */
    font: string;
    /** Smaller font used for muted/secondary labels. */
    fontSmall: string;
}
/** Viewport / data windowing state — consumed by viewport.ts. */
export interface ViewportState {
    data: Candle[];
    visibleData: Candle[];
    viewportStart: number;
    scaleX: number;
    offsetCandles: number;
    minPrice: number;
    maxPrice: number;
}
/** Physical canvas dimensions. */
export interface CanvasState {
    width: number;
    height: number;
}
/** Mouse / touch / drawing interaction state. */
export interface InteractionState {
    isDragging: boolean;
    dragStartX: number;
    mouseX: number;
    mouseY: number;
    mouseInside: boolean;
    drawingMode: DrawingMode;
}
/** Visual display options — chart type, scale, indicators. */
export interface DisplayState {
    currentPrice: number;
    chartType: ChartType;
    scaleType: ScaleType;
    magnetEnabled: boolean;
    activeIndicators: Set<IndicatorId>;
    rafPending: boolean;
    baselinePrice: number;
}
/**
 * Full chart state — intersection of all sub-states.
 * Kept as a single interface for backward compatibility; consumers
 * should prefer the narrower sub-interfaces where possible.
 */
export interface ChartState extends ViewportState, CanvasState, InteractionState, DisplayState {
}
/**
 * Minimal data-fetching contract used by DataManager.
 * Allows injecting any fetcher (ProviderRegistry, mock, etc.)
 * instead of importing the singleton directly.
 */
export interface ICandleFetcher {
    fetchCandles(request: CandleRequest): Promise<RawCandle[] | Candle[]>;
}
/**
 * UI-facing contract for chart controls.
 * Toolbar, tooltip, and other UI modules depend on this interface
 * instead of the concrete ChartEngine class (DIP).
 */
export interface IChartControls {
    readonly canvas: HTMLCanvasElement;
    readonly state: ChartState;
    setChartType(type: ChartType): void;
    setDrawingMode(mode: DrawingMode): void;
    clearDrawings(): void;
    toggleIndicator(id: IndicatorId): void;
    zoomIn(): void;
    zoomOut(): void;
    resetView(): void;
    setScaleType(scale: ScaleType): void;
    cycleScaleType(): void;
    toggleMagnet(): void;
    downloadScreenshot(filename?: string): void;
    copyScreenshotToClipboard(): Promise<void>;
    getCandleAtCursor(): Candle | null;
    requestDraw(): void;
    addAlert(alert: PriceAlert): void;
    removeAlert(id: string): void;
    readonly replay: ReplayState;
    startReplay(): void;
    stopReplay(): void;
    toggleReplayPause(): void;
    setReplaySpeed(speed: number): void;
    replayStep(): void;
    replayStepBack(): void;
}
export interface IndicatorPoint {
    timestamp: number;
    value: number;
}
export interface BollingerPoint {
    timestamp: number;
    upper: number;
    middle: number;
    lower: number;
}
export interface MACDPoint {
    timestamp: number;
    macd: number;
    signal: number;
    histogram: number;
}
export interface IndicatorSeries {
    id: IndicatorId;
    label: string;
    color: string;
    points?: IndicatorPoint[];
    bollingerPoints?: BollingerPoint[];
    macdPoints?: MACDPoint[];
    isSubPanel: boolean;
    subPanelRange?: [number, number];
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'stepline';
    lineWidth?: number;
}
export interface PricePoint {
    timestamp: number;
    price: number;
}
export interface Drawing {
    id: string;
    type: DrawingMode;
    points: PricePoint[];
    color: string;
    lineWidth: number;
    label?: string;
    isDraft: boolean;
    /** User-entered text for text-label drawings. */
    text?: string;
}
export type AlertCondition = 'crosses_above' | 'crosses_below' | 'crosses';
export interface PriceAlert {
    id: string;
    instrumentId: string;
    price: number;
    condition: AlertCondition;
    message: string;
    color: string;
    enabled: boolean;
    triggered: boolean;
    createdAt: number;
}
export interface CompareSeriesData {
    instrumentId: string;
    symbol: string;
    color: string;
    data: Candle[];
    /** Base price (first candle close) for percentage normalisation. */
    basePrice: number;
}
export interface ReplayState {
    active: boolean;
    /** Index up to which candles are revealed. */
    cursor: number;
    speed: number;
    paused: boolean;
    /** Full dataset (replay reveals a growing slice). */
    fullData: Candle[];
}
export interface MeasureResult {
    priceDelta: number;
    pricePct: number;
    bars: number;
    timeDelta: number;
}
export interface AppEvents {
    themeChanged: ThemeName;
    symbolChanged: string;
    timeframeChanged: Timeframe;
    chartTypeChanged: ChartType;
    indicatorToggled: IndicatorId;
    drawingModeChanged: DrawingMode;
    scaleTypeChanged: ScaleType;
    dataLoaded: Candle[];
    priceUpdated: number;
    alertTriggered: PriceAlert;
    replayStateChanged: ReplayState;
    compareChanged: CompareSeriesData[];
    screenshotTaken: string;
}
//# sourceMappingURL=index.d.ts.map