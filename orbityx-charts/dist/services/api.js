// Base endpoint for CoinGecko v3 REST API.
const BASE_URL = 'https://api.coingecko.com/api/v3';
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
};
