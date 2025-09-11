/**
 * Legend UI module – reads latest candles from DataManager and updates
 * the header (symbol, price, change) plus the four stat cards.
 *
 * This module is display-only; it does not fetch data on its own.
 */
import DataManager from '../core/data-manager.js';
/**
 * Shorthand for document.querySelector returning an HTMLElement (or null).
 */
function q(selector) {
    return document.querySelector(selector);
}
/**
 * Shorthand for document.querySelectorAll returning HTML elements.
 */
function qa(selector) {
    return document.querySelectorAll(selector);
}
/**
 * Initialize the legend for a given trading symbol.
 * Grabs DOM references, subscribes to DataManager updates, and performs
 * an initial render.
 * @param symbol Display symbol in the form BASE/QUOTE (e.g., 'BTC/USDT').
 */
export function initLegend(symbol = 'BTC/USDT') {
    // Cache DOM nodes used by the legend header and stats grid.
    const symbolNameEl = q('.symbol-name');
    const symbolPriceEl = q('.symbol-price');
    const symbolChangeEl = q('.symbol-change');
    const statsCards = qa('.stat-card');
    // Abort early if the required DOM structure is missing.
    if (!symbolNameEl || !symbolPriceEl || !symbolChangeEl || statsCards.length === 0) {
        return;
    }
    // Re-render whenever new candle data arrives.
    DataManager.subscribe(() => {
        updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
    });
    // Initial paint so the UI shows something before the next tick.
    updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
}
/**
 * Apply the latest price, 24h change, and stats to the legend elements.
 */
function updateLegend(symbol, nameEl, priceEl, changeEl, statCards) {
    // Pull the full candle array from the data layer.
    const data = DataManager.getData();
    if (!data || data.length === 0)
        return;
    // Latest candle drives the live price; previous candle for delta.
    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : latest;
    nameEl.textContent = `${getSymbolName(symbol)} (${symbol})`;
    priceEl.textContent = formatPrice(latest.close);
    updatePriceChange(changeEl, latest.close, prev.close);
    update24hStats(data, statCards);
}
/**
 * Map an exchange symbol to a human-friendly name (fallback to base asset).
 */
function getSymbolName(symbol) {
    const map = { 'BTC/USDT': 'Bitcoin' };
    return map[symbol] ?? symbol.split('/')[0];
}
/**
 * Format a USD price with adaptive precision for sub-dollar assets.
 */
function formatPrice(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: value < 1 ? 4 : 2,
        maximumFractionDigits: value < 1 ? 6 : 2
    }).format(value);
}
/**
 * Compute absolute and percentage change and decorate the UI accordingly.
 */
function updatePriceChange(el, current, previous) {
    const delta = current - previous;
    // Guard divide-by-zero when no previous price is available.
    const pct = previous === 0 ? 0 : (delta / previous) * 100;
    el.textContent = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)`;
    el.className = `price-change ${delta >= 0 ? 'change-up' : 'change-down'}`;
}
/**
 * Update 24h High/Low/Volume/Cap cards based on the most recent 1440 candles.
 * Assumes one-minute candles; adjust `period` if using a different timeframe.
 */
function update24hStats(data, statCards) {
    // Look back 24h window (1440 minutes) for min/max and volume sum.
    const period = 1440;
    // Efficiently take the tail without mutating the original array.
    const slice = data.slice(-period);
    // If not enough data is present yet, skip rendering.
    if (slice.length === 0)
        return;
    // Project arrays for vectorized min/max computations.
    const highs = slice.map((c) => c.high);
    const lows = slice.map((c) => c.low);
    const volume = slice.reduce((acc, c) => acc + c.volume, 0);
    // Each stat card contains a .stat-value element; update if present.
    const vHigh = statCards[0]?.querySelector('.stat-value');
    const vLow = statCards[1]?.querySelector('.stat-value');
    const vVol = statCards[2]?.querySelector('.stat-value');
    const vCap = statCards[3]?.querySelector('.stat-value');
    if (vHigh)
        vHigh.textContent = formatPrice(Math.max(...highs));
    if (vLow)
        vLow.textContent = formatPrice(Math.min(...lows));
    // Display volume in millions to keep numbers compact.
    if (vVol)
        vVol.textContent = `${(volume / 1e6).toFixed(1)}M`;
    // Market cap not available from candle stream; placeholder for now.
    if (vCap)
        vCap.textContent = 'N/A';
}
//# sourceMappingURL=legend.js.map