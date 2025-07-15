export default class ChartEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Chart configuration
        this.config = {
            theme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
            darkTheme: {
                upColor: 'rgba(46, 204, 113, 0.8)',
                downColor: 'rgba(231, 76, 60, 0.8)',
                wickColor: 'rgba(149, 165, 166, 0.8)',
                bgColor: 'rgba(20, 25, 40, 1)',
                gridColor: 'rgba(127, 140, 141, 0.2)',
                textColor: 'rgba(236, 240, 241, 0.9)',
                priceLineColor: 'rgba(52, 152, 219, 0.7)'
            },
            lightTheme: {
                upColor: 'rgba(39, 174, 96, 0.7)',
                downColor: 'rgba(192, 57, 43, 0.7)',
                wickColor: 'rgba(100, 100, 100, 0.4)',
                bgColor: 'rgba(255, 255, 255, 1)',
                gridColor: 'rgba(200, 200, 200, 0.2)',
                textColor: 'rgba(50, 50, 50, 0.9)',
                priceLineColor: 'rgba(41, 128, 185, 0.5)'
            },
            candleWidth: 10,
            candleSpacing: 3,
            margin: { top: 30, right: 20, bottom: 50, left: 60 }
        };

        // Chart state
        this.state = {
            data: [],
            visibleData: [],
            scaleX: 1,
            offsetX: 0,
            minPrice: 0,
            maxPrice: 0,
            width: 0,
            height: 0,
            currentPrice: 0,
            isDragging: false,   // For panning
            dragStartX: 0        // Panning start position
        };

        // Bind event handlers
        this.handleResize = this.handleResize.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    // Get current color scheme
    getColors() {
        return this.config.theme === 'dark'
            ? this.config.darkTheme
            : this.config.lightTheme;
    }

    // Initialize chart engine
    init(dataManager) {
        this.dataManager = dataManager;
        this.setData(this.dataManager.getData());
        this.resizeCanvas();
        this.setupEventListeners();
        this.draw();
    }

    // Update with new data
    update() {
        this.setData(this.dataManager.getData());
    }

    // Reset zoom and pan
    resetView() {
        this.state.scaleX = 1;
        this.state.offsetX = 0;
        this.updateVisibleData();
        this.draw();
    }

    // Apply theme
    applyTheme(theme) {
        this.config.theme = theme;
        this.draw();
    }

    // Resize canvas to fit container
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.state.width = this.canvas.width;
        this.state.height = this.canvas.height;
        this.updateVisibleData();
    }

    // Handle window resize
    handleResize() {
        this.resizeCanvas();
        this.draw();
    }

    // Set chart data
    setData(data) {
        this.state.data = data;
        this.state.currentPrice = data.length ? data[data.length - 1].close : 0;
        this.updateVisibleData();
        this.draw();
    }

    // Calculate visible candles
    updateVisibleData() {
        const { left, right } = this.config.margin;
        const visibleW = this.state.width - left - right;
        const space = this.config.candleWidth + this.config.candleSpacing;
        const count = Math.floor(visibleW / (space * this.state.scaleX));
        const start = Math.max(0, this.state.data.length - count - Math.floor(this.state.offsetX));
        const end = Math.min(this.state.data.length, start + count);

        this.state.visibleData = this.state.data.slice(start, end);

        // Handle empty data case
        if (this.state.visibleData.length === 0) {
            this.state.minPrice = 0;
            this.state.maxPrice = 0;
            return;
        }

        // Calculate price range
        this.state.minPrice = Infinity;
        this.state.maxPrice = -Infinity;
        this.state.visibleData.forEach(candle => {
            this.state.minPrice = Math.min(this.state.minPrice, candle.low);
            this.state.maxPrice = Math.max(this.state.maxPrice, candle.high);
        });

        // Add padding
        const pad = (this.state.maxPrice - this.state.minPrice) * 0.05;
        this.state.minPrice -= pad;
        this.state.maxPrice += pad;
    }

    // Convert price to Y coordinate
    priceToY(price) {
        const h = this.state.height - this.config.margin.top - this.config.margin.bottom;
        return this.state.height - this.config.margin.bottom -
            ((price - this.state.minPrice) / (this.state.maxPrice - this.state.minPrice)) * h;
    }

    // Convert index to X coordinate
    indexToX(index) {
        const space = (this.config.candleWidth + this.config.candleSpacing) * this.state.scaleX;
        return this.config.margin.left + index * space;
    }

    // Main draw function
    draw() {
        this.ctx.clearRect(0, 0, this.state.width, this.state.height);
        this.drawBackground();
        this.drawGrid();
        this.drawCandles();
        this.drawCurrentPrice();
    }

    // Draw chart background
    drawBackground() {
        const theme = this.getColors();
        const m = this.config.margin;
        this.ctx.fillStyle = theme.bgColor;
        this.ctx.fillRect(
            m.left,
            m.top,
            this.state.width - m.left - m.right,
            this.state.height - m.top - m.bottom
        );
    }

    // Draw grid and price labels
    drawGrid() {
        const theme = this.getColors();
        const { left, right, top, bottom } = this.config.margin;

        // Vertical grid lines
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = left + (i/10) * (this.state.width - left - right);
            this.ctx.beginPath();
            this.ctx.moveTo(x, top);
            this.ctx.lineTo(x, this.state.height - bottom);
            this.ctx.stroke();
        }

        // Horizontal grid lines
        this.ctx.fillStyle = theme.textColor;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';

        for (let i = 0; i <= 8; i++) {
            const y = top + (i/8) * (this.state.height - top - bottom);

            // Grid line
            this.ctx.beginPath();
            this.ctx.moveTo(left, y);
            this.ctx.lineTo(this.state.width - right, y);
            this.ctx.stroke();

            // Price label
            const price = this.state.minPrice +
                (this.state.maxPrice - this.state.minPrice) * (1 - i/8);

            this.ctx.fillText(
                '$' + price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }),
                left - 10,
                y
            );
        }
    }

    // Draw candlesticks
    drawCandles() {
        this.ctx.save(); // Save context state

        const theme = this.getColors();
        for (let i = 0; i < this.state.visibleData.length; i++) {
            const candle = this.state.visibleData[i];
            const x = this.indexToX(i);
            const centerX = x + (this.config.candleWidth * this.state.scaleX)/2;
            const openY = this.priceToY(candle.open);
            const closeY = this.priceToY(candle.close);
            const highY = this.priceToY(candle.high);
            const lowY = this.priceToY(candle.low);
            const isUp = candle.close > candle.open;
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.abs(openY - closeY);

            // Wick
            this.ctx.strokeStyle = theme.wickColor;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, highY);
            this.ctx.lineTo(centerX, lowY);
            this.ctx.stroke();

            // Body
            this.ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.fillRect(x, bodyTop, this.config.candleWidth * this.state.scaleX, bodyHeight);
            this.ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.strokeRect(x, bodyTop, this.config.candleWidth * this.state.scaleX, bodyHeight);
        }

        this.ctx.restore(); // Restore context state
    }

    // Draw current price line
    drawCurrentPrice() {
        const theme = this.getColors();
        const y = this.priceToY(this.state.currentPrice);

        this.ctx.strokeStyle = theme.priceLineColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.config.margin.left, y);
        this.ctx.lineTo(this.state.width - this.config.margin.right, y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    // Setup event listeners
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);

        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', this.handleWheel);

        // Panning controls
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    }

    // Handle mouse wheel zoom
    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const zoomFactor = 1 + (e.deltaY > 0 ? -zoomIntensity : zoomIntensity);
        this.state.scaleX = Math.max(0.5, Math.min(5, this.state.scaleX * zoomFactor));
        this.updateVisibleData();
        this.draw();
    }

    // Zoom in
    zoomIn() {
        this.state.scaleX *= 1.2;
        this.state.scaleX = Math.min(5, this.state.scaleX);
        this.updateVisibleData();
        this.draw();
    }

    // Zoom out
    zoomOut() {
        this.state.scaleX /= 1.2;
        this.state.scaleX = Math.max(0.5, this.state.scaleX);
        this.updateVisibleData();
        this.draw();
    }

    // Handle mouse down for panning
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.canvas.style.cursor = 'grabbing';
    }

    // Handle mouse move for panning
    handleMouseMove(e) {
        if (!this.state.isDragging) return;

        const deltaX = e.clientX - this.state.dragStartX;
        this.state.dragStartX = e.clientX;

        // Adjust offset based on mouse movement and scale
        this.state.offsetX += deltaX / (this.config.candleWidth + this.config.candleSpacing) / this.state.scaleX;

        this.updateVisibleData();
        this.draw();
    }

    // Handle mouse up for panning
    handleMouseUp() {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.canvas.style.cursor = 'default';
        }
    }
}