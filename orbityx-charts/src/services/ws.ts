const WEBSOCKET_URL: string = 'SOMETHING???';

type Subscriber = (data: unknown) => void;

class WebsocketService {
  private socket: WebSocket | null;
  private subscribers: Subscriber[];
  private readonly reconnectInterval: number;
  private reconnectAttempts: number;
  private readonly maxReconnectAttempts: number;
  private isManuallyClosed: boolean;
  private readonly pingInterval: number;
  private pingTimer: number | null;

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

  connect(): void {
    if (this.isManuallyClosed) return;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.socket = new WebSocket(WEBSOCKET_URL);

    this.socket.onopen = () => {
      console.info('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: unknown = JSON.parse(event.data);
        this.subscribers.forEach((cb) => cb(data));
      } catch {
        console.warn('WS: Invalid JSON', event.data);
      }
    };

    this.socket.onerror = (err: Event) => {
      console.error('WebSocket error', err);
      this.socket?.close();
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.stopPing();
      console.warn(
        `WS closed (code: ${event.code}), reconnect in ${this.reconnectInterval}ms`
      );

      if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
        window.setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, this.reconnectInterval);
      }
    };
  }

  private startPing(): void {
    this.pingTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  subscribe(callback: Subscriber): void {
    if (typeof callback !== 'function') {
      console.error('WS: Subscriber must be a function');
      return;
    }
    this.subscribers.push(callback);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  unsubscribe(callback: Subscriber): void {
    this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    if (this.subscribers.length === 0) {
      this.disconnect();
    }
  }

  send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WS not open, queuing message');
    }
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    this.stopPing();
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
  }
}

export default new WebsocketService();