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

// ─────────────────────────────────────────────────────────────────────────────
// Drawing Tool Registry (OCP)
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawingToolDef {
    /** Number of clicks to complete (1 = horizontal, 2 = trendline, 3 = pitchfork). */
    pointsRequired: number;
    /** If true, prompt user for text input on first click. */
    promptText?: boolean;
}

const toolDefs = new Map<DrawingMode, DrawingToolDef>();

/** Register a drawing tool definition. */
export function registerDrawingTool(mode: DrawingMode, def: DrawingToolDef): void {
    toolDefs.set(mode, def);
}

/** Get drawing tool definition (returns undefined for 'none'). */
export function getDrawingToolDef(mode: DrawingMode): DrawingToolDef | undefined {
    return toolDefs.get(mode);
}

// Register built-in tools
registerDrawingTool('horizontal',        { pointsRequired: 1 });
registerDrawingTool('vertical',          { pointsRequired: 1 });
registerDrawingTool('trendline',         { pointsRequired: 2 });
registerDrawingTool('fibonacci',         { pointsRequired: 2 });
registerDrawingTool('rectangle',         { pointsRequired: 2 });
registerDrawingTool('ray',               { pointsRequired: 2 });
registerDrawingTool('extended_line',     { pointsRequired: 2 });
registerDrawingTool('arrow',             { pointsRequired: 2 });
registerDrawingTool('measure',           { pointsRequired: 2 });
registerDrawingTool('text',              { pointsRequired: 1, promptText: true });
registerDrawingTool('parallel_channel',  { pointsRequired: 3 });
registerDrawingTool('pitchfork',         { pointsRequired: 3 });

// ─────────────────────────────────────────────────────────────────────────────
// DrawingManager
// ─────────────────────────────────────────────────────────────────────────────

export class DrawingManager {
    private _drawings: Drawing[] = [];
    private _draft: Drawing | null = null;

    get drawings(): readonly Drawing[] { return this._drawings; }
    get draftDrawing(): Drawing | null { return this._draft; }

    /**
     * Handle a click while a drawing tool is active.
     * @returns true if a drawing was finalized or cancelled.
     */
    handleClick(
        mode: DrawingMode,
        point: PricePoint,
        colors: ThemeColors,
    ): boolean {
        const def = toolDefs.get(mode);
        if (!def) return false;

        // Text labels need prompt — handled by caller before this
        if (def.promptText && !this._draft) {
            return false; // caller should prompt, then call addTextDrawing()
        }

        if (!this._draft) {
            this._draft = {
                id:        `draw_${Date.now()}`,
                type:      mode,
                points:    [point],
                color:     colors.priceLineColor,
                lineWidth: 1.5,
                isDraft:   true,
            };
            if (def.pointsRequired === 1) {
                return this.finalize();
            }
            return false;
        }

        this._draft.points.push(point);
        if (this._draft.points.length >= def.pointsRequired) {
            return this.finalize();
        }
        return false;
    }

    /** Add a text drawing directly (after prompt). */
    addTextDrawing(point: PricePoint, text: string, color: string): void {
        this._drawings.push({
            id: `draw_${Date.now()}`, type: 'text', points: [point],
            color, lineWidth: 1, isDraft: false, text,
        });
    }

    /** Update the second point of a draft drawing (mouse tracking). */
    updateDraftEndpoint(point: PricePoint): void {
        if (!this._draft || this._draft.points.length < 1) return;
        if (this._draft.points.length > 1) {
            this._draft.points[this._draft.points.length - 1] = point;
        } else {
            this._draft.points.push(point);
        }
    }

    cancelDraft(): void {
        this._draft = null;
    }

    clearAll(): void {
        this._drawings = [];
        this._draft = null;
    }

    private finalize(): boolean {
        if (!this._draft) return false;
        this._draft.isDraft = false;
        this._drawings.push(this._draft);
        this._draft = null;
        return true;
    }
}
