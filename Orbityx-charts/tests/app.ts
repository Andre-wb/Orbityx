/**
 * app.ts — Dev viewer entry point for the Orbityx tests folder.
 *
 * Place this file in:  /tests/app.ts
 * Place index.html in: /tests/index.html
 *
 * The library lives in ../src — imports resolve relative to that path.
 * Run with Vite (or any dev server that handles TypeScript modules):
 *
 *   cd /Users/borismaltsev/WebstormProjects/Orbityx-charts
 *   npx vite tests/index.html
 */

import OrbityxChart from '../src/main.js';
import { BinanceProvider } from '../src/providers/examples/binance.js';

// ── Instruments to register ───────────────────────────────────────────────────
const INSTRUMENTS = [
    { id: 'BTCUSDT',  symbol: 'BTC/USDT',  name: 'Bitcoin',   icon: '₿',  iconColor: '#f7931a', pricePrecision: 2 },
    { id: 'ETHUSDT',  symbol: 'ETH/USDT',  name: 'Ethereum',  icon: 'Ξ',  iconColor: '#627eea', pricePrecision: 2 },
    { id: 'SOLUSDT',  symbol: 'SOL/USDT',  name: 'Solana',    icon: '◎',  iconColor: '#9945ff', pricePrecision: 3 },
    { id: 'BNBUSDT',  symbol: 'BNB/USDT',  name: 'BNB',       icon: '⬡',  iconColor: '#f3ba2f', pricePrecision: 2 },
    { id: 'XRPUSDT',  symbol: 'XRP/USDT',  name: 'XRP',       icon: '✦',  iconColor: '#00aae4', pricePrecision: 4 },
    { id: 'DOGEUSDT', symbol: 'DOGE/USDT', name: 'Dogecoin',  icon: 'Ð',  iconColor: '#c3a634', pricePrecision: 5 },
    { id: 'ADAUSDT',  symbol: 'ADA/USDT',  name: 'Cardano',   icon: '₳',  iconColor: '#0033ad', pricePrecision: 4 },
    { id: 'AVAXUSDT', symbol: 'AVAX/USDT', name: 'Avalanche', icon: 'A',  iconColor: '#e84142', pricePrecision: 3 },
];

// ── Patch the symbol-icon in the sidebar when the symbol changes ─────────────
function updateSidebarIcon(id: string) {
    const inst = INSTRUMENTS.find(i => i.id === id);
    if (!inst) return;
    const iconEl = document.querySelector<HTMLElement>('.symbol-icon');
    if (iconEl) {
        iconEl.innerHTML = `<span style="color:${inst.iconColor}">${inst.icon}</span>`;
    }
}

// ── Patch live price into the header ─────────────────────────────────────────
// The library writes to .symbol-price / .price-change in the sidebar;
// we mirror those values to the header spans as well.
function mirrorHeaderPrice() {
    const priceEl  = document.querySelector<HTMLElement>('.symbol-price');
    const changeEl = document.querySelector<HTMLElement>('.price-change');
    const hdrPrice  = document.getElementById('live-price');
    const hdrChange = document.getElementById('price-change');
    if (!priceEl || !hdrPrice) return;

    const observer = new MutationObserver(() => {
        if (hdrPrice)  hdrPrice.textContent  = priceEl.textContent ?? '';
        if (hdrChange && changeEl) {
            hdrChange.textContent = changeEl.textContent ?? '';
            hdrChange.className   = `change-${changeEl.classList.contains('change-up') ? 'up' : 'down'}`;
        }
    });
    observer.observe(priceEl,  { childList: true, characterData: true, subtree: true });
    observer.observe(changeEl!, { childList: true, characterData: true, subtree: true });
}

// ── Mirror 24h stats to the top stats bar ────────────────────────────────────
function mirrorStatsBar() {
    const map: Record<string, string> = {
        '#stat-high':   '#stat-high-val',
        '#stat-low':    '#stat-low-val',
        '#stat-volume': '#stat-vol-top',
        '#stat-change': '#stat-chg-top',
    };

    for (const [src, dst] of Object.entries(map)) {
        const srcEl = document.querySelector<HTMLElement>(src);
        const dstEl = document.querySelector<HTMLElement>(dst);
        if (!srcEl || !dstEl) continue;

        new MutationObserver(() => {
            dstEl.textContent = srcEl.textContent ?? '';
            // Carry up/down colour class for the change badge
            if (src === '#stat-change') {
                dstEl.style.color = srcEl.classList.contains('badge-up') ? '#00ff8c' : '#ff2d55';
            }
        }).observe(srcEl, { childList: true, characterData: true, subtree: true });
    }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function main() {
    const chart = new OrbityxChart({ canvasId: 'chartCanvas' });

    chart
        .setProvider(new BinanceProvider())
        .registerInstruments(INSTRUMENTS)
        .setDefaultInstrument('BTCUSDT')
        .setDefaultTimeframe('1h');

    // Mirror live values to the header once the DOM is populated
    mirrorHeaderPrice();
    mirrorStatsBar();

    // Intercept symbol-select changes to also update the sidebar icon
    const sel = document.getElementById('symbol-select') as HTMLSelectElement | null;
    if (sel) {
        sel.addEventListener('change', () => updateSidebarIcon(sel.value));
    }

    // Initial icon
    updateSidebarIcon('BTCUSDT');

    await chart.init();
}

main().catch(console.error);