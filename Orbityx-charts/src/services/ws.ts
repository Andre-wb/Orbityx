/**
 * @file services/ws.ts
 * @description Resilient WebSocket client with auto-reconnect and heartbeat.
 *
 * Uses exponential back-off for reconnects and emits typed messages
 * to subscribers. Designed as a singleton.
 */
import type { WSMessage } from '../types/index.js';

type MessageCallback = (msg: WSMessage) => void;
type StatusCallback  = (connected: boolean) => void;

class WebSocketService {
    private socket: WebSocket | null = null;
    private subscribers: MessageCallback[] = [];
    private statusCallbacks: StatusCallback[] = [];
    private isManuallyClosed = false;
    private reconnectAttempts = 0;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /** Configurable endpoint; defaults to localhost dev server. */
    private url = 'ws://127.0.0.1:5000/stream';

    private readonly MAX_RECONNECT = 10;
    private readonly BASE_DELAY_MS = 1_000;  // exponential back-off base
    private readonly MAX_DELAY_MS  = 30_000; // cap reconnect delay
    private readonly PING_INTERVAL = 20_000; // heartbeat period

    // ───────────────────────────────────────────────────────────────────────────
    // Connection lifecycle
    // ───────────────────────────────────────────────────────────────────────────

    /** Override the server URL before calling connect(). */
    setUrl(url: string): void {
        this.url = url;
    }

    /** Open the connection. No-op when already OPEN or CONNECTING. */
    connect(): void {
        if (this.isManuallyClosed) return;
        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING)
        ) return;

        try {
            this.socket = new WebSocket(this.url);
        } catch (err) {
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

        this.socket.onmessage = (ev: MessageEvent<string>) => {
            try {
                const msg = JSON.parse(ev.data) as WSMessage;
                this.subscribers.forEach((cb) => cb(msg));
            } catch {
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

    private scheduleReconnect(): void {
        this.reconnectAttempts++;
        // Exponential back-off with jitter.
        const delay = Math.min(
            this.BASE_DELAY_MS * 2 ** this.reconnectAttempts + Math.random() * 500,
            this.MAX_DELAY_MS,
        );
        console.info(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    /** Gracefully close and disable auto-reconnect. */
    disconnect(): void {
        this.isManuallyClosed = true;
        this.stopPing();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close(1000, 'Client disconnected');
        this.socket = null;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Heartbeat
    // ───────────────────────────────────────────────────────────────────────────

    private startPing(): void {
        this.pingTimer = setInterval(() => {
            this.send({ type: 'heartbeat' });
        }, this.PING_INTERVAL);
    }

    private stopPing(): void {
        if (this.pingTimer !== null) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Pub/Sub
    // ───────────────────────────────────────────────────────────────────────────

    /** Register a message subscriber; auto-connects when first subscriber arrives. */
    subscribe(callback: MessageCallback): () => void {
        this.subscribers.push(callback);
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.isManuallyClosed = false;
            this.connect();
        }
        return () => this.unsubscribe(callback);
    }

    private unsubscribe(callback: MessageCallback): void {
        this.subscribers = this.subscribers.filter((cb) => cb !== callback);
        if (this.subscribers.length === 0) this.disconnect();
    }

    /** Listen for connection status changes (true = connected, false = disconnected). */
    onStatus(callback: StatusCallback): () => void {
        this.statusCallbacks.push(callback);
        return () => {
            this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
        };
    }

    private notifyStatus(connected: boolean): void {
        this.statusCallbacks.forEach((cb) => cb(connected));
    }

    /** Send a JSON message. Silently drops when socket is not OPEN. */
    send(message: WSMessage): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    get isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

// Export as singleton.
export default new WebSocketService();