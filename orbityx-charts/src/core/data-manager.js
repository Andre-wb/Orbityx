import api from '../services/api';
import { parseISO, format } from '../utils/date';

class dataManager {
    constructor() {
        this.cache = [];
        this.subscribers
    }
    async loadCandles(symbol,interval) {
        const raw = await api.fetchCandles(symbol, interval);
        this._cache = raw.map(item => ({
            timestamp: parseISO(item.timestamp),
            open:   Number(item.open),
            high:   Number(item.high),
            low:    Number(item.low),
            close:  Number(item.close),
            volume: Number(item.volume)
        }));
        this._cache.sort((a, b) => a.timestamp - b.timestamp);
        return [...this._cache];
    }
    getSlice(start, count){
        const end = start + count;
        return this._cache.slice(start, end)
    }
    subscribe(callback){
        if (typeof callback === 'function'){
            this._subscribers.push(callback);
        }
    }
    _notify(candle) {
        this._subscribers.forEach(cb => cb(candle));
    }
    attachSocket(socket) {
        socket.onmessage = event => {
            const data = JSON.parse(event.data);
            const candle = {
                timestamp: parseISO(data.timestamp),
                open: Number(data.open),
                high: Number(data.high),
                low: Number(data.low),
                close: Number(data.close),
                volume: Number(data.volume)
            };
            this._cache.push(candle);
            this._notify(candle);
        }
    }
}
export default dataManager;