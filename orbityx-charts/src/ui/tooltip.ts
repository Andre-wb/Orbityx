export function initTooltip(chartEngine, dataManager) {
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
        indicators: tooltip.querySelector('#tooltip-indicators')
    };

    const canvas = chartEngine.canvas;
    let activeCandleIndex = -1;

    canvas.addEventListener('mousemove', (e) => {
        if (!chartEngine.state.data.length) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const candleIndex = findCandleAtPosition(x, y);

        if (candleIndex === -1 || candleIndex >= chartEngine.state.visibleData.length) {
            tooltip.style.display = 'none';
            activeCandleIndex = -1;
            return;
        }

        if (candleIndex !== activeCandleIndex) {
            activeCandleIndex = candleIndex;
            updateTooltipContent(candleIndex);
        }

        positionTooltip(e.clientX, e.clientY, rect);
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
            if (chartX >= candleX && chartX <= candleX + candleWidth) return i;
        }
        return -1;
    }

    function updateTooltipContent(candleIndex) {
        const candle = chartEngine.state.visibleData[candleIndex];
        if (!candle) return;

        const date = new Date(candle.timestamp);
        elements.date.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        elements.time.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

        elements.open.textContent = priceFormatter.format(candle.open);
        elements.high.textContent = priceFormatter.format(candle.high);
        elements.low.textContent = priceFormatter.format(candle.low);
        elements.close.textContent = priceFormatter.format(candle.close);

        const volume = candle.volume;
        const volumeText = volume >= 1e6 ? `${(volume / 1e6).toFixed(2)}M` : `${(volume / 1e3).toFixed(0)}K`;
        elements.volume.textContent = volumeText;

        const maxVolume = Math.max(...chartEngine.state.visibleData.map(c => c.volume));
        const volumePercent = Math.min(100, (volume / maxVolume) * 100);
        elements.volumeFill.style.width = `${volumePercent}%`;

        updateIndicators(candleIndex);
        tooltip.style.display = 'block';
    }

    function updateIndicators(candleIndex) {
        elements.indicators.innerHTML = '';
    }

    function positionTooltip(mouseX, mouseY) {
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let posX = mouseX + 15;
        let posY = mouseY + 15;

        if (posX + tooltipWidth > windowWidth) posX = mouseX - tooltipWidth - 15;
        if (posY + tooltipHeight > windowHeight) posY = mouseY - tooltipHeight - 15;

        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
    }

    document.addEventListener('themeChanged', (e) => {
        const isDark = e.detail === 'dark';
        tooltip.classList.toggle('dark-theme', isDark);
    });

    return tooltip;
}