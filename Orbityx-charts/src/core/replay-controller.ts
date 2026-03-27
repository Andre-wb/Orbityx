/**
 * @file core/replay-controller.ts
 * @description Bar Replay controller — extracted from ChartEngine (SRP).
 *
 * Single responsibility: manage replay lifecycle (start, stop, pause,
 * step forward/back, speed control, timer).
 *
 * Does not touch rendering or state directly — communicates via
 * the onUpdate callback which the engine uses to apply the replay slice.
 */
import type { Candle, ReplayState } from '../types/index.js';
import { clamp } from '../utils/math.js';

export type ReplayUpdateFn = (visibleSlice: Candle[]) => void;

export class ReplayController {
    private _state: ReplayState = {
        active: false, cursor: 0, speed: 1, paused: true, fullData: [],
    };
    private timer: ReturnType<typeof setInterval> | null = null;
    private _onUpdate: ReplayUpdateFn | null = null;

    get state(): Readonly<ReplayState> { return this._state; }

    set onUpdate(fn: ReplayUpdateFn | null) {
        this._onUpdate = fn;
    }

    start(data: Candle[]): void {
        if (data.length < 2) return;
        this._state = {
            active: true,
            cursor: Math.min(50, Math.floor(data.length / 4)),
            speed: 1,
            paused: true,
            fullData: [...data],
        };
        this.emit();
    }

    stop(): void {
        this.clearTimer();
        const full = this._state.fullData;
        this._state = { active: false, cursor: 0, speed: 1, paused: true, fullData: [] };
        // Return full data so engine can restore
        if (full.length) this._onUpdate?.(full);
    }

    togglePause(): void {
        if (!this._state.active) return;
        this._state.paused = !this._state.paused;
        if (!this._state.paused) {
            this.timer = setInterval(() => this.stepForward(), 1000 / this._state.speed);
        } else {
            this.clearTimer();
        }
    }

    setSpeed(speed: number): void {
        this._state.speed = clamp(speed, 0.25, 32);
        if (!this._state.paused) {
            this.clearTimer();
            this.timer = setInterval(() => this.stepForward(), 1000 / this._state.speed);
        }
    }

    stepForward(): void {
        if (!this._state.active) return;
        if (this._state.cursor >= this._state.fullData.length - 1) {
            this._state.paused = true;
            this.clearTimer();
            return;
        }
        this._state.cursor++;
        this.emit();
    }

    stepBack(): void {
        if (!this._state.active || this._state.cursor <= 1) return;
        this._state.cursor--;
        this.emit();
    }

    private emit(): void {
        const slice = this._state.fullData.slice(0, this._state.cursor + 1);
        this._onUpdate?.(slice);
    }

    private clearTimer(): void {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    destroy(): void {
        this.clearTimer();
    }
}
