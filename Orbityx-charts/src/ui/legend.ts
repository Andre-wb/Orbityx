/**
 * @file ui/legend.ts
 * @description Market legend panel — live price, 24 h stats, instrument info.
 *
 * All instrument metadata comes from user-registered Instrument objects.
 * There is no hard-coded symbol list and no CoinGecko reference anywhere.
 * Market stats come from the DataProvider; the library falls back to
 * computing approximate stats from cached candles when unavailable.
 */
import type { Candle, Instrument, MarketStats } from '../types/index.js';
import { formatPrice, formatPct, formatCompact } from '../utils/format.js';
import { registry } from '../services/api.js';
import dataManager   from '../core/data-manager.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise the legend for the given instrument id.
 * Subscribes to DataManager for live candle updates.
 * Returns an unsubscribe function — call it before switching instruments.
 */
export function initLegend(instrumentId: string): () => void {
    const instrument = registry.getInstrument(instrumentId) ?? placeholderInstrument(instrumentId);
    renderMeta(instrument);

    const unsub = dataManager.subscribe((candles) => {
        renderStats(candles, instrument, null);
    });

    // Render immediately with whatever is already in the cache.
    renderStats(dataManager.getData(), instrument, null);

    return unsub;
}

/**
 * Push provider-supplied market stats into the legend.
 * Called by OrbityxChart after fetchMarketStats() resolves.
 */
export function applyMarketStats(stats: Partial<MarketStats>, instrumentId: string): void {
    const instrument = registry.getInstrument(instrumentId) ?? placeholderInstrument(instrumentId);
    renderStats(dataManager.getData(), instrument, stats);
}

/**
 * Populate the instrument <select> element from the registry.
 * Called once during chart.init() after registerInstruments().
 */
export function populateSymbolSelector(selectEl: HTMLSelectElement): void {
    const instruments = registry.getAllInstruments();

    if (instruments.length === 0) {
        console.warn(
            '[Orbityx] populateSymbolSelector: no instruments registered.\n' +
            'Call chart.registerInstruments([…]) before init().',
        );
        return;
    }

    selectEl.innerHTML = instruments
        .map(i =>
            `<option value="${escapeAttr(i.id)}">${escapeHtml(i.symbol)}` +
            (i.name ? ` — ${escapeHtml(i.name)}` : '') +
            `</option>`,
        )
        .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal renderers
// ─────────────────────────────────────────────────────────────────────────────

function renderMeta(i: Instrument): void {
    setText('.symbol-name', `${i.name} (${i.symbol})`);

    const iconEl = document.querySelector<HTMLElement>('.symbol-icon');
    if (iconEl) {
        const fallbackColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--orbityx-muted-text').trim() || '#888';
        iconEl.textContent   = i.icon ?? i.symbol[0] ?? '?';
        iconEl.style.color   = i.iconColor ?? fallbackColor;
        iconEl.style.borderColor = i.iconColor ?? 'transparent';
    }
}

function renderStats(
    candles:    Candle[],
    instrument: Instrument,
    stats:      Partial<MarketStats> | null,
): void {
    if (!candles.length) return;

    const prec     = instrument.pricePrecision ?? 2;
    const fmt      = (v: number) => formatPrice(v, 'USD', prec);
    const latest   = candles[candles.length - 1]!;
    const prev     = candles.length > 1 ? candles[candles.length - 2]! : latest;
    const delta    = latest.close - prev.close;
    const deltaPct = prev.close !== 0 ? (delta / prev.close) * 100 : 0;
    const isUp     = delta >= 0;

    // Live price
    setText('.symbol-price', fmt(latest.close));

    const changeEl = document.querySelector<HTMLElement>('.price-change');
    if (changeEl) {
        const sign = isUp ? '▲' : '▼';
        changeEl.textContent = `${sign} ${fmt(Math.abs(delta))} (${Math.abs(deltaPct).toFixed(2)}%)`;
        changeEl.className   = `price-change ${isUp ? 'change-up' : 'change-down'}`;
    }

    // Announce price change to screen readers
    const srRegion = document.getElementById('orbityx-sr-live');
    if (srRegion) {
        srRegion.textContent = `${instrument.symbol} price: ${fmt(latest.close)}, change: ${delta >= 0 ? 'up' : 'down'} ${Math.abs(deltaPct).toFixed(2)} percent`;
    }

    // 24 h stats — provider data wins; fall back to computed
    const computed = dataManager.computeStats();
    const high24   = stats?.high24h           ?? computed.high24h;
    const low24    = stats?.low24h            ?? computed.low24h;
    const vol24    = stats?.volume24h         ?? computed.volume24h;
    const mcap     = stats?.marketCap         ?? null;
    const pct24    = stats?.priceChangePct24h ?? deltaPct;

    setText('#stat-high',      fmt(high24));
    setText('#stat-low',       fmt(low24));
    setText('#stat-volume',    formatCompact(vol24));
    setText('#stat-marketcap', mcap !== null ? formatCompact(mcap) : 'N/A');

    const pctEl = document.querySelector<HTMLElement>('#stat-change');
    if (pctEl) {
        pctEl.textContent = formatPct(pct24);
        pctEl.className   = `stat-badge ${pct24 >= 0 ? 'badge-up' : 'badge-dn'}`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setText(selector: string, value: string): void {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) el.textContent = value;
}

/** Used when an id is referenced before being registered (safe degradation). */
function placeholderInstrument(id: string): Instrument {
    return { id, symbol: id.toUpperCase(), name: id, icon: id[0]?.toUpperCase() ?? '?', iconColor: '#888' };
}

function escapeAttr(s: string): string { return s.replace(/"/g, '&quot;'); }
function escapeHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}