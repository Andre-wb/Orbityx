/**
 * @file core/drawing-manager.ts
 * @description Drawing state and tool logic — extracted from ChartEngine (SRP).
 *
 * Single responsibility: manage drawings array, draft drawing,
 * and click-to-place logic for all drawing tool types.
 *
 * Open/Closed: uses DrawingToolRegistry so new tools can be added
 * without modifying this file.
 */
import type { Drawing, DrawingMode, PricePoint, ThemeColors } from '../types/index.js';
export interface DrawingToolDef {
    /** Number of clicks to complete (1 = horizontal, 2 = trendline, 3 = pitchfork). */
    pointsRequired: number;
    /** If true, prompt user for text input on first click. */
    promptText?: boolean;
}
/** Register a drawing tool definition. */
export declare function registerDrawingTool(mode: DrawingMode, def: DrawingToolDef): void;
/** Get drawing tool definition (returns undefined for 'none'). */
export declare function getDrawingToolDef(mode: DrawingMode): DrawingToolDef | undefined;
export declare class DrawingManager {
    private _drawings;
    private _draft;
    get drawings(): readonly Drawing[];
    get draftDrawing(): Drawing | null;
    /**
     * Handle a click while a drawing tool is active.
     * @returns true if a drawing was finalized or cancelled.
     */
    handleClick(mode: DrawingMode, point: PricePoint, colors: ThemeColors): boolean;
    /** Add a text drawing directly (after prompt). */
    addTextDrawing(point: PricePoint, text: string, color: string): void;
    /** Update the second point of a draft drawing (mouse tracking). */
    updateDraftEndpoint(point: PricePoint): void;
    cancelDraft(): void;
    clearAll(): void;
    private finalize;
}
//# sourceMappingURL=drawing-manager.d.ts.map