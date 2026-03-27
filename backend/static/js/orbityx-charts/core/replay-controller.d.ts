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
export type ReplayUpdateFn = (visibleSlice: Candle[]) => void;
export declare class ReplayController {
    private _state;
    private timer;
    private _onUpdate;
    get state(): Readonly<ReplayState>;
    set onUpdate(fn: ReplayUpdateFn | null);
    start(data: Candle[]): void;
    stop(): void;
    togglePause(): void;
    setSpeed(speed: number): void;
    stepForward(): void;
    stepBack(): void;
    private emit;
    private clearTimer;
    destroy(): void;
}
//# sourceMappingURL=replay-controller.d.ts.map