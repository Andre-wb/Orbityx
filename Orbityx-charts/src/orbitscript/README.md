<div align="center">

# OrbitScript

</div>

<div align="center">

![Orbityx Script](https://img.shields.io/badge/OrbitScript-Language-0f141b?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyAxOEw5IDEyTDEzIDE2TDIxIDYiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==&labelColor=1a2332)

**The scripting language for Orbityx Charts — write custom indicators, strategies, and alerts with Rust-inspired syntax.**

[![License](https://img.shields.io/badge/License-Apache_2.0-22c55e.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3b82f6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-22c55e.svg?style=flat-square)](../../package.json)

[**Quick Start**](#-quick-start) · [**Language Reference**](#-language-reference) · [**Built-in Functions**](#-built-in-functions) · [**Output Functions**](#-output-functions) · [**Full Examples**](#-full-examples) · [**API**](#-typescript-api)

</div>

---

## Table of Contents

- [What is OrbitScript?](#-what-is-orbitscript)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Language Reference](#-language-reference)
  - [Variables and Mutability](#variables-and-mutability)
  - [Data Types](#data-types)
  - [Type Annotations](#type-annotations)
  - [Arithmetic and Operators](#arithmetic-and-operators)
  - [Functions](#functions)
  - [Closures](#closures)
  - [Control Flow](#control-flow)
  - [Structs](#structs)
  - [Enums](#enums)
  - [Traits](#traits)
  - [Impl Blocks](#impl-blocks)
  - [Pattern Matching](#pattern-matching)
  - [Arrays and Array Methods](#arrays-and-array-methods)
  - [Strings and String Methods](#strings-and-string-methods)
  - [Ranges](#ranges)
  - [History References](#history-references-bar-lookback)
  - [Built-in Series Variables](#built-in-series-variables)
  - [Directives](#directives--indicator--strategy--input)
  - [Colors](#colors)
  - [Comments](#comments)
- [Built-in Functions](#-built-in-functions)
  - [Moving Averages](#moving-averages)
  - [Oscillators](#oscillators)
  - [Volatility](#volatility)
  - [Volume Indicators](#volume-indicators)
  - [Rolling Statistics](#rolling-statistics)
  - [Crossover and Trend](#crossover-and-trend)
  - [Math Functions](#math-functions)
  - [String Functions](#string-functions)
  - [Utility Functions](#utility-functions)
- [Output Functions](#-output-functions)
  - [plot()](#plot)
  - [hline()](#hline)
  - [bgcolor()](#bgcolor)
  - [alertcondition()](#alertcondition)
  - [plotshape()](#plotshape)
  - [plotarrow()](#plotarrow)
  - [plothistogram()](#plothistogram)
- [Full Examples](#-full-examples)
  - [Simple SMA](#1-simple-sma-overlay)
  - [RSI with Levels](#2-rsi-with-overbought--oversold-levels)
  - [MACD Panel](#3-macd-panel)
  - [Bollinger Bands](#4-bollinger-bands)
  - [Golden Cross Alert](#5-golden-cross-alert)
  - [Custom Momentum Score](#6-custom-momentum-score)
  - [Volume-Weighted Trend](#7-volume-weighted-trend)
  - [Multi-timeframe Structure](#8-multi-timeframe-structure)
  - [Position Tracker with Struct](#9-position-tracker-with-struct)
  - [Enum-Based Signal System](#10-enum-based-signal-system)
  - [Parabolic SAR](#11-parabolic-sar)
  - [Keltner Channel Squeeze](#12-keltner-channel-squeeze)
- [TypeScript API](#-typescript-api)
  - [compile()](#compile)
  - [register()](#register)
  - [unregister()](#unregister)
  - [OrbitScript namespace](#orbitscript-namespace)
  - [CompiledScript type](#compiledscript-type)
- [Error Handling](#-error-handling)
- [Execution Model](#-execution-model)
- [Performance](#-performance)
- [Comparison with Pine Script](#-comparison-with-pine-script)
- [Limitations & Roadmap](#-limitations--roadmap)
- [Contributing](#-contributing)

---

## 🔭 What is OrbitScript?

**OrbitScript** is a domain-specific scripting language built into Orbityx Charts. It gives you a way to write custom technical indicators, trading strategies, and alert conditions using a clean, expressive **Rust-inspired syntax** — without needing to touch the underlying TypeScript or canvas rendering code.

Think of it as TradingView's Pine Script, but for Orbityx — and with a richer type system, real structs, enums, pattern matching, closures, and traits.

```
OrbitScript Source Code
        │
        ▼
   ┌─────────┐     ┌─────────┐     ┌──────────────┐
   │  Lexer  │────▶│ Parser  │────▶│ Interpreter  │
   │ (tokens)│     │  (AST)  │     │ (bar-by-bar) │
   └─────────┘     └─────────┘     └──────┬───────┘
                                          │
                   ┌──────────┐           │ calls
                   │  StdLib  │◀──────────┤
                   │(sma, rsi)│           │
                   └──────────┘           │
                                          ▼
                                   ┌────────────┐
                                   │  Compiler  │──▶ registerIndicator()
                                   │  (bridge)  │──▶ IndicatorSeries
                                   └────────────┘
```

**Key characteristics:**

- **Rust-like syntax**: `let`, `fn`, `struct`, `enum`, `impl`, `trait`, `match`, `for`, `while`, `loop`, closures with `|params|`, the `->` return arrow, `::` path operator, `#[attribute]` directives
- **Bar-by-bar execution model**: the script runs once per candle. Variables accumulate history automatically
- **Series caching**: heavy computations like `sma(close, 20)` are computed once for all bars, then indexed O(1) per bar
- **Zero boilerplate**: just describe _what_ to plot — the framework handles registration and rendering
- **Type-safe bridge**: integrates directly with Orbityx's `registerIndicator()` — no glue code required

---

## 🚀 Quick Start

### 1. Inline script (no registration)

```typescript
import { compile } from 'orbityx-charts/orbitscript';

const script = compile(`
  #[indicator(name = "My SMA", overlay = true)]

  let ma = sma(close, 20);
  plot(ma, "SMA 20", #2196F3, 2);
`);

// script.computeFn is ready — pass it to any Candle[]
const series = script.computeFn(myCandles);
```

### 2. Register on a chart engine

```typescript
import { OrbitScript } from 'orbityx-charts/orbitscript';
import type { IndicatorId } from 'orbityx-charts';

// Register returns the indicator ID
const id = OrbitScript.register(`
  #[indicator(name = "RSI 14", overlay = false)]
  #[input(length, "i64", 14)]

  let rsi_val = rsi(close, length);
  plot(rsi_val, "RSI", #2196F3, 2);
  hline(70.0, "Overbought", #ef4444, "dashed");
  hline(30.0, "Oversold",   #22c55e, "dashed");
`);

// Activate it on your chart
engine.toggleIndicator(id as IndicatorId);

// Remove it later
OrbitScript.unregister(id);
engine.toggleIndicator(id as IndicatorId);
```

### 3. With user inputs (runtime overrides)

```typescript
const id = OrbitScript.register(
  `
  #[indicator(name = "Dual EMA", overlay = true)]
  #[input(fast, "i64", 9)]
  #[input(slow, "i64", 21)]

  let fast_ema = ema(close, fast);
  let slow_ema = ema(close, slow);

  plot(fast_ema, "Fast EMA", #22c55e, 2);
  plot(slow_ema, "Slow EMA", #ef4444, 2);
  alertcondition(crossover(fast_ema, slow_ema), "Bullish Cross", "Fast EMA crossed above Slow EMA");
`,
  { fast: 12, slow: 26 }, // override defaults
);
```

---

## 🏗️ Architecture

### Execution Model

OrbitScript uses a **bar-by-bar** execution model. When your script is executed against a dataset of N candles, the interpreter:

1. Parses the script **once** into an AST
2. Registers all `fn`, `struct`, `enum`, `trait`, `impl` declarations into a runtime environment
3. Extracts metadata from `#[indicator]`, `#[strategy]`, and `#[input]` directives
4. Loops through every candle from index `0` to `N-1`:
   - Sets `bar_index`, `open`, `high`, `low`, `close`, `volume`, `timestamp` for the current bar
   - Executes all top-level statements in your script body
   - Accumulates `plot()`, `hline()`, `bgcolor()`, etc. outputs
5. Returns the accumulated outputs as `IndicatorSeries`

```
Candle[0]  → execute body → record plot point 0
Candle[1]  → execute body → record plot point 1
Candle[2]  → execute body → record plot point 2
   ...
Candle[N]  → execute body → record plot point N
```

### Series Caching

Series functions like `sma(close, 20)` are **cached by key** on the first call, so the full array is computed once for all N bars in O(n) time. Subsequent bar iterations access the pre-built array at `array[barIndex]` in O(1):

```
sma(close, 20) → cache key "sma:20"
  ├── Bar 0: cache miss → compute all N values → store → return values[0]
  ├── Bar 1: cache hit → return values[1]
  ├── Bar 2: cache hit → return values[2]
  └── Bar N: cache hit → return values[N]
```

This makes even complex scripts with multiple indicator calls run efficiently.

### File Structure

```
src/orbitscript/
├── types.ts          Token types, runtime value system, error classes
├── ast.ts            Abstract Syntax Tree node definitions
├── lexer.ts          Tokenizer: source code → Token[]
├── parser.ts         Recursive-descent parser: Token[] → Program AST
├── environment.ts    Runtime scope, series history, output collectors
├── stdlib.ts         All built-in functions (sma, ema, rsi, plot, ...)
├── interpreter.ts    Bar-by-bar AST executor
├── compiler.ts       Bridge to Orbityx registerIndicator() API
├── index.ts          Public re-exports
└── README.md         This file
```

---

## 📖 Language Reference

### Variables and Mutability

OrbitScript follows Rust's ownership philosophy: variables are **immutable by default**. Use `mut` to allow reassignment.

```rust
// Immutable — cannot be reassigned
let length = 14;
let name = "My Indicator";
let threshold = 70.0;

// Mutable — can be updated with assignment operators
let mut counter = 0;
let mut sum = 0.0;
let mut signal = "none";

// Assign new values
counter += 1;
sum += close;
signal = "buy";

// Compound assignment operators
counter += 5;   // add
counter -= 2;   // subtract
counter *= 3;   // multiply
counter /= 4;   // divide
counter %= 7;   // modulo
```

> **Note:** Attempting to reassign an immutable variable is a runtime error.

---

### Data Types

OrbitScript has a rich set of primitive and composite types:

| Type      | Description                           | Example                         |
|-----------|---------------------------------------|---------------------------------|
| `f64`     | 64-bit floating-point number           | `3.14`, `-0.5`, `1e6`           |
| `i64`     | 64-bit integer (rounds internally)    | `14`, `200`, `-1`               |
| `bool`    | Boolean value                         | `true`, `false`                 |
| `str`     | UTF-8 string                          | `"RSI"`, `"hello\nworld"`       |
| `color`   | Hex color (6 or 8 digits)             | `#2196F3`, `#FF000080`          |
| `[T]`     | Homogeneous array                     | `[1.0, 2.0, 3.0]`               |
| `(T, U)`  | Tuple                                 | `(42.0, "BTC")`                 |
| `Option<T>` | Optional value                      | `Some(42.0)` or `None`          |

```rust
// Numbers
let price: f64  = 45230.50;
let period: i64 = 14;

// Booleans
let is_bull: bool = close > open;
let is_green = close > open;          // type inferred

// Strings
let label: str = "Signal";
let msg = format("Price: {}", close); // string interpolation

// Colors (must be exactly 6 or 8 hex digits)
let green: color = #22c55e;
let red_50pct    = #ef444480;         // with 50% alpha

// Arrays
let levels: [f64] = [70.0, 50.0, 30.0];
let empty: [f64]  = [];

// Tuples
let pair: (str, f64) = ("close", close);

// Options
let maybe: Option<f64> = if close > 50000.0 { Some(close) } else { None };
```

---

### Type Annotations

Type annotations are optional but recommended for clarity. They are written after the variable name with a colon:

```rust
let x: f64 = 1.0;
let arr: [f64] = [1.0, 2.0, 3.0];

fn my_fn(period: i64, source: f64) -> f64 {
    sma(source, period)
}
```

In function parameters, the supported type keywords are:
`f64`, `i64`, `bool`, `str`, `color`, `series`, `void`, `Option<T>`, `Result<T, E>`, `[T]`

---

### Arithmetic and Operators

#### Arithmetic

```rust
let a = 10.0 + 3.0;    // 13.0
let b = 10.0 - 3.0;    // 7.0
let c = 10.0 * 3.0;    // 30.0
let d = 10.0 / 3.0;    // 3.333...
let e = 10.0 % 3.0;    // 1.0  (modulo)
let f = 2.0 ** 8.0;    // 256.0 (power — right-associative)
let g = -close;        // unary negation
```

#### Comparison

```rust
close > open          // greater than
close < open          // less than
close >= high         // greater than or equal
close <= low          // less than or equal
close == open         // equal
close != open         // not equal
```

#### Logical

```rust
a && b    // logical AND (short-circuit)
a || b    // logical OR  (short-circuit)
!a        // logical NOT
```

#### Operator Precedence (high → low)

| Level | Operators              | Associativity |
|-------|------------------------|---------------|
| 8     | `**` (power)           | Right         |
| 7     | `*` `/` `%`            | Left          |
| 6     | `+` `-`                | Left          |
| 5     | `..` `..=` (ranges)    | Non-assoc     |
| 4     | `<` `>` `<=` `>=`      | Left          |
| 3     | `==` `!=`              | Left          |
| 2     | `&&`                   | Left          |
| 1     | `\|\|`                 | Left          |

---

### Functions

Functions are declared with `fn`, use `->` for the return type, and support Rust-style **implicit return** (last expression is the return value — no `return` keyword needed):

```rust
// Explicit return type, implicit return
fn spread(high: f64, low: f64) -> f64 {
    high - low
}

// Multiple parameters with explicit return
fn normalize(value: f64, min: f64, max: f64) -> f64 {
    (value - min) / (max - min)
}

// Void function (no return type annotation)
fn log_signal(label: str, value: f64) {
    print("[{}] {}", label, value);
}

// Explicit return keyword (useful for early exit)
fn safe_divide(a: f64, b: f64) -> f64 {
    if b == 0.0 { return 0.0; }
    a / b
}

// Recursive function
fn factorial(n: f64) -> f64 {
    if n <= 1.0 { 1.0 } else { n * factorial(n - 1.0) }
}

// Default parameter values
fn my_ema(source: f64, period: i64 = 14) -> f64 {
    ema(source, period)
}

// Calling functions
let result = spread(high, low);
let norm   = normalize(rsi_val, 0.0, 100.0);
```

> **Implicit return**: the last expression in a function body (without a semicolon) is automatically the return value, exactly like Rust. Both styles work:
> ```rust
> fn double(x: f64) -> f64 { x * 2.0 }     // implicit
> fn double(x: f64) -> f64 { return x * 2.0; } // explicit
> ```

---

### Closures

Closures are anonymous functions that capture their environment. They use the `|params|` syntax:

```rust
// Inline closure, single expression body
let double  = |x| x * 2.0;
let negate  = |x| -x;
let is_bull = |o, c| c > o;

// Multi-line closure with block body
let calc_range = |h, l| {
    let spread = h - l;
    spread / l * 100.0
};

// Typed parameters
let clamp_val = |v: f64, lo: f64, hi: f64| -> f64 {
    if v < lo { lo } else if v > hi { hi } else { v }
};

// Calling closures like functions
let result = double(close);
let bull   = is_bull(open, close);

// Using closures with array methods
let prices  = [100.0, 200.0, 150.0, 175.0];
let doubled = prices.map(|p| p * 2.0);
let highs   = prices.filter(|p| p > 150.0);
let total   = prices.reduce(|acc, p| acc + p, 0.0);
```

---

### Control Flow

#### if / else

`if` is an **expression** in OrbitScript — it returns a value, just like in Rust:

```rust
// As an expression (returns a value)
let signal = if rsi_val > 70.0 { "overbought" } else { "oversold" };
let color  = if close > open { #22c55e } else { #ef4444 };

// Multi-branch
let label = if rsi_val > 70.0 {
    "OB"
} else if rsi_val < 30.0 {
    "OS"
} else {
    "Neutral"
};

// As a statement (no value needed)
if crossover(close, sma_val) {
    alertcondition(true, "Buy", "Price crossed above SMA");
}

// With complex conditions
if (close > open) && (volume > 1000000.0) {
    plotshape(true, "Volume Spike", "triangle", "above", #f59e0b, "small");
}
```

> **Important:** When the condition ends with an identifier followed by `{`, wrap it in parentheses to disambiguate from a struct initializer:
> ```rust
> // Ambiguous — parser may treat "trend {" as struct init
> if trend { ... }
>
> // Always safe — wrap in parens
> if (trend) { ... }
> if (trend == true) { ... }
> ```

#### match

Pattern matching with `match` — fully exhaustive, supports guards, enum bindings, wildcard:

```rust
// Literal patterns
let description = match rsi_val {
    90.0 => "Extreme OB",
    70.0 => "Overbought",
    30.0 => "Oversold",
    10.0 => "Extreme OS",
    _    => "Neutral",
};

// Enum variant patterns
enum Signal { Buy, Sell, Hold }
let sig = Signal::Buy;
let action = match (sig) {
    Signal::Buy  => "Going Long",
    Signal::Sell => "Going Short",
    Signal::Hold => "Waiting",
};

// Enum with data bindings
enum OrderType { Market, Limit(f64), StopLoss(f64, f64) }
let order = OrderType::Limit(45500.0);
match (order) {
    OrderType::Market             => execute_at_market(),
    OrderType::Limit(price)       => execute_limit(price),
    OrderType::StopLoss(sl, tp)   => set_stop_and_target(sl, tp),
}

// Guard patterns (if conditions)
let category = match (rsi_val) {
    x if x > 80.0 => "Extreme OB",
    x if x > 70.0 => "Overbought",
    x if x < 20.0 => "Extreme OS",
    x if x < 30.0 => "Oversold",
    _              => "Neutral",
};

// Wildcard (matches anything)
let msg = match (trend) {
    "up"   => "Bullish",
    "down" => "Bearish",
    _      => "Unknown",
};
```

#### for loops

```rust
// Range-based for loop (exclusive end)
for i in 0..10 {
    let val = close[i];
}

// Inclusive range
for i in 1..=10 {
    sum += i;
}

// Iterating an array
let prices = [100.0, 200.0, 150.0];
for price in prices {
    total += price;
}

// With break and continue
for i in 0..100 {
    if i == 50 { break; }
    if i % 2 == 0 { continue; }
    odd_sum += i;
}
```

#### while loops

```rust
let mut n = 0;
let mut acc = 0.0;
while n < 10 {
    acc += n;
    n += 1;
}

// With complex condition
while (close > sma_val) && (rsi_val < 70.0) {
    // loop body
    break; // manual exit
}
```

#### loop (infinite with break)

```rust
let mut attempts = 0;
loop {
    attempts += 1;
    if attempts >= 100 { break; }
    // do something
}

// loop returns the value from break (future)
// Currently break does not carry a value
```

---

### Structs

Structs are named composite types — group related values together:

```rust
// Define a struct
struct Signal {
    direction: str,
    strength:  f64,
    price:     f64,
}

// Create an instance
let sig = Signal {
    direction: "long",
    strength:  0.85,
    price:     close,
};

// Access fields
let dir   = sig.direction;
let power = sig.strength;

// Nested structs
struct Range {
    high: f64,
    low:  f64,
}

struct Candle {
    body: Range,
    wick: Range,
}

let candle = Candle {
    body: Range { high: close, low: open },
    wick: Range { high: high,  low: low  },
};

let body_size = candle.body.high - candle.body.low;
```

---

### Enums

Enums define a type that is one of several named variants. Variants can optionally carry data:

```rust
// Simple enum (unit variants)
enum Trend {
    Up,
    Down,
    Sideways,
}

// Enum with associated data
enum OrderType {
    Market,
    Limit(f64),
    StopLoss(f64, f64),
}

// Enum with struct-like data
enum IndicatorState {
    Ready,
    Warmup(i64),  // bars remaining
    Error,
}

// Creating enum values
let trend = Trend::Up;
let order = OrderType::Limit(45500.0);
let state = IndicatorState::Warmup(14);

// Using in match
let trend_label = match (trend) {
    Trend::Up       => "↑ Bullish",
    Trend::Down     => "↓ Bearish",
    Trend::Sideways => "→ Neutral",
};
```

---

### Traits

Traits define shared behavior that structs can implement:

```rust
// Define a trait
trait Indicator {
    fn name(&self) -> str;
    fn compute(&self, period: i64) -> f64;
    fn is_overlay(&self) -> bool { true }  // default implementation
}

// Implement for a struct
struct MomentumIndicator {
    period: i64,
    source: f64,
}

impl Indicator for MomentumIndicator {
    fn name(&self) -> str { "Momentum" }

    fn compute(&self, period: i64) -> f64 {
        let current  = close;
        let previous = close[period];
        current - previous
    }
}
```

---

### Impl Blocks

Add methods to any struct using `impl`. Methods receive `&self` to access the instance:

```rust
struct Position {
    entry_price: f64,
    size:        f64,
    is_long:     bool,
}

impl Position {
    // Constructor-style static method
    fn new(price: f64, size: f64, long: bool) -> Position {
        Position {
            entry_price: price,
            size:        size,
            is_long:     long,
        }
    }

    // Instance method — reads self
    fn pnl(&self, current_price: f64) -> f64 {
        if self.is_long {
            (current_price - self.entry_price) * self.size
        } else {
            (self.entry_price - current_price) * self.size
        }
    }

    fn is_profitable(&self, current_price: f64) -> bool {
        self.pnl(current_price) > 0.0
    }

    fn risk_reward(&self, stop: f64, target: f64) -> f64 {
        let risk   = abs(self.entry_price - stop);
        let reward = abs(target - self.entry_price);
        if risk == 0.0 { return 0.0; }
        reward / risk
    }
}

// Usage
let pos    = Position::new(close, 1.0, true);
let profit = pos.pnl(close + 1000.0);
let rr     = pos.risk_reward(close - 500.0, close + 1500.0);
```

---

### Pattern Matching

OrbitScript supports rich pattern matching inside `match` expressions:

```rust
// Literal pattern
match value {
    0.0  => "zero",
    1.0  => "one",
    _    => "other",
}

// Identifier pattern (binds the value)
match rsi_val {
    x if x > 70.0 => format("OB: {}", x),
    x if x < 30.0 => format("OS: {}", x),
    x              => format("Neutral: {}", x),
}

// Enum pattern without data
match trend {
    Trend::Up       => 1.0,
    Trend::Down     => -1.0,
    Trend::Sideways => 0.0,
}

// Enum pattern with data bindings
match order {
    Order::Limit(price)       => price,
    Order::StopLoss(sl, _tp)  => sl,
    _                         => 0.0,
}

// Option patterns
match maybe_value {
    Some(v) => v * 2.0,
    None    => 0.0,
}

// Boolean patterns
match is_bull {
    true  => #22c55e,
    false => #ef4444,
}

// Wildcard (always matches, must be last)
match anything {
    _ => "default",
}
```

---

### Arrays and Array Methods

Arrays hold sequences of values of a single type:

```rust
// Creating arrays
let levels  = [70.0, 50.0, 30.0];
let empty: [f64] = [];
let prices  = [100.0, 105.0, 102.0, 110.0, 108.0];

// Index access (zero-based)
let first  = prices[0];
let second = prices[1];

// Array methods — called with dot notation
prices.len()                       // number of elements → 5
prices.is_empty()                  // true if length is 0
prices.first()                     // first element
prices.last()                      // last element
prices.get(2)                      // element at index 2
prices.contains(105.0)             // membership test
prices.max()                       // maximum value
prices.min()                       // minimum value
prices.sum()                       // sum of all elements
prices.avg()                       // arithmetic mean
prices.reverse()                   // reverse order (new array)
prices.sort()                      // ascending sort (new array)
prices.slice(1, 3)                 // subarray [index 1, 3)

// Mutable methods (modify in-place)
let mut arr = [1.0, 2.0, 3.0];
arr.push(4.0);                     // append element
let last = arr.pop();              // remove and return last element

// Higher-order methods (closures)
let doubled  = prices.map(|p| p * 2.0);
let highs    = prices.filter(|p| p > 105.0);
let total    = prices.reduce(|acc, p| acc + p, 0.0);

// Chaining
let result = prices
    .filter(|p| p > 100.0)
    .map(|p| (p - 100.0) / 100.0 * 100.0);  // % above 100
```

---

### Strings and String Methods

```rust
// String literals
let s = "Hello, OrbitScript!";
let s2 = "Line 1\nLine 2";       // escape: \n \t \r \" \\

// String methods
s.len()                          // length in characters
s.is_empty()                     // true if empty
s.contains("OrbitScript")        // substring test → true
s.starts_with("Hello")           // prefix test → true
s.ends_with("!")                 // suffix test → true
s.to_upper()                     // "HELLO, ORBITSCRIPT!"
s.to_lower()                     // "hello, orbitscript!"
s.trim()                         // remove leading/trailing whitespace
s.split(", ")                    // split into array of strings
s.replace("Hello", "Hi")        // replace first occurrence

// String formatting with format()
let msg = format("RSI: {}, Close: {}", rsi_val, close);
let lbl = format("Bar {} of {}", bar_index, 500);
```

---

### Ranges

Ranges produce sequences of integers for use in `for` loops:

```rust
// Exclusive range (0, 1, 2, ..., 9)
for i in 0..10 { }

// Inclusive range (1, 2, 3, ..., 10)
for i in 1..=10 { }

// Variable bounds
for i in 0..length { }
for i in start..end { }
```

---

### History References (Bar Lookback)

One of OrbitScript's most powerful features is accessing **previous bar values** with the `[]` operator on series variables:

```rust
// close[0] is the current bar — equivalent to just `close`
// close[1] is one bar ago (previous bar)
// close[n] is n bars ago

let prev_close = close[1];
let two_bars_ago = close[2];
let week_ago = close[5];   // 5 bars back on daily chart

// Works on any series variable you define
let ema_val = ema(close, 20);
let prev_ema = ema_val[1];   // EMA from the previous bar

// Useful for change detection
let price_change = close - close[1];
let ema_slope    = ema_val - ema_val[1];

// Crossover implemented manually using history
let crossed_above = (close[1] < sma_val[1]) && (close > sma_val);
```

> **Note:** Accessing history before bar 0 (e.g., `close[1]` on bar 0) returns `NaN`. Use `na()` to check for this:
> ```rust
> if na(close[1]) {
>     // not enough data yet
> }
> ```

---

### Built-in Series Variables

These variables are automatically available every bar:

| Variable     | Type    | Description                                    |
|--------------|---------|------------------------------------------------|
| `open`       | `f64`   | Opening price of the current bar               |
| `high`       | `f64`   | Highest price of the current bar               |
| `low`        | `f64`   | Lowest price of the current bar                |
| `close`      | `f64`   | Closing price of the current bar               |
| `volume`     | `f64`   | Trade volume of the current bar                |
| `bar_index`  | `f64`   | Zero-based index of the current bar (0, 1, 2…) |
| `timestamp`  | `f64`   | Unix timestamp in milliseconds                 |

All of these support history access: `open[1]`, `high[5]`, `volume[3]`, etc.

```rust
// Bar characteristics
let body     = abs(close - open);
let upper_wk = high - if close > open { close } else { open };
let lower_wk = (if close > open { open } else { close }) - low;
let is_doji  = body < (high - low) * 0.1;

// Volume analysis
let avg_vol    = sma(volume, 20);
let vol_spike  = volume > avg_vol * 2.0;

// Bar progression
let is_last    = bar_index == 499.0;   // if loading 500 bars
let progress   = bar_index / 500.0;
```

---

### Directives (`#[indicator]`, `#[strategy]`, `#[input]`)

Directives configure your script's metadata and declare user inputs. They must appear at the **top of the script**, before any executable code:

#### `#[indicator]`

```rust
#[indicator(name = "My Indicator", overlay = false)]
```

| Argument  | Type   | Default       | Description                                       |
|-----------|--------|---------------|---------------------------------------------------|
| `name`    | `str`  | `"Custom Script"` | Display name in the legend and indicator list |
| `overlay` | `bool` | `false`       | `true` = draws on price chart, `false` = sub-panel |

#### `#[strategy]`

```rust
#[strategy(name = "My Strategy")]
```

Marks the script as a strategy (future: backtesting integration). Takes the same arguments as `#[indicator]`.

#### `#[input]`

Declares a user-configurable parameter. The positional form is: `(name, type, default)`:

```rust
#[input(length, "i64", 14)]          // integer input, default 14
#[input(mult,   "f64", 2.0)]         // float input, default 2.0
#[input(source, "str", "close")]     // string input
#[input(show,   "bool", true)]       // boolean input
```

Or the named form:

```rust
#[input(name = "length", type = "i64", default = 14)]
#[input(name = "mult",   type = "f64", default = 2.0, min = 0.1, max = 5.0)]
```

**Complete directive example:**

```rust
#[indicator(name = "Bollinger Bands", overlay = true)]
#[input(length, "i64", 20)]
#[input(mult,   "f64", 2.0)]

let bb = bollinger(close, length, mult);
plot(bb.upper,  "Upper BB", #2196F3, 1);
plot(bb.middle, "Middle",   #9e9e9e, 1);
plot(bb.lower,  "Lower BB", #2196F3, 1);
```

---

### Colors

Colors are written as hex literals with a `#` prefix, followed by exactly **6 or 8 hex digits**:

```rust
// 6-digit RGB
let red     = #ef4444;
let green   = #22c55e;
let blue    = #2196F3;
let white   = #ffffff;
let black   = #000000;
let orange  = #f97316;
let purple  = #8b5cf6;
let yellow  = #eab308;
let cyan    = #06b6d4;
let pink    = #ec4899;
let gray    = #6b7280;

// 8-digit RGBA (last 2 digits = alpha: 00=transparent, FF=opaque)
let semi_red   = #ef444480;    // 50% opacity red
let quarter_bl = #2196F340;    // 25% opacity blue
let full_green = #22c55eff;    // fully opaque

// Using colors in plot()
plot(close, "Close", #2196F3, 2);

// Conditional color
let bar_color = if close > open { #22c55e } else { #ef4444 };
```

**Built-in color constants** (accessed as path expressions):

```rust
let c = Color::red;
let c = Color::green;
let c = Color::blue;
let c = Color::yellow;
let c = Color::orange;
let c = Color::purple;
let c = Color::cyan;
let c = Color::pink;
let c = Color::white;
let c = Color::black;
let c = Color::gray;
let c = Color::lime;
let c = Color::teal;
let c = Color::indigo;
```

---

### Comments

```rust
// Single-line comment — everything after // is ignored

/* Multi-line comment
   spans multiple lines
   very useful for explanations */

let x = 1.0; // inline comment after code
```

---

## 📐 Built-in Functions

### Moving Averages

All moving average functions take a **series** source (typically `close`) and a **period** (integer). They return the value for the current bar.

---

#### `sma(source, length)` — Simple Moving Average

Arithmetic mean of the last `length` bars.

```rust
let ma = sma(close, 20);
let vol_ma = sma(volume, 10);
```

Returns `NaN` for bars before `length - 1`.

---

#### `ema(source, length)` — Exponential Moving Average

Gives more weight to recent prices. The smoothing factor α = 2/(length+1).

```rust
let fast_ema = ema(close, 12);
let slow_ema = ema(close, 26);
```

---

#### `wma(source, length)` — Weighted Moving Average

Linear weighting — the most recent bar has the highest weight.

```rust
let wma20 = wma(close, 20);
```

---

#### `ema(source, length)` — Double EMA (DEMA)

Reduces EMA lag by subtracting a second EMA from 2× the first EMA.

```rust
let dema = dema(close, 14);
```

---

#### `tema(source, length)` — Triple EMA

Even less lag than DEMA: 3×EMA - 3×EMA(EMA) + EMA(EMA(EMA)).

```rust
let tema14 = tema(close, 14);
```

---

#### `hma(source, length)` — Hull Moving Average

Very smooth and fast-responding MA: WMA(2×WMA(n/2) - WMA(n), sqrt(n)).

```rust
let hull = hma(close, 20);
```

---

#### `vwma(source, length)` — Volume-Weighted Moving Average

Weights each price by volume traded.

```rust
let vwma20 = vwma(close, 20);
```

---

### Oscillators

#### `rsi(source, length)` — Relative Strength Index

Returns a value in [0, 100]. Above 70 = overbought, below 30 = oversold.

```rust
let rsi_val = rsi(close, 14);
let is_ob   = rsi_val > 70.0;
let is_os   = rsi_val < 30.0;
```

---

#### `macd(source, fast, slow, signal)` — MACD

Returns a **struct** with three fields:

```rust
let m = macd(close, 12, 26, 9);

// Access the fields
let macd_line  = m.macd_line;    // MACD line (fast EMA - slow EMA)
let sig_line   = m.signal_line;  // Signal line (EMA of MACD line)
let histogram  = m.histogram;   // Histogram (MACD - Signal)

plot(m.macd_line,   "MACD",   #2196F3, 2);
plot(m.signal_line, "Signal", #ef4444, 1);
plot(m.histogram,   "Hist",   #22c55e, 1);
```

---

#### `stoch(high, low, close, k_length, d_length, smooth)` — Stochastic Oscillator

```rust
let s = stoch(high, low, close, 14, 3, 3);
let k = s.k;    // %K line
let d = s.d;    // %D line
```

---

#### `stoch_rsi(source, rsi_len, k_len, d_len)` — Stochastic RSI

```rust
let sr = stoch_rsi(close, 14, 3, 3);
let k  = sr.k;
let d  = sr.d;
```

---

#### `williams_r(high, low, close, length)` — Williams %R

Returns a value in [-100, 0]. Near 0 = overbought, near -100 = oversold.

```rust
let wr = williams_r(high, low, close, 14);
```

---

#### `cci(high, low, close, length)` — Commodity Channel Index

```rust
let cci_val = cci(high, low, close, 20);
```

---

#### `mfi(high, low, close, volume, length)` — Money Flow Index

Volume-weighted RSI. Range [0, 100].

```rust
let mfi_val = mfi(high, low, close, volume, 14);
```

---

#### `roc(source, length)` — Rate of Change

Percentage change over `length` bars.

```rust
let roc_val = roc(close, 10);
```

---

#### `momentum(source, length)` — Momentum

Absolute change over `length` bars. `close - close[length]`.

```rust
let mom = momentum(close, 10);
```

---

#### `awesome_oscillator()` — Awesome Oscillator

Midpoint-price difference of 5-bar SMA and 34-bar SMA.

```rust
let ao = awesome_oscillator(high, low);
```

---

### Volatility

#### `atr(high, low, close, length)` — Average True Range

Measures volatility. Higher ATR = more volatile.

```rust
let atr_val  = atr(high, low, close, 14);
let stop_loss = close - atr_val * 2.0;
let take_prof = close + atr_val * 3.0;
```

---

#### `adx(high, low, close, length)` — Average Directional Index

Returns a struct with trend strength and direction:

```rust
let dx       = adx(high, low, close, 14);
let strength = dx.adx;   // 0-100, above 25 = strong trend
let bull     = dx.plus;  // +DI (bullish pressure)
let bear     = dx.minus; // -DI (bearish pressure)
```

---

#### `bollinger(source, length, mult)` — Bollinger Bands

Returns a struct with upper, middle, lower bands and bandwidth/squeeze metrics:

```rust
let bb = bollinger(close, 20, 2.0);

let upper   = bb.upper;
let middle  = bb.middle;
let lower   = bb.lower;
let bw      = bb.bandwidth;   // (upper - lower) / middle
let pct_b   = bb.percent_b;   // position within bands (0-1)
```

---

#### `keltner(source, high, low, close, ema_len, atr_len, mult)` — Keltner Channels

```rust
let kc = keltner(close, high, low, close, 20, 10, 1.5);

let upper  = kc.upper;
let middle = kc.middle;
let lower  = kc.lower;
```

---

#### `donchian(high, low, length)` — Donchian Channels

```rust
let dc = donchian(high, low, 20);

let upper  = dc.upper;
let middle = dc.middle;
let lower  = dc.lower;
```

---

#### `parabolic_sar(high, low, step, max_step)` — Parabolic SAR

```rust
let psar = parabolic_sar(high, low, 0.02, 0.2);
plot(psar, "PSAR", #f59e0b, 1);
```

---

#### `ichimoku(high, low, tenkan_len, kijun_len, senkou_len)` — Ichimoku Cloud

```rust
let cloud = ichimoku(high, low, 9, 26, 52);

let tenkan  = cloud.tenkan;      // Conversion line
let kijun   = cloud.kijun;       // Base line
let senkou_a = cloud.senkou_a;   // Leading span A
let senkou_b = cloud.senkou_b;   // Leading span B
let chikou  = cloud.chikou;      // Lagging span
```

---

### Volume Indicators

#### `obv(close, volume)` — On-Balance Volume

Cumulative volume indicator showing buying/selling pressure.

```rust
let obv_val = obv(close, volume);
plot(obv_val, "OBV", #2196F3, 1);
```

---

#### `vwap(high, low, close, volume)` — Volume-Weighted Average Price

```rust
let vwap_val = vwap(high, low, close, volume);
plot(vwap_val, "VWAP", #9e9e9e, 1);
```

---

#### `ad_line(high, low, close, volume)` — Accumulation/Distribution Line

```rust
let adl = ad_line(high, low, close, volume);
```

---

#### `cmf(high, low, close, volume, length)` — Chaikin Money Flow

Range [-1, 1]. Positive = buying pressure, negative = selling pressure.

```rust
let cmf_val = cmf(high, low, close, volume, 20);
```

---

### Rolling Statistics

#### `stdev(source, length)` — Standard Deviation

```rust
let volatility = stdev(close, 20);
let upper_bb   = sma(close, 20) + stdev(close, 20) * 2.0;
```

---

#### `highest(source, length)` — Rolling Maximum

```rust
let hh = highest(high, 20);   // highest high over last 20 bars
```

---

#### `lowest(source, length)` — Rolling Minimum

```rust
let ll = lowest(low, 20);    // lowest low over last 20 bars
```

---

#### `sum(source, length)` — Rolling Sum

```rust
let vol_sum = sum(volume, 10);   // total volume over 10 bars
```

---

#### `avg(source, length)` — Rolling Average

Alias for `sma`. Same result, more descriptive name for non-MA use cases.

```rust
let avg_range = avg(high - low, 20);   // average bar range
```

---

#### `change(source, length)` — Change Over N Bars

`source[0] - source[length]`

```rust
let mom = change(close, 1);    // single-bar change
let wk  = change(close, 5);   // 5-bar change
```

---

### Crossover and Trend

#### `crossover(series_a, series_b)` — Upward Cross

Returns `true` on the bar where `a` crosses above `b` (was below, now above).

```rust
let bull_cross = crossover(fast_ema, slow_ema);
let above_sma  = crossover(close, sma_val);

// Constant level
let above_70 = crossover(rsi_val, 70.0);

if crossover(close, sma_val) {
    alertcondition(true, "Breakout", "Price crossed above SMA");
}
```

---

#### `crossunder(series_a, series_b)` — Downward Cross

Returns `true` on the bar where `a` crosses below `b`.

```rust
let bear_cross = crossunder(fast_ema, slow_ema);
let below_30   = crossunder(rsi_val, 30.0);
```

---

#### `rising(source, length)` — Rising for N Bars

`true` if the source has been strictly increasing for the last `length` bars.

```rust
let uptrend = rising(close, 3);   // price rising 3 bars in a row
```

---

#### `falling(source, length)` — Falling for N Bars

`true` if the source has been strictly decreasing for the last `length` bars.

```rust
let downtrend = falling(close, 3);
```

---

### Math Functions

| Function              | Description                                   | Example                  |
|-----------------------|-----------------------------------------------|--------------------------|
| `abs(x)`              | Absolute value                                | `abs(-5.0)` → `5.0`      |
| `sqrt(x)`             | Square root                                   | `sqrt(9.0)` → `3.0`      |
| `pow(base, exp)`      | Power (same as `**` operator)                 | `pow(2.0, 8.0)` → `256.0`|
| `log(x)`              | Natural logarithm                             | `log(2.718)` → `≈ 1.0`   |
| `log10(x)`            | Base-10 logarithm                             | `log10(100.0)` → `2.0`   |
| `round(x)`            | Round to nearest integer                      | `round(3.7)` → `4.0`     |
| `ceil(x)`             | Round up (ceiling)                            | `ceil(3.1)` → `4.0`      |
| `floor(x)`            | Round down (floor)                            | `floor(3.9)` → `3.0`     |
| `max(a, b)`           | Maximum of two values                         | `max(3.0, 7.0)` → `7.0`  |
| `min(a, b)`           | Minimum of two values                         | `min(3.0, 7.0)` → `3.0`  |
| `clamp(v, lo, hi)`    | Constrain value to [lo, hi]                   | `clamp(150.0, 0.0, 100.0)` → `100.0` |

```rust
let spread   = abs(close - open);
let range_rt = sqrt(high - low);
let logged   = log(close);
let clamped  = clamp(rsi_val, 0.0, 100.0);
let snapped  = round(close / 100.0) * 100.0;   // round to nearest $100
```

---

### String Functions

#### `format(template, args...)` — String Formatting

Replaces each `{}` placeholder in the template with the corresponding argument:

```rust
let msg  = format("RSI: {}", rsi_val);
let msg2 = format("Bar {} — Close: {} Vol: {}", bar_index, close, volume);
let msg3 = format("Price is {} the SMA", if close > sma_val { "above" } else { "below" });
```

---

#### `print(args...)` — Debug Output

Prints to the browser console (for debugging during development):

```rust
print("Bar:", bar_index, "Close:", close);
print("RSI =", rsi_val);
```

---

### Utility Functions

#### `na(value)` — Check for NaN

Returns `true` if the value is `NaN` (not a number), `false` otherwise.

```rust
let prev = close[1];
if na(prev) {
    // not enough history yet
}

// Also works on indicator outputs
let ma = sma(close, 20);
if na(ma) {
    // still in warmup period
}
```

---

#### `nz(value, default)` — Replace NaN with Default

Returns `value` if it is a finite number, otherwise returns `default`:

```rust
let prev = nz(close[1], close);   // use current close if no prior bar
let ma   = nz(sma(close, 20), 0.0);
```

---

## 📊 Output Functions

These functions emit visual output. They are called **per bar** and accumulate points into series that are rendered on the chart.

---

### `plot()`

The primary output function. Plots a line on the chart.

```rust
plot(value, title, color, linewidth)
```

| Parameter   | Type    | Default     | Description                              |
|-------------|---------|-------------|------------------------------------------|
| `value`     | `f64`   | required    | The value to plot for the current bar    |
| `title`     | `str`   | `""`        | Display name in the legend               |
| `color`     | `color` | `#2196F3`   | Line color (6 or 8 hex digits)           |
| `linewidth` | `i64`   | `1`         | Line width in pixels (1–5 recommended)   |

```rust
// Single plot
plot(close, "Close", #2196F3, 1);

// Multiple plots (each becomes a separate series)
let fast = sma(close, 9);
let slow = sma(close, 21);
plot(fast, "Fast MA", #22c55e, 2);
plot(slow, "Slow MA", #ef4444, 2);

// Conditional value
plot(if is_bull { high } else { low }, "Signal", #f59e0b, 1);

// NaN gaps (use NaN to create gaps in the line)
plot(if rsi_val > 70.0 { rsi_val } else { 0.0 / 0.0 }, "OB Zone", #ef4444, 2);
```

---

### `hline()`

Draws a constant horizontal line across the entire chart panel.

```rust
hline(price, title, color, style)
```

| Parameter | Type    | Default     | Description                               |
|-----------|---------|-------------|-------------------------------------------|
| `price`   | `f64`   | required    | The price level to draw                   |
| `title`   | `str`   | `""`        | Display label                             |
| `color`   | `color` | `#9e9e9e`   | Line color                                |
| `style`   | `str`   | `"dashed"`  | `"solid"`, `"dashed"`, or `"dotted"`      |

```rust
hline(70.0, "Overbought", #ef4444, "dashed");
hline(50.0, "Midline",    #9e9e9e, "dotted");
hline(30.0, "Oversold",   #22c55e, "dashed");
hline(0.0,  "Zero",       #ffffff, "solid");
```

---

### `bgcolor()`

Fills the background of the chart panel with a color when a condition is true.

```rust
bgcolor(color, condition, opacity)
```

| Parameter   | Type    | Default | Description                                     |
|-------------|---------|---------|--------------------------------------------------|
| `color`     | `color` | required | Background fill color (use alpha channel or opacity) |
| `condition` | `bool`  | `true`  | Only fills when this is `true`                  |
| `opacity`   | `f64`   | `0.1`   | Fill opacity 0.0–1.0 (overrides alpha channel)  |

```rust
// Color the background when RSI is in overbought/oversold zone
bgcolor(#ef4444, rsi_val > 70.0);
bgcolor(#22c55e, rsi_val < 30.0);

// With custom opacity
bgcolor(#2196F340, close > sma_val, 0.15);

// Highlight volume spikes
bgcolor(#f59e0b, volume > sma(volume, 20) * 2.0);
```

---

### `alertcondition()`

Registers an alert that fires when the condition is `true` on the current bar.

```rust
alertcondition(condition, title, message)
```

| Parameter   | Type   | Description                        |
|-------------|--------|------------------------------------|
| `condition` | `bool` | When `true`, alert fires           |
| `title`     | `str`  | Short alert name                   |
| `message`   | `str`  | Full alert message text            |

```rust
// Simple crossover alert
alertcondition(
    crossover(fast_ema, slow_ema),
    "Golden Cross",
    "Fast EMA crossed above Slow EMA — potential buy signal"
);

// RSI extremes
alertcondition(rsi_val > 80.0, "Extreme Overbought", format("RSI = {}", rsi_val));
alertcondition(rsi_val < 20.0, "Extreme Oversold",   format("RSI = {}", rsi_val));

// Combined condition
alertcondition(
    crossover(close, sma_val) && (volume > sma(volume, 20) * 1.5),
    "Volume Breakout",
    "Price crossed SMA with above-average volume"
);
```

---

### `plotshape()`

Draws a shape marker on the chart at the current bar's position.

```rust
plotshape(condition, title, shape, location, color, size)
```

| Parameter   | Type   | Default     | Description                                    |
|-------------|--------|-------------|------------------------------------------------|
| `condition` | `bool` | required    | When `true`, shape is drawn                    |
| `title`     | `str`  | `""`        | Shape label                                    |
| `shape`     | `str`  | `"circle"`  | `"circle"`, `"triangle"`, `"diamond"`, `"flag"`, `"arrowup"`, `"arrowdown"`, `"cross"` |
| `location`  | `str`  | `"above"`   | `"above"`, `"below"`, `"abovebar"`, `"belowbar"`, `"price"` |
| `color`     | `color`| `#2196F3`   | Shape fill color                               |
| `size`      | `str`  | `"small"`   | `"tiny"`, `"small"`, `"normal"`, `"large"`     |

```rust
// Buy/sell markers
plotshape(crossover(fast_ema, slow_ema),  "Buy",  "triangle",   "below", #22c55e, "small");
plotshape(crossunder(fast_ema, slow_ema), "Sell", "triangle",   "above", #ef4444, "small");

// Divergence marker
plotshape(is_bearish_divergence, "Div", "diamond", "above", #f59e0b, "normal");
```

---

### `plotarrow()`

Draws an up or down arrow based on the sign of a value.

```rust
plotarrow(value, title, color_up, color_down, min_height, max_height)
```

```rust
// Show momentum direction
let mom = close - close[1];
plotarrow(mom, "Momentum", #22c55e, #ef4444, 5, 50);
```

---

### `plothistogram()`

Draws vertical histogram bars (like the MACD histogram).

```rust
plothistogram(value, title, color)
```

```rust
let macd_obj = macd(close, 12, 26, 9);
plothistogram(
    macd_obj.histogram,
    "MACD Hist",
    if macd_obj.histogram > 0.0 { #22c55e } else { #ef4444 }
);
```

---

## 📝 Full Examples

### 1. Simple SMA Overlay

```rust
#[indicator(name = "Simple Moving Average", overlay = true)]
#[input(length, "i64", 20)]

let ma = sma(close, length);
plot(ma, "SMA", #2196F3, 2);
```

---

### 2. RSI with Overbought / Oversold Levels

```rust
#[indicator(name = "RSI", overlay = false)]
#[input(length, "i64", 14)]
#[input(ob_level, "f64", 70.0)]
#[input(os_level, "f64", 30.0)]

let rsi_val = rsi(close, length);

plot(rsi_val, "RSI", #2196F3, 2);
hline(ob_level, "Overbought", #ef4444, "dashed");
hline(50.0,     "Midline",    #9e9e9e, "dotted");
hline(os_level, "Oversold",   #22c55e, "dashed");

bgcolor(#ef444420, rsi_val > ob_level);
bgcolor(#22c55e20, rsi_val < os_level);

alertcondition(crossover(rsi_val, ob_level),  "RSI Overbought", format("RSI crossed above {}", ob_level));
alertcondition(crossunder(rsi_val, os_level), "RSI Oversold",   format("RSI crossed below {}", os_level));
```

---

### 3. MACD Panel

```rust
#[indicator(name = "MACD", overlay = false)]
#[input(fast_len,   "i64", 12)]
#[input(slow_len,   "i64", 26)]
#[input(signal_len, "i64", 9)]

let m = macd(close, fast_len, slow_len, signal_len);

plot(m.macd_line,   "MACD",        #2196F3, 2);
plot(m.signal_line, "Signal",      #ef4444, 1);
plothistogram(
    m.histogram,
    "Histogram",
    if m.histogram >= 0.0 { #22c55e } else { #ef4444 }
);
hline(0.0, "Zero", #ffffff, "solid");

alertcondition(crossover(m.macd_line, m.signal_line),  "MACD Bullish Cross", "MACD crossed above Signal");
alertcondition(crossunder(m.macd_line, m.signal_line), "MACD Bearish Cross", "MACD crossed below Signal");
```

---

### 4. Bollinger Bands

```rust
#[indicator(name = "Bollinger Bands", overlay = true)]
#[input(length, "i64", 20)]
#[input(mult,   "f64", 2.0)]

let bb = bollinger(close, length, mult);

plot(bb.upper,  "Upper BB",  #2196F380, 1);
plot(bb.middle, "Middle BB", #9e9e9e,   1);
plot(bb.lower,  "Lower BB",  #2196F380, 1);

// Squeeze signal — bands are unusually narrow
let avg_bw = sma(bb.bandwidth, 50);
let squeeze = bb.bandwidth < avg_bw * 0.5;
bgcolor(#f59e0b20, squeeze);

// Price touching or outside bands
let touch_upper = close >= bb.upper;
let touch_lower = close <= bb.lower;

plotshape(touch_upper, "Touch Upper", "circle", "above", #ef4444, "tiny");
plotshape(touch_lower, "Touch Lower", "circle", "below", #22c55e, "tiny");
```

---

### 5. Golden Cross Alert

```rust
#[indicator(name = "Golden Cross / Death Cross", overlay = true)]
#[input(fast_len, "i64", 50)]
#[input(slow_len, "i64", 200)]

let fast_sma = sma(close, fast_len);
let slow_sma = sma(close, slow_len);

plot(fast_sma, "Fast SMA", #22c55e, 2);
plot(slow_sma, "Slow SMA", #ef4444, 2);

let golden_cross = crossover(fast_sma, slow_sma);
let death_cross  = crossunder(fast_sma, slow_sma);

plotshape(golden_cross, "Golden Cross", "triangle", "below", #22c55e, "normal");
plotshape(death_cross,  "Death Cross",  "triangle", "above", #ef4444, "normal");

bgcolor(#22c55e10, fast_sma > slow_sma);
bgcolor(#ef444410, fast_sma < slow_sma);

alertcondition(golden_cross, "Golden Cross", format("SMA {} crossed above SMA {}", fast_len, slow_len));
alertcondition(death_cross,  "Death Cross",  format("SMA {} crossed below SMA {}", fast_len, slow_len));
```

---

### 6. Custom Momentum Score

A fully custom indicator that combines multiple signals into a single composite score:

```rust
#[indicator(name = "Momentum Score", overlay = false)]

// Collect individual signals (each normalized to -1, 0, +1)
let rsi_sig  = if rsi(close, 14) > 55.0 { 1.0 } else { if rsi(close, 14) < 45.0 { -1.0 } else { 0.0 } };
let macd_obj = macd(close, 12, 26, 9);
let macd_sig = if macd_obj.macd_line > 0.0 { 1.0 } else { -1.0 };
let ema_sig  = if close > ema(close, 20) { 1.0 } else { -1.0 };
let adx_obj  = adx(high, low, close, 14);
let trend_str = adx_obj.adx / 100.0;

// Weighted composite score (-3 to +3)
let score = (rsi_sig * 1.0) + (macd_sig * 1.0) + (ema_sig * 1.0);

// Weight by trend strength
let weighted = score * nz(trend_str, 1.0);

// Plot
let score_color = if weighted > 1.5 {
    #22c55e
} else if weighted < -1.5 {
    #ef4444
} else {
    #9e9e9e
};

plot(weighted, "Momentum Score", score_color, 2);
hline(1.5,  "Bullish threshold", #22c55e, "dashed");
hline(-1.5, "Bearish threshold", #ef4444, "dashed");
hline(0.0,  "Zero",              #ffffff, "dotted");
```

---

### 7. Volume-Weighted Trend

```rust
#[indicator(name = "Volume-Weighted Trend", overlay = true)]
#[input(length, "i64", 20)]

let vwma_val  = vwma(close, length);
let sma_val   = sma(close, length);
let vol_ratio = volume / nz(sma(volume, length), volume);

// Volume-weighted signal
let bull_signal = (close > vwma_val) && (vol_ratio > 1.2);
let bear_signal = (close < vwma_val) && (vol_ratio > 1.2);

plot(vwma_val, "VWMA", #f59e0b, 2);
plot(sma_val,  "SMA",  #9e9e9e, 1);

bgcolor(#22c55e15, bull_signal);
bgcolor(#ef444415, bear_signal);

plotshape(bull_signal && !bull_signal[1], "Volume Bull", "arrowup",   "below", #22c55e, "small");
plotshape(bear_signal && !bear_signal[1], "Volume Bear", "arrowdown", "above", #ef4444, "small");
```

---

### 8. Multi-Timeframe Structure

Demonstrate using structs to organize complex indicator state:

```rust
#[indicator(name = "Price Structure", overlay = true)]
#[input(swing_len, "i64", 5)]

// Define our swing point struct
struct SwingPoint {
    price:    f64,
    bar:      f64,
    is_high:  bool,
}

// Helper to identify swing highs and lows
fn is_swing_high(n: i64) -> bool {
    let mid = high;
    let left  = highest(high, n)[1];
    let right = highest(high, n);
    mid >= left && mid >= right
}

fn is_swing_low(n: i64) -> bool {
    let mid = low;
    let left  = lowest(low, n)[1];
    let right = lowest(low, n);
    mid <= left && mid <= right
}

let swing_h = is_swing_high(swing_len);
let swing_l = is_swing_low(swing_len);

// Track recent structure
let mut last_high = highest(high, 50);
let mut last_low  = lowest(low, 50);

// Higher highs and higher lows = uptrend structure
let hh = swing_h && (high > last_high[1]);
let hl = swing_l && (low  > last_low[1]);
let ll = swing_l && (low  < last_low[1]);
let lh = swing_h && (high < last_high[1]);

// Plot structure markers
plotshape(hh, "HH", "triangle", "above", #22c55e, "small");
plotshape(hl, "HL", "triangle", "below", #22c55e, "small");
plotshape(lh, "LH", "triangle", "above", #ef4444, "small");
plotshape(ll, "LL", "triangle", "below", #ef4444, "small");

// Background based on structure bias
let bull_structure = hh || hl;
let bear_structure = ll || lh;

bgcolor(#22c55e10, bull_structure);
bgcolor(#ef444410, bear_structure);
```

---

### 9. Position Tracker with Struct

```rust
#[indicator(name = "Position PnL Tracker", overlay = true)]
#[input(entry_price, "f64", 0.0)]
#[input(position_size, "f64", 1.0)]
#[input(is_long, "bool", true)]

struct Position {
    entry: f64,
    size:  f64,
    long:  bool,
}

impl Position {
    fn pnl(&self, current: f64) -> f64 {
        if self.long {
            (current - self.entry) * self.size
        } else {
            (self.entry - current) * self.size
        }
    }

    fn pnl_pct(&self, current: f64) -> f64 {
        if self.entry == 0.0 { return 0.0; }
        self.pnl(current) / (self.entry * self.size) * 100.0
    }

    fn is_winning(&self, current: f64) -> bool {
        self.pnl(current) > 0.0
    }
}

// Create position from inputs
let pos = Position {
    entry: entry_price,
    size:  position_size,
    long:  is_long,
};

let pnl     = pos.pnl(close);
let pnl_pct = pos.pnl_pct(close);
let winning = pos.is_winning(close);

// Plot entry line
hline(entry_price, "Entry", #f59e0b, "solid");

// Color the area above/below entry
bgcolor(#22c55e15, winning);
bgcolor(#ef444415, !winning);

// Annotate PnL
plot(close, format("Close | PnL: {} ({}%)", round(pnl), round(pnl_pct)), if winning { #22c55e } else { #ef4444 }, 1);
```

---

### 10. Enum-Based Signal System

```rust
#[indicator(name = "Signal System", overlay = true)]

// Define our signal types
enum Signal {
    StrongBuy,
    Buy,
    Neutral,
    Sell,
    StrongSell,
}

// Function that returns a signal based on multiple criteria
fn evaluate_signal(rsi_val: f64, macd_hist: f64, above_sma: bool) -> Signal {
    let bull_count = if rsi_val > 55.0 { 1 } else { 0 }
                   + if macd_hist > 0.0 { 1 } else { 0 }
                   + if above_sma { 1 } else { 0 };

    let bear_count = if rsi_val < 45.0 { 1 } else { 0 }
                   + if macd_hist < 0.0 { 1 } else { 0 }
                   + if !above_sma { 1 } else { 0 };

    if bull_count == 3 {
        Signal::StrongBuy
    } else if bull_count == 2 {
        Signal::Buy
    } else if bear_count == 3 {
        Signal::StrongSell
    } else if bear_count == 2 {
        Signal::Sell
    } else {
        Signal::Neutral
    }
}

// Gather inputs
let rsi_v    = rsi(close, 14);
let macd_obj = macd(close, 12, 26, 9);
let sma_val  = sma(close, 50);

// Evaluate
let sig = evaluate_signal(rsi_v, macd_obj.histogram, close > sma_val);

// Translate to visual output
let sig_color = match (sig) {
    Signal::StrongBuy  => #22c55e,
    Signal::Buy        => #86efac,
    Signal::Neutral    => #9e9e9e,
    Signal::Sell       => #fca5a5,
    Signal::StrongSell => #ef4444,
};

let sig_shape_up = match (sig) {
    Signal::StrongBuy => true,
    Signal::Buy       => true,
    _                 => false,
};

let sig_shape_dn = match (sig) {
    Signal::StrongSell => true,
    Signal::Sell       => true,
    _                  => false,
};

plot(sma_val, "SMA 50", #9e9e9e, 1);
plotshape(sig_shape_up, "Bull Signal", "triangle", "below", sig_color, "small");
plotshape(sig_shape_dn, "Bear Signal", "triangle", "above", sig_color, "small");

alertcondition(match (sig) { Signal::StrongBuy => true, _ => false }, "Strong Buy", "All 3 bullish signals aligned");
alertcondition(match (sig) { Signal::StrongSell => true, _ => false }, "Strong Sell", "All 3 bearish signals aligned");
```

---

### 11. Parabolic SAR

```rust
#[indicator(name = "Parabolic SAR", overlay = true)]
#[input(step,     "f64", 0.02)]
#[input(max_step, "f64", 0.2)]

let psar = parabolic_sar(high, low, step, max_step);

// Color the SAR dots differently when above/below price
let sar_color = if psar < close { #22c55e } else { #ef4444 };

plot(psar, "PSAR", sar_color, 1);

// Trend switches
let going_long  = (psar < close) && (psar[1] > close[1]);
let going_short = (psar > close) && (psar[1] < close[1]);

plotshape(going_long,  "SAR Long",  "triangle", "below", #22c55e, "small");
plotshape(going_short, "SAR Short", "triangle", "above", #ef4444, "small");

alertcondition(going_long,  "SAR Long Signal",  "Parabolic SAR flipped bullish");
alertcondition(going_short, "SAR Short Signal", "Parabolic SAR flipped bearish");
```

---

### 12. Keltner Channel Squeeze

Identifies when Bollinger Bands are inside the Keltner Channels (low volatility squeeze), then fires on expansion:

```rust
#[indicator(name = "Keltner Squeeze", overlay = false)]
#[input(bb_len,   "i64", 20)]
#[input(bb_mult,  "f64", 2.0)]
#[input(kc_len,   "i64", 20)]
#[input(kc_mult,  "f64", 1.5)]
#[input(mom_len,  "i64", 12)]

let bb = bollinger(close, bb_len, bb_mult);
let kc = keltner(close, high, low, close, kc_len, kc_len, kc_mult);

// Squeeze = BB inside KC
let squeeze_on  = (bb.lower > kc.lower) && (bb.upper < kc.upper);
let squeeze_off = !squeeze_on;

// Momentum oscillator
let mid_price = (highest(high, mom_len) + lowest(low, mom_len)) / 2.0;
let mid_avg   = sma((mid_price + sma(close, mom_len)) / 2.0, mom_len);
let mom       = close - mid_avg;

let mom_color = if mom > 0.0 {
    if mom > mom[1] { #22c55e } else { #86efac }
} else {
    if mom < mom[1] { #ef4444 } else { #fca5a5 }
};

plothistogram(mom, "Momentum", mom_color);

// Squeeze indicator dots
let dot_color = if squeeze_on { #ef4444 } else { #22c55e };
plot(0.0, "Squeeze", dot_color, 2);

alertcondition(squeeze_off && squeeze_on[1], "Squeeze Release", "Keltner Squeeze released — momentum expansion imminent");
```

---

## 🔌 TypeScript API

OrbitScript is accessible from TypeScript/JavaScript via three simple functions and a convenient namespace.

### `compile()`

Parse and compile an OrbitScript source string. Does **not** register with the chart engine — safe to call anytime.

```typescript
import { compile } from 'orbityx-charts/orbitscript';
import type { CompiledScript } from 'orbityx-charts/orbitscript';

const script: CompiledScript = compile(source);

// Access metadata
console.log(script.meta.name);      // "My RSI"
console.log(script.meta.overlay);   // false
console.log(script.meta.kind);      // "indicator" | "strategy"
console.log(script.meta.inputs);    // InputDef[]

// Run against candles
const series = script.computeFn(candles);

// Access the parsed AST
const ast = script.program;
```

**With input overrides:**

```typescript
const script = compile(source, {
  length: 21,    // override the "length" input
  mult:   2.5,   // override the "mult" input
});
```

**Signature:**

```typescript
function compile(
  source: string,
  inputOverrides?: Record<string, OSValue>,
): CompiledScript
```

---

### `register()`

Compile and register the script as a live indicator plugin. Returns the primary indicator ID for use with `engine.toggleIndicator()`.

```typescript
import { register } from 'orbityx-charts/orbitscript';

const id = register(`
  #[indicator(name = "My EMA", overlay = true)]
  plot(ema(close, 20), "EMA 20", #2196F3, 2);
`);

// Activate on the chart
engine.toggleIndicator(id as IndicatorId);
```

**With input overrides:**

```typescript
const id = register(source, { length: 21, mult: 2.5 });
```

**Signature:**

```typescript
function register(
  source: string,
  inputOverrides?: Record<string, OSValue>,
): string
```

---

### `unregister()`

Remove a previously registered OrbitScript indicator from the plugin registry. Also removes all secondary series (additional plot lines, hlines, histograms).

```typescript
import { unregister } from 'orbityx-charts/orbitscript';

unregister(id);
engine.toggleIndicator(id as IndicatorId);  // deactivate from chart
```

**Signature:**

```typescript
function unregister(id: string): void
```

---

### `OrbitScript` Namespace

A convenience object that bundles all three functions:

```typescript
import { OrbitScript } from 'orbityx-charts/orbitscript';

// All three methods available under one import
const id = OrbitScript.register(source);
OrbitScript.unregister(id);
const compiled = OrbitScript.compile(source);
```

---

### `CompiledScript` Type

```typescript
interface CompiledScript {
  /** Script metadata extracted from directives */
  meta: ScriptMeta;

  /**
   * The compute function called by ChartEngine on every data update.
   * Receives the full candle array, returns the primary IndicatorSeries or null.
   */
  computeFn: (candles: Candle[]) => IndicatorSeries | null;

  /** Pre-parsed AST for inspection or re-use */
  program: Program;
}
```

---

### `ScriptMeta` Type

```typescript
interface ScriptMeta {
  kind:    'indicator' | 'strategy';
  name:    string;
  overlay: boolean;
  inputs:  InputDef[];
}
```

---

### `InputDef` Type

```typescript
interface InputDef {
  name:         string;
  type:         'f64' | 'i64' | 'bool' | 'str' | 'color';
  defaultValue: OSValue;
  min?:         number;
  max?:         number;
  step?:        number;
}
```

---

### `OSValue` Type

All runtime values in OrbitScript are one of:

```typescript
type OSValue =
  | number          // f64, i64
  | boolean         // bool
  | string          // str
  | null            // None
  | OSColor         // color { r, g, b, a, hex }
  | OSValue[]       // array
  | OSStruct        // struct instance
  | OSEnum          // enum instance
  | OSClosure       // closure / function reference
```

---

### Raw Module Imports

If you need access to the individual pipeline stages:

```typescript
import { tokenize }   from 'orbityx-charts/orbitscript';  // Lexer
import { parse }      from 'orbityx-charts/orbitscript';  // Parser
import { interpret }  from 'orbityx-charts/orbitscript';  // Interpreter

// Lex
const tokens = tokenize(source);

// Parse
const ast = parse(tokens);

// Interpret against candles
const { meta, outputs } = interpret(ast, candles, inputMap);

// Inspect outputs
const plotOutputs = outputs.filter(o => o.type === 'plot');
const hlineOutputs = outputs.filter(o => o.type === 'hline');
```

---

## ⚠️ Error Handling

OrbitScript throws `OrbitScriptError` with detailed location information on any error:

```typescript
import { OrbitScriptError, compile } from 'orbityx-charts/orbitscript';

try {
  const script = compile(source);
} catch (e) {
  if (e instanceof OrbitScriptError) {
    console.error(`[${e.phase}] ${e.message}`);
    console.error(`  at line ${e.line}, column ${e.column}`);
    // e.phase: 'lexer' | 'parser' | 'runtime' | 'typecheck'
  }
}
```

**Error phases:**

| Phase       | When it occurs                                              |
|-------------|-------------------------------------------------------------|
| `lexer`     | Invalid character, unterminated string, bad color literal   |
| `parser`    | Syntax error, unexpected token, missing bracket             |
| `runtime`   | Undefined variable, type mismatch, division errors          |
| `typecheck` | Reserved for future static type analysis                    |

**Common errors and fixes:**

```
[lexer] Invalid color literal '#fff' — expected 6 or 8 hex digits
   Fix: Use full 6-digit colors: #ffffff instead of #fff

[parser] Expected 'RPAREN' but got ':'
   Fix: Use positional input directive: #[input(length, "i64", 14)]
   instead of: #[input(length: i64 = 14)]

[runtime] 'plot:value' expects a number, got object
   Fix: Ensure the first argument to plot() is a scalar f64, not an array

[runtime] Unknown function 'myFunc'
   Fix: Declare the function before calling it, or check spelling

[parser] Unexpected token '{' (struct init ambiguity)
   Fix: Wrap match/if conditions in parentheses when ending with an identifier:
   match (trend) { ... } instead of match trend { ... }
```

---

## ⚙️ Execution Model

### Bar-by-Bar Loop

Every statement in the script body is executed once **per candle**:

```
for barIndex = 0 to N-1:
  ├── set open, high, low, close, volume, bar_index, timestamp
  ├── reset plot() counter
  └── execute all top-level statements
      ├── let x = sma(close, 20)   ← series fn: O(1) lookup from cache
      ├── let y = x * 2.0          ← arithmetic: O(1)
      └── plot(y, "2x SMA", ...)   ← records a plot point
```

### Variable History

Every `let` variable automatically builds up history that can be accessed with `[n]`:

```rust
// Each bar, we compute rsi_val and it's stored in history
let rsi_val = rsi(close, 14);

// On bar 5, rsi_val[1] gives the rsi_val from bar 4
// On bar 5, rsi_val[2] gives the rsi_val from bar 3
let prev_rsi = rsi_val[1];
let crossed_70 = (rsi_val[1] < 70.0) && (rsi_val > 70.0);
```

### Multiple `plot()` Calls

You can call `plot()` multiple times in one script. Each produces a separate series:

```rust
plot(fast_ema, "Fast", #22c55e, 2);  // series #1 — the primary
plot(slow_ema, "Slow", #ef4444, 2);  // series #2 — registered as secondary
plot(ema(close, 100), "Trend", #f59e0b, 1);  // series #3
```

### Script Re-runs

The `computeFn` returned by `compile()` is designed to be called multiple times as new candles arrive. The AST is parsed **once** and reused. The series cache is rebuilt on each full `interpret()` call, so live-updating charts stay accurate.

---

## ⚡ Performance

OrbitScript is designed to handle large datasets efficiently:

| Operation                    | Complexity | Notes                                  |
|------------------------------|------------|----------------------------------------|
| Parse (compile time)         | O(n)       | n = number of tokens; runs once        |
| `sma(close, 20)` first call  | O(N)       | N = number of candles; cached after    |
| `sma(close, 20)` per bar     | O(1)       | Array index lookup                     |
| `crossover(a, b)` per bar    | O(1)       | Uses barIndex into pre-built arrays    |
| `highest(close, 20)` first   | O(N×period)| Cached after first call                |
| History reference `close[1]` | O(1)       | Direct array index                     |
| `plot()` accumulation         | O(1)       | Appends to pre-allocated list          |

**Tips for best performance:**

1. **Assign series computations to variables** — `let ma = sma(close, 20)` is cached. Calling `sma(close, 20)` three times in one script only computes it once.

2. **Avoid calling series functions inside loops** — the loop body runs N times, but series functions are designed to run once per script execution.

3. **Use built-in functions over manual loops** — `highest(high, 20)` is implemented in optimized TypeScript and cached; a manual `for` loop rolling over `high[i]` is slower.

4. **Keep scripts focused** — a script that computes 10 indicators is better split into 2 focused scripts if only some are visible at a time.

---

## 🆚 Comparison with Pine Script

If you're coming from TradingView's Pine Script, here's a quick reference:

| Concept           | Pine Script                    | OrbitScript                          |
|-------------------|--------------------------------|--------------------------------------|
| Variables         | `x = 5`, `var x = 5`           | `let x = 5`, `let mut x = 5`         |
| Functions         | `f(x) => x * 2`                | `fn f(x: f64) -> f64 { x * 2.0 }`   |
| Conditional       | `x = condition ? a : b`        | `let x = if condition { a } else { b }` |
| Pattern matching  | (not supported)                | `match (value) { arm => expr }`      |
| Structs           | (not supported)                | `struct Point { x: f64, y: f64 }`   |
| Enums             | (not supported)                | `enum Signal { Buy, Sell, Hold }`    |
| Methods           | (not supported)                | `impl Point { fn dist(&self) -> f64 }` |
| Indicator meta    | `indicator("Name", overlay=true)` | `#[indicator(name = "Name", overlay = true)]` |
| Input             | `input.int(14, "Length")`      | `#[input(length, "i64", 14)]`        |
| Plot              | `plot(val, "Name", color.blue, 2)` | `plot(val, "Name", #2196F3, 2)`  |
| Horizontal line   | `hline(70, "OB", color.red)`   | `hline(70.0, "OB", #ef4444)`         |
| History           | `close[1]`                     | `close[1]` (identical)               |
| Crossover         | `ta.crossover(a, b)`           | `crossover(a, b)` (no prefix)        |
| SMA               | `ta.sma(close, 14)`            | `sma(close, 14)` (no prefix)         |
| Color             | `color.rgb(33, 150, 243)`      | `#2196F3` (hex literal)              |
| `na()` check      | `na(x)`                        | `na(x)` (identical)                  |
| `nz()` replace    | `nz(x, 0)`                     | `nz(x, 0.0)` (identical)             |
| Alert             | `alertcondition(cond, ...)`    | `alertcondition(cond, ...)` (identical) |
| Closures          | (limited)                      | Full `\|x\| x * 2.0` syntax          |
| `format()` / print| `str.format()` / `log.info()`  | `format(...)` / `print(...)`         |

**OrbitScript advantages over Pine Script:**
- Full `struct`, `enum`, `impl`, `trait` system
- Proper `match` pattern matching with guards
- First-class closures and higher-order functions
- `for` loops with ranges and iterators
- Strongly-typed enums with associated data
- Open source and embeddable in your own app

**Pine Script advantages (current gaps in OrbitScript):**
- More built-in drawing types (lines, boxes, tables)
- `request.security()` for multi-timeframe data
- Strategy tester integration
- More indicator built-ins (Supertrend, Pivot Points, etc.)

---

## 🚧 Limitations & Roadmap

### Current Limitations

1. **Input directive syntax**: Use positional form `#[input(name, "type", default)]`. The `name: type = default` syntax is not yet supported.

2. **Struct-init ambiguity**: When a `match` or `if` condition ends with an identifier immediately followed by `{`, wrap the condition in parentheses: `match (expr) { ... }`.

3. **Colors**: Must be exactly 6 or 8 hex digits. Shorthand (`#fff`) is not supported.

4. **No multi-timeframe data**: Scripts only access the current timeframe's candles. `request.security()` equivalent is not yet implemented.

5. **No persistent state**: Variables reset each time `computeFn` is called. There is no equivalent of Pine Script's `var` for accumulation across calls (use the bar-by-bar history system instead).

6. **No drawing objects**: `line.new()`, `box.new()`, `table.new()` equivalents are not yet available.

7. **No strategy backtesting**: `strategy.entry()`, `strategy.close()`, and P&L calculation are planned for a future release.

### Roadmap

- [ ] Strategy backtesting engine (`strategy.entry()`, `strategy.close()`)
- [ ] Drawing objects (`line.new()`, `box.new()`, `label.new()`)
- [ ] Multi-timeframe data access
- [ ] `#[input(name: type = default)]` shorthand syntax
- [ ] Type checker (static analysis before runtime)
- [ ] More built-in indicators (Supertrend, Pivot Points, Vortex, Elder Force Index)
- [ ] Script editor with syntax highlighting
- [ ] REPL / sandbox mode for interactive development
- [ ] Script import system (`use mylib::functions`)

---

## 🤝 Contributing

OrbitScript lives in `src/orbitscript/`. The test suite is in `orbitscript.test.ts` and runs with Vitest.

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Only OrbitScript tests
npm test -- src/orbitscript/orbitscript.test.ts
```

### Adding a Built-in Function

1. **Register in `stdlib.ts`**:

```typescript
reg('my_fn', (args, env, line, col) => {
    const src = resolveSeriesArray(args[0], 0, env, line, col);
    const len = asInt(args[1], 'my_fn:length', line, col);
    const key = `my_fn:${len}`;
    return currentVal(cached(env, key, () => myComputation(src, len)), env);
});
```

2. **Add to `SERIES_FUNS`** in `interpreter.ts` if the function takes a full series array as input:

```typescript
const SERIES_FUNS = new Set([
    // ...existing...
    'my_fn',
]);
```

3. **Write tests** in `orbitscript.test.ts`:

```typescript
it('my_fn() computes correctly', () => {
    const candles = makeCandles([1, 2, 3, 4, 5]);
    const { outputs } = run('plot(my_fn(close, 3), "v", #ffffff, 1);', candles);
    const plot = outputs.find(o => o.type === 'plot');
    if (plot?.type === 'plot') {
        expect(plot.points.at(-1)!.value).toBeCloseTo(expectedValue, 3);
    }
});
```

### Pipeline Diagram for Contributors

```
tokenize(source: string): Token[]
    └── lexer.ts / Lexer class
        ├── readNumber()
        ├── readString()
        ├── readColor()
        ├── readIdent()   → resolves keywords
        └── readOperator()

parse(tokens: Token[]): Program
    └── parser.ts / Parser class (recursive descent + Pratt)
        ├── parseProgram()
        │   ├── parseDirective()     → #[indicator(...)]
        │   ├── parseStructDef()     → struct Foo { ... }
        │   ├── parseEnumDef()       → enum Bar { ... }
        │   ├── parseTraitDef()      → trait Baz { ... }
        │   ├── parseImplBlock()     → impl Foo { ... }
        │   └── parseFnDef()         → fn f(x) -> T { ... }
        ├── parseStatement()
        │   ├── parseLetStmt()
        │   ├── parseForStmt()
        │   ├── parseWhileStmt()
        │   ├── parseLoopStmt()
        │   └── parseExprStmt()      → assignment or expression
        └── parseExpr(minPrec)       → Pratt top-down precedence
            ├── parseUnary()
            ├── parsePostfix()       → .field, [index], ()
            └── parsePrimary()
                ├── literals         → NumberLit, StringLit, BoolLit, ColorLit
                ├── parseIfExpr()    → if cond { ... } else { ... }
                ├── parseMatchExpr() → match (x) { pat => expr }
                ├── parseBlockExpr() → { stmts... tail }
                ├── parseClosure()   → |params| body
                └── parseIdentOrCall() → Identifier, FnCall, StructInit, PathExpr

interpret(program, candles, inputs): { meta, outputs }
    └── interpreter.ts / Interpreter class
        ├── extractMeta()            → reads #[indicator], #[input]
        ├── initRun()                → registers declarations, inits env
        └── bar-by-bar loop
            ├── env.setBar(i)
            ├── resetPlotCounter()
            └── execStatement() / eval()
                ├── evalFnCall()     → STDLIB.get() | fnRegistry | closure var
                ├── evalMethodCall() → array/string/struct methods
                ├── evalIf()         → expression semantics
                ├── evalMatch()      → pattern matching
                └── callUserFn()     → implicit last-expr return
```

---

## 📄 License

OrbitScript is part of Orbityx Chart Pro, licensed under the [Apache 2.0 License](../../LICENSE).

---

<div align="center">

**Built with ❤️ for the Orbityx Charts ecosystem**

[Report a Bug](https://github.com/BorisMalts/Orbityx-charts/issues) · [Request a Feature](https://github.com/BorisMalts/Orbityx-charts/issues) · [Contribute](https://github.com/BorisMalts/Orbityx-charts/pulls)

</div>
