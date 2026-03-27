# Changelog

All notable changes to **Orbityx Chart Pro** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2025-03-26

### Added — OrbitScript DSL

A complete Pine Script-style scripting language embedded in the library. Users write `.os` files and call `OrbitScript.register(source)` to add custom indicators to any chart with no build step.

**Language features**

- Lexer, recursive-descent parser, and bar-by-bar interpreter
- Variables (`let`, `let mut`), assignments, compound assignments (`+=`, `-=`, `*=`, `/=`, `%=`)
- Control flow: `if / else / end`, `for … in range`, `while`, `loop`, `break`, `continue`, `return`
- Functions (`fn`), closures, default parameters, implicit last-expression return
- Structs (`struct`), enums (`enum`), method calls, field access
- Pattern matching (`match … end`) with literal, identifier, enum, tuple, wildcard, guard patterns
- History lookback: `close[1]`, `high[2]` — access previous bars
- Ranges: `0..5` (exclusive), `0..=5` (inclusive), usable in `for` loops and slice expressions
- String indexing: `s[0]` (char), `s[-1]` (last char), `s[1..3]` (slice), `s[1..=3]` (inclusive slice)
- Negative array indices: `arr[-1]` returns the last element
- Colors as first-class values: `#2196F3`, `#ef444420` (with alpha), named constants (`color.red` etc.)
- Script directives: `@indicator`, `@strategy`, `@input`
- Error reporting with line and column numbers

**Standard library — 60+ functions**

| Category | Functions |
|----------|-----------|
| Moving averages | `sma` `ema` `wma` `dema` `tema` `hma` `vwma` |
| Oscillators | `rsi` `macd` `stoch` `stoch_rsi` `williams_r` `cci` `mfi` `roc` `momentum` `awesome_oscillator` |
| Volatility | `atr` `adx` `bollinger` `keltner` `donchian` `parabolic_sar` `ichimoku` |
| Volume | `obv` `vwap` `ad_line` `cmf` |
| Statistics | `stdev` `highest` `lowest` `sum` `avg` `change` |
| Crossover | `crossover` `crossunder` `rising` `falling` |
| Math | `abs` `sqrt` `log` `log10` `round` `ceil` `floor` `pow` `max` `min` `clamp` |
| Output | `plot` `hline` `bgcolor` `alertcondition` `plotshape` `plotarrow` `plothistogram` |
| Utility | `na` `nz` `format` `print` |
| Color | `color.red` `color.green` `color.blue` … (15 named constants) |

**Macros**

Rust-style macros with `name!(…)` / `name![…]` syntax:
`println!` `format!` `assert!` `panic!` `dbg!` `todo!` `unreachable!` `vec![]`

**Compiler bridge**

- `OrbitScript.compile(source, inputs?)` — parse once, reuse AST on every candle update
- `OrbitScript.register(source, inputs?)` — compile and register as a native indicator, returns ID
- `OrbitScript.unregister(id)` — remove indicator and all its secondary series from the chart
- Secondary plots (second `plot()` call, `hline()`, `plothistogram()`) are auto-registered as sibling indicator series
- Series computation results are cached per fingerprint — `sma(close, 20)` and `sma(open, 20)` never collide

**Architecture**

Reorganised into 90+ single-responsibility files following SOLID principles:

```
src/orbitscript/
├── lang/          token, value, output, ast, meta, error
├── frontend/      lexer, parser (8 focused modules)
├── runtime/       scope, series, color, signal, output collectors,
│                  stdlib (11 category files), interpreter (9 modules),
│                  macro (8 built-in macros + registry)
└── compiler/      output-converter, index
```

**Tests**

318 tests covering lexer, parser, interpreter, all stdlib categories, string indexing, macros, and integration scenarios.

---

### Added — Chart engine improvements

- Heikin Ashi chart type
- Area and Bar chart types alongside existing Candlestick and Line
- Replay controller (`ReplayController`) for step-by-step historical playback
- Screenshot service (`ScreenshotService`) — export chart as PNG
- Multi-chart layout (`MultiChart`) — display several instruments simultaneously
- Viewport manager (`Viewport`) — extracted into standalone class with tests
- Alert manager (`AlertManager`) — fire and collect indicator alerts
- Drawing manager (`DrawingManager`) — trend lines, levels, fibonacci, rectangles, text

### Added — New export entry points

```json
"./orbitscript": "./dist/orbitscript/index.js"
```

### Fixed

- Series cache key collision: `sma(close, 20)` and `sma(open, 20)` previously shared the same cache entry — fixed by fingerprinting each series with `length + first + middle + last` values
- Secondary plot callbacks received an empty program instead of the original script AST
- Compound assignment errors reported `line 0, col 0` instead of the actual statement position
- Negative index in array write (`arr[-1] = x`) was not normalised like the read path
- `assert!` macro did not treat `NaN` and empty string as falsy, inconsistent with the rest of the language
- Dead code path in function call resolution that re-ran an already-failed STDLIB lookup

---

## [1.0.0] — 2024-05-01

### Added

- Canvas-based OHLCV chart renderer
- Candlestick and Line chart types
- Built-in technical indicators: SMA, EMA, WMA, DEMA, TEMA, HMA, VWMA, RSI, MACD, Stochastic, Williams %R, CCI, MFI, ROC, Momentum, Awesome Oscillator, ATR, ADX, Bollinger Bands, Keltner Channels, Donchian Channels, Parabolic SAR, Ichimoku, OBV, VWAP, A/D Line, CMF
- `DataProvider` interface — provider-agnostic data layer
- Built-in providers: Binance, CoinGecko, Generic REST, Mock
- Live WebSocket streaming with automatic reconnect
- Infinite backwards history scroll with lazy loading
- Toolbar UI with chart type selector, indicator panel, timeframe switcher
- Tooltip showing OHLCV values on hover
- Legend panel for active indicators
- `registerIndicator()` / `unregisterIndicator()` plugin API
- `registerInstrument()` symbol registry
- TypeScript-first with full type definitions
- Zero runtime dependencies
- Apache-2.0 license
