const WEBSOCKET_URL = 'SOMETHING???';

class WebsocketService {
    constructor() {
        this.socket = null;
        this.subscribers = [];
        this.reconnectInterval = 5000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.isManuallyClosed = false;
        this.pingInterval = 30000;
        this.pingTimer = null;
    }

    connect() {
        if (this.isManuallyClosed) return;

        if (this.socket && (
            this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING
        )) {
            return;
        }

        this.socket = new WebSocket(WEBSOCKET_URL);

        this.socket.onopen = () => {
            console.info('WebSocket connected');
            this.reconnectAttempts = 0;
            this.startPing();
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.subscribers.forEach(cb => cb(data));
            } catch (err) {
                console.warn('WS: Invalid JSON', event.data);
            }
        };

        this.socket.onerror = (err) => {
            console.error('WebSocket error', err);
            this.socket.close();
        };

        this.socket.onclose = (event) => {
            this.stopPing();
            console.warn(`WS closed (code: ${event.code}), reconnect in ${this.reconnectInterval}ms`);

            if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect();
                }, this.reconnectInterval);
            }
        };
    }

    startPing() {
        this.pingTimer = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.pingInterval);
    }

    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

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

    unsubscribe(callback) {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
        if (this.subscribers.length === 0) {
            this.disconnect();
        }
    }

    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WS not open, queuing message');
        }
    }

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