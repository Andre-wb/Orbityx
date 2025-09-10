const BASE_URL = 'https://api.coingecko.com/api/v3';
async function request(path) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`CoinGecko API error ${res.status}: ${res.statusText} — ${text}`);
    }
    return (await res.json());
}
function intervalToDays(interval) {
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
export async function fetchCandles(symbol, interval) {
    const days = intervalToDays(interval);
    const rows = await request(`/coins/${encodeURIComponent(symbol)}/ohlc?vs_currency=usd&days=${days}`);
    return rows.map(([t, o, h, l, c]) => ({
        timestamp: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 0,
    }));
}
export async function fetchMarketChart(symbol, days = 1) {
    return await request(`/coins/${encodeURIComponent(symbol)}/market_chart?vs_currency=usd&days=${days}`);
}
export default {
    fetchCandles,
    fetchMarketChart,
};
