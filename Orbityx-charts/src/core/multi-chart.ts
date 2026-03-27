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
export function applyLayout(
    containerId: string,
    layout: LayoutMode,
): LayoutCell[] {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[MultiChart] Container #${containerId} not found`);
        return [];
    }

    // Clear existing cells
    container.querySelectorAll('.mc-cell').forEach(el => el.remove());

    const cells: LayoutCell[] = [];
    let cols = 1, rows = 1;

    switch (layout) {
        case '1x2': cols = 2; rows = 1; break;
        case '2x1': cols = 1; rows = 2; break;
        case '2x2': cols = 2; rows = 2; break;
        default:    cols = 1; rows = 1; break;
    }

    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    container.style.gap = '2px';

    const total = cols * rows;
    for (let i = 0; i < total; i++) {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'mc-cell';
        cellDiv.style.cssText = 'position:relative;overflow:hidden;min-height:0;';

        const canvasId = i === 0 ? 'chartCanvas' : `chartCanvas_${i}`;
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Chart ${i + 1}`);

        cellDiv.appendChild(canvas);
        container.appendChild(cellDiv);

        cells.push({ canvasId, container: cellDiv });
    }

    return cells;
}

/**
 * Reset to single-chart layout (removes extra canvases, restores original).
 */
export function resetLayout(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.mc-cell').forEach(el => el.remove());
    container.style.display = '';
    container.style.gridTemplateColumns = '';
    container.style.gridTemplateRows = '';
    container.style.gap = '';

    // Ensure original canvas exists
    if (!container.querySelector('#chartCanvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'chartCanvas';
        canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
        container.appendChild(canvas);
    }
}

/**
 * Synchronize crosshair position across multiple chart engines.
 * Call this in a shared mousemove handler to sync mouse Y across charts.
 */
export function syncCrosshair(
    engines: { state: { mouseX: number; mouseY: number; mouseInside: boolean }; requestDraw(): void }[],
    sourceIndex: number,
): void {
    const src = engines[sourceIndex];
    if (!src || !src.state.mouseInside) return;

    for (let i = 0; i < engines.length; i++) {
        if (i === sourceIndex) continue;
        const eng = engines[i];
        if (!eng) continue;
        // Sync vertical line position (same X timestamp)
        eng.state.mouseX = src.state.mouseX;
        eng.state.mouseInside = true;
        eng.requestDraw();
    }
}
