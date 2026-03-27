const STORAGE_KEY = 'orbityx_alerts';
export class AlertManager {
    _alerts = [];
    _onTriggered = null;
    get alerts() { return this._alerts; }
    set onTriggered(fn) {
        this._onTriggered = fn;
    }
    add(alert) {
        this._alerts.push(alert);
        this.persist();
    }
    remove(id) {
        this._alerts = this._alerts.filter(a => a.id !== id);
        this.persist();
    }
    toggle(id) {
        const alert = this._alerts.find(a => a.id === id);
        if (alert) {
            alert.enabled = !alert.enabled;
            this.persist();
        }
    }
    /**
     * Check all enabled, un-triggered alerts against the current price.
     * @param currentPrice Latest price.
     * @param previousPrice Previous candle close (for crossing detection).
     */
    check(currentPrice, previousPrice) {
        for (const alert of this._alerts) {
            if (!alert.enabled || alert.triggered)
                continue;
            let triggered = false;
            switch (alert.condition) {
                case 'crosses_above':
                    triggered = previousPrice <= alert.price && currentPrice > alert.price;
                    break;
                case 'crosses_below':
                    triggered = previousPrice >= alert.price && currentPrice < alert.price;
                    break;
                case 'crosses':
                    triggered =
                        (previousPrice <= alert.price && currentPrice > alert.price) ||
                            (previousPrice >= alert.price && currentPrice < alert.price);
                    break;
            }
            if (triggered) {
                alert.triggered = true;
                this.persist();
                this._onTriggered?.(alert);
                this.browserNotify(alert);
            }
        }
    }
    /** Load alerts from localStorage. */
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw)
                this._alerts = JSON.parse(raw);
        }
        catch { /* corrupt storage — start fresh */ }
    }
    persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._alerts));
        }
        catch { /* quota exceeded — silent */ }
    }
    browserNotify(alert) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Price Alert', { body: alert.message });
        }
    }
}
//# sourceMappingURL=alert-manager.js.map