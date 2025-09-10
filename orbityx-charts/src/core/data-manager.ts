import api from '../services/api.js';
import { parseISO } from '../utils/date.js';

export type Candle = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

type RawCandle = {
    timestamp: string | number | Date;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
};

type Subscriber = (candle: Candle) => void;

type ApiLike = {
    fetchCandles(symbol: string, interval: string): Promise<any>;
    fetchMarketChart?: (symbol: string, days?: number) => Promise<any>;
};

function normalizeRaw(item: any): RawCandle {
    const ts =
        item.timestamp ??
        item.time ??
        item.t ??
        (Array.isArray(item) ? item[0] : undefined);

    const open =
        item.open ?? item.o ?? (Array.isArray(item) ? item[1] : undefined);
    const high =
        item.high ?? item.h ?? (Array.isArray(item) ? item[2] : undefined);
    const low =
        item.low ?? item.l ?? (Array.isArray(item) ? item[3] : undefined);
    const close =
        item.close ?? item.c ?? (Array.isArray(item) ? item[4] : undefined);
    const volume =
        item.volume ?? item.v ?? (Array.isArray(item) ? item[5] : undefined);

    return { timestamp: ts, open, high, low, close, volume };
}

async function fetchCandlesAdapted(symbol: string, interval: string): Promise<RawCandle[]> {
    const res = await (api as ApiLike).fetchCandles(symbol, interval);
    if (!Array.isArray(res)) return [];
    return res.map(normalizeRaw);
}

class DataManager {
    private _cache: Candle[] = [];
    private _subscribers: Subscriber[] = [];

    async loadCandles(symbol: string, interval: string): Promise<Candle[]> {
        const raw = await fetchCandlesAdapted(symbol, interval);

        this._cache = raw
            .map((item): Candle => ({
                timestamp: parseISO(item.timestamp),
                open: Number(item.open),
                high: Number(item.high),
                low: Number(item.low),
                close: Number(item.close),
                volume: Number(item.volume),
            }))
            .filter(c => Number.isFinite(c.timestamp));

        this._cache.sort((a, b) => a.timestamp - b.timestamp);
        return [...this._cache];
    }

    getData(): Candle[] {
        return [...this._cache];
    }

    getSlice(start: number, count: number): Candle[] {
        return this._cache.slice(start, start + count);
    }

    subscribe(callback: Subscriber): () => void {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    }

    private _notify(candle: Candle): void {
        for (const cb of this._subscribers) cb(candle);
    }

    attachSocket(socket: WebSocket): void {
        socket.addEventListener('message', (event: MessageEvent<string>) => {
            const data = JSON.parse(event.data) as any;
            const raw = normalizeRaw(data);
            const candle: Candle = {
                timestamp: parseISO(raw.timestamp),
                open: Number(raw.open),
                high: Number(raw.high),
                low: Number(raw.low),
                close: Number(raw.close),
                volume: Number(raw.volume),
            };
            this._cache.push(candle);
            this._notify(candle);
        });
    }
}

export default new DataManager();