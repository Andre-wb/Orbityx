/**
 * @file ui/tooltip.ts
 * @description Floating OHLCV tooltip that follows the cursor inside the chart canvas.
 *
 * Reads the candle under the cursor from ChartEngine.getCandleAtCursor(),
 * so it stays in sync with the engine's viewport math automatically.
 *
 * Fixes applied vs v1:
 *  - TS2307: import now points to '../utils/format.js' (concrete file, not missing barrel)
 *  - TS18048: refs typed with a named interface instead of Record<string, HTMLElement>,
 *             so every field is known non-undefined to the compiler
 *  - Duplicate `formatDate` declaration removed; replaced by local `formatTimestamp`
 */
import type { Candle, IChartControls } from '../types/index.js';
// Import only from the concrete module file to avoid a missing barrel-export error (TS2307).
import { formatPrice, formatVolume } from '../utils/format.js';

// ─────────────────────────────────────────────────────────────────────────────
// Strictly-typed DOM reference bag.
// Using a named interface (instead of Record<string, HTMLElement>) means every
// field is non-optional, eliminating the "possibly undefined" TS18048 errors.
// ─────────────────────────────────────────────────────────────────────────────
interface TooltipRefs {
    date:   HTMLElement;
    open:   HTMLElement;
    high:   HTMLElement;
    low:    HTMLElement;
    close:  HTMLElement;
    change: HTMLElement;
    volume: HTMLElement;
    volBar: HTMLElement;
}

/**
 * querySelector wrapper that throws a descriptive error when the selector
 * yields no element, instead of returning null and crashing silently later.
 * This is safer than the non-null assertion (!) because it surfaces template
 * bugs immediately with a clear message.
 */
function queryRequired(root: HTMLElement, selector: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`[Tooltip] Missing required element: "${selector}"`);
    return el;
}

/** Inject the tooltip element into <body> and bind to the canvas. */
export function initTooltip(engine: IChartControls): HTMLDivElement {
    const tooltip = createTooltipElement();
    document.body.appendChild(tooltip);

    // Build the ref bag using the throwing helper – no non-null assertions needed.
    const refs: TooltipRefs = {
        date:   queryRequired(tooltip, '.tt-date'),
        open:   queryRequired(tooltip, '.tt-open'),
        high:   queryRequired(tooltip, '.tt-high'),
        low:    queryRequired(tooltip, '.tt-low'),
        close:  queryRequired(tooltip, '.tt-close'),
        change: queryRequired(tooltip, '.tt-change'),
        volume: queryRequired(tooltip, '.tt-volume'),
        volBar: queryRequired(tooltip, '.tt-vol-fill'),
    };

    let lastIndex = -1;

    engine.canvas.addEventListener('mousemove', (e: MouseEvent) => {
        const candle = engine.getCandleAtCursor();
        if (!candle) {
            tooltip.style.display = 'none';
            lastIndex = -1;
            return;
        }

        // Only update DOM when the hovered candle changes.
        const idx = engine.state.visibleData.indexOf(candle);
        if (idx !== lastIndex) {
            lastIndex = idx;
            populateTooltip(refs, candle, engine);
        }
        tooltip.style.display = 'block';
        positionTooltip(tooltip, e.clientX, e.clientY);
    });

    engine.canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        lastIndex = -1;
    });

    // Theme sync: toggle a data-attribute so CSS can adjust colours if needed.
    document.addEventListener('themeChanged', (e) => {
        const theme = (e as CustomEvent<string>).detail;
        tooltip.dataset['theme'] = theme;
    });

    return tooltip;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────────────────────────────────────

function createTooltipElement(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'chart-tooltip';
    el.style.display = 'none';
    el.innerHTML = `
    <div class="tt-date"></div>
    <div class="tt-ohlc">
      <div class="tt-row"><span class="tt-lbl">O</span><span class="tt-open"></span></div>
      <div class="tt-row"><span class="tt-lbl">H</span><span class="tt-high tt-up"></span></div>
      <div class="tt-row"><span class="tt-lbl">L</span><span class="tt-low tt-dn"></span></div>
      <div class="tt-row"><span class="tt-lbl">C</span><span class="tt-close"></span></div>
      <div class="tt-row"><span class="tt-lbl">Chg</span><span class="tt-change"></span></div>
    </div>
    <div class="tt-volume-section">
      <div class="tt-row">
        <span class="tt-lbl">Vol</span>
        <span class="tt-volume"></span>
      </div>
      <div class="tt-vol-bar"><div class="tt-vol-fill"></div></div>
    </div>
  `;
    return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function populateTooltip(
    refs: TooltipRefs,
    candle: Candle,
    engine: IChartControls,
): void {
    const isUp     = candle.close >= candle.open;
    const delta    = candle.close - candle.open;
    const deltaPct = candle.open !== 0 ? (delta / candle.open) * 100 : 0;
    const sign     = isUp ? '+' : '';

    refs.date.textContent   = formatTimestamp(candle.timestamp);
    refs.open.textContent   = formatPrice(candle.open);
    refs.high.textContent   = formatPrice(candle.high);
    refs.low.textContent    = formatPrice(candle.low);
    refs.close.textContent  = formatPrice(candle.close);
    refs.close.className    = `tt-close ${isUp ? 'tt-up' : 'tt-dn'}`;
    refs.change.textContent = `${sign}${delta.toFixed(2)} (${sign}${deltaPct.toFixed(2)}%)`;
    refs.change.className   = `tt-change ${isUp ? 'tt-up' : 'tt-dn'}`;
    refs.volume.textContent = formatVolume(candle.volume);

    // Volume bar fill relative to the max visible volume.
    const maxVol = Math.max(1, ...engine.state.visibleData.map((c) => c.volume));
    const pct    = Math.min(100, (candle.volume / maxVol) * 100);
    refs.volBar.style.width      = `${pct}%`;
    refs.volBar.style.background = isUp ? 'var(--candle-up)' : 'var(--candle-down)';
}

function positionTooltip(el: HTMLDivElement, mx: number, my: number): void {
    const w  = el.offsetWidth  + 4;
    const h  = el.offsetHeight + 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer bottom-right of cursor; flip when it would overflow the viewport.
    let x = mx + 16;
    let y = my + 16;
    if (x + w > vw) x = mx - w - 4;
    if (y + h > vh) y = my - h - 4;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting (local to this module; avoids importing the whole utils
// barrel just for one small helper function)
// ─────────────────────────────────────────────────────────────────────────────

/** Format an epoch-ms timestamp as "DD Mon YYYY  HH:mm UTC". */
function formatTimestamp(ts: number): string {
    const d      = new Date(ts);
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'] as const;
    const mo = months[d.getUTCMonth()];
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const yy = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd} ${mo ?? ''} ${yy}  ${hh}:${mm} UTC`;
}