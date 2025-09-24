/**
 * ChartEngine – a lightweight, canvas-based OHLC chart renderer.
 *
 * Responsibilities:
 *  - Manage canvas sizing and high-level layout (margins, grids, axes labels).
 *  - Maintain view state (zoom/scroll) and translate between price/index and pixels.
 *  - Render candles, wicks, grid, and current price line.
 *  - Handle basic user interactions: wheel-zoom, drag-to-pan, and simple controls.
 *
 * Non-Goals:
 *  - Data fetching, order books, overlays/indicators – provide via higher layers.
 *
 * Usage:
 *  1) const engine = new ChartEngine('canvasId');
 *  2) engine.init(dataManager); // dataManager implements DataManagerLike
 *  3) engine.update(); // call when new data arrives
 */
export default class ChartEngine {
    /**
     * Create a ChartEngine bound to a specific <canvas> element by id.
     * Throws if the element is missing or 2D context is unavailable.
     * @param canvasId - DOM id of the target <canvas> element.
     */
    constructor(canvasId) {
        const el = document.getElementById(canvasId);
        if (!(el instanceof HTMLCanvasElement)) {
            throw new Error(`Element with id "${canvasId}" is not a <canvas> or not found`);
        }
        this.canvas = el;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('2D rendering context is not available');
        }
        this.ctx = ctx;
        this.config = {
            theme: (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'),
            darkTheme: {
                upColor: 'rgba(46, 204, 113, 0.8)',
                downColor: 'rgba(231, 76, 60, 0.8)',
                wickColor: 'rgba(149, 165, 166, 0.8)',
                bgColor: 'rgba(20, 25, 40, 1)',
                gridColor: 'rgba(127, 140, 141, 0.2)',
                textColor: 'rgba(236, 240, 241, 0.9)',
                priceLineColor: 'rgba(52, 152, 219, 0.7)',
            },
            lightTheme: {
                upColor: 'rgba(39, 174, 96, 0.7)',
                downColor: 'rgba(192, 57, 43, 0.7)',
                wickColor: 'rgba(100, 100, 100, 0.4)',
                bgColor: 'rgba(255, 255, 255, 1)',
                gridColor: 'rgba(200, 200, 200, 0.2)',
                textColor: 'rgba(50, 50, 50, 0.9)',
                priceLineColor: 'rgba(41, 128, 185, 0.5)',
            },
            candleWidth: 10,
            candleSpacing: 3,
            margin: { top: 30, right: 20, bottom: 50, left: 60 },
        };
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
            isDragging: false,
            dragStartX: 0,
        };
        this.handleResize = this.handleResize.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }
    /**
     * Resolve the active color palette based on the current theme.
     */
    getColors() {
        return this.config.theme === 'dark' ? this.config.darkTheme : this.config.lightTheme;
    }
    /**
     * One-time initializer: attach a data manager, size the canvas,
     * subscribe to events, and paint the first frame.
     */
    init(dataManager) {
        this.dataManager = dataManager;
        this.setData(this.dataManager.getData());
        this.resizeCanvas();
        this.setupEventListeners();
        this.draw();
    }
    /**
     * Pull fresh data from the data manager and re-render.
     * Call this when new candles arrive.
     */
    update() {
        this.setData(this.dataManager.getData());
    }
    /**
     * Reset zoom and scroll offsets to defaults and re-render.
     */
    resetView() {
        this.state.scaleX = 1;
        this.state.offsetX = 0;
        this.updateVisibleData();
        this.draw();
    }
    /**
     * Switch active theme and repaint.
     */
    applyTheme(theme) {
        this.config.theme = theme;
        this.draw();
    }
    /**
     * Match canvas size to its container and update derived state.
     * Note: relies on parent element sizing; ensure the container has layout.
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container)
            return;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.state.width = this.canvas.width;
        this.state.height = this.canvas.height;
        this.updateVisibleData();
    }
    /**
     * Window resize handler – resizes canvas and repaints.
     */
    handleResize() {
        this.resizeCanvas();
        this.draw();
    }
    /**
     * Replace the full dataset and recompute min/max and current price.
     * @param data - Candles sorted by time ascending.
     */
    setData(data) {
        this.state.data = data;
        this.state.currentPrice = data.length ? data[data.length - 1].close : 0;
        this.updateVisibleData();
        this.draw();
    }
    /**
     * Compute the slice of data that fits into the current viewport given
     * the zoom level (`scaleX`) and horizontal offset (`offsetX`). Also updates
     * dynamic price bounds with a small padding for aesthetics.
     */
    updateVisibleData() {
        const { left, right } = this.config.margin;
        // Compute how many candles can be shown given inner width and current zoom.
        const visibleW = this.state.width - left - right;
        const space = this.config.candleWidth + this.config.candleSpacing;
        const count = Math.floor(visibleW / (space * this.state.scaleX));
        const start = Math.max(0, this.state.data.length - count - Math.floor(this.state.offsetX / this.state.scaleX));
        const end = Math.min(this.state.data.length, start + count);
        this.state.visibleData = this.state.data.slice(start, end);
        if (this.state.visibleData.length === 0) {
            this.state.minPrice = 0;
            this.state.maxPrice = 0;
            return;
        }
        // Scan visible candles to determine dynamic price range for Y-scaling.
        let min = Infinity;
        let max = -Infinity;
        for (const c of this.state.visibleData) {
            if (c.low < min)
                min = c.low;
            if (c.high > max)
                max = c.high;
        }
        const pad = (max - min) * 0.05;
        this.state.minPrice = min - pad;
        this.state.maxPrice = max + pad;
    }
    /**
     * Convert a price value into a canvas Y coordinate inside the plot area.
     * Top-left is (0,0); higher prices map towards the top of the plot.
     */
    priceToY(price) {
        const h = this.state.height - this.config.margin.top - this.config.margin.bottom;
        // Invert Y because canvas increases downward.
        return this.state.height - this.config.margin.bottom -
            ((price - this.state.minPrice) / (this.state.maxPrice - this.state.minPrice)) * h;
    }
    /**
     * Convert a visible-data index into a canvas X coordinate (left edge of body).
     */
    indexToX(index) {
        const space = (this.config.candleWidth + this.config.candleSpacing) * this.state.scaleX;
        return this.config.margin.left + index * space;
    }
    /**
     * Main render routine – clears the frame and draws layers in order.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.state.width, this.state.height);
        this.drawBackground();
        this.drawGrid();
        this.drawCandles();
        this.drawCurrentPrice();
    }
    /**
     * Paint the chart plotting area background inside the margins.
     */
    drawBackground() {
        const theme = this.getColors();
        const m = this.config.margin;
        this.ctx.fillStyle = theme.bgColor;
        this.ctx.fillRect(m.left, m.top, this.state.width - m.left - m.right, this.state.height - m.top - m.bottom);
    }
    /**
     * Draw vertical and horizontal grid lines and annotate the price scale.
     */
    drawGrid() {
        const theme = this.getColors();
        const { left, right, top, bottom } = this.config.margin;
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 1;
        // Vertical grid lines (X-axis subdivisions).
        for (let i = 0; i <= 10; i++) {
            const x = left + (i / 10) * (this.state.width - left - right);
            this.ctx.beginPath();
            this.ctx.moveTo(x, top);
            this.ctx.lineTo(x, this.state.height - bottom);
            this.ctx.stroke();
        }
        this.ctx.fillStyle = theme.textColor;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        // Horizontal grid lines (Y-axis) with price labels.
        for (let i = 0; i <= 8; i++) {
            const y = top + (i / 8) * (this.state.height - top - bottom);
            this.ctx.beginPath();
            this.ctx.moveTo(left, y);
            this.ctx.lineTo(this.state.width - right, y);
            this.ctx.stroke();
            const price = this.state.minPrice +
                (this.state.maxPrice - this.state.minPrice) * (1 - i / 8);
            this.ctx.fillText('$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), left - 10, y);
        }
    }
    /**
     * Render candle bodies and wicks for the visible data window.
     */
    drawCandles() {
        const theme = this.getColors();
        const bodyW = this.config.candleWidth * this.state.scaleX;
        this.ctx.save();
        // Iterate visible candles; index i maps to X via indexToX(i).
        for (let i = 0; i < this.state.visibleData.length; i++) {
            const c = this.state.visibleData[i];
            const x = this.indexToX(i);
            const centerX = x + bodyW / 2;
            const openY = this.priceToY(c.open);
            const closeY = this.priceToY(c.close);
            const highY = this.priceToY(c.high);
            const lowY = this.priceToY(c.low);
            const isUp = c.close > c.open;
            const bodyTop = Math.min(openY, closeY);
            const bodyH = Math.abs(openY - closeY);
            // Wick (high→low) centered on the candle's X mid-point.
            this.ctx.strokeStyle = theme.wickColor;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, highY);
            this.ctx.lineTo(centerX, lowY);
            this.ctx.stroke();
            // Candle body – filled and then outlined for crisp edges.
            this.ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.fillRect(x, bodyTop, bodyW, bodyH);
            this.ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.strokeRect(x, bodyTop, bodyW, bodyH);
        }
        this.ctx.restore();
    }
    /**
     * Draw a dashed horizontal line at the latest close price.
     */
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
    /**
     * Wire up window resize, toolbar buttons, and pointer interactions.
     */
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const resetBtn = document.getElementById('reset-view');
        zoomInBtn?.addEventListener('click', () => this.zoomIn());
        zoomOutBtn?.addEventListener('click', () => this.zoomOut());
        resetBtn?.addEventListener('click', () => this.resetView());
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    }
    /**
     * Mouse wheel zoom handler – scales `scaleX` around a fixed center.
     * Prevents default scrolling to keep interaction within the canvas.
     */
    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const zoomFactor = 1 + (e.deltaY > 0 ? -zoomIntensity : zoomIntensity);
        this.state.scaleX = Math.max(0.5, Math.min(5, this.state.scaleX * zoomFactor));
        this.updateVisibleData();
        this.draw();
    }
    /**
     * Programmatic zoom-in (e.g., toolbar button).
     */
    zoomIn() {
        this.state.scaleX = Math.min(5, this.state.scaleX * 1.2);
        this.updateVisibleData();
        this.draw();
    }
    /**
     * Programmatic zoom-out (e.g., toolbar button).
     */
    zoomOut() {
        this.state.scaleX = Math.max(0.5, this.state.scaleX / 1.2);
        this.updateVisibleData();
        this.draw();
    }
    /**
     * Begin drag-to-pan interaction; remembers the starting X.
     */
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.canvas.style.cursor = 'grabbing';
    }
    /**
     * If dragging, convert pixel delta into candle-offset units and pan.
     */
    handleMouseMove(e) {
        if (!this.state.isDragging)
            return;
        const deltaX = e.clientX - this.state.dragStartX;
        this.state.dragStartX = e.clientX;
        // Translate pixel movement to data-space offset (candles), respecting zoom.
        this.state.offsetX += deltaX / ((this.config.candleWidth + this.config.candleSpacing) * this.state.scaleX);
        this.updateVisibleData();
        this.draw();
    }
    /**
     * End drag interaction and restore cursor.
     */
    handleMouseUp() {
        if (!this.state.isDragging)
            return;
        this.state.isDragging = false;
        this.canvas.style.cursor = 'default';
    }
}
//# sourceMappingURL=chart-engine.js.map