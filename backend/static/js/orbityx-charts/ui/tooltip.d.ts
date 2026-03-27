/**
 * @file ui/tooltip.ts
 * @description Floating OHLCV tooltip that follows the cursor inside the chart canvas.
 *
 * Reads the candle under the cursor from ChartEngine.getCandleAtCursor(),
 * so it stays in sync with the engine's viewport math automatically.
 *
 * Fixes applied vs v1:
 *  - TS2307: import now points to '../utils/format.js' (concrete file, not missing barrel)
 *  - TS18048: refs typed with a named interface instead of Record<string, HTMLElement>,
 *             so every field is known non-undefined to the compiler
 *  - Duplicate `formatDate` declaration removed; replaced by local `formatTimestamp`
 */
import type { IChartControls } from '../types/index.js';
/** Inject the tooltip element into <body> and bind to the canvas. */
export declare function initTooltip(engine: IChartControls): HTMLDivElement;
//# sourceMappingURL=tooltip.d.ts.map