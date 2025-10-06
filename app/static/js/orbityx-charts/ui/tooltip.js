/**
 * Initialize the floating tooltip bound to a chart engine instance.
 * Creates DOM, subscribes to mouse events, and renders candle details.
 */
export function initTooltip(chartEngine) {
    // Create a detached tooltip element and attach to <body>.
    const tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.className = 'chart-tooltip';
    // Static HTML template for header, OHLC rows, volume bar and indicators.
    tooltip.innerHTML = `
    <div class="tooltip-header">
      <div class="tooltip-date"></div>
      <div class="tooltip-time"></div>
    </div>
    <div class="price-grid">
      <div class="price-row"><span class="price-label">Open</span><span class="price-value" id="tooltip-open"></span></div>
      <div class="price-row"><span class="price-label">High</span><span class="price-value" id="tooltip-high"></span></div>
      <div class="price-row"><span class="price-label">Low</span><span class="price-value" id="tooltip-low"></span></div>
      <div class="price-row"><span class="price-label">Close</span><span class="price-value" id="tooltip-close"></span></div>
    </div>
    <div class="volume-container">
      <div class="volume-header"><span class="volume-label">Volume</span><span class="volume-value" id="tooltip-volume"></span></div>
      <div class="volume-bar"><div class="volume-fill"></div></div>
    </div>
    <div class="indicators-container">
      <div class="indicators-title">Indicators</div>
      <div class="indicators-grid" id="tooltip-indicators"></div>
    </div>
  `;
    // Cache references to frequently updated DOM nodes.
    const elements = {
        date: tooltip.querySelector('.tooltip-date'),
        time: tooltip.querySelector('.tooltip-time'),
        open: tooltip.querySelector('#tooltip-open'),
        high: tooltip.querySelector('#tooltip-high'),
        low: tooltip.querySelector('#tooltip-low'),
        close: tooltip.querySelector('#tooltip-close'),
        volume: tooltip.querySelector('#tooltip-volume'),
        volumeFill: tooltip.querySelector('.volume-fill'),
        indicators: tooltip.querySelector('#tooltip-indicators'),
    };
    const canvas = chartEngine.canvas;
    // Track the last-rendered candle index to avoid redundant DOM updates.
    let activeCandleIndex = -1;
    canvas.addEventListener('mousemove', (e) => {
        // If no data yet, keep the tooltip hidden.
        if (!chartEngine.state.data.length)
            return;
        // Convert mouse client coordinates into canvas-local X for hit-testing.
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        // No candle under cursor → hide and reset state.
        const candleIndex = findCandleAtPosition(x);
        if (candleIndex === -1 || candleIndex >= chartEngine.state.visibleData.length) {
            tooltip.style.display = 'none';
            activeCandleIndex = -1;
            return;
        }
        // Render only when index changes to minimize layout/paint costs.
        if (candleIndex !== activeCandleIndex) {
            activeCandleIndex = candleIndex;
            updateTooltipContent(candleIndex);
        }
        // Follow the cursor with smart bounding.
        positionTooltip(e.clientX, e.clientY);
    });
    // Hide tooltip when pointer leaves the canvas area.
    canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        activeCandleIndex = -1;
    });
    /**
     * Hit-test helper: map canvas X to a visible candle index.
     */
    function findCandleAtPosition(x) {
        const { visibleData } = chartEngine.state;
        // Account for zoomed candle body width.
        const candleWidth = chartEngine.config.candleWidth * chartEngine.state.scaleX;
        const candleSpacing = chartEngine.config.candleSpacing;
        // Translate from absolute canvas X into plot-area X (exclude left margin).
        const marginLeft = chartEngine.config.margin.left;
        const chartX = x - marginLeft;
        // Linear scan is fine for modest candle counts; consider bisection if large.
        for (let i = 0; i < visibleData.length; i++) {
            const candleX = i * (candleWidth + candleSpacing);
            if (chartX >= candleX && chartX <= candleX + candleWidth)
                return i;
        }
        return -1;
    }
    /**
     * Fill tooltip fields from the N-th visible candle and show the tooltip.
     */
    function updateTooltipContent(candleIndex) {
        const candle = chartEngine.state.visibleData[candleIndex];
        if (!candle)
            return;
        // Human-friendly date/time formatting (local timezone).
        const dateObj = new Date(candle.timestamp);
        elements.date && (elements.date.textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        elements.time && (elements.time.textContent = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        // Currency formatter reused for O/H/L/C values.
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        elements.open && (elements.open.textContent = fmt.format(candle.open));
        elements.high && (elements.high.textContent = fmt.format(candle.high));
        elements.low && (elements.low.textContent = fmt.format(candle.low));
        elements.close && (elements.close.textContent = fmt.format(candle.close));
        // Compact volume notation (K/M) depending on magnitude.
        const v = candle.volume;
        const volumeText = v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${(v / 1e3).toFixed(0)}K`;
        elements.volume && (elements.volume.textContent = volumeText);
        // Normalize volume bar relative to the max visible volume (avoid divide-by-zero).
        const maxVolume = Math.max(1, ...chartEngine.state.visibleData.map(c => c.volume)); // защита от 0
        const volumePercent = Math.min(100, (v / maxVolume) * 100);
        if (elements.volumeFill)
            elements.volumeFill.style.width = `${volumePercent}%`;
        updateIndicators();
        tooltip.style.display = 'block';
    }
    /**
     * Placeholder: render per-candle indicator values if provided by the app.
     */
    function updateIndicators() {
        if (elements.indicators)
            elements.indicators.innerHTML = '';
    }
    /**
     * Position the floating tooltip near the cursor while keeping it on-screen.
     */
    function positionTooltip(mouseX, mouseY) {
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        // Prefer bottom-right offset; we'll flip if we hit the viewport edge.
        let posX = mouseX + 15;
        let posY = mouseY + 15;
        // Flip horizontally when overflowing to the right.
        if (posX + tooltipWidth > windowWidth)
            posX = mouseX - tooltipWidth - 15;
        // Flip vertically when overflowing to the bottom.
        if (posY + tooltipHeight > windowHeight)
            posY = mouseY - tooltipHeight - 15;
        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
    }
    // Theme hook: toggle a CSS class based on app-wide theme events.
    document.addEventListener('themeChanged', (e) => {
        const detail = e.detail;
        const isDark = detail === 'dark';
        tooltip.classList.toggle('dark-theme', isDark);
    });
    return tooltip;
}
//# sourceMappingURL=tooltip.js.map