/**
 * @file core/alert-manager.ts
 * @description Price alert system — extracted from ChartEngine (SRP).
 *
 * Single responsibility: manage price alerts lifecycle
 * (create, remove, toggle, persist, check triggers, notify).
 */
import type { PriceAlert } from '../types/index.js';
export declare class AlertManager {
    private _alerts;
    private _onTriggered;
    get alerts(): readonly PriceAlert[];
    set onTriggered(fn: ((alert: PriceAlert) => void) | null);
    add(alert: PriceAlert): void;
    remove(id: string): void;
    toggle(id: string): void;
    /**
     * Check all enabled, un-triggered alerts against the current price.
     * @param currentPrice Latest price.
     * @param previousPrice Previous candle close (for crossing detection).
     */
    check(currentPrice: number, previousPrice: number): void;
    /** Load alerts from localStorage. */
    load(): void;
    private persist;
    private browserNotify;
}
//# sourceMappingURL=alert-manager.d.ts.map