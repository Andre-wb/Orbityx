export default class ChartEngine {
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
    getColors() {
        return this.config.theme === 'dark' ? this.config.darkTheme : this.config.lightTheme;
    }
    init(dataManager) {
        this.dataManager = dataManager;
        this.setData(this.dataManager.getData());
        this.resizeCanvas();
        this.setupEventListeners();
        this.draw();
    }
    update() {
        this.setData(this.dataManager.getData());
    }
    resetView() {
        this.state.scaleX = 1;
        this.state.offsetX = 0;
        this.updateVisibleData();
        this.draw();
    }
    applyTheme(theme) {
        this.config.theme = theme;
        this.draw();
    }
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
    handleResize() {
        this.resizeCanvas();
        this.draw();
    }
    setData(data) {
        this.state.data = data;
        this.state.currentPrice = data.length ? data[data.length - 1].close : 0;
        this.updateVisibleData();
        this.draw();
    }
    updateVisibleData() {
        const { left, right } = this.config.margin;
        const visibleW = this.state.width - left - right;
        const space = this.config.candleWidth + this.config.candleSpacing;
        const count = Math.floor(visibleW / (space * this.state.scaleX));
        const start = Math.max(0, this.state.data.length - count - Math.floor(this.state.offsetX));
        const end = Math.min(this.state.data.length, start + count);
        this.state.visibleData = this.state.data.slice(start, end);
        if (this.state.visibleData.length === 0) {
            this.state.minPrice = 0;
            this.state.maxPrice = 0;
            return;
        }
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
    priceToY(price) {
        const h = this.state.height - this.config.margin.top - this.config.margin.bottom;
        return this.state.height - this.config.margin.bottom -
            ((price - this.state.minPrice) / (this.state.maxPrice - this.state.minPrice)) * h;
    }
    indexToX(index) {
        const space = (this.config.candleWidth + this.config.candleSpacing) * this.state.scaleX;
        return this.config.margin.left + index * space;
    }
    draw() {
        this.ctx.clearRect(0, 0, this.state.width, this.state.height);
        this.drawBackground();
        this.drawGrid();
        this.drawCandles();
        this.drawCurrentPrice();
    }
    drawBackground() {
        const theme = this.getColors();
        const m = this.config.margin;
        this.ctx.fillStyle = theme.bgColor;
        this.ctx.fillRect(m.left, m.top, this.state.width - m.left - m.right, this.state.height - m.top - m.bottom);
    }
    drawGrid() {
        const theme = this.getColors();
        const { left, right, top, bottom } = this.config.margin;
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 1;
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
    drawCandles() {
        const theme = this.getColors();
        const bodyW = this.config.candleWidth * this.state.scaleX;
        this.ctx.save();
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
            this.ctx.strokeStyle = theme.wickColor;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, highY);
            this.ctx.lineTo(centerX, lowY);
            this.ctx.stroke();
            this.ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.fillRect(x, bodyTop, bodyW, bodyH);
            this.ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
            this.ctx.strokeRect(x, bodyTop, bodyW, bodyH);
        }
        this.ctx.restore();
    }
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
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const resetBtn = document.getElementById('resetView');
        zoomInBtn?.addEventListener('click', () => this.zoomIn());
        zoomOutBtn?.addEventListener('click', () => this.zoomOut());
        resetBtn?.addEventListener('click', () => this.resetView());
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    }
    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const zoomFactor = 1 + (e.deltaY > 0 ? -zoomIntensity : zoomIntensity);
        this.state.scaleX = Math.max(0.5, Math.min(5, this.state.scaleX * zoomFactor));
        this.updateVisibleData();
        this.draw();
    }
    zoomIn() {
        this.state.scaleX = Math.min(5, this.state.scaleX * 1.2);
        this.updateVisibleData();
        this.draw();
    }
    zoomOut() {
        this.state.scaleX = Math.max(0.5, this.state.scaleX / 1.2);
        this.updateVisibleData();
        this.draw();
    }
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.canvas.style.cursor = 'grabbing';
    }
    handleMouseMove(e) {
        if (!this.state.isDragging)
            return;
        const deltaX = e.clientX - this.state.dragStartX;
        this.state.dragStartX = e.clientX;
        this.state.offsetX += deltaX / (this.config.candleWidth + this.config.candleSpacing) / this.state.scaleX;
        this.updateVisibleData();
        this.draw();
    }
    handleMouseUp() {
        if (!this.state.isDragging)
            return;
        this.state.isDragging = false;
        this.canvas.style.cursor = 'default';
    }
}
