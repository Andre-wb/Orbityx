class WebSocketService {
    socket = null;
    subscribers = [];
    statusCallbacks = [];
    isManuallyClosed = false;
    reconnectAttempts = 0;
    pingTimer = null;
    reconnectTimer = null;
    /** Configurable endpoint; defaults to localhost dev server. */
    url = 'ws://127.0.0.1:5000/stream';
    MAX_RECONNECT = 10;
    BASE_DELAY_MS = 1_000; // exponential back-off base
    MAX_DELAY_MS = 30_000; // cap reconnect delay
    PING_INTERVAL = 20_000; // heartbeat period
    // ───────────────────────────────────────────────────────────────────────────
    // Connection lifecycle
    // ───────────────────────────────────────────────────────────────────────────
    /** Override the server URL before calling connect(). */
    setUrl(url) {
        this.url = url;
    }
    /** Open the connection. No-op when already OPEN or CONNECTING. */
    connect() {
        if (this.isManuallyClosed)
            return;
        if (this.socket &&
            (this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING))
            return;
        try {
            this.socket = new WebSocket(this.url);
        }
        catch (err) {
            console.warn('WebSocket: failed to create socket', err);
            this.scheduleReconnect();
            return;
        }
        this.socket.onopen = () => {
            console.info(`[WS] Connected → ${this.url}`);
            this.reconnectAttempts = 0;
            this.startPing();
            this.notifyStatus(true);
        };
        this.socket.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                this.subscribers.forEach((cb) => cb(msg));
            }
            catch {
                console.warn('[WS] Non-JSON frame:', ev.data);
            }
        };
        this.socket.onerror = () => {
            // onerror is always followed by onclose; log only.
            console.warn('[WS] Socket error');
        };
        this.socket.onclose = (ev) => {
            this.stopPing();
            this.notifyStatus(false);
            console.warn(`[WS] Closed (code ${ev.code})`);
            if (!this.isManuallyClosed && this.reconnectAttempts < this.MAX_RECONNECT) {
                this.scheduleReconnect();
            }
        };
    }
    scheduleReconnect() {
        this.reconnectAttempts++;
        // Exponential back-off with jitter.
        const delay = Math.min(this.BASE_DELAY_MS * 2 ** this.reconnectAttempts + Math.random() * 500, this.MAX_DELAY_MS);
        console.info(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    /** Gracefully close and disable auto-reconnect. */
    disconnect() {
        this.isManuallyClosed = true;
        this.stopPing();
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.socket?.close(1000, 'Client disconnected');
        this.socket = null;
    }
    // ───────────────────────────────────────────────────────────────────────────
    // Heartbeat
    // ───────────────────────────────────────────────────────────────────────────
    startPing() {
        this.pingTimer = setInterval(() => {
            this.send({ type: 'heartbeat' });
        }, this.PING_INTERVAL);
    }
    stopPing() {
        if (this.pingTimer !== null) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    // ───────────────────────────────────────────────────────────────────────────
    // Pub/Sub
    // ───────────────────────────────────────────────────────────────────────────
    /** Register a message subscriber; auto-connects when first subscriber arrives. */
    subscribe(callback) {
        this.subscribers.push(callback);
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.isManuallyClosed = false;
            this.connect();
        }
        return () => this.unsubscribe(callback);
    }
    unsubscribe(callback) {
        this.subscribers = this.subscribers.filter((cb) => cb !== callback);
        if (this.subscribers.length === 0)
            this.disconnect();
    }
    /** Listen for connection status changes (true = connected, false = disconnected). */
    onStatus(callback) {
        this.statusCallbacks.push(callback);
        return () => {
            this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
        };
    }
    notifyStatus(connected) {
        this.statusCallbacks.forEach((cb) => cb(connected));
    }
    /** Send a JSON message. Silently drops when socket is not OPEN. */
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }
    get isConnected() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}
// Export as singleton.
export default new WebSocketService();
//# sourceMappingURL=ws.js.map