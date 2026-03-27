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
import type { Candle, ChartConfig, ChartState, ThemeColors, ChartType, DrawingMode, IndicatorId, ScaleType, PriceAlert, CompareSeriesData, ReplayState, IChartControls } from '../types/index.js';
export default class ChartEngine implements IChartControls {
    readonly canvas: HTMLCanvasElement;
    private readonly ctx;
    private dpr;
    config: ChartConfig;
    state: ChartState;
    private readonly alertMgr;
    private readonly replayCtrl;
    private readonly drawingMgr;
    private readonly screenshotSvc;
    private timeframe;
    private indicatorCache;
    /** Compare/overlay instrument series. */
    compareSeries: CompareSeriesData[];
    onNeedMoreData: (() => void) | null;
    fetchingMoreHistory: boolean;
    private _onResize;
    private _onWheel;
    private _onMDown;
    private _onMMove;
    private _onMUp;
    private _onMLeave;
    private _onKey;
    private _onTStart;
    private _onTMove;
    private _onTEnd;
    constructor(canvasId: string);
    init(dataManager: {
        getData(): Candle[];
    }): void;
    update(): void;
    destroy(): void;
    setData(data: Candle[]): void;
    setTimeframe(tf: string): void;
    resetView(): void;
    zoomIn(): void;
    zoomOut(): void;
    setChartType(type: ChartType): void;
    setDrawingMode(mode: DrawingMode): void;
    clearDrawings(): void;
    setScaleType(scale: ScaleType): void;
    cycleScaleType(): void;
    toggleMagnet(): void;
    private snapToOHLC;
    get alerts(): readonly PriceAlert[];
    set onAlertTriggered(fn: ((alert: PriceAlert) => void) | null);
    addAlert(alert: PriceAlert): void;
    removeAlert(id: string): void;
    loadAlerts(): void;
    private checkAlerts;
    get replay(): ReplayState;
    startReplay(): void;
    stopReplay(): void;
    toggleReplayPause(): void;
    setReplaySpeed(speed: number): void;
    replayStep(): void;
    replayStepBack(): void;
    addCompareSeries(series: CompareSeriesData): void;
    removeCompareSeries(instrumentId: string): void;
    clearCompareSeries(): void;
    screenshot(): string;
    downloadScreenshot(filename?: string): void;
    copyScreenshotToClipboard(): Promise<void>;
    toggleIndicator(id: IndicatorId): void;
    private invalidateIndicatorCache;
    private recomputeIndicators;
    applyTheme(theme: 'dark' | 'light'): void;
    getColors(): ThemeColors;
    resizeCanvas(): void;
    private handleResize;
    private getPlot;
    private getSubPanelCount;
    updateVisibleData(): void;
    priceToY(price: number): number;
    indexToX(index: number): number;
    xToIndex(x: number): number;
    yToPrice(y: number): number;
    timestampToX(ts: number): number;
    requestDraw(): void;
    draw(): void;
    drawVolumePanel(): void;
    getCandleAtCursor(): Candle | null;
    private setupEventListeners;
    private handleWheel;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleMouseLeave;
    private handleKey;
    private lastTouchDist;
    private lastTouchX;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    private handleDrawingClick;
    private canvasToPrice;
}
//# sourceMappingURL=chart-engine.d.ts.map