import DataManager from '../core/data-manager.js';
export function initLegend(symbol = 'BTC/USDT') {
    const symbolNameEl   = document.querySelector('.symbol-name');
    const symbolPriceEl  = document.querySelector('.symbol-price');
    const symbolChangeEl = document.querySelector('.symbol-change');
    const statsCards     = document.querySelectorAll('.stat-card');

    DataManager.subscribe(() => {
        updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
    });

    updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
}

function updateLegend(symbol, nameEl, priceEl, changeEl, statCards) {
    const data = DataManager.getData();
    if (!data || data.length === 0) return;
    const latest = data[data.length - 1];
    const prev   = data.length > 1 ? data[data.length - 2] : latest;
    nameEl.textContent = `${getSymbolName(symbol)} (${symbol})`;
    priceEl.textContent = formatPrice(latest.close);
    updatePriceChange(changeEl, latest.close, prev.close);
    update24hStats(data, statCards);
}

function getSymbolName(symbol) {
    const map = { 'BTC/USDT': 'Bitcoin' };
    return map[symbol] || symbol.split('/')[0];
}

function formatPrice(value) {
    return new Intl.NumberFormat('en-US', {
        style:    'currency',
        currency: 'USD',
        minimumFractionDigits: value < 1 ? 4 : 2,
        maximumFractionDigits: value < 1 ? 6 : 2
    }).format(value);
}

function updatePriceChange(el, current, previous) {
    const delta = current - previous;
    const pct   = (delta / previous) * 100;

    el.textContent = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)`;
    el.className   = `price-change ${delta >= 0 ? 'change-up' : 'change-down'}`;
}

function update24hStats(data, statCards) {
    const period = 1440;
    const slice  = data.slice(-period);
    if (slice.length === 0) return;
    const highs  = slice.map(c => c.high);
    const lows   = slice.map(c => c.low);
    const volume = slice.reduce((sum, c) => sum + c.volume, 0);
    statCards[0].querySelector('.stat-value').textContent = formatPrice(Math.max(...highs));
    statCards[1].querySelector('.stat-value').textContent = formatPrice(Math.min(...lows));
    statCards[2].querySelector('.stat-value').textContent = `${(volume / 1e6).toFixed(1)}M`;
    statCards[3].querySelector('.stat-value').textContent = 'N/A'; // market cap placeholder
}