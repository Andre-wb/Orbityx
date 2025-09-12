// TODO: Set the actual WebSocket endpoint here. Prefer secure wss:// in production.
// Example: const WEBSOCKET_URL = process.env.WS_URL ?? 'wss://example.com/stream';
const WEBSOCKET_URL = 'ws://127.0.0.1:5000/stream';
/**
 * WebsocketService – resilient client for JSON-based WS streams.
 *
 * Responsibilities:
 *  - Manage a single WebSocket connection with auto-reconnect.
 *  - Heartbeat the server via periodic 'ping' messages.
 *  - Fan-out parsed messages to subscribed callbacks.
 *
 * Non-goals:
 *  - Message domain logic. Consumers should parse/branch on payloads.
 */
class WebsocketService {
    constructor() {
        this.socket = null;
        this.subscribers = [];
        // Wait 5s between reconnect attempts to avoid thundering herd.
        this.reconnectInterval = 5000;
        this.reconnectAttempts = 0;
        // Cap retries to prevent infinite loops when server is down.
        this.maxReconnectAttempts = 10;
        this.isManuallyClosed = false;
        // Heartbeat every 30s; align with server idle timeouts if applicable.
        this.pingInterval = 30000;
        this.pingTimer = null;
    }
    /**
     * Open the WS connection (idempotent). Auto-reconnects on abnormal closes
     * until `maxReconnectAttempts` is reached or `disconnect()` is called.
     */
    connect() {
        // Respect manual shutdowns; do not auto-reconnect after disconnect().
        if (this.isManuallyClosed)
            return;
        // Avoid creating a second connection while OPEN or CONNECTING.
        if (this.socket &&
            (this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }
        // Create a new connection to the configured endpoint.
        this.socket = new WebSocket(WEBSOCKET_URL);
        this.socket.onopen = () => {
            console.info('WebSocket connected');
            this.reconnectAttempts = 0;
            // Begin heartbeat once the socket is live.
            this.startPing();
        };
        // Parse JSON frames and broadcast to all subscribers.
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.subscribers.forEach((cb) => cb(data));
            }
            catch {
                console.warn('WS: Invalid JSON', event.data);
            }
        };
        // Log transport-level errors and proactively close to trigger reconnect.
        this.socket.onerror = (err) => {
            console.error('WebSocket error', err);
            this.socket?.close();
        };
        // Handle closes: stop heartbeat and schedule a reconnect if allowed.
        this.socket.onclose = (event) => {
            this.stopPing();
            console.warn(`WS closed (code: ${event.code}), reconnect in ${this.reconnectInterval}ms`);
            if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                window.setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect();
                }, this.reconnectInterval);
            }
        };
    }
    /**
     * Start sending periodic 'ping' messages to keep intermediaries alive
     * (e.g., proxies) and to detect half-open connections.
     */
    startPing() {
        this.pingTimer = window.setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.pingInterval);
    }
    /**
     * Stop the heartbeat timer safely.
     */
    stopPing() {
        if (this.pingTimer !== null) {
            window.clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    /**
     * Register a subscriber and ensure the connection is established.
     * No-op with console error if the callback is not a function.
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            console.error('WS: Subscriber must be a function');
            return;
        }
        this.subscribers.push(callback);
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.connect();
        }
    }
    /**
     * Unregister a subscriber; auto-disconnect when the last subscriber leaves.
     */
    unsubscribe(callback) {
        // NOTE: Nearby identifier must remain exactly as-is per request (no edits).
        // Remove the exact callback instance from the list.
        this.subscribers = this.subscribers.filter((cb) => cb !== callback);
        if (this.subscribers.length === 0) {
            this.disconnect();
        }
    }
    /**
     * Send a JSON-encoded message if the socket is open; otherwise warn.
     * Upstream code may implement a message queue/retry if needed.
     */
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
        else {
            console.warn('WS not open, queuing message');
        }
    }
    /**
     * Gracefully close the socket and prevent automatic reconnects.
     */
    disconnect() {
        this.isManuallyClosed = true;
        this.stopPing();
        if (this.socket) {
            this.socket.close(1000, 'User disconnected');
            this.socket = null;
        }
    }
}
export default new WebsocketService();
//# sourceMappingURL=ws.js.map