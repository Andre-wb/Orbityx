const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

// Chart color and layout configuration
const config = {
    theme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light', // Read current theme

    darkTheme: {
        upColor: 'rgba(46, 204, 113, 0.8)',
        downColor: 'rgba(231, 76, 60, 0.8)',
        wickColor: 'rgba(149, 165, 166, 0.8)',
        bgColor: 'rgba(20, 25, 40, 1)',
        gridColor: 'rgba(127, 140, 141, 0.2)',
        textColor: 'rgba(236, 240, 241, 0.9)',
        axisColor: 'rgba(236, 240, 241, 0.6)',
        priceLineColor: 'rgba(52, 152, 219, 0.7)'
    },

    lightTheme: {
        upColor: 'rgba(39, 174, 96, 0.7)',
        downColor: 'rgba(192, 57, 43, 0.7)',
        wickColor: 'rgba(100, 100, 100, 0.4)',
        bgColor: 'rgba(255, 255, 255, 1)',
        gridColor: 'rgba(200, 200, 200, 0.2)',
        textColor: 'rgba(50, 50, 50, 0.9)',
        axisColor: 'rgba(120, 120, 120, 0.5)',
        priceLineColor: 'rgba(41, 128, 185, 0.5)'
    },

    candleWidth: 10,
    candleSpacing: 3,
    margin: { top: 30, right: 20, bottom: 50, left: 60 }
};

// Return the current color scheme
function getColors() {
    return config.theme === 'dark' ? config.darkTheme : config.lightTheme;
}

// Chart state: data and view settings
const state = {
    data: [],
    visibleData: [],
    scaleX: 1,
    offsetX: 0,
    minPrice: 0,
    maxPrice: 0,
    width: 0,
    height: 0,
    currentPrice: 0
};

// Initialize chart rendering
async function initChart() {
    resizeCanvas();
    await fetchData();
    setupEventListeners();
}

// Adjust canvas size to container
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    state.width = canvas.width;
    state.height = canvas.height;
}

// Fetch candle data from API (replace this with actual backend)
async function fetchData() {
    const res = await fetch('/api/candles');
    const candles = await res.json();
    state.data = candles;
    state.currentPrice = candles[candles.length - 1].close;
    updateVisibleData();
    drawChart();
}

// Filter and prepare visible candles to draw
function updateVisibleData() {
    const visibleWidth = state.width - config.margin.left - config.margin.right;
    const candleSpace = config.candleWidth + config.candleSpacing;
    const visibleCandleCount = Math.floor(visibleWidth / (candleSpace * state.scaleX));
    const startIndex = Math.max(0, state.data.length - visibleCandleCount - Math.floor(state.offsetX));
    const endIndex = Math.min(state.data.length, startIndex + visibleCandleCount);
    state.visibleData = state.data.slice(startIndex, endIndex);
    state.minPrice = Infinity;
    state.maxPrice = -Infinity;
    for (const candle of state.visibleData) {
        if (candle.low < state.minPrice) state.minPrice = candle.low;
        if (candle.high > state.maxPrice) state.maxPrice = candle.high;
    }
    const padding = (state.maxPrice - state.minPrice) * 0.05;
    state.minPrice -= padding;
    state.maxPrice += padding;
}

// Convert price to vertical Y coordinate
function priceToY(price) {
    const chartHeight = state.height - config.margin.top - config.margin.bottom;
    return state.height - config.margin.bottom - ((price - state.minPrice) / (state.maxPrice - state.minPrice)) * chartHeight;
}

// Convert candle index to horizontal X coordinate
function indexToX(index) {
    const candleSpace = (config.candleWidth + config.candleSpacing) * state.scaleX;
    return config.margin.left + index * candleSpace;
}

// Master draw function
function drawChart() {
    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground();
    drawGrid();
    drawCandles();
    drawCurrentPrice();
}

// Fill background
function drawBackground() {
    const theme = getColors();
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(config.margin.left, config.margin.top, state.width - config.margin.left - config.margin.right, state.height - config.margin.top - config.margin.bottom);
}

// Draw vertical & horizontal grid lines
function drawGrid() {
    const theme = getColors();
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    const verticalLineCount = 10;
    for (let i = 0; i <= verticalLineCount; i++) {
        const x = config.margin.left + (i / verticalLineCount) * (state.width - config.margin.left - config.margin.right);
        ctx.beginPath();
        ctx.moveTo(x, config.margin.top);
        ctx.lineTo(x, state.height - config.margin.bottom);
        ctx.stroke();
    }
    const horizontalLineCount = 8;
    for (let i = 0; i <= horizontalLineCount; i++) {
        const y = config.margin.top + (i / horizontalLineCount) * (state.height - config.margin.top - config.margin.bottom);
        ctx.beginPath();
        ctx.moveTo(config.margin.left, y);
        ctx.lineTo(state.width - config.margin.right, y);
        ctx.stroke();
    }
    ctx.fillStyle = theme.textColor;
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= horizontalLineCount; i++) {
        const price = state.minPrice + (state.maxPrice - state.minPrice) * (1 - i / horizontalLineCount);
        const y = config.margin.top + (i / horizontalLineCount) * (state.height - config.margin.top - config.margin.bottom);
        ctx.fillText('$' + price.toFixed(0), config.margin.left - 10, y);
    }
}

// Draw candlesticks
function drawCandles() {
    const theme = getColors();
    for (let i = 0; i < state.visibleData.length; i++) {
        const candle = state.visibleData[i];
        const x = indexToX(i);
        const centerX = x + (config.candleWidth * state.scaleX) / 2;
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        const isUp = candle.close > candle.open;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(openY - closeY);

        // Wick
        ctx.strokeStyle = theme.wickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, lowY);
        ctx.stroke();

        // Body
        ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
        ctx.fillRect(x, bodyTop, config.candleWidth * state.scaleX, bodyHeight);
        ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
        ctx.strokeRect(x, bodyTop, config.candleWidth * state.scaleX, bodyHeight);
    }
}

// Draw dashed line at current price
function drawCurrentPrice() {
    const theme = getColors();
    const y = priceToY(state.currentPrice);
    ctx.strokeStyle = theme.priceLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(config.margin.left, y);
    ctx.lineTo(state.width - config.margin.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
}

// Zoom and resize controls
function setupEventListeners() {
    window.addEventListener('resize', () => {
        resizeCanvas();
        updateVisibleData();
        drawChart();
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
        state.scaleX *= 1.2;
        updateVisibleData();
        drawChart();
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        state.scaleX /= 1.2;
        updateVisibleData();
        drawChart();
    });

    document.getElementById('resetView').addEventListener('click', () => {
        state.scaleX = 1;
        state.offsetX = 0;
        updateVisibleData();
        drawChart();
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const zoomFactor = 1 + (e.deltaY > 0 ? -zoomIntensity : zoomIntensity);
        state.scaleX *= zoomFactor;
        state.scaleX = Math.max(0.5, Math.min(5, state.scaleX));
        updateVisibleData();
        drawChart();
    });
}

// Start rendering when page is loaded
window.addEventListener('load', initChart);