/**
 * @file core/multi-chart.ts
 * @description Multi-chart layout manager — supports 1x1, 1x2, 2x1, 2x2
 * split-screen layouts with synchronized crosshairs.
 *
 * Each cell hosts an independent ChartEngine instance inside a dynamically
 * created <canvas> element. The primary chart (index 0) drives symbol
 * selection; secondary cells can show different timeframes or instruments.
 */
export type LayoutMode = '1x1' | '1x2' | '2x1' | '2x2';
export interface LayoutCell {
    canvasId: string;
    container: HTMLElement;
}
/**
 * Apply a multi-chart layout to the given container.
 * Creates the necessary canvas elements and CSS grid.
 *
 * @returns Array of created canvas IDs (callers instantiate ChartEngine per ID).
 */
export declare function applyLayout(containerId: string, layout: LayoutMode): LayoutCell[];
/**
 * Reset to single-chart layout (removes extra canvases, restores original).
 */
export declare function resetLayout(containerId: string): void;
/**
 * Synchronize crosshair position across multiple chart engines.
 * Call this in a shared mousemove handler to sync mouse Y across charts.
 */
export declare function syncCrosshair(engines: {
    state: {
        mouseX: number;
        mouseY: number;
        mouseInside: boolean;
    };
    requestDraw(): void;
}[], sourceIndex: number): void;
//# sourceMappingURL=multi-chart.d.ts.map