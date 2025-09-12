/**
 * Toolbar module – pure UI layer that builds the top control strip (timeframes, chart type,
 * tools, fullscreen, settings). It delegates all actions via callbacks and never fetches data directly.
 * IDs must match DOM elements; zoom/reset controls are wired here directly as well.
 */
/**
 * Initialize toolbar UI inside #toolbar and attach handlers.
 * @param onTimeframeChange - Callback(appTimeframeKey) -> void (delegates to app)
 * @param onChartTypeChange - Callback(chartType) -> void (delegates to app)
 * @param chartEngine       - Rendering engine exposing zoom/reset/setChartType APIs
 */
export function initToolBar(
  onTimeframeChange: (timeframe: string) => void,
  onChartTypeChange: (chartType: string) => void,
  chartEngine: any
): void {
  // Resolve toolbar container once; abort gracefully if missing.
  const toolbar = document.getElementById('toolbar') as HTMLDivElement | null;
  if (!toolbar) {
    console.error('No toolbar was found.');
    return;
  }
  createToolbarStructure(toolbar);
  // Pass callbacks and engine to event wiring function.
  setupEventListeners(toolbar, onTimeframeChange, onChartTypeChange, chartEngine);
}

/**
 * Inject the toolbar DOM skeleton. Kept minimal; icons are emoji placeholders.
 * NOTE: Structure-only – styling handled by CSS.
 */
function createToolbarStructure(container: HTMLElement): void {
  // Render static HTML template for groups and buttons.
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

/**
 * Wire up toolbar controls to engine/callbacks. The toolbar does NOT fetch data.
 * It delegates timeframe and chart-type changes upward to the app via callbacks.
 */
function setupEventListeners(
  toolbar: HTMLElement,
  onTimeframeChange: (timeframe: string) => void,
  onChartTypeChange: (chartType: string) => void,
  chartEngine: any
): void {
  // --- Timeframe switcher ---------------------------------------------------
  const timeframeBtns = toolbar.querySelectorAll<HTMLButtonElement>('[data-timeframe]');
  timeframeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Visual state: ensure only one timeframe button is active.
      timeframeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Read selected timeframe from data attribute; default to '1m'.
      const timeframe = btn.dataset.timeframe || '1m';
      // Delegate upwards; app will reload data and perform re-render.
      try {
        onTimeframeChange(timeframe);
      } catch (err) {
        console.error('Timeframe change callback failed:', err);
      }
    });
  });

  // --- Chart type toggle ----------------------------------------------------
  const chartTypeBtns = toolbar.querySelectorAll<HTMLButtonElement>('[data-chart-type]');
  chartTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Update active state across chart type buttons.
      chartTypeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Extract desired chart type (candlestick/line/area).
      const t = btn.dataset.chartType || 'candlestick';
      // Prefer delegating to app so it can synchronize state; fall back to engine.
      try {
        onChartTypeChange(t);
      } catch (err) {
        console.warn('onChartTypeChange failed, falling back to engine:', err);
        chartEngine?.setChartType?.(t);
      }
    });
  });

  // --- View controls (zoom/reset) ------------------------------------------
  // Bind zoom/reset buttons by ID with defensive engine calls.
  const zoomIn = toolbar.querySelector<HTMLButtonElement>('#zoom-in') || toolbar.querySelector<HTMLButtonElement>('#zoomIn');
  const zoomOut = toolbar.querySelector<HTMLButtonElement>('#zoom-out') || toolbar.querySelector<HTMLButtonElement>('#zoomOut');
  const resetView = toolbar.querySelector<HTMLButtonElement>('#reset-view') || toolbar.querySelector<HTMLButtonElement>('#resetView');
  zoomIn?.addEventListener('click', () => chartEngine?.zoomIn?.());
  zoomOut?.addEventListener('click', () => chartEngine?.zoomOut?.());
  resetView?.addEventListener('click', () => chartEngine?.resetView?.());

  // --- Drawing tools --------------------------------------------------------
  const drawTrendline = toolbar.querySelector<HTMLButtonElement>('#draw-trendline');
  const drawFibonacci = toolbar.querySelector<HTMLButtonElement>('#draw-fibonacci');
  drawTrendline?.addEventListener('click', () => chartEngine.setDrawingMode('trendline'));
  drawFibonacci?.addEventListener('click', () => chartEngine.setDrawingMode('fibonacci'));

  // --- Fullscreen -----------------------------------------------------------
  const fullscreenBtn = toolbar.querySelector<HTMLButtonElement>('#fullscreen');
  fullscreenBtn?.addEventListener('click', toggleFullscreen);

  const settingsBtn = toolbar.querySelector<HTMLButtonElement>('#settings');
  settingsBtn?.addEventListener('click', () => console.log('Open settings'));

  // Toggle browser fullscreen for the main .chart-container element.
  function toggleFullscreen(): void {
    // Target the container; no-op if it's missing.
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

/**
 * Map a timeframe key to a human-readable label used in UI.
 */
export function getTimeframeLabel(timeframe: string): string {
  // Central dictionary for UI display names.
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
  // Fallback: echo the key if not found to aid debugging of new presets.
  return labels[timeframe] || timeframe;
}