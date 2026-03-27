import { clamp } from '../utils/math.js';
export class ReplayController {
    _state = {
        active: false, cursor: 0, speed: 1, paused: true, fullData: [],
    };
    timer = null;
    _onUpdate = null;
    get state() { return this._state; }
    set onUpdate(fn) {
        this._onUpdate = fn;
    }
    start(data) {
        if (data.length < 2)
            return;
        this._state = {
            active: true,
            cursor: Math.min(50, Math.floor(data.length / 4)),
            speed: 1,
            paused: true,
            fullData: [...data],
        };
        this.emit();
    }
    stop() {
        this.clearTimer();
        const full = this._state.fullData;
        this._state = { active: false, cursor: 0, speed: 1, paused: true, fullData: [] };
        // Return full data so engine can restore
        if (full.length)
            this._onUpdate?.(full);
    }
    togglePause() {
        if (!this._state.active)
            return;
        this._state.paused = !this._state.paused;
        if (!this._state.paused) {
            this.timer = setInterval(() => this.stepForward(), 1000 / this._state.speed);
        }
        else {
            this.clearTimer();
        }
    }
    setSpeed(speed) {
        this._state.speed = clamp(speed, 0.25, 32);
        if (!this._state.paused) {
            this.clearTimer();
            this.timer = setInterval(() => this.stepForward(), 1000 / this._state.speed);
        }
    }
    stepForward() {
        if (!this._state.active)
            return;
        if (this._state.cursor >= this._state.fullData.length - 1) {
            this._state.paused = true;
            this.clearTimer();
            return;
        }
        this._state.cursor++;
        this.emit();
    }
    stepBack() {
        if (!this._state.active || this._state.cursor <= 1)
            return;
        this._state.cursor--;
        this.emit();
    }
    emit() {
        const slice = this._state.fullData.slice(0, this._state.cursor + 1);
        this._onUpdate?.(slice);
    }
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    destroy() {
        this.clearTimer();
    }
}
//# sourceMappingURL=replay-controller.js.map