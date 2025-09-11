// Base endpoint for CoinGecko v3 REST API.
const BASE_URL = 'https://api.coingecko.com/api/v3';
// Optional backend origin for DB-backed candles (Flask).
// Empty string means same-origin; change to your server URL if needed.
const BACKEND_BASE = '';
/**
 * Thin fetch wrapper for CoinGecko endpoints.
 * @template T Parsed JSON response type
 * @param path Relative path beginning with '/'
 * @throws Error with HTTP status and response body text when response is not OK
 */
async function request(path) {
    // Compose absolute URL and perform the network request.
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) {
        // Read error payload (if any) to aid debugging and surfacing API limits.
        const text = await res.text();
        throw new Error(`CoinGecko API error ${res.status}: ${res.statusText} — ${text}`);
    }
    return (await res.json());
}
/** Normalize unix timestamp to milliseconds (number). */
function toMillis(ts) {
    // Heuristic: >= 10^12 → already ms, else seconds
    return ts >= 1_000_000_000_000 ? ts : ts * 1000;
}
/**
 * Quick range utility for timeframe strings (1m,5m,15m,1h,4h,1d,1w).
 * Returns [startSec, endSec] in UNIX seconds.
 */
function timeframeToRange(timeframe) {
    const nowSec = Math.floor(Date.now() / 1000);
    const unit = timeframe.slice(-1);
    const n = parseInt(timeframe.slice(0, -1), 10);
    const mult = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : unit === 'w' ? 604800 : 0;
    const span = isFinite(n) && mult ? n * mult : 86400; // default 1 day
    return [nowSec - span, nowSec];
}
/** Minimal coinId → symbol mapping to query the DB (adjust as needed). */
const COIN_ID_TO_SYMBOL = {
    bitcoin: 'BTC/USDT',
    ethereum: 'ETH/USDT',
    solana: 'SOL/USDT',
    ripple: 'XRP/USDT',
    cardano: 'ADA/USDT',
    dogecoin: 'DOGE/USDT',
    polkadot: 'DOT/USDT',
    litecoin: 'LTC/USDT',
};
/**
 * Map human-readable interval keys to a number of days accepted by CoinGecko.
 * Falls back to 30 days when the interval is unknown.
 */
function intervalToDays(interval) {
    // Supported keys mirror UI presets; adjust here if presets change.
    switch (interval) {
        case '1d': return 1;
        case '3d': return 3;
        case '1w': return 7;
        case '2w': return 14;
        case '1month': return 30;
        case '3month': return 90;
        case '6month': return 180;
        case '1y': return 365;
        case '2y': return 730;
        case '5y': return 1825;
        case '10y': return 3650;
        default: return 30;
    }
}
/**
 * Fetch OHLC candles for a coin id and convert the payload into RawCandle[].
 * @param symbol CoinGecko coin id (e.g., 'bitcoin')
 * @param interval UI interval key (e.g., '1d', '1w', '1month')
 */
export async function fetchCandles(symbol, interval) {
    // Convert UI interval into the 'days' parameter expected by CoinGecko.
    const days = intervalToDays(interval);
    // Response is an array of [timestamp(ms), open, high, low, close].
    const rows = await request(`/coins/${encodeURIComponent(symbol)}/ohlc?vs_currency=usd&days=${days}`);
    // Normalize into our RawCandle shape; CoinGecko lacks volume in OHLC.
    return rows.map(([t, o, h, l, c]) => ({
        timestamp: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 0,
    }));
}
/**
 * Fetch candles from the Flask database-backed API instead of CoinGecko.
 *
 * @param coinId   UI coin id (e.g., 'bitcoin')
 * @param timeframe Granularity/window key (e.g., '1m', '1h', '1d')
 * @returns RawCandle[] with timestamps normalized to milliseconds
 */
export async function fetchCandlesDB(coinId, timeframe) {
    const symbol = COIN_ID_TO_SYMBOL[coinId];
    if (!symbol) {
        throw new Error(`No DB symbol mapping for coinId: ${coinId}`);
    }
    const [start, end] = timeframeToRange(timeframe);
    const url = `${BACKEND_BASE}/api/candles?symbol=${encodeURIComponent(symbol)}&start=${start}&end=${end}`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`DB API error ${res.status}: ${res.statusText} — ${text}`);
    }
    const data = (await res.json());
    // Normalize into RawCandle with ms timestamps; default volume to 0
    return data.map((c) => ({
        timestamp: toMillis(c.timestamp),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume ?? 0),
    }));
}
/**
 * Proxy to CoinGecko market_chart endpoint for auxiliary metrics (prices, mkt cap).
 * Consumers should narrow the return type based on the fields they access.
 */
export async function fetchMarketChart(symbol, days = 1) {
    // Pass-through to the generic request wrapper.
    return await request(`/coins/${encodeURIComponent(symbol)}/market_chart?vs_currency=usd&days=${days}`);
}
// Named exports above; default export provided for convenience/legacy imports.
export default {
    fetchCandles,
    fetchMarketChart,
    fetchCandlesDB,
};
//# sourceMappingURL=api.js.map