<div align="center">

# Orbityx Chart Pro

</div>

<div align="center">

![Orbityx Chart Pro Banner](https://img.shields.io/badge/Orbityx-Chart_Pro-0f141b?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyAxOEw5IDEyTDEzIDE2TDIxIDYiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&labelColor=1a2332)

**A professional, provider-agnostic, canvas-based OHLCV charting library for the web.**
**Now with OrbitScript — write custom indicators in a built-in scripting language.**

[![License](https://img.shields.io/badge/License-Apache_2.0-22c55e.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3b82f6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-22c55e.svg?style=flat-square)](https://github.com/BorisMalts/Orbityx-charts/blob/main/package.json)
[![Tests](https://img.shields.io/badge/Tests-318_passing-22c55e.svg?style=flat-square)](https://github.com/BorisMalts/Orbityx-charts)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-8b5cf6.svg?style=flat-square)](https://github.com/BorisMalts/Orbityx-charts/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/BorisMalts/Orbityx-charts?style=flat-square&color=f59e0b)](https://github.com/BorisMalts/Orbityx-charts/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/BorisMalts/Orbityx-charts?style=flat-square&color=ef4444)](https://github.com/BorisMalts/Orbityx-charts/issues)

[**Documentation**](#-documentation) · [**Quick Start**](#-quick-start) · [**OrbitScript**](#-orbitscript) · [**API Reference**](#-api-reference) · [**Contributing**](#-contributing)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [What's New in v2](#-whats-new-in-v2)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Project Structure](#-project-structure)
- [Core Concepts](#-core-concepts)
    - [DataProvider Interface](#dataprovider-interface)
    - [Instrument Registration](#instrument-registration)
    - [Timeframes](#timeframes)
    - [WebSocket Streaming](#websocket-streaming)
- [Built-in Providers](#-built-in-providers)
    - [Binance Provider](#binance-provider)
    - [CoinGecko Provider](#coingecko-provider)
    - [Generic REST Provider](#generic-rest-provider)
    - [Mock Provider](#mock-provider)
- [Chart Engine](#-chart-engine)
    - [Chart Types](#chart-types)
    - [Built-in Technical Indicators](#built-in-technical-indicators)
    - [Drawing Tools](#drawing-tools)
    - [Viewport & Navigation](#viewport--navigation)
- [UI Components](#-ui-components)
    - [Toolbar](#toolbar)
    - [Tooltip](#tooltip)
    - [Legend Panel](#legend-panel)
    - [Theme System](#theme-system)
- [OrbitScript](#-orbitscript)
    - [Overview](#orbitscript-overview)
    - [Getting Started](#getting-started)
    - [Language Reference](#language-reference)
        - [File Extension](#file-extension)
        - [Script Header](#script-header)
        - [Built-in Series](#built-in-series)
        - [History Lookback](#history-lookback)
        - [Variables](#variables)
        - [Operators](#operators)
        - [Control Flow](#control-flow)
        - [Functions](#functions)
        - [Structs](#structs)
        - [Enums](#enums)
        - [Pattern Matching](#pattern-matching)
        - [String Indexing](#string-indexing)
        - [Macros](#macros)
    - [Standard Library](#standard-library)
        - [Moving Averages](#moving-averages)
        - [Oscillators](#oscillators)
        - [Volatility](#volatility)
        - [Volume Indicators](#volume-indicators)
        - [Statistics](#statistics)
        - [Crossover & Trend](#crossover--trend)
        - [Math Functions](#math-functions)
        - [Utility Functions](#utility-functions)
        - [Output Functions](#output-functions)
        - [Colors](#colors)
    - [Complete Script Examples](#complete-script-examples)
    - [OrbitScript API (TypeScript)](#orbitscript-api-typescript)
    - [Performance Model](#performance-model)
- [API Reference](#-api-reference)
    - [OrbityxChart](#orbityxchart-class)
    - [ChartEngine](#chartengine-class)
    - [DataManager](#datamanager-class)
    - [ProviderRegistry](#providerregistry-class)
    - [WebSocketService](#websocketservice-class)
- [Types Reference](#-types-reference)
- [Utility Functions](#-utility-functions)
    - [Math Utilities](#math-utilities)
    - [Format Utilities](#format-utilities)
- [Configuration](#-configuration)
- [Advanced Usage](#-advanced-usage)
    - [Custom Provider](#custom-provider)
    - [Multiple Charts on One Page](#multiple-charts-on-one-page)
    - [Infinite Backwards Scroll](#infinite-backwards-scroll)
    - [Custom WebSocket Integration](#custom-websocket-integration)
    - [Registering a Custom Indicator Plugin](#registering-a-custom-indicator-plugin)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Browser Support](#-browser-support)
- [Performance Notes](#-performance-notes)
- [Contributing](#-contributing)
- [License](#-license)
- [Authors](#-authors)

---

## 🔭 Overview

**Orbityx Chart Pro** is a fully featured, zero-dependency, TypeScript-first charting library built on top of the native HTML5 Canvas API. It is designed to be completely **provider-agnostic** — there are no hard-coded references to any exchange, broker, or data vendor anywhere in the core library. You plug in your own data source, register your instruments, and the library takes care of everything else.

Version 2.0 introduces **OrbitScript** — a full domain-specific scripting language inspired by Pine Script, embedded directly in the library. Users write `.os` files to create custom indicators, strategies, and alerts without touching TypeScript or rebuilding the app.

Whether you're building a crypto trading terminal, a stock market dashboard, a forex analytics tool, or a financial data visualization platform for any asset class, Orbityx Chart Pro gives you a professional-grade rendering engine with the flexibility to connect to any backend.

```
╔═══════════════════════════════════════════════════════════════╗
║                    Orbityx Chart Pro v2                       ║
║                                                               ║
║   Your App                                                    ║
║   ─────────────────────────────────────────────────────────   ║
║   chart.setProvider(new BinanceProvider())                    ║
║         .registerInstruments([...])                           ║
║         .setWebSocketUrl('wss://...')                         ║
║         .setDefaultTimeframe('1h')                            ║
║   await chart.init()                                          ║
║                                                               ║
║   // Custom indicators via OrbitScript                        ║
║   import { OrbitScript } from 'orbityx-chart-pro/orbitscript' ║
║   OrbitScript.register(myScript, { fast: 50, slow: 200 })     ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🆕 What's New in v2

| Feature | Description |
|---------|-------------|
| **OrbitScript** | Full scripting language for custom indicators — 60+ stdlib functions, macros, structs, pattern matching |
| **String indexing** | `s[0]`, `s[-1]`, `s[1..3]`, `s[1..=3]` — slice strings and arrays by index or range |
| **Rust-style macros** | `println!`, `format!`, `assert!`, `panic!`, `dbg!`, `todo!`, `unreachable!`, `vec![]` |
| **Heikin Ashi** | New chart type alongside Candlestick, Line, Area, Bar |
| **Replay controller** | Step-by-step historical bar playback |
| **Screenshot service** | Export chart canvas as PNG |
| **Multi-chart layout** | Display several instruments side-by-side |
| **Alert manager** | Collect and fire indicator alerts from OrbitScript |
| **Drawing manager** | Extracted into standalone class — trend lines, fibonacci, rectangles, text |
| **318 tests** | Full test suite covering all stdlib functions, lexer, parser, interpreter |

---

## ✨ Features

### 📊 Charting

- **Five chart types**: Candlestick, Heikin Ashi, Line, Area, OHLC Bars
- **High-DPI canvas rendering** with `window.devicePixelRatio` support
- **`requestAnimationFrame`-based render loop** with dirty-flag optimization
- **Volume panel** with proportional up/down bars
- **Current price line** with animated floating label
- **Crosshair** with price and timestamp axis labels

### 📈 Technical Indicators

- **Moving Averages**: SMA (7 variants), EMA, WMA, DEMA, TEMA, HMA, VWMA
- **Oscillators**: RSI, MACD with histogram, Stochastic, Stochastic RSI, Williams %R, CCI, MFI, ROC, Momentum, Awesome Oscillator
- **Volatility**: ATR, ADX (+DI/-DI), Bollinger Bands, Keltner Channels, Donchian Channels, Parabolic SAR, Ichimoku Cloud
- **Volume**: OBV, VWAP, A/D Line, Chaikin Money Flow
- All indicators computed with **pure stateless functions** over the full candle array
- Extensible via `registerIndicator()` plugin API
- **OrbitScript** for unlimited custom indicators

### 🖊️ Drawing Tools

- **Trend Line** — two-point line projected across the price area
- **Horizontal Line** — single-click fixed price level
- **Fibonacci Retracement** — 7-level auto-colored (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- **Rectangle** — area selection with semi-transparent fill
- **Clear All** — one-click wipe of all drawing annotations

### 🔄 Data & Streaming

- **Provider-agnostic**: REST API, WebSocket, local database, mock data — anything
- **Lazy infinite backwards scroll**: automatic history fetch when the user pans to the left edge
- **Live tick streaming** via built-in WebSocket client with exponential back-off reconnect
- **Candle merging**: live ticks update the current candle in-place
- **Pub/sub DataManager**: any number of UI modules can subscribe to candle updates
- **Raw candle normalisation**: accepts arrays `[ts, o, h, l, c, v]`, objects with any alias

### 🌗 Theming

- **Dark and light themes** with full color token control
- **OS preference detection** via `prefers-color-scheme`
- **`localStorage` persistence** of the last chosen theme
- `themeChanged` custom DOM event for third-party module sync

### 🖥️ UI

- **Responsive toolbar**: timeframe switcher, chart type selector, drawing tool palette, indicator picker, zoom/reset
- **Floating OHLCV tooltip**: follows the cursor, updates only when the hovered candle changes
- **Market legend panel**: live price, delta %, 24h high/low/volume/market cap
- **Symbol selector**: auto-populated from registered instruments
- **FPS monitor** for performance profiling
- **WebSocket connection indicator** (Live / Offline dot)
- **Fullscreen mode** toggle
- **Settings modal** scaffold

### ⌨️ Interaction

- **Mouse wheel zoom** centered on cursor position
- **Click-and-drag pan**
- **Keyboard navigation**: arrow keys, +/−, Home, Escape
- **Touch-friendly** architecture (extensible)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                        │
│                   main.ts / OrbityxChart class                  │
│   Orchestrates init, data loading, WS setup, UI wiring          │
├─────────────────────────────────────────────────────────────────┤
│                       OrbitScript Layer (NEW)                   │
│   orbitscript/                                                  │
│   ├── frontend/  lexer → parser → AST                           │
│   ├── runtime/   interpreter, stdlib, macros, environment       │
│   └── compiler/  AST → registerIndicator() bridge               │
├─────────────────────────────────────────────────────────────────┤
│                          UI Layer                               │
│   toolbar.ts │ tooltip.ts │ legend.ts │ theme.ts                │
│   Pure DOM manipulation — no data fetching                      │
├────────────────────┬────────────────────────────────────────────┤
│    Core Layer      │           Services Layer                   │
│  chart-engine.ts   │   api.ts (ProviderRegistry)                │
│  data-manager.ts   │   ws.ts  (WebSocketService)                │
│  indicators.ts     │                                            │
├────────────────────┴────────────────────────────────────────────┤
│                         Utils Layer                             │
│             math.ts │ format.ts │ date.ts                       │
│             Pure, stateless helper functions                    │
├─────────────────────────────────────────────────────────────────┤
│                         Types Layer                             │
│                       types/index.ts                            │
│         Central type registry — no runtime code                 │
├─────────────────────────────────────────────────────────────────┤
│               Providers Layer (optional, user-supplied)         │
│  binance.ts │ coingecko.ts │ generic_rest.ts │ mock.ts          │
│  Implement DataProvider — library core never imports these      │
└─────────────────────────────────────────────────────────────────┘
```

**Key design principles:**
1. **The library core never fetches data on its own.** All network activity is delegated to the user's `DataProvider`.
2. **DataManager is a pure cache.** It normalises, validates, sorts, and broadcasts candle data; it never decides what to fetch.
3. **ChartEngine is a pure renderer.** It reads from state and calls `requestDraw()` — it fires `onNeedMoreData` as a callback hook, never directly loads anything.
4. **ProviderRegistry is the sole IoC boundary.** All library modules that need data go through `registry.fetchCandles()`.
5. **OrbitScript is fully sandboxed.** Scripts cannot access DOM, fetch, or any external API — they only read OHLCV series and emit plot commands.

---

## 🚀 Quick Start

### 1. With Binance (crypto)

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import { BinanceProvider } from 'orbityx-chart-pro/providers/binance';

const chart = new OrbityxChart({ canvasId: 'chartCanvas' });

chart
  .setProvider(new BinanceProvider())
  .registerInstruments([
    { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
    { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
    { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana',   icon: '◎', iconColor: '#9945ff' },
  ])
  .setDefaultTimeframe('4h')
  .setDefaultInstrument('BTCUSDT');

await chart.init();
```

### 2. With CoinGecko (free API, no key required)

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import { CoinGeckoProvider } from 'orbityx-chart-pro/providers/coingecko';

const chart = new OrbityxChart();

chart
  .setProvider(new CoinGeckoProvider({ apiKey: 'CG-yourkey' })) // key optional
  .registerInstruments([
    { id: 'bitcoin',  symbol: 'BTC/USD', name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
    { id: 'ethereum', symbol: 'ETH/USD', name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
    { id: 'solana',   symbol: 'SOL/USD', name: 'Solana',   icon: '◎', iconColor: '#9945ff' },
  ]);

await chart.init();
```

### 3. With Mock data (offline / demos)

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import { MockProvider } from 'orbityx-chart-pro/providers/mock';

const chart = new OrbityxChart();

chart
  .setProvider(new MockProvider({ delayMs: 300 }))
  .registerInstruments([
    { id: 'DEMO_BTC', symbol: 'BTC/USDT', name: 'Demo Bitcoin',  icon: '₿', iconColor: '#f7931a' },
    { id: 'DEMO_ETH', symbol: 'ETH/USDT', name: 'Demo Ethereum', icon: 'Ξ', iconColor: '#627eea' },
  ]);

await chart.init();
```

### 4. Minimal custom provider

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import type { DataProvider } from 'orbityx-chart-pro';

const myProvider: DataProvider = {
  async fetchCandles({ instrumentId, timeframe, to }) {
    const url = new URL(`https://api.myapp.com/ohlcv/${instrumentId}`);
    url.searchParams.set('tf', timeframe);
    url.searchParams.set('limit', '500');
    if (to !== undefined) url.searchParams.set('endTime', String(to));

    const rows: any[] = await fetch(url).then(r => r.json());
    return rows.map(r => ({
      timestamp: r.time * 1000,
      open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v,
    }));
  },
};

const chart = new OrbityxChart();
chart
  .setProvider(myProvider)
  .registerInstruments([
    { id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', icon: '', iconColor: '#555' },
  ]);

await chart.init();
```

### 5. Quick OrbitScript indicator

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import { OrbitScript } from 'orbityx-chart-pro/orbitscript';
import { BinanceProvider } from 'orbityx-chart-pro/providers/binance';

const chart = new OrbityxChart({ canvasId: 'chartCanvas' });
chart.setProvider(new BinanceProvider())
     .registerInstruments([{ id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', icon: '₿', iconColor: '#f7931a' }]);
await chart.init();

// Add a custom indicator written in OrbitScript
const goldenCross = `
@indicator("Golden Cross", overlay=true)
@input("fast", number, 50)
@input("slow", number, 200)

fastMA = sma(close, fast)
slowMA = sma(close, slow)

plot(fastMA, "Fast SMA", #2196F3, 2)
plot(slowMA, "Slow SMA", #F44336, 2)

alertcondition(crossover(fastMA, slowMA), "Golden Cross", "SMA 50 crossed above SMA 200")
`;

const id = OrbitScript.register(goldenCross);

// Remove later
OrbitScript.unregister(id);
```

---

## 📦 Installation

### npm

```bash
npm install orbityx-chart-pro
```

### From source

```bash
git clone https://github.com/BorisMalts/Orbityx-charts.git
cd Orbityx-charts
npm install
npm run build
```

### Required HTML structure

The chart requires a canvas element and several UI mount points:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <title>Orbityx Chart Pro</title>
  <link rel="stylesheet" href="styles/main.css" />
</head>
<body>

  <!-- Toolbar mount point -->
  <div id="toolbar"></div>

  <!-- Symbol selector -->
  <select id="symbol-select"></select>

  <!-- Chart container -->
  <div class="chart-container">
    <canvas id="chartCanvas"></canvas>
  </div>

  <!-- Legend panel -->
  <div class="legend-panel">
    <span class="symbol-icon"></span>
    <span class="symbol-name"></span>
    <span class="symbol-price"></span>
    <span class="price-change"></span>
    <span id="stat-high"></span>
    <span id="stat-low"></span>
    <span id="stat-volume"></span>
    <span id="stat-marketcap"></span>
    <span id="stat-change" class="stat-badge"></span>
  </div>

  <!-- Status -->
  <div id="connection-status"></div>
  <div id="frame-rate"></div>
  <div id="last-update"></div>
  <div id="loading-indicator" style="display:none;">Loading…</div>

  <!-- Error notification -->
  <div id="error-notification" style="display:none;">
    <span class="error-title"></span>
    <span class="error-message"></span>
    <button class="error-dismiss">✕</button>
  </div>

  <!-- Controls -->
  <button id="theme-toggle"><span class="theme-icon">☀️</span></button>
  <button id="fullscreen-btn">⛶</button>
  <button id="settings-btn">⚙</button>

  <div id="settings-modal" style="display:none;">
    <button class="modal-close">✕</button>
  </div>

  <script type="module" src="main.js"></script>
</body>
</html>
```

---

## 📁 Project Structure

```
orbityx-charts/
│
├── main.ts                          # Application bootstrap & OrbityxChart class
│
├── core/
│   ├── chart-engine.ts              # Canvas renderer, viewport math, event handling
│   ├── chart-renderer.ts            # Render pipeline (extracted from chart-engine)
│   ├── chart-type-registry.ts       # Pluggable chart type registration
│   ├── data-manager.ts              # In-memory OHLCV cache, pub/sub, live ticks
│   ├── indicators.ts                # Built-in indicator computation & plugin registry
│   ├── viewport.ts                  # Viewport state & coordinate transforms
│   ├── drawing-manager.ts           # Drawing tool state & hit-testing
│   ├── alert-manager.ts             # Alert collection & event dispatching
│   ├── multi-chart.ts               # Multi-chart layout manager
│   ├── replay-controller.ts         # Historical bar-by-bar playback
│   └── screenshot-service.ts        # PNG export from canvas
│
├── orbitscript/                     # OrbitScript DSL — Pine Script-style language
│   ├── lang/                        # Language primitives
│   │   ├── token/                   # TokenType, Token
│   │   ├── value/                   # OSColor, OSStruct, OSEnum, OSClosure, OSArray
│   │   ├── output/                  # PlotOutput, VisualOutput, AlertOutput
│   │   ├── ast/                     # Literals, Expressions, Statements, Declarations
│   │   ├── meta.ts                  # ScriptMeta, InputDef
│   │   └── error.ts                 # OrbitScriptError (line/col aware)
│   ├── frontend/
│   │   ├── lexer/                   # Tokeniser — keywords, lexer
│   │   └── parser/                  # Recursive descent parser (8 modules)
│   ├── runtime/
│   │   ├── scope/                   # Lexical scope stack
│   │   ├── series/                  # Built-in series access, history lookback
│   │   ├── color/                   # Color constants & hex conversion
│   │   ├── signal/                  # Return/Break/Continue signals
│   │   ├── output/                  # Plot/HLine/BgColor/Alert/Shape collectors
│   │   ├── macro/                   # Macro registry + 8 built-in macros
│   │   ├── stdlib/                  # 11 category files, 60+ functions
│   │   ├── interpreter/             # Bar-by-bar evaluator (9 modules)
│   │   └── environment.ts           # Runtime environment
│   ├── compiler/                    # AST → registerIndicator() bridge
│   ├── orbitscript.test.ts          # Core tests
│   └── features.test.ts             # String indexing + macro tests
│
├── services/
│   ├── api.ts                       # ProviderRegistry — IoC boundary for data
│   └── ws.ts                        # Resilient WebSocket client with auto-reconnect
│
├── ui/
│   ├── toolbar.ts                   # Timeframes, chart types, drawings, indicator picker
│   ├── tooltip.ts                   # Floating OHLCV crosshair tooltip
│   ├── legend.ts                    # Market legend panel (price, stats, instrument info)
│   └── theme.ts                     # Dark/light theme manager with localStorage
│
├── types/
│   └── index.ts                     # Central type registry (no runtime code)
│
├── utils/
│   ├── math.ts                      # Pure numeric helpers (SMA, EMA, RSI, MACD, BB…)
│   ├── format.ts                    # Currency, number, percent, compact formatters
│   └── date.ts                      # Timestamp parsing, axis labels, date formatting
│
└── providers/
    └── examples/
        ├── binance.ts               # Binance Spot adapter with pagination
        ├── coingecko.ts             # CoinGecko v3 REST adapter
        ├── generic_rest.ts          # Generic REST template
        └── mock.ts                  # In-memory mock for testing and demos
```

---

## 🧠 Core Concepts

### DataProvider Interface

The `DataProvider` interface is the **only contract** Orbityx Chart Pro imposes on the user. Implement it to connect to any data source.

```typescript
export interface DataProvider {
  /**
   * REQUIRED — fetch OHLCV candles.
   * Return RawCandle[] or Candle[] — the library normalises either.
   * Throw to surface the error in the UI.
   */
  fetchCandles(request: CandleRequest): Promise<RawCandle[] | Candle[]>;

  /**
   * OPTIONAL — fetch 24-hour market statistics.
   * When omitted, the library computes approximate stats from loaded candles.
   */
  fetchMarketStats?(instrumentId: string): Promise<Partial<MarketStats>>;

  /**
   * OPTIONAL — called once during chart.init().
   * Use for auth, opening connections, or fetching a dynamic instrument list.
   */
  init?(): Promise<void>;

  /**
   * OPTIONAL — called when the user changes the active instrument or timeframe.
   */
  onInstrumentChange?(instrumentId: string, timeframe: string): void;

  /**
   * OPTIONAL — called on chart.destroy().
   * Close connections, clear timers.
   */
  destroy?(): void;
}
```

#### CandleRequest

| Field | Type | Description |
|-------|------|-------------|
| `instrumentId` | `string` | Instrument id as registered (e.g. `'BTCUSDT'`) |
| `timeframe` | `string` | Active timeframe key (e.g. `'1h'`, `'1d'`) |
| `from` | `number?` | Optional start epoch-ms |
| `to` | `number?` | Optional end epoch-ms — set on lazy-load history requests |
| `limit` | `number?` | Optional maximum candles to return |

> **Important:** The `to` field is the signal for **lazy history loading**. When the user scrolls to the left edge, the library sets `req.to = oldest_timestamp - 1`. Your provider must fetch candles strictly older than `to`.

---

### Instrument Registration

Every tradable instrument must be registered before `init()`:

```typescript
chart.registerInstruments([
  {
    id:             'BTCUSDT',    // Unique key — passed verbatim to DataProvider
    symbol:         'BTC/USDT',  // Short label shown in the UI
    name:           'Bitcoin',   // Full name shown in the legend
    icon:           '₿',         // Icon badge character or emoji
    iconColor:      '#f7931a',   // CSS color for the icon badge
    pricePrecision: 2,           // Decimal places for price formatting
    meta:           { category: 'crypto' }, // Arbitrary user data, never read by library
  },
]);
```

**`id`** is passed verbatim to `fetchCandles()`, `fetchMarketStats()`, and `onInstrumentChange()`. It can be anything — `'BTCUSDT'`, `'bitcoin'`, `'AAPL'`, `'EUR/USD'`.

---

### Timeframes

| Key | Label | Notes |
|-----|-------|-------|
| `1m` | 1 Minute | Highest resolution |
| `5m` | 5 Minutes | |
| `15m` | 15 Minutes | |
| `30m` | 30 Minutes | |
| `1h` | 1 Hour | |
| `4h` | 4 Hours | |
| `12h` | 12 Hours | |
| `1d` | 1 Day | **Default** |
| `3d` | 3 Days | |
| `1w` | 1 Week | |
| `2w` | 2 Weeks | |
| `1month` | 1 Month | |
| `3month` | 3 Months | |
| `6month` | 6 Months | |
| `1y` | 1 Year | |

You can pass any custom string — the toolbar label falls back to the raw key.

---

### WebSocket Streaming

```typescript
// Set the WS endpoint before init
chart.setWebSocketUrl('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

// The library routes messages automatically:
// - type 'candle'    → DataManager.processLiveTick()
// - type 'trade'     → engine.state.currentPrice update
// - type 'heartbeat' → responds with 'pong'
```

Expected `WSMessage` envelope:

```typescript
interface WSMessage {
  type:       'candle' | 'trade' | 'heartbeat' | 'pong' | 'subscribe' | 'error';
  payload?:   RawCandle;
  price?:     number;
  symbol?:    string;
  timeframe?: string;
  stats?:     Partial<MarketStats>;
  [key: string]: unknown;
}
```

To bypass the built-in socket entirely:

```typescript
import dataManager from 'orbityx-chart-pro';

const socket = new WebSocket('wss://yourserver.com/stream');
const detach = dataManager.attachSocket(socket);

// Later:
detach();
```

---

## 🔌 Built-in Providers

### Binance Provider

Full-featured Binance Spot adapter. Fetches up to 3,000 candles on initial load via backwards pagination. Supports all standard Binance kline intervals.

```typescript
import { BinanceProvider } from 'orbityx-chart-pro/providers/binance';

const provider = new BinanceProvider({
  baseUrl: 'https://api.binance.com/api/v3', // default; for Binance US: 'https://api.binance.us/api/v3'
  limit:   500,                               // candles per HTTP request (max 1000)
});
```

**Timeframe mapping:**

| Library key | Binance interval |
|-------------|-----------------|
| `1m` | `1m` |
| `5m` | `5m` |
| `15m` | `15m` |
| `30m` | `30m` |
| `1h` | `1h` |
| `4h` | `4h` |
| `12h` | `12h` |
| `1d` | `1d` |
| `3d` | `3d` |
| `1w` | `1w` |
| `1month` | `1M` |

**Market stats:** Implements `fetchMarketStats()` using Binance's `/ticker/24hr` — high24h, low24h, volume (quote), price change and percent change.

---

### CoinGecko Provider

Connects to the CoinGecko v3 public API. No API key required for basic use.

```typescript
import { CoinGeckoProvider } from 'orbityx-chart-pro/providers/coingecko';

const provider = new CoinGeckoProvider({
  apiKey:     'CG-yourProKey', // optional
  vsCurrency: 'usd',           // default: 'usd'
});
```

> Use the **CoinGecko coin id** as the instrument `id` — e.g. `'bitcoin'`, `'ethereum'`, `'the-graph'`.

**Timeframe → days mapping:**

| Library key | Days fetched |
|-------------|-------------|
| `1m`–`30m` | 1 |
| `1h` | 7 |
| `4h` | 30 |
| `12h` | 90 |
| `1d`, `3d` | 365 |
| `1w`, `2w` | 730 |
| `1month` | 365 |
| `6month` | 1825 |
| `1y` | 3650 |

---

### Generic REST Provider

A configurable template for connecting any REST/JSON API:

```typescript
import { GenericRestProvider } from 'orbityx-chart-pro/providers/generic-rest';

const provider = new GenericRestProvider({
  candlesUrl: (id, tf) =>
    `https://api.mybroker.com/ohlcv?symbol=${id}&interval=${tf}&limit=500`,

  statsUrl: (id) =>
    `https://api.mybroker.com/stats/${id}`,

  mapCandle: (row: any) => ({
    timestamp: row.openTime,
    open:  row.open,
    high:  row.high,
    low:   row.low,
    close: row.close,
    volume: row.volume,
  }),

  mapStats: (s: any) => ({
    high24h:           s.highPrice,
    low24h:            s.lowPrice,
    volume24h:         s.volume,
    priceChange24h:    s.priceChange,
    priceChangePct24h: s.priceChangePercent,
  }),

  headers: { 'Authorization': `Bearer ${MY_API_KEY}` },

  // Unwrap nested response: { data: { candles: [...] } } → ['data', 'candles']
  candlesPath: ['data', 'candles'],
});
```

---

### Mock Provider

In-memory OHLCV generator for testing, demos, and offline development:

```typescript
import { MockProvider } from 'orbityx-chart-pro/providers/mock';

const provider = new MockProvider({
  delayMs:    300,    // Simulated network latency
  candleCount: 1000,  // Initial history depth
  volatility:  0.02,  // Price movement amplitude
});
```

---

## 📊 Chart Engine

### Chart Types

| Type | Description |
|------|-------------|
| `candlestick` | Standard OHLC candlestick — green/red bodies with wicks |
| `heikinashi` | Heikin Ashi averaged candles — smooths noise |
| `line` | Close price line chart |
| `area` | Close price with gradient fill beneath |
| `bar` | OHLC bar chart (open/close ticks on a vertical line) |

Switch programmatically:

```typescript
chart.setChartType('heikinashi');
```

Or the user can switch via the toolbar dropdown.

---

### Built-in Technical Indicators

Activate via the toolbar or programmatically:

```typescript
chart.activateIndicator('sma',             { period: 20 });
chart.activateIndicator('ema',             { period: 50 });
chart.activateIndicator('macd');
chart.activateIndicator('rsi',             { period: 14 });
chart.activateIndicator('bollinger_bands', { period: 20, multiplier: 2 });
chart.activateIndicator('ichimoku');
chart.activateIndicator('parabolic_sar');
chart.activateIndicator('vwap');
```

Full list of built-in indicator ids:

| Category | IDs |
|----------|-----|
| Moving Averages | `sma` `ema` `wma` `dema` `tema` `hma` `vwma` |
| Oscillators | `rsi` `macd` `stoch` `stoch_rsi` `williams_r` `cci` `mfi` `roc` `momentum` `awesome_oscillator` |
| Volatility | `atr` `adx` `bollinger_bands` `keltner` `donchian` `parabolic_sar` `ichimoku` |
| Volume | `obv` `vwap` `ad_line` `cmf` |

#### Custom Indicator Plugin API

Register your own indicator using the low-level plugin API:

```typescript
import { registerIndicator, unregisterIndicator } from 'orbityx-chart-pro';
import type { Candle, IndicatorSeries } from 'orbityx-chart-pro';

registerIndicator(
  'my_indicator',
  {
    label:      'My Indicator',
    color:      '#9C27B0',
    isSubPanel: false,
    group:      'Custom',
  },
  (candles: Candle[]): IndicatorSeries => ({
    id:         'my_indicator',
    label:      'My Indicator',
    color:      '#9C27B0',
    isSubPanel: false,
    points:     candles.map((c, i) => ({
      timestamp: c.timestamp,
      value:     (c.high + c.low + c.close) / 3, // typical price
    })),
  }),
);
```

---

### Drawing Tools

| Tool | Description |
|------|-------------|
| Trend Line | Draw a line between two clicked price/time points, extended across the chart |
| Horizontal Line | Click once to place a fixed horizontal price level |
| Fibonacci Retracement | Drag between high and low to auto-place 7 retracement levels |
| Rectangle | Drag to draw a semi-transparent box over a time/price region |
| Clear All | Remove all annotations |

---

### Viewport & Navigation

The `Viewport` class manages the visible time window and coordinate transforms:

- **Zoom**: Mouse wheel — centered on cursor position
- **Pan**: Click-and-drag or keyboard arrows
- **Reset**: Double-click or `Home` key — fits all loaded candles
- **Precision zoom**: `+` / `−` keys

```typescript
// Access viewport state
const vp = chart.engine.viewport;
console.log(vp.startIndex, vp.endIndex);

// Programmatic control
chart.engine.zoomToFit();
chart.engine.scrollToLatest();
```

---

## 🖥️ UI Components

### Toolbar

The toolbar renders into `#toolbar` and provides:

- **Timeframe selector** — buttons for all supported timeframes
- **Chart type dropdown** — switch between chart modes
- **Drawing tools** — pencil, line, fibonacci, rectangle, clear
- **Indicator picker** — multi-select panel with search
- **Zoom controls** — fit, zoom-in, zoom-out
- **Screenshot button** — triggers `ScreenshotService`

### Tooltip

The floating OHLCV tooltip appears on mouse hover:

- Shows: Date/time, Open, High, Low, Close, Volume
- Updates only when the hovered candle index changes (no layout thrash)
- Automatically positions to avoid screen edges

### Legend Panel

The market legend panel (`#legend-panel`) shows:

- Instrument icon, symbol, and full name
- Current price with up/down color
- 24h price change (absolute + percent)
- 24h High, Low
- 24h Volume (quote currency)
- Market cap (when provided by DataProvider)

### Theme System

```typescript
// Toggle programmatically
chart.setTheme('light');
chart.setTheme('dark');

// Listen for theme changes (e.g. to update your own UI)
document.addEventListener('themeChanged', (e: CustomEvent) => {
  console.log('Theme is now:', e.detail.theme); // 'dark' | 'light'
});
```

Theme colors are CSS custom properties defined on `[data-theme]`:

```css
[data-theme="dark"] {
  --chart-bg:          #0f141b;
  --chart-grid:        #1e2937;
  --chart-text:        #94a3b8;
  --candle-bull:       #22c55e;
  --candle-bear:       #ef4444;
  --volume-bull:       rgba(34, 197, 94,  0.4);
  --volume-bear:       rgba(239, 68,  68, 0.4);
  --crosshair:         rgba(148, 163, 184, 0.5);
  --price-line:        #3b82f6;
}
```

---

## 📝 OrbitScript

### OrbitScript Overview

OrbitScript is a domain-specific scripting language built into Orbityx Chart Pro, inspired by TradingView's Pine Script. It allows users to write custom indicators, strategies, and alert conditions without modifying the host application.

**Key design goals:**
- **Simple syntax** — readable by traders who are not professional programmers
- **Safe** — fully sandboxed; scripts cannot access DOM, network, or file system
- **Performant** — series computations are cached; each bar only indexes into pre-computed arrays
- **Complete** — 60+ stdlib functions covering every common technical indicator

**Architecture of OrbitScript:**

```
.os source code
       │
       ▼
  ┌─────────┐     ┌─────────┐     ┌──────────────────┐
  │  Lexer  │────▶│ Parser  │────▶│  Interpreter      │
  │ (tokens)│     │  (AST)  │     │  (bar-by-bar)     │
  └─────────┘     └─────────┘     └────────┬─────────┘
                                            │ uses
                      ┌─────────────────────┤
                      │                     │ uses
               ┌──────────────┐    ┌────────────────┐
               │  StdLib      │    │  Environment   │
               │  (60+ fns)   │    │  (vars, scope, │
               └──────────────┘    │   series cache)│
                                   └────────────────┘
                                            │
                                            ▼
                                   ┌────────────────┐
                                   │   Compiler     │──▶ registerIndicator()
                                   │   (bridge)     │    ──▶ IndicatorSeries
                                   └────────────────┘
```

---

### Getting Started

```typescript
import { OrbitScript } from 'orbityx-chart-pro/orbitscript';

// Option 1: register from a string
const source = `
@indicator("My RSI", overlay=false)
@input("length", number, 14)

rsiValue = rsi(close, length)
plot(rsiValue, "RSI", #2196F3, 2)
hline(70, "Overbought", #ef4444)
hline(30, "Oversold", #22c55e)
`;

const id = OrbitScript.register(source);
// later:
OrbitScript.unregister(id);

// Option 2: load a .os file
const text = await fetch('/indicators/my-rsi.os').then(r => r.text());
const id2  = OrbitScript.register(text, { length: 21 }); // override inputs

// Option 3: compile only (no registration)
const { meta, computeFn, program } = OrbitScript.compile(source);
console.log(meta.name);    // "My RSI"
console.log(meta.overlay); // false
const series = computeFn(candles);
```

---

### Language Reference

#### File Extension

`.os`

---

#### Script Header

Every script should start with a directive declaring its type and metadata:

```
@indicator("My Indicator", overlay=true)
@input("length", number, 14)
@input("source", string, "close")
@input("mult",   number, 2.0)
```

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `@indicator(name)` | `name: string`, `overlay?: bool` | Declare an indicator. `overlay=true` draws on the price axis. |
| `@strategy(name)` | `name: string` | Declare a strategy (for future backtesting). |
| `@input(name, type, default)` | `name: string`, `type: number\|string\|bool`, `default: any` | Expose a user-editable parameter. Accessible by variable name inside the script. |

---

#### Built-in Series

The following variables are available on every bar:

| Variable | Type | Description |
|----------|------|-------------|
| `open` | `number[]` | Open price of each bar |
| `high` | `number[]` | High price of each bar |
| `low` | `number[]` | Low price of each bar |
| `close` | `number[]` | Close price of each bar |
| `volume` | `number[]` | Volume of each bar |
| `bar_index` | `number` | Index of the current bar (0 = first, oldest bar) |
| `timestamp` | `number` | Unix epoch milliseconds of the current bar |

---

#### History Lookback

Use `[n]` after any series variable to look back `n` bars from the current bar:

```
prev_close    = close[1]   // close of the bar before current
two_bars_ago  = high[2]
```

> `[0]` is the same as the current bar value. Negative indices are **not** valid for history lookback — they are reserved for string/array indexing.

---

#### Variables

```
// Immutable binding (default)
let x = 42
let name = "RSI"
let flag = true

// Mutable binding
let mut counter = 0
counter = counter + 1
counter += 5
counter -= 2
counter *= 3
counter /= 2
counter %= 7
```

Variables can hold numbers, strings, booleans, arrays, structs, enums, and closures.

---

#### Operators

**Arithmetic:**

| Operator | Description |
|----------|-------------|
| `+` | Addition |
| `-` | Subtraction |
| `*` | Multiplication |
| `/` | Division |
| `%` | Modulo |
| `**` | Exponentiation |

**Comparison:**

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less or equal |
| `>=` | Greater or equal |

**Logical:**

| Operator | Description |
|----------|-------------|
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `!` | Logical NOT |

**Range:**

| Operator | Description |
|----------|-------------|
| `0..5` | Exclusive range (0, 1, 2, 3, 4) |
| `0..=5` | Inclusive range (0, 1, 2, 3, 4, 5) |

---

#### Control Flow

```
// If / else if / else
if rsiValue > 80
    bgcolor(#ef444430, true)
else if rsiValue > 70
    bgcolor(#ff980030, true)
else
    bgcolor(#00000000, true)
end

// Ternary (inline)
color = rsiValue > 70 ? #ef4444 : #22c55e

// For loop with range
for i in 0..5
    plot(close[i], "bar", #2196F3, 1)
end

// For loop over array
prices = vec![10.0, 20.0, 30.0]
for price in prices
    println!(price)
end

// While loop
let mut i = 0
while i < 10
    i += 1
end

// Infinite loop with break
let mut found = false
loop
    if someCondition
        found = true
        break
    end
end
```

---

#### Functions

```
// Function declaration
fn average(a, b)
    (a + b) / 2
end

// With explicit return
fn clampRsi(val)
    if val > 100
        return 100
    end
    if val < 0
        return 0
    end
    val
end

// Default parameters
fn lineColor(bullish, bullColor=#22c55e, bearColor=#ef4444)
    if bullish
        bullColor
    else
        bearColor
    end
end

// Closures
let double = |x| x * 2
let result = double(21)   // 42
```

---

#### Structs

```
struct Signal
    direction: string
    strength:  number
    timestamp: number
end

let sig = Signal {
    direction: "bullish",
    strength:  0.85,
    timestamp: timestamp,
}

println!(sig.direction)  // "bullish"

sig.strength = 0.9       // field assignment
```

---

#### Enums

```
enum Trend
    Up
    Down
    Sideways
end

let current = Trend::Up

match current
    Trend::Up      => plot(close, "Up",       #22c55e, 2)
    Trend::Down    => plot(close, "Down",     #ef4444, 2)
    Trend::Sideways => plot(close, "Neutral", #9e9e9e, 2)
end
```

---

#### Pattern Matching

```
match rsiValue
    v if v > 80 => bgcolor(#ef444440, true)
    v if v > 70 => bgcolor(#ff980040, true)
    v if v < 30 => bgcolor(#22c55e40, true)
    v if v < 20 => bgcolor(#22c55e70, true)
    _           => null
end
```

---

#### String Indexing

```
let s     = "hello"

// Single character by index (0-based)
let first = s[0]      // "h"
let second = s[1]     // "e"

// Negative index counts from the end
let last  = s[-1]     // "o"
let prev  = s[-2]     // "l"

// Range slice — exclusive end
let slice = s[1..3]   // "el"

// Range slice — inclusive end
let incl  = s[1..=3]  // "ell"

// Array indexing works the same way
let arr   = vec![10, 20, 30, 40, 50]
let first_elem = arr[0]    // 10
let last_elem  = arr[-1]   // 50
let sub        = arr[1..3] // [20, 30]
```

---

#### Macros

Macros use `name!(...)` or `name![...]` syntax:

| Macro | Signature | Description |
|-------|-----------|-------------|
| `println!` | `println!(value, ...)` | Print one or more values to the browser console |
| `format!` | `format!("template {}", val)` | Interpolate values into a template string, returns string |
| `assert!` | `assert!(condition)` or `assert!(condition, "msg")` | Throw `OrbitScriptError` if condition is falsy |
| `panic!` | `panic!("message")` | Always throw a runtime error with the given message |
| `dbg!` | `dbg!(value)` | Print the value to console and return it unchanged |
| `todo!` | `todo!()` | Mark an unimplemented code path — throws at runtime |
| `unreachable!` | `unreachable!()` | Assert a branch is logically impossible |
| `vec!` | `vec![1, 2, 3]` | Create an array literal |

```
// assert! — throws if condition is falsy (null, false, 0, NaN, "")
assert!(rsiValue >= 0, "RSI cannot be negative")

// dbg! — returns value unchanged, logs to console
let v = dbg!(rsi(close, 14))

// format! — string interpolation
let msg = format!("RSI={} at bar {}", rsiValue, bar_index)

// vec! — create array
let levels = vec![20.0, 50.0, 80.0]
for level in levels
    hline(level, format!("Level {}", level), #9e9e9e)
end
```

---

### Standard Library

#### Moving Averages

All moving averages take a source series and a length. They return `number` — the value for the current bar.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sma` | `sma(src, length)` | Simple Moving Average |
| `ema` | `ema(src, length)` | Exponential Moving Average |
| `wma` | `wma(src, length)` | Weighted Moving Average — linearly weighted, most recent bar has highest weight |
| `dema` | `dema(src, length)` | Double EMA — `2 * EMA(src) - EMA(EMA(src))`, reduced lag |
| `tema` | `tema(src, length)` | Triple EMA — `3 * EMA - 3 * EMA(EMA) + EMA(EMA(EMA))`, minimal lag |
| `hma` | `hma(src, length)` | Hull Moving Average — `WMA(2*WMA(n/2) - WMA(n), sqrt(n))`, very responsive |
| `vwma` | `vwma(src, volume, length)` | Volume-Weighted Moving Average |

**Examples:**

```
fastEma = ema(close, 12)
slowEma = ema(close, 26)
hull    = hma(close, 9)
vwmaVal = vwma(close, volume, 20)

plot(fastEma, "EMA 12", #2196F3, 1)
plot(slowEma, "EMA 26", #FF9800, 1)
```

---

#### Oscillators

| Function | Default params | Returns |
|----------|---------------|---------|
| `rsi(src, length=14)` | length=14 | `number` — 0 to 100 |
| `macd(src, fast=12, slow=26, signal=9)` | — | `{ macd_line, signal_line, histogram }` |
| `stoch(high, low, close, k=14, d=3)` | — | `{ k, d }` |
| `stoch_rsi(src, rsi_len=14, stoch_len=14, k_smooth=3, d_smooth=3)` | — | `{ k, d }` |
| `williams_r(high, low, close, length=14)` | — | `number` — −100 to 0 |
| `cci(high, low, close, length=20)` | — | `number` |
| `mfi(high, low, close, volume, length=14)` | — | `number` — 0 to 100 |
| `roc(src, length=12)` | — | `number` — percent rate of change |
| `momentum(src, length=10)` | — | `number` — raw difference |
| `awesome_oscillator(high, low)` | — | `number` |

**Examples:**

```
// RSI
rsiVal = rsi(close, 14)
plot(rsiVal, "RSI", #2196F3, 2)
hline(70, "Overbought", #ef4444)
hline(30, "Oversold",   #22c55e)

// MACD
m = macd(close, 12, 26, 9)
plot(m.macd_line,   "MACD",     #2196F3, 2)
plot(m.signal_line, "Signal",   #FF9800, 2)
plothistogram(m.histogram, "Hist", #9C27B0)

// Stochastic
s = stoch(high, low, close, 14, 3)
plot(s.k, "%K", #2196F3, 2)
plot(s.d, "%D", #FF9800, 2)
```

---

#### Volatility

| Function | Default params | Returns |
|----------|---------------|---------|
| `atr(high, low, close, length=14)` | — | `number` — average true range |
| `adx(high, low, close, length=14)` | — | `{ adx, plus_di, minus_di }` |
| `bollinger(src, length=20, mult=2.0)` | — | `{ upper, middle, lower }` |
| `keltner(high, low, close, ema_len=20, atr_len=20, mult=1.5)` | — | `{ upper, middle, lower }` |
| `donchian(high, low, length=20)` | — | `{ upper, middle, lower }` |
| `parabolic_sar(high, low, step=0.02, max=0.2)` | — | `number` |
| `ichimoku(high, low, close, tenkan=9, kijun=26, senkou_b=52, displacement=26)` | — | `{ tenkan, kijun, senkou_a, senkou_b, chikou }` |

**Examples:**

```
// Bollinger Bands
bb = bollinger(close, 20, 2.0)
plot(bb.upper,  "Upper",  #2196F3, 1)
plot(bb.middle, "Middle", #9E9E9E, 1)
plot(bb.lower,  "Lower",  #2196F3, 1)

// ATR
atrVal = atr(high, low, close, 14)
plot(atrVal, "ATR", #FF9800, 1)

// ADX
d = adx(high, low, close, 14)
plot(d.adx,      "ADX",    #2196F3, 2)
plot(d.plus_di,  "+DI",    #22c55e, 1)
plot(d.minus_di, "-DI",    #ef4444, 1)

// Ichimoku
cloud = ichimoku(high, low, close)
plot(cloud.tenkan,   "Tenkan",   #2196F3, 1)
plot(cloud.kijun,    "Kijun",    #F44336, 1)
plot(cloud.senkou_a, "Senkou A", #4CAF50, 1)
plot(cloud.senkou_b, "Senkou B", #FF9800, 1)
plot(cloud.chikou,   "Chikou",   #9C27B0, 1)
```

---

#### Volume Indicators

| Function | Description |
|----------|-------------|
| `obv(close, volume)` | On-Balance Volume — cumulative volume signed by price direction |
| `vwap(high, low, close, volume)` | Volume-Weighted Average Price |
| `ad_line(high, low, close, volume)` | Accumulation/Distribution Line |
| `cmf(high, low, close, volume, length=20)` | Chaikin Money Flow — −1 to +1 |

**Examples:**

```
// VWAP
vwapVal = vwap(high, low, close, volume)
plot(vwapVal, "VWAP", #FF9800, 2)

// OBV
obvVal = obv(close, volume)
plot(obvVal, "OBV", #9C27B0, 1)

// CMF
cmfVal = cmf(high, low, close, volume, 20)
plot(cmfVal, "CMF", #2196F3, 2)
hline(0, "Zero", #9e9e9e)
```

---

#### Statistics

| Function | Description |
|----------|-------------|
| `stdev(src, length=20)` | Rolling population standard deviation |
| `highest(src, length)` | Highest value over the last `length` bars |
| `lowest(src, length)` | Lowest value over the last `length` bars |
| `sum(src, length)` | Sum of values over the last `length` bars |
| `avg(src, length)` | Average of values over the last `length` bars |
| `change(src, length=1)` | `src[current] - src[current - length]` |

**Examples:**

```
// 20-period standard deviation
sd = stdev(close, 20)
plot(sd, "StDev", #9C27B0, 1)

// 52-week high and low
hi52 = highest(high, 252)
lo52 = lowest(low, 252)
hline(hi52, "52W High", #22c55e)
hline(lo52, "52W Low",  #ef4444)

// Price change
delta = change(close, 1)
plot(delta, "Change", delta > 0 ? #22c55e : #ef4444, 2)
```

---

#### Crossover & Trend

| Function | Description |
|----------|-------------|
| `crossover(a, b)` | `true` on the bar where series `a` crossed above series `b` |
| `crossunder(a, b)` | `true` on the bar where series `a` crossed below series `b` |
| `rising(src, length)` | `true` if `src` has increased every bar for `length` consecutive bars |
| `falling(src, length)` | `true` if `src` has decreased every bar for `length` consecutive bars |

**Examples:**

```
fastMA = ema(close, 12)
slowMA = ema(close, 26)

bullish = crossover(fastMA, slowMA)
bearish = crossunder(fastMA, slowMA)

plotshape(bullish, "Buy",  "triangle_up",   "below", #22c55e, "small")
plotshape(bearish, "Sell", "triangle_down", "above", #ef4444, "small")

alertcondition(bullish, "EMA Cross Up",   "EMA 12 crossed above EMA 26")
alertcondition(bearish, "EMA Cross Down", "EMA 12 crossed below EMA 26")
```

---

#### Math Functions

| Function | Description |
|----------|-------------|
| `abs(x)` | Absolute value |
| `sqrt(x)` | Square root |
| `log(x)` | Natural logarithm |
| `log10(x)` | Base-10 logarithm |
| `round(x)` | Round to nearest integer |
| `ceil(x)` | Round up (ceiling) |
| `floor(x)` | Round down (floor) |
| `pow(x, y)` | `x` raised to the power of `y` |
| `max(a, b)` | Maximum of two numbers; or `max(array)` — maximum of all elements |
| `min(a, b)` | Minimum of two numbers; or `min(array)` — minimum of all elements |
| `clamp(x, lo, hi)` | Clamp `x` to the range `[lo, hi]` |

**Examples:**

```
// Log returns
logReturn = log(close / close[1])
plot(logReturn, "Log Return", #2196F3, 1)

// Normalize 0-1
hiN   = highest(close, 100)
loN   = lowest(close, 100)
norm  = (close - loN) / (hiN - loN)
plot(norm, "Normalized", #9C27B0, 2)

// Clamped RSI
safeRsi = clamp(rsi(close, 14), 0, 100)
```

---

#### Utility Functions

| Function | Description |
|----------|-------------|
| `na(value)` | Returns `true` if value is `NaN`, `null`, or non-finite |
| `nz(value, replacement=0)` | Returns `replacement` when value is `NaN` or `null` |
| `format(template, ...args)` | Interpolates `{}` placeholders with the provided arguments |
| `print(...args)` | Prints arguments to the browser console prefixed with `[OrbitScript]` |

**Examples:**

```
// Guard against NaN on early bars
rsiRaw = rsi(close, 14)
rsiSafe = nz(rsiRaw, 50)

// Check before plotting
if !na(rsiSafe)
    plot(rsiSafe, "RSI", #2196F3, 2)
end

// Formatted debug output
print(format!("bar {} close={} rsi={}", bar_index, close, rsiSafe))
```

---

#### Output Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `plot` | `plot(value, title?, color?, width?)` | Add a point to a line series |
| `hline` | `hline(price, title?, color?, style?)` | Draw a fixed horizontal level. `style`: `"solid"`, `"dashed"`, `"dotted"` |
| `bgcolor` | `bgcolor(color, condition?, opacity?)` | Fill the chart background when condition is true |
| `alertcondition` | `alertcondition(cond, title?, message?)` | Fire an alert when condition is true |
| `plotshape` | `plotshape(cond, title?, shape?, location?, color?, size?)` | Draw a shape on the chart |
| `plotarrow` | `plotarrow(value, title?, colorUp?, colorDn?)` | Draw up (positive) or down (negative) arrows |
| `plothistogram` | `plothistogram(value, title?, color?)` | Draw a histogram bar at the current bar |

**`plotshape` parameters:**

| Parameter | Values |
|-----------|--------|
| `shape` | `"circle"` `"triangle_up"` `"triangle_down"` `"square"` `"diamond"` `"cross"` `"x"` |
| `location` | `"above"` `"below"` `"on"` |
| `size` | `"tiny"` `"small"` `"normal"` `"large"` |

---

#### Colors

**Hex literals** — use directly in any color argument:

```
plot(close, "Close", #2196F3)
plot(close, "Close", #2196F380)  // with 50% alpha (last two hex digits)
```

**Named color constants:**

| Constant | Hex |
|----------|-----|
| `color.red` | `#ef4444` |
| `color.green` | `#22c55e` |
| `color.blue` | `#2196F3` |
| `color.white` | `#ffffff` |
| `color.black` | `#000000` |
| `color.gray` | `#6b7280` |
| `color.yellow` | `#eab308` |
| `color.orange` | `#f97316` |
| `color.purple` | `#a855f7` |
| `color.teal` | `#14b8a6` |
| `color.lime` | `#84cc16` |
| `color.pink` | `#ec4899` |
| `color.cyan` | `#06b6d4` |
| `color.indigo` | `#6366f1` |
| `color.amber` | `#f59e0b` |

---

### Complete Script Examples

#### Golden Cross / Death Cross

```
@indicator("Golden Cross", overlay=true)
@input("fast", number, 50)
@input("slow", number, 200)

fastMA = sma(close, fast)
slowMA = sma(close, slow)

plot(fastMA, "Fast SMA", #2196F3, 2)
plot(slowMA, "Slow SMA", #F44336, 2)

bullCross = crossover(fastMA, slowMA)
bearCross = crossunder(fastMA, slowMA)

plotshape(bullCross, "Golden Cross", "triangle_up",   "below", #22c55e, "normal")
plotshape(bearCross, "Death Cross",  "triangle_down", "above", #ef4444, "normal")

bgcolor(#22c55e10, fastMA > slowMA)
bgcolor(#ef444410, fastMA < slowMA)

alertcondition(bullCross, "Golden Cross", format!("SMA {} crossed above SMA {}", fast, slow))
alertcondition(bearCross, "Death Cross",  format!("SMA {} crossed below SMA {}", fast, slow))
```

---

#### RSI with Divergence Zones

```
@indicator("RSI Zones", overlay=false)
@input("length",      number, 14)
@input("overbought",  number, 70)
@input("oversold",    number, 30)
@input("extreme_ob",  number, 80)
@input("extreme_os",  number, 20)

rsiVal = rsi(close, length)

plot(rsiVal, "RSI", #2196F3, 2)

hline(overbought, "Overbought",  #ef4444, "dashed")
hline(oversold,   "Oversold",    #22c55e, "dashed")
hline(extreme_ob, "Extreme OB",  #ef4444, "solid")
hline(extreme_os, "Extreme OS",  #22c55e, "solid")
hline(50,         "Midline",     #9e9e9e, "dotted")

bgcolor(#ef444430, rsiVal > extreme_ob)
bgcolor(#ef444415, rsiVal > overbought && rsiVal <= extreme_ob)
bgcolor(#22c55e30, rsiVal < extreme_os)
bgcolor(#22c55e15, rsiVal < oversold   && rsiVal >= extreme_os)

alertcondition(rsiVal > overbought, "RSI Overbought", format!("RSI={} above {}", rsiVal, overbought))
alertcondition(rsiVal < oversold,   "RSI Oversold",   format!("RSI={} below {}", rsiVal, oversold))
```

---

#### MACD with Histogram Coloring

```
@indicator("MACD Advanced", overlay=false)
@input("fast",   number, 12)
@input("slow",   number, 26)
@input("signal", number, 9)

m = macd(close, fast, slow, signal)

plot(m.macd_line,   "MACD",   #2196F3, 2)
plot(m.signal_line, "Signal", #FF9800, 2)

histColor = m.histogram > 0 ? #22c55e : #ef4444
plothistogram(m.histogram, "Histogram", histColor)

crossedUp   = crossover(m.macd_line,  m.signal_line)
crossedDown = crossunder(m.macd_line, m.signal_line)

plotshape(crossedUp,   "Buy",  "triangle_up",   "below", #22c55e, "small")
plotshape(crossedDown, "Sell", "triangle_down", "above", #ef4444, "small")

hline(0, "Zero", #9e9e9e, "solid")
```

---

#### Bollinger Bands + Keltner Squeeze

```
@indicator("Squeeze Momentum", overlay=false)
@input("bb_len",   number, 20)
@input("bb_mult",  number, 2.0)
@input("kc_len",   number, 20)
@input("kc_mult",  number, 1.5)

bb = bollinger(close, bb_len, bb_mult)
kc = keltner(high, low, close, kc_len, kc_len, kc_mult)

squeezed = bb.upper < kc.upper && bb.lower > kc.lower

// Momentum: delta between linear regression and price
mom = change(close, 1)

momColor = mom > 0 ? (mom > change(close, 2) ? #22c55e : #84cc16)
                   : (mom < change(close, 2) ? #ef4444 : #f97316)

plothistogram(mom, "Momentum", momColor)

plotshape(!squeezed, "No Squeeze", "circle", "on", #2196F3, "tiny")
plotshape(squeezed,  "Squeeze",    "circle", "on", #ef4444, "tiny")

hline(0, "Zero", #9e9e9e, "dotted")
```

---

#### Ichimoku Cloud Full

```
@indicator("Ichimoku Cloud", overlay=true)
@input("tenkan",       number, 9)
@input("kijun",        number, 26)
@input("senkou_b_len", number, 52)
@input("displacement", number, 26)

cloud = ichimoku(high, low, close, tenkan, kijun, senkou_b_len, displacement)

plot(cloud.tenkan,   "Tenkan-sen",  #2196F3, 1)
plot(cloud.kijun,    "Kijun-sen",   #F44336, 2)
plot(cloud.senkou_a, "Senkou A",    #22c55e, 1)
plot(cloud.senkou_b, "Senkou B",    #ef4444, 1)
plot(cloud.chikou,   "Chikou Span", #9C27B0, 1)

bullishCloud = cloud.senkou_a > cloud.senkou_b
bgcolor(#22c55e08, bullishCloud)
bgcolor(#ef444408, !bullishCloud)

priceAboveCloud = close > cloud.senkou_a && close > cloud.senkou_b
priceBelowCloud = close < cloud.senkou_a && close < cloud.senkou_b

alertcondition(priceAboveCloud && crossover(cloud.tenkan, cloud.kijun),
    "Ichimoku Buy", "Price above cloud with Tenkan/Kijun bullish cross")
alertcondition(priceBelowCloud && crossunder(cloud.tenkan, cloud.kijun),
    "Ichimoku Sell", "Price below cloud with Tenkan/Kijun bearish cross")
```

---

#### Supertrend

```
@indicator("Supertrend", overlay=true)
@input("atr_len",  number, 10)
@input("factor",   number, 3.0)

atrVal = atr(high, low, close, atr_len)
hl2    = (high + low) / 2

upperBand = hl2 + factor * atrVal
lowerBand = hl2 - factor * atrVal

let mut trend     = 1
let mut supertrend = lowerBand

if close > supertrend
    trend = 1
else
    trend = -1
end

if trend == 1
    supertrend = lowerBand
    plot(supertrend, "Supertrend", #22c55e, 2)
else
    supertrend = upperBand
    plot(supertrend, "Supertrend", #ef4444, 2)
end

plotshape(crossover(close,  supertrend), "Buy",  "triangle_up",   "below", #22c55e, "small")
plotshape(crossunder(close, supertrend), "Sell", "triangle_down", "above", #ef4444, "small")
```

---

#### Volume Profile Oscillator

```
@indicator("Volume Profile Oscillator", overlay=false)
@input("length", number, 20)

bullVol = 0.0
bearVol = 0.0

let mut i = 0
while i < length
    if close[i] >= open[i]
        bullVol += volume[i]
    else
        bearVol += volume[i]
    end
    i += 1
end

totalVol = bullVol + bearVol
vpo = nz((bullVol - bearVol) / totalVol * 100, 0)

plot(vpo, "VPO", vpo > 0 ? #22c55e : #ef4444, 2)
hline(0,   "Zero",  #9e9e9e, "solid")
hline(20,  "Bull",  #22c55e, "dotted")
hline(-20, "Bear",  #ef4444, "dotted")
```

---

### OrbitScript API (TypeScript)

```typescript
import { OrbitScript } from 'orbityx-chart-pro/orbitscript';
```

#### `OrbitScript.compile(source, inputOverrides?)`

Parses and compiles a script. Returns a `CompiledScript` without registering anything.

```typescript
const compiled = OrbitScript.compile(source, { length: 21 });

compiled.meta.name;       // string — from @indicator("...")
compiled.meta.overlay;    // boolean
compiled.meta.inputs;     // InputDef[]
compiled.program;         // Program (AST) — reusable
compiled.computeFn;       // (candles: Candle[]) => IndicatorSeries | null
```

#### `OrbitScript.register(source, inputOverrides?)`

Compiles and registers the script as a live indicator. Returns a string `id` for later removal.

```typescript
const id = OrbitScript.register(source, { fast: 50, slow: 200 });
```

#### `OrbitScript.unregister(id)`

Removes the indicator and all its secondary plot series from the chart.

```typescript
OrbitScript.unregister(id);
```

---

### Performance Model

OrbitScript is designed to be used with thousands of candles without performance issues.

**Series caching:**

When a script calls `sma(close, 20)`, the interpreter:
1. Checks `seriesCache` for key `"sma:<fingerprint>:20"`
2. If found — returns the cached `number[]` and indexes `arr[barIndex]` — O(1)
3. If not found — computes the full array once for all bars — O(n), then caches it

The fingerprint is `length + first + middle + last` of the series array, separated by a non-printable byte. This gives collision resistance with O(1) computation.

**AST reuse:**

`compile()` parses the source once. The returned `program` (AST) is reused on every candle update. There is no re-parsing per bar.

**Environment:**

The `Environment` object reuses its `Map`s between bars. `setBar(i)` updates only the `barIndex` pointer — no allocations per bar.

**Memory:**

Cached series arrays are held for the lifetime of the indicator registration. `unregister()` removes all cached data.

---

## 📚 API Reference

### OrbityxChart class

The main entry point:

```typescript
class OrbityxChart {
  constructor(options?: { canvasId?: string; theme?: 'dark' | 'light' });

  // Fluent builder
  setProvider(provider: DataProvider): this;
  registerInstruments(instruments: Instrument[]): this;
  setDefaultTimeframe(tf: string): this;
  setDefaultInstrument(id: string): this;
  setWebSocketUrl(url: string): this;
  setTheme(theme: 'dark' | 'light'): this;
  setChartType(type: 'candlestick' | 'heikinashi' | 'line' | 'area' | 'bar'): this;

  // Lifecycle
  init(): Promise<void>;
  destroy(): void;

  // Indicators
  activateIndicator(id: string, options?: Record<string, unknown>): void;
  deactivateIndicator(id: string): void;
}
```

---

### ChartEngine class

Low-level canvas renderer. Accessible via `chart.engine`:

```typescript
class ChartEngine {
  viewport:    Viewport;
  state:       ChartState;

  requestDraw():   void;
  zoomToFit():     void;
  scrollToLatest(): void;
  setChartType(type: string): void;

  // Callbacks
  onNeedMoreData?: (oldestTimestamp: number) => void;
  onCrosshairMove?: (candle: Candle | null) => void;
}
```

---

### DataManager class

In-memory OHLCV cache with pub/sub:

```typescript
class DataManager {
  // Load candles (replaces cache for the active instrument/timeframe)
  setCandles(candles: Candle[]): void;

  // Prepend older history (lazy-load triggered by scroll)
  prependCandles(candles: Candle[]): void;

  // Apply a live tick (updates last candle or appends a new one)
  processLiveTick(tick: RawCandle): void;

  // Subscribe to candle updates
  subscribe(handler: (candles: Candle[]) => void): () => void;

  // Read current candles
  getCandles(): Candle[];

  // Attach a WebSocket — auto-routes messages to processLiveTick
  attachSocket(ws: WebSocket): () => void;
}
```

---

### ProviderRegistry class

IoC boundary that decouples the library from concrete data sources:

```typescript
class ProviderRegistry {
  setProvider(provider: DataProvider): void;

  fetchCandles(request: CandleRequest): Promise<Candle[]>;
  fetchMarketStats(instrumentId: string): Promise<Partial<MarketStats>>;
}
```

---

### WebSocketService class

Resilient WebSocket client:

```typescript
class WebSocketService {
  connect(url: string): void;
  disconnect(): void;
  send(message: unknown): void;

  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}
```

Features:
- Exponential back-off reconnect (1s → 2s → 4s … capped at 30s)
- Heartbeat ping every 30 seconds
- Queues messages sent while disconnected

---

## 📐 Types Reference

```typescript
// Core data types
interface Candle {
  timestamp: number;  // Unix epoch milliseconds
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

interface RawCandle {
  timestamp: number | string | Date;
  open:      number | string;
  high:      number | string;
  low:       number | string;
  close:     number | string;
  volume?:   number | string;
}

interface Instrument {
  id:              string;  // Unique key, passed to DataProvider
  symbol:          string;  // Short label, e.g. "BTC/USDT"
  name:            string;  // Full name, e.g. "Bitcoin"
  icon:            string;  // Badge character or emoji
  iconColor:       string;  // CSS color string
  pricePrecision?: number;  // Decimal places for price display
  meta?:           Record<string, unknown>; // Arbitrary user data
}

interface MarketStats {
  high24h:           number;
  low24h:            number;
  volume24h:         number;
  marketCap:         number | null;
  priceChange24h:    number;
  priceChangePct24h: number;
}

// Indicator types
interface IndicatorSeries {
  id:         IndicatorId;
  label:      string;
  color:      string;
  points:     IndicatorPoint[];
  isSubPanel: boolean;
}

interface IndicatorPoint {
  timestamp: number;
  value:     number;
}

interface IndicatorMeta {
  label:      string;
  color:      string;
  isSubPanel: boolean;
  group?:     string;
}

type IndicatorId = string & { readonly __brand: 'IndicatorId' };

// OrbitScript types
interface ScriptMeta {
  kind:    'indicator' | 'strategy';
  name:    string;
  overlay: boolean;
  inputs:  InputDef[];
}

interface InputDef {
  name:         string;
  type:         'number' | 'string' | 'bool';
  defaultValue: number | string | boolean;
}

interface CompiledScript {
  meta:      ScriptMeta;
  computeFn: (candles: Candle[]) => IndicatorSeries | null;
  program:   Program;
}
```

---

## 🔧 Utility Functions

### Math Utilities

```typescript
import {
  sma, ema, wma, dema, tema, hma, vwma,
  rsi, macd, stochastic, stochasticRSI, williamsR, cci, mfi, roc, momentum, awesomeOscillator,
  atr, adx, bollingerBands, keltnerChannels, donchianChannels, parabolicSAR, ichimoku,
  obv, vwap, adLine, cmf,
  isFiniteNumber,
} from 'orbityx-chart-pro/utils/math';

// Example
const closes  = candles.map(c => c.close);
const highs   = candles.map(c => c.high);
const lows    = candles.map(c => c.low);
const volumes = candles.map(c => c.volume);

const smaArr  = sma(closes, 20);     // number[]
const emaArr  = ema(closes, 12);     // number[]
const rsiArr  = rsi(closes, 14);     // number[]

const macdResult = macd(closes, 12, 26, 9);
// { macdLine: number[], signalLine: number[], histogram: number[] }

const bbResult = bollingerBands(closes, 20, 2.0);
// { upper: number[], middle: number[], lower: number[] }

const ichiResult = ichimoku(highs, lows, closes, 9, 26, 52, 26);
// { tenkan: number[], kijun: number[], senkouA: number[], senkouB: number[], chikou: number[] }
```

---

### Format Utilities

```typescript
import {
  formatPrice,
  formatPercent,
  formatVolume,
  formatCompact,
  formatTimestamp,
} from 'orbityx-chart-pro/utils/format';

formatPrice(42350.75, 2);       // "42,350.75"
formatPercent(3.14);            // "+3.14%"
formatPercent(-1.5);            // "-1.50%"
formatVolume(1_234_567);        // "1.23M"
formatCompact(1_500_000_000);   // "1.5B"
formatTimestamp(Date.now(), '1d'); // "26 Mar 2025"
formatTimestamp(Date.now(), '1h'); // "14:30"
```

---

## ⚙️ Configuration

### ChartConfig

```typescript
const chart = new OrbityxChart({
  canvasId: 'chartCanvas',  // ID of the <canvas> element (default: 'chartCanvas')
  theme:    'dark',         // 'dark' | 'light' (default: OS preference)
});
```

### Theme Colors

Override any theme variable via CSS:

```css
[data-theme="dark"] {
  --chart-bg:           #0f141b;
  --chart-grid:         #1e2937;
  --chart-text:         #94a3b8;
  --chart-axis:         #334155;
  --candle-bull:        #22c55e;
  --candle-bear:        #ef4444;
  --candle-bull-wick:   #22c55e;
  --candle-bear-wick:   #ef4444;
  --volume-bull:        rgba(34, 197, 94, 0.4);
  --volume-bear:        rgba(239, 68, 68, 0.4);
  --crosshair:          rgba(148, 163, 184, 0.5);
  --price-line:         #3b82f6;
  --price-line-label:   #1e293b;
  --toolbar-bg:         #0f141b;
  --toolbar-border:     #1e2937;
  --tooltip-bg:         rgba(15, 20, 27, 0.95);
  --legend-text:        #e2e8f0;
}

[data-theme="light"] {
  --chart-bg:           #ffffff;
  --chart-grid:         #f1f5f9;
  --chart-text:         #64748b;
  --candle-bull:        #16a34a;
  --candle-bear:        #dc2626;
}
```

---

## 🔬 Advanced Usage

### Custom Provider

```typescript
import type { DataProvider, CandleRequest, Candle, MarketStats } from 'orbityx-chart-pro';

class MyBrokerProvider implements DataProvider {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async init(): Promise<void> {
    // Verify token on startup
    const res = await fetch('https://broker.api/auth/verify', {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error('Invalid API token');
  }

  async fetchCandles(req: CandleRequest): Promise<Candle[]> {
    const url = new URL(`https://broker.api/ohlcv/${req.instrumentId}`);
    url.searchParams.set('interval', req.timeframe);
    url.searchParams.set('limit',    String(req.limit ?? 500));
    if (req.to) url.searchParams.set('before', String(req.to));

    const rows: any[] = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    }).then(r => r.json());

    return rows.map(r => ({
      timestamp: r.ts,
      open:  +r.o, high: +r.h, low: +r.l, close: +r.c, volume: +r.v,
    }));
  }

  async fetchMarketStats(id: string): Promise<Partial<MarketStats>> {
    const data: any = await fetch(`https://broker.api/ticker/${id}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    }).then(r => r.json());

    return {
      high24h:           data.high,
      low24h:            data.low,
      volume24h:         data.quoteVolume,
      priceChange24h:    data.change,
      priceChangePct24h: data.changePct,
    };
  }

  onInstrumentChange(id: string, tf: string): void {
    console.log(`Switching to ${id} @ ${tf}`);
  }

  destroy(): void {
    console.log('Provider cleanup');
  }
}
```

---

### Multiple Charts on One Page

```typescript
import OrbityxChart from 'orbityx-chart-pro';
import { BinanceProvider } from 'orbityx-chart-pro/providers/binance';

const instruments = [
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana',   icon: '◎', iconColor: '#9945ff' },
];

const provider = new BinanceProvider();

const charts = ['chartA', 'chartB', 'chartC'].map((canvasId, i) => {
  const c = new OrbityxChart({ canvasId });
  c.setProvider(provider)
   .registerInstruments(instruments)
   .setDefaultInstrument(instruments[i]!.id)
   .setDefaultTimeframe('1h');
  return c;
});

await Promise.all(charts.map(c => c.init()));
```

---

### Infinite Backwards Scroll

Lazy-loading is automatic when you implement `fetchCandles` to handle the `to` parameter:

```typescript
const myProvider: DataProvider = {
  async fetchCandles({ instrumentId, timeframe, to, limit }) {
    const url = new URL(`https://api.myexchange.com/klines`);
    url.searchParams.set('symbol',   instrumentId);
    url.searchParams.set('interval', timeframe);
    url.searchParams.set('limit',    String(limit ?? 500));

    // This is the key: when `to` is set, fetch history BEFORE that timestamp
    if (to !== undefined) {
      url.searchParams.set('endTime', String(to));
    }

    const data: any[] = await fetch(url).then(r => r.json());
    return data.map(r => ({
      timestamp: r[0],
      open:  +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5],
    }));
  },
};
```

When the user scrolls to the left edge of the chart, the library automatically calls `fetchCandles` with `to = oldest_candle_timestamp - 1`. If your provider returns data, it is prepended to the chart seamlessly.

---

### Custom WebSocket Integration

If your server sends a different WebSocket format than the built-in `WSMessage` envelope, bypass the built-in socket and call `DataManager` directly:

```typescript
import OrbityxChart, { dataManager } from 'orbityx-chart-pro';

const chart = new OrbityxChart();
// ... setup ...
await chart.init();

// Connect your own WebSocket
const ws = new WebSocket('wss://myexchange.com/stream/btcusdt');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  // Transform to the format DataManager expects
  if (msg.e === 'kline') {
    dataManager.processLiveTick({
      timestamp: msg.k.t,
      open:      +msg.k.o,
      high:      +msg.k.h,
      low:       +msg.k.l,
      close:     +msg.k.c,
      volume:    +msg.k.v,
    });
  }
};
```

---

### Registering a Custom Indicator Plugin

For TypeScript-level plugins (more control than OrbitScript):

```typescript
import { registerIndicator } from 'orbityx-chart-pro';
import type { Candle, IndicatorSeries } from 'orbityx-chart-pro';
import { sma } from 'orbityx-chart-pro/utils/math';

// A simple "price distance from SMA" oscillator
registerIndicator(
  'price_sma_distance',
  {
    label:      'Price / SMA Distance %',
    color:      '#9C27B0',
    isSubPanel: true,
    group:      'Custom',
  },
  (candles: Candle[], options: { period?: number } = {}): IndicatorSeries => {
    const period = options.period ?? 20;
    const closes = candles.map(c => c.close);
    const smaArr = sma(closes, period);

    return {
      id:         'price_sma_distance',
      label:      `Price/SMA(${period}) %`,
      color:      '#9C27B0',
      isSubPanel: true,
      points:     candles.map((c, i) => ({
        timestamp: c.timestamp,
        value:     smaArr[i] != null && !isNaN(smaArr[i]!)
          ? ((c.close - smaArr[i]!) / smaArr[i]!) * 100
          : NaN,
      })),
    };
  },
);

// Activate it on the chart
chart.activateIndicator('price_sma_distance', { period: 20 });
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Pan left / right |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Home` | Reset view (fit all candles) |
| `End` | Jump to latest bar |
| `Escape` | Cancel active drawing tool |
| `F` | Toggle fullscreen |

---

## 🌐 Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |
| Opera | 76+ |
| Mobile Chrome | 90+ |
| Mobile Safari | 14+ |

**Requirements:**
- HTML5 Canvas 2D API
- ES2020+ (modules, optional chaining, nullish coalescing)
- No polyfills required in supported browsers

---

## ⚡ Performance Notes

- **Canvas over DOM**: All chart elements are rendered to a single `<canvas>`, avoiding DOM layout and paint costs.
- **Dirty-flag rendering**: `requestDraw()` schedules a `requestAnimationFrame` only when state has changed. Hovering the crosshair triggers a redraw only when the hovered candle index changes.
- **Typed arrays for viewport math**: Coordinate transforms use direct numeric operations, not SVG or CSS transforms.
- **Indicator caching**: Each indicator is computed once per candle set update, not once per frame.
- **OrbitScript series cache**: `sma(close, 20)` is computed once for all bars, then indexed O(1) per bar. A unique fingerprint (based on array length + first/middle/last value) prevents collisions between different source series using the same function and period.
- **Efficient lazy history**: `prependCandles()` uses `Array.prototype.unshift()` on a pre-sorted array — no full re-sort on each page load.
- **Typical frame budget**: With 5,000 candles, 3 indicators, and live ticks, a full render takes < 2ms on modern hardware.

---

## 🤝 Contributing

Contributions are welcome. Please open an issue before submitting a large pull request.

```bash
git clone https://github.com/BorisMalts/Orbityx-charts.git
cd Orbityx-charts
npm install

# Start development server
npm run dev

# Run tests
npm test

# Watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Build
npm run build
```

### Commit conventions

```
feat: add Supertrend indicator to OrbitScript stdlib
fix: correct ADX +DI/-DI calculation for small periods
docs: add Ichimoku example to README
test: add crossover edge cases for single-bar series
refactor: extract series fingerprint into helpers
```

### Adding an OrbitScript stdlib function

1. Add the math implementation to `src/utils/math.ts`
2. Add the stdlib wrapper in the appropriate category file under `src/orbitscript/runtime/stdlib/`
3. Register the entry in `src/orbitscript/runtime/stdlib/index.ts`
4. Add tests in `src/orbitscript/orbitscript.test.ts`

### Reporting bugs

Open an issue at [github.com/BorisMalts/Orbityx-charts/issues](https://github.com/BorisMalts/Orbityx-charts/issues) with:
- Library version
- Browser and OS
- Minimal reproduction script or code snippet
- Expected vs actual behavior

---

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.

**Latest: v2.0.0** — OrbitScript scripting language, Heikin Ashi, replay controller, screenshot service, multi-chart layout, 318 tests, bug fixes.

---

## 📄 License

Apache-2.0 © [Boris Malts](https://github.com/BorisMalts)

See [LICENSE](./LICENSE) for the full license text.

---

## 👥 Authors

| Author | GitHub |
|--------|--------|
| Boris Maltsev | [@BorisMalts](https://github.com/BorisMalts) |
| Andrey Karavaev | [@Andre-wb](https://github.com/Andre-wb) |

---

<div align="center">

[⭐ Star on GitHub](https://github.com/BorisMalts/Orbityx-charts) · [🐛 Report a Bug](https://github.com/BorisMalts/Orbityx-charts/issues) · [💡 Request a Feature](https://github.com/BorisMalts/Orbityx-charts/issues)

</div>
