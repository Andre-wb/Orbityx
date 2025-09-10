export function initTooltip(chartEngine) {
    const tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
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
    let activeCandleIndex = -1;
    canvas.addEventListener('mousemove', (e) => {
        if (!chartEngine.state.data.length)
            return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const candleIndex = findCandleAtPosition(x);
        if (candleIndex === -1 || candleIndex >= chartEngine.state.visibleData.length) {
            tooltip.style.display = 'none';
            activeCandleIndex = -1;
            return;
        }
        if (candleIndex !== activeCandleIndex) {
            activeCandleIndex = candleIndex;
            updateTooltipContent(candleIndex);
        }
        positionTooltip(e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        activeCandleIndex = -1;
    });
    function findCandleAtPosition(x) {
        const { visibleData } = chartEngine.state;
        const candleWidth = chartEngine.config.candleWidth * chartEngine.state.scaleX;
        const candleSpacing = chartEngine.config.candleSpacing;
        const marginLeft = chartEngine.config.margin.left;
        const chartX = x - marginLeft;
        for (let i = 0; i < visibleData.length; i++) {
            const candleX = i * (candleWidth + candleSpacing);
            if (chartX >= candleX && chartX <= candleX + candleWidth)
                return i;
        }
        return -1;
    }
    function updateTooltipContent(candleIndex) {
        const candle = chartEngine.state.visibleData[candleIndex];
        if (!candle)
            return;
        const dateObj = new Date(candle.timestamp);
        elements.date && (elements.date.textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        elements.time && (elements.time.textContent = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        elements.open && (elements.open.textContent = fmt.format(candle.open));
        elements.high && (elements.high.textContent = fmt.format(candle.high));
        elements.low && (elements.low.textContent = fmt.format(candle.low));
        elements.close && (elements.close.textContent = fmt.format(candle.close));
        const v = candle.volume;
        const volumeText = v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${(v / 1e3).toFixed(0)}K`;
        elements.volume && (elements.volume.textContent = volumeText);
        const maxVolume = Math.max(1, ...chartEngine.state.visibleData.map(c => c.volume)); // защита от 0
        const volumePercent = Math.min(100, (v / maxVolume) * 100);
        if (elements.volumeFill)
            elements.volumeFill.style.width = `${volumePercent}%`;
        updateIndicators();
        tooltip.style.display = 'block';
    }
    function updateIndicators() {
        if (elements.indicators)
            elements.indicators.innerHTML = '';
    }
    function positionTooltip(mouseX, mouseY) {
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        let posX = mouseX + 15;
        let posY = mouseY + 15;
        if (posX + tooltipWidth > windowWidth)
            posX = mouseX - tooltipWidth - 15;
        if (posY + tooltipHeight > windowHeight)
            posY = mouseY - tooltipHeight - 15;
        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
    }
    document.addEventListener('themeChanged', (e) => {
        const detail = e.detail;
        const isDark = detail === 'dark';
        tooltip.classList.toggle('dark-theme', isDark);
    });
    return tooltip;
}
