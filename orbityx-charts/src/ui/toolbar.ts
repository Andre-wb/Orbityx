export function initToolBar(
  chartEngine: any,
  dataManager: any,
  themeHandler: (theme: 'dark' | 'light') => void
): void {
  const toolbar = document.getElementById('toolbar') as HTMLDivElement | null;
  if (!toolbar) {
    console.error('No toolbar was found.');
    return;
  }
  createToolbarStructure(toolbar);
  setupEventListeners(toolbar, chartEngine, dataManager, themeHandler);
}

function createToolbarStructure(container: HTMLElement): void {
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

    <div class="toolbar-group">
      <div class="btn-group">
        <button id="fullscreen" class="toolbar-btn" title="Fullscreen">
          <i class="fullscreen-icon">⛶</i>
        </button>
        <button id="settings" class="toolbar-btn" title="Settings">
          <i class="settings-icon">⚙️</i>
        </button>
      </div>
    </div>
  `;
}

function setupEventListeners(
  toolbar: HTMLElement,
  chartEngine: any,
  dataManager: any,
  themeHandler: (theme: 'dark' | 'light') => void
): void {
  const timeframeBtns = toolbar.querySelectorAll<HTMLButtonElement>('[data-timeframe]');
  timeframeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      timeframeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const timeframe = btn.dataset.timeframe || '1m';
      Promise.resolve(dataManager.loadCandles('BTC/USD', timeframe))
        .then(() => {
          chartEngine.setData(dataManager.getData());
          chartEngine.resetView();
        })
        .catch((error: unknown) => console.error('Failed to get any data.', error));
    });
  });

  const chartTypeBtns = toolbar.querySelectorAll<HTMLButtonElement>('[data-chart-type]');
  chartTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      chartTypeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.chartType || 'candlestick';
      chartEngine.setChartType(t);
    });
  });

  const zoomIn = toolbar.querySelector<HTMLButtonElement>('#zoom-in');
  const zoomOut = toolbar.querySelector<HTMLButtonElement>('#zoom-out');
  const resetView = toolbar.querySelector<HTMLButtonElement>('#reset-view');
  zoomIn?.addEventListener('click', () => chartEngine.zoomIn());
  zoomOut?.addEventListener('click', () => chartEngine.zoomOut());
  resetView?.addEventListener('click', () => chartEngine.resetView());

  const themeBtn = toolbar.querySelector<HTMLInputElement>('#theme-toggle');
  themeBtn?.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    const newTheme: 'dark' | 'light' = isDark ? 'dark' : 'light';
    themeHandler(newTheme);
  });

  const drawTrendline = toolbar.querySelector<HTMLButtonElement>('#draw-trendline');
  const drawFibonacci = toolbar.querySelector<HTMLButtonElement>('#draw-fibonacci');
  drawTrendline?.addEventListener('click', () => chartEngine.setDrawingMode('trendline'));
  drawFibonacci?.addEventListener('click', () => chartEngine.setDrawingMode('fibonacci'));

  const fullscreenBtn = toolbar.querySelector<HTMLButtonElement>('#fullscreen');
  fullscreenBtn?.addEventListener('click', toggleFullscreen);

  const settingsBtn = toolbar.querySelector<HTMLButtonElement>('#settings');
  settingsBtn?.addEventListener('click', () => console.log('Open settings'));

  function toggleFullscreen(): void {
    const container = document.querySelector<HTMLElement>('.chart-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      void container.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        void document.exitFullscreen();
      }
    }
  }
}

export function getTimeframeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
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
    '10y': '10 Years',
  };
  return labels[timeframe] || timeframe;
}