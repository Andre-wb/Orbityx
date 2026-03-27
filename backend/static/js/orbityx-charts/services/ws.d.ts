/**
 * @file services/ws.ts
 * @description Resilient WebSocket client with auto-reconnect and heartbeat.
 *
 * Uses exponential back-off for reconnects and emits typed messages
 * to subscribers. Designed as a singleton.
 */
import type { WSMessage } from '../types/index.js';
type MessageCallback = (msg: WSMessage) => void;
type StatusCallback = (connected: boolean) => void;
declare class WebSocketService {
    private socket;
    private subscribers;
    private statusCallbacks;
    private isManuallyClosed;
    private reconnectAttempts;
    private pingTimer;
    private reconnectTimer;
    /** Configurable endpoint; defaults to localhost dev server. */
    private url;
    private readonly MAX_RECONNECT;
    private readonly BASE_DELAY_MS;
    private readonly MAX_DELAY_MS;
    private readonly PING_INTERVAL;
    /** Override the server URL before calling connect(). */
    setUrl(url: string): void;
    /** Open the connection. No-op when already OPEN or CONNECTING. */
    connect(): void;
    private scheduleReconnect;
    /** Gracefully close and disable auto-reconnect. */
    disconnect(): void;
    private startPing;
    private stopPing;
    /** Register a message subscriber; auto-connects when first subscriber arrives. */
    subscribe(callback: MessageCallback): () => void;
    private unsubscribe;
    /** Listen for connection status changes (true = connected, false = disconnected). */
    onStatus(callback: StatusCallback): () => void;
    private notifyStatus;
    /** Send a JSON message. Silently drops when socket is not OPEN. */
    send(message: WSMessage): void;
    get isConnected(): boolean;
}
declare const _default: WebSocketService;
export default _default;
//# sourceMappingURL=ws.d.ts.map