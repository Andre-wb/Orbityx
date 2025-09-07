const BASE_URL = 'https://api.coingecko.com/api/v3';

async function request(path) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`CoinGecko API error ${res.status}: ${res.statusText} — ${text}`);
    }
    return res.json();
}
export async function fetchCandles(coinId, days = 1) {
    return request(`/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`);
}

export async function fetchMarketChart(coinId, days = 1) {
    return request(`/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
}

export default {
    fetchCandles,
    fetchMarketChart,
};