export function initToolBar(chartEngine, dataManager, themeHandler) {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) {
        console.error('No toolbar was found.');
        return;
    }
    createToolbarStructure(toolbar);
    setupEventListeners(toolbar, dataManager, themeHandler);
}
function createToolbarStructure(container) {
    container.innerHTML = `
        <div class="toolbar-group">
            <div class="toolbar-label">Timeframe:</div>
            <div class="btn-group">
                <button class="toolbar-btn active" data-timeframe="1m">1m</button>
                <button class="toolbar-btn" data-timeframe="5m">5m</button>
                <button class="toolbar-btn" data-timeframe="15m">15m</button>
                <button class="toolbar-btn" data-timeframe="1h">1h</button>
                <button class="toolbar-btn" data-timeframe="4h">4h</button>
                <button class="toolbar-btn" data-timeframe="1d">1d</button>
                <button class="toolbar-btn" data-timeframe="1w">1w</button>
            </div>
        </div>
        <div class="toolbar-group">
            <div class="toolbar-label">Chart Type:</div>
            <div class="btn-group">
                <button class="toolbar-btn active" data-chart-type="candlestick" title="Candlestick">
                    <i class="chart-icon">📊</i>
                </button>
                <button class="toolbar-btn" data-chart-type="line" title="Line">
                    <i class="chart-icon">📈</i>
                </button>
                <button class="toolbar-btn" data-chart-type="area" title="Area">
                    <i class="chart-icon">⛰️</i>
                </button>
                </button>
            </div>
        </div>
        <div class="toolbar-group">
            <div class="toolbar-label">Tools:</div>
            <div class="btn-group">
                <button class="toolbar-btn" id="zoom-in" title="Zoom In">
                    <i class="tool-icon">🔍+</i>
                </button>
                <button class="toolbar-btn" id="zoom-out" title="Zoom Out">
                    <i class="tool-icon">🔍-</i>
                </button>
                <button class="toolbar-btn" id="reset-view" title="Reset View">
                    <i class="tool-icon">↺</i>
                </button>
                <button class="toolbar-btn" id="draw-trendline" title="Trendline">
                    <i class="tool-icon">🎨🖌️</i>
                </button>
                <button class="toolbar-btn" id="draw-fibonacci" title="Fibonacci">
                    <i class="tool-icon">🌀</i>
                </button>
            </div>
        </div>
        </div>
            <button id="fullscreen" class="toolbar-btn" title="Fullscreen">
                <i class="fullscreen-icon">⛶</i>
            </button>
            <button id="settings" class="toolbar-btn" title="Settings">
                <i class="settings-icon">⚙️</i>
            </button>
        </div>
    `;
}
function setupEventListeners(toolbar, chartEngine, dataManager, themeHandler) {
    const timeframeBtns = toolbar.querySelectorAll('[data-timeframe]')
    timeframeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeframeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const timeframe = btn.dataset.timeframe;
            dataManager.loadCandles('BTC/USD', timeframe)
                .then(() => {
                    chartEngine.setData(dataManager.getData());
                    chartEngine.resetView();
                })
                .catch(error => console.error('Failed to get aby data.', error));
        });
    });
    const chartTypeBtns = toolbar.querySelectorAll('[data-chart-type]');
    chartTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartEngine.setChartType(btn.dataset.chartType);
        });
    });
    toolbar.querySelector('#zoom-in').addEventListener('click', () => chartEngine.zoomIn());
    toolbar.querySelector('#zoom-out').addEventListener('click', () => chartEngine.zoomOut());
    toolbar.querySelector('#reset-view').addEventListener('click', () => chartEngine.resetView());
    const themeBtn = toolbar.querySelector('#theme-toggle');
    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        const newTheme = isDark ? 'dark' : 'light';
        themeHandler(newTheme);
    });
    toolbar.querySelector('#draw-trendline').addEventListener('click', () => chartEngine.setDrawingMode('trendline'));
    toolbar.querySelector('#draw-fibonacci').addEventListener('click', () => chartEngine.setDrawingMode('fibonacci'));
    toolbar.querySelector('#fullscreen').addEventListener('click', toggleFullscreen);

    function toggleFullscreen() {
        const container = document.querySelector('.chart-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen?.() ||
            container.mozRequestFullScreen?.() ||
            container.webkitRequestFullscreen?.() ||
            container.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() ||
            document.mozCancelFullScreen?.() ||
            document.webkitExitFullscreen?.() ||
            document.msExitFullscreen?.();
        }
    }

    toolbar.querySelector('#settings').addEventListener('click', () => console.log('Open settings'));

    // Пока нету идей что сюда поместить позже равернем
    export function getTimeframeLabel(timeframe) {
        const labels = {
            '1m': '1 Minute',
            '5m': '5 Minutes',
            '15m': '15 Minutes',
            '1h': '1 Hour',
            '4h': '4 Hours',
            '12h': '12 Hours',
            '1d': '1 Day',
            '3d': '3 Days',
            '1w': '1 Week',
            '2w': '2 Weeks',
            '1M': '1 Month',
            '3M': '3 Months',
            '6M': '6 Months',
            '1y': '1 Year',
            '3y': '3 Years',
            '10y': '10 Years'
        };
        return labels[timeframe] || timeframe;
    }
}