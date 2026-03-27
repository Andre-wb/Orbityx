<div align="center">

# Orbityx Platform

</div>

<div align="center">

![Orbityx Platform Banner](https://img.shields.io/badge/Orbityx-Platform-0f141b?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyAxOEw5IDEyTDEzIDE2TDIxIDYiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&labelColor=1a2332)

**A full-stack professional cryptocurrency trading platform.**
**Live charting · AI-powered signals · Futures automation · On-chain analytics.**

[![License](https://img.shields.io/badge/License-Apache_2.0-22c55e.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3b82f6.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3b82f6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-22c55e.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.x-f59e0b.svg?style=flat-square)](https://www.sqlalchemy.org/)
[![Status](https://img.shields.io/badge/status-production-22c55e.svg?style=flat-square)](https://github.com/BorisMalts/Orbityx)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-8b5cf6.svg?style=flat-square)](https://github.com/BorisMalts/Orbityx/pulls)

[**Quick Start**](#4-quick-start) · [**API Reference**](#8-api-reference) · [**AI Engine**](#10-ai-signal-engine) · [**WebSocket**](#9-websocket-protocol) · [**Deployment**](#15-production-deployment)

</div>

---

## Table of Contents

1. [Overview](#1-overview)
2. [Sub-Libraries](#2-sub-libraries)
   - [2.1 Orbityx Chart Pro](#21-orbityx-chart-pro)
   - [2.2 OrbityxAI](#22-orbityxai)
3. [Architecture](#3-architecture)
   - [3.1 System Diagram](#31-system-diagram)
   - [3.2 Data Flow](#32-data-flow)
   - [3.3 Technology Stack](#33-technology-stack)
4. [Quick Start](#4-quick-start)
   - [4.1 Prerequisites](#41-prerequisites)
   - [4.2 Clone and Setup](#42-clone-and-setup)
   - [4.3 Environment Variables](#43-environment-variables)
   - [4.4 Database Initialization](#44-database-initialization)
   - [4.5 Start the Server](#45-start-the-server)
   - [4.6 Build TypeScript Frontend](#46-build-typescript-frontend)
5. [Project Structure](#5-project-structure)
6. [Backend — FastAPI Application](#6-backend--fastapi-application)
   - [6.1 Application Factory](#61-application-factory)
   - [6.2 Configuration System](#62-configuration-system)
   - [6.3 Database Layer](#63-database-layer)
   - [6.4 ORM Models](#64-orm-models)
   - [6.5 Pydantic Schemas](#65-pydantic-schemas)
   - [6.6 Middleware](#66-middleware)
7. [Authentication System](#7-authentication-system)
   - [7.1 Registration Flow](#71-registration-flow)
   - [7.2 JWT Token Lifecycle](#72-jwt-token-lifecycle)
   - [7.3 Password Hashing](#73-password-hashing)
   - [7.4 Protected Routes](#74-protected-routes)
   - [7.5 Avatar Management](#75-avatar-management)
8. [API Reference](#8-api-reference)
   - [8.1 Auth Endpoints](#81-auth-endpoints)
   - [8.2 Candles Endpoints](#82-candles-endpoints)
   - [8.3 Market Endpoints](#83-market-endpoints)
   - [8.4 AI Prediction Endpoint](#84-ai-prediction-endpoint)
   - [8.5 Error Responses](#85-error-responses)
9. [WebSocket Protocol](#9-websocket-protocol)
   - [9.1 Connection](#91-connection)
   - [9.2 Subscribe / Unsubscribe](#92-subscribe--unsubscribe)
   - [9.3 Server Message Types](#93-server-message-types)
   - [9.4 Connection Manager Internals](#94-connection-manager-internals)
10. [AI Signal Engine](#10-ai-signal-engine)
    - [10.1 OrbityxPredictor Overview](#101-orbityxpredictor-overview)
    - [10.2 Indicators Computed](#102-indicators-computed)
    - [10.3 RSI — Relative Strength Index](#103-rsi--relative-strength-index)
    - [10.4 MACD](#104-macd)
    - [10.5 Bollinger Bands](#105-bollinger-bands)
    - [10.6 ATR — Average True Range](#106-atr--average-true-range)
    - [10.7 Support and Resistance Detection](#107-support-and-resistance-detection)
    - [10.8 Volume Profile and POC](#108-volume-profile-and-poc)
    - [10.9 Signal Scoring System](#109-signal-scoring-system)
    - [10.10 Stop-Loss and Take-Profit Logic](#1010-stop-loss-and-take-profit-logic)
    - [10.11 On-Chain Data Integration](#1011-on-chain-data-integration)
    - [10.12 Full Prediction Response](#1012-full-prediction-response)
11. [Market Data Layer](#11-market-data-layer)
    - [11.1 CCXT Binance Connector](#111-ccxt-binance-connector)
    - [11.2 CoinGecko Integration](#112-coingecko-integration)
    - [11.3 Candle Backfill System](#113-candle-backfill-system)
    - [11.4 Timeframe Support](#114-timeframe-support)
12. [Frontend Integration — Orbityx Chart Pro](#12-frontend-integration--orbityx-chart-pro)
    - [12.1 FastAPIProvider Implementation](#121-fastapiprovider-implementation)
    - [12.2 Instrument Registration](#122-instrument-registration)
    - [12.3 WebSocket Streaming from Backend](#123-websocket-streaming-from-backend)
    - [12.4 Lazy History Loading](#124-lazy-history-loading)
    - [12.5 OrbitScript Custom Indicators](#125-orbitscript-custom-indicators)
13. [Templates and Static Assets](#13-templates-and-static-assets)
    - [13.1 Jinja2 Template Hierarchy](#131-jinja2-template-hierarchy)
    - [13.2 Theme System](#132-theme-system)
    - [13.3 JavaScript Animations](#133-javascript-animations)
14. [Database Migrations — Alembic](#14-database-migrations--alembic)
    - [14.1 Creating Migrations](#141-creating-migrations)
    - [14.2 Applying Migrations](#142-applying-migrations)
    - [14.3 Reverting Migrations](#143-reverting-migrations)
    - [14.4 Switching to PostgreSQL](#144-switching-to-postgresql)
15. [Production Deployment](#15-production-deployment)
    - [15.1 Environment Hardening](#151-environment-hardening)
    - [15.2 Uvicorn Multi-Worker Setup](#152-uvicorn-multi-worker-setup)
    - [15.3 Nginx Reverse Proxy](#153-nginx-reverse-proxy)
    - [15.4 systemd Service](#154-systemd-service)
    - [15.5 Docker Deployment](#155-docker-deployment)
    - [15.6 Railway Deployment](#156-railway-deployment)
    - [15.7 SSL / TLS with Let's Encrypt](#157-ssl--tls-with-lets-encrypt)
16. [Security Considerations](#16-security-considerations)
    - [16.1 JWT Best Practices](#161-jwt-best-practices)
    - [16.2 CORS Configuration](#162-cors-configuration)
    - [16.3 Rate Limiting](#163-rate-limiting)
    - [16.4 Secret Management](#164-secret-management)
17. [Testing](#17-testing)
    - [17.1 Backend Tests](#171-backend-tests)
    - [17.2 Frontend Tests — Vitest](#172-frontend-tests--vitest)
    - [17.3 Integration Testing](#173-integration-testing)
18. [Monitoring and Logging](#18-monitoring-and-logging)
    - [18.1 Structured Logging](#181-structured-logging)
    - [18.2 Health Check Endpoint](#182-health-check-endpoint)
    - [18.3 Request Tracing](#183-request-tracing)
19. [Troubleshooting](#19-troubleshooting)
    - [19.1 Common Errors](#191-common-errors)
    - [19.2 WebSocket Issues](#192-websocket-issues)
    - [19.3 Database Issues](#193-database-issues)
    - [19.4 CCXT / Exchange Issues](#194-ccxt--exchange-issues)
20. [Configuration Reference](#20-configuration-reference)
21. [Glossary](#21-glossary)
22. [FAQ](#22-faq)
23. [Contributing](#23-contributing)
24. [Version History](#24-version-history)
25. [Authors](#25-authors)
26. [License](#26-license)
27. [Disclaimer](#27-disclaimer)

---

## 1. Overview

**Orbityx** is a professional-grade, open-source cryptocurrency trading platform built for traders who demand precision, speed, and analytical depth. It unifies three independent production-grade systems under a single deployable backend:

| System | Role |
|---|---|
| **FastAPI Backend** | REST API, WebSocket streaming, JWT auth, OHLCV storage |
| **Orbityx Chart Pro** | Zero-dependency TypeScript canvas charting library |
| **OrbityxAI** | ML-powered futures trading bot with 5-step CHECKLIST strategy |

The platform is designed around a clear separation of concerns: the backend serves data and handles persistence, the charting library renders it with professional-grade visuals, and the AI bot makes autonomous trading decisions using a disciplined, rule-first approach.

### What Orbityx is NOT

- It is not a social trading platform or copy-trading service.
- It is not a SaaS product with a hosted cloud offering.
- It is not a black-box AI that trades without explainable signals.

Every signal, every trade, every chart rendering decision is traceable to a deterministic rule or a clearly documented ML feature.

### Design Philosophy

**Explainability over black-box performance.** Every AI signal includes full indicator values, support/resistance levels, and a confidence breakdown so that a trader can verify and override any decision.

**Data sovereignty.** All OHLCV data is stored locally in your own database. You own your data.

**Composability.** Each subsystem (API, charts, AI bot) can be used independently or together. You can use the charting library against any REST endpoint, run the AI bot against any exchange, or use the backend without the AI bot.

**Minimal dependencies.** The charting library ships with zero production dependencies. The AI predictor in the API is pure NumPy — no scikit-learn, no TensorFlow, no external ML framework required at the API level.

---

## 2. Sub-Libraries

Orbityx is organized as a monorepo containing two independent sub-libraries that can be developed, tested, and deployed separately.

### 2.1 Orbityx Chart Pro

**Location:** `Orbityx-charts/`

Orbityx Chart Pro is a zero-dependency, provider-agnostic, canvas-based OHLCV charting library written in TypeScript. It is the visual rendering engine for the Orbityx platform but can be embedded in any web project.

Key capabilities:
- Candlestick, bar, and line chart types rendered on an HTML5 Canvas
- Built-in technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, Volume
- **OrbitScript** — a built-in scripting language (`.orb` files) for writing custom indicators
- Provider-agnostic: implement the `DataProvider` interface to connect any data source
- WebSocket streaming with automatic candle updates
- Professional drawing tools: trend lines, horizontal rays, Fibonacci retracements, rectangles
- Light and dark themes with full CSS variable theming
- 318 unit tests via Vitest

See `Orbityx-charts/README.md` for the complete API reference.

### 2.2 OrbityxAI

**Location:** `orbityxAI/`

OrbityxAI is a professional-grade crypto futures trading bot powered by a 5-step **CHECKLIST** strategy built on Support/Resistance level analysis. It supports live and paper trading on Bybit and MEXC exchanges.

Key capabilities:
- Automated S/R level detection with swing point analysis and clustering
- Multi-timeframe analysis: D1 context → H1 trend → M5 entry
- Two entry patterns: Retest and Breakout+Pause+Confirmation
- ML ensemble: LightGBM + XGBoost + CatBoost with SHAP explainability
- Full Telegram bot interface for remote monitoring and control
- Backtesting engine with Sharpe ratio, drawdown, and win-rate reporting

See `orbityxAI/README.md` for the complete strategy and configuration reference.

---

## 3. Architecture

### 3.1 System Diagram

```
+===========================================================================+
|                           Orbityx Platform                                |
|                                                                           |
|  +--------------------------------------------------------------------+  |
|  |                       Browser / Client                             |  |
|  |                                                                     |  |
|  |   +------------------------+    +-----------------------------+    |  |
|  |   |  Orbityx Chart Pro     |    |   HTML Templates (Jinja2)   |    |  |
|  |   |  (Canvas 2D, TS)       |    |   + Static JS/CSS/Images    |    |  |
|  |   |  FastAPIProvider       |    |                             |    |  |
|  |   +-----------+------------+    +-------------+---------------+    |  |
|  |               |                               |                    |  |
|  +---------------|-------------------------------|--------------------+  |
|                  | HTTP / WebSocket              | HTTP                  |
|  +---------------|-------------------------------|--------------------+  |
|  |               v                               v                    |  |
|  |         +--------------------------------------------------+       |  |
|  |         |              FastAPI Application                 |       |  |
|  |         |  +-----------+  +-----------+  +-----------+    |       |  |
|  |         |  | /api/auth |  | /api/cand |  | /api/mark |    |       |  |
|  |         |  |  router   |  |  router   |  |  router   |    |       |  |
|  |         |  +-----------+  +-----------+  +-----------+    |       |  |
|  |         |  +-----------+  +-----------+                   |       |  |
|  |         |  | /api/ai   |  | /stream   |                   |       |  |
|  |         |  |  router   |  |  (WS)     |                   |       |  |
|  |         |  +-----------+  +-----------+                   |       |  |
|  |         +----+--------+--------+--------+-----------------+       |  |
|  |               |        |        |        |                        |  |
|  |               v        v        v        v                        |  |
|  |  +----------+ +------+ +------+ +-------+--------+               |  |
|  |  | Auth     | | CCXT | | Coin | | AI Predictor   |               |  |
|  |  | Service  | | Svc  | | Gecko| | (pure NumPy)   |               |  |
|  |  +----------+ +--+---+ +--+---+ +-------+--------+               |  |
|  |                  |        |              |                        |  |
|  |                  v        v              v                        |  |
|  |          +-------+--------+----+  +------+--------+              |  |
|  |          |    SQLAlchemy ORM   |  | blockchain.info|              |  |
|  |          |    SQLite / PgSQL   |  | CoinGecko API  |              |  |
|  |          +--------------------+  +----------------+              |  |
|  +--------------------------------------------------------------------+  |
|                                                                           |
|  +--------------------------------------------------------------------+  |
|  |                   OrbityxAI (separate process)                     |  |
|  |   run_live.py → LiveEngine → CHECKLIST → Bybit/MEXC (ccxt)        |  |
|  +--------------------------------------------------------------------+  |
+===========================================================================+
```

### 3.2 Data Flow

```
User Browser
    |
    | HTTP GET /api/candles?symbol=BTC/USDT&timeframe=1h&limit=500
    v
FastAPI Router (candles.py)
    |
    | Query SQLAlchemy ORM
    v
SQLite / PostgreSQL
    |
    | If no candles in DB → trigger background backfill
    v
CCXT Service (ccxt_service.py)
    |
    | ccxt.binance().fetch_ohlcv("BTC/USDT", "1h", limit=1000)
    v
Binance REST API
    |
    | Store candles in DB
    v
Return JSON array to client
    |
    v
FastAPIProvider (frontend TypeScript)
    |
    | Map JSON → OHLCVBar[]
    v
Orbityx Chart Pro (Canvas rendering)
```

```
User Browser
    |
    | WS CONNECT /stream
    v
WebSocket Router (ws.py)
    |
    | { "type": "subscribe", "symbol": "BTC/USDT", "timeframe": "1m" }
    v
WebSocketManager
    |
    | Register connection, start background broadcast loop
    v
CCXT Service → fetch latest candle every N seconds
    |
    | { "type": "candle", "payload": {...} }
    v
Browser → Orbityx Chart Pro → append candle to chart
```

### 3.3 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Backend API | FastAPI | 0.110+ | Async HTTP + WebSocket server |
| ASGI Server | Uvicorn | 0.29+ | Production ASGI runner |
| ORM | SQLAlchemy | 2.x | Database abstraction layer |
| Migrations | Alembic | 1.x | Schema version control |
| Database (dev) | SQLite | 3.x | Zero-config local storage |
| Database (prod) | PostgreSQL | 14+ | Production-grade RDBMS |
| Auth | python-jose + bcrypt | — | JWT tokens + password hashing |
| Market Data | CCXT | 4.x | Exchange-agnostic OHLCV fetcher |
| Market Stats | CoinGecko API | v3 | Market cap, 24h stats |
| On-Chain | blockchain.info | — | BTC hash rate, mempool |
| AI/ML | NumPy | 1.x | Technical indicator engine |
| Frontend Charts | Orbityx Chart Pro | 2.x | TypeScript canvas charting |
| TypeScript Build | tsc | 5.x | Frontend compilation |
| AI Bot | OrbityxAI | 7.3 | Futures trading automation |

---

## 4. Quick Start

### 4.1 Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Python | 3.10 | 3.12 recommended |
| Node.js | 18.x | For TypeScript build |
| npm | 9.x | Ships with Node.js |
| Git | 2.x | |
| SQLite | 3.x | Pre-installed on macOS/Linux |

### 4.2 Clone and Setup

```bash
git clone https://github.com/BorisMalts/Orbityx.git
cd Orbityx

# Create and activate a Python virtual environment
python -m venv .venv
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows PowerShell

# Install Python dependencies
pip install -r requirements.txt
```

### 4.3 Environment Variables

```bash
cp .env.example .env
```

Open `.env` and configure:

```env
# ── Application ──────────────────────────────────────────────────────────────
SECRET_KEY=your-very-long-random-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# ── Database ─────────────────────────────────────────────────────────────────
# SQLite (default for development)
DATABASE_URL=sqlite:///./orbityx.db

# PostgreSQL (recommended for production)
# DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/orbityx

# ── Exchange ──────────────────────────────────────────────────────────────────
# Leave empty to use public (unauthenticated) Binance endpoints
BINANCE_API_KEY=
BINANCE_SECRET_KEY=

# ── SMTP (optional — for email confirmation) ──────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

> **Security:** Never commit `.env` to version control. The `.gitignore` already excludes it.

### 4.4 Database Initialization

```bash
# Apply all migrations (creates tables in orbityx.db on first run)
alembic upgrade head
```

On success you will see:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, create users table
INFO  [alembic.runtime.migration] Running upgrade 0001 -> 0002, create ohlcv table
```

### 4.5 Start the Server

```bash
python run.py
```

The server starts on `http://localhost:8000`.

| URL | Purpose |
|---|---|
| `http://localhost:8000` | Web application |
| `http://localhost:8000/docs` | Swagger / OpenAPI interactive docs |
| `http://localhost:8000/redoc` | ReDoc documentation |
| `ws://localhost:8000/stream` | WebSocket endpoint |

### 4.6 Build TypeScript Frontend

In a separate terminal (with virtual environment still active):

```bash
# Install Node.js dependencies
npm install

# One-time build
npm run build

# Watch mode (rebuilds on file change)
npm run dev
```

The compiled JavaScript is output to `backend/static/js/`.

---

## 5. Project Structure

```
Orbityx/
│
├── run.py                              # Entrypoint: launches Uvicorn
├── alembic.ini                         # Alembic configuration
├── requirements.txt                    # Python dependencies
├── package.json                        # Node.js / TypeScript build config
├── tsconfig.json                       # TypeScript compiler config
├── .env.example                        # Environment variable template
├── .env                                # Local configuration (git-ignored)
│
├── alembic/
│   ├── env.py                          # Alembic migration environment
│   └── versions/
│       ├── 0001_create_users.py        # Users table migration
│       └── 0002_create_ohlcv.py        # OHLCV table migration
│
├── backend/                            # FastAPI application package
│   ├── __init__.py
│   ├── main.py                         # App factory, middleware, static files
│   ├── config.py                       # Settings loaded from .env
│   ├── database.py                     # SQLAlchemy engine + session factory
│   ├── models.py                       # ORM models: User, OHLCV
│   ├── schemas.py                      # Pydantic v2 request/response schemas
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                     # Authentication endpoints
│   │   ├── candles.py                  # OHLCV data endpoints
│   │   ├── market.py                   # Market cap / stats endpoints
│   │   ├── ai.py                       # AI prediction endpoint
│   │   └── ws.py                       # WebSocket streaming endpoint
│   │
│   └── services/
│       ├── auth_service.py             # JWT decode + get_current_user
│       ├── ccxt_service.py             # Binance OHLCV fetcher via ccxt
│       ├── ai_predictor.py             # Full trading signal engine (NumPy)
│       ├── ws_manager.py               # WebSocket connection manager
│       ├── candle_sync.py              # Background candle sync service
│       └── exchange_service.py         # Unified exchange interface
│   │
│   ├── static/
│   │   ├── css/
│   │   │   └── styles.css              # Global application styles
│   │   ├── js/
│   │   │   ├── ThemeToggle.js          # Dark/light theme switcher
│   │   │   ├── items_animation.js      # Page element animations
│   │   │   ├── parallax_animations.js  # Parallax scroll effects
│   │   │   ├── rotate_animations.js    # CSS rotation animations
│   │   │   ├── window_mode.js          # Window/fullscreen manager
│   │   │   └── orbityx-charts/         # Compiled chart library output
│   │   ├── ts/
│   │   │   ├── ThemeToggle.ts
│   │   │   ├── items_animation.ts
│   │   │   ├── parallax_animations.ts
│   │   │   └── rotate_animations.ts
│   │   └── img/
│   │       ├── Black-theme-logo.png
│   │       ├── Light-theme-logo.png
│   │       └── ...toolbar icons...
│   │
│   └── templates/
│       ├── base.html                   # Base layout with nav/footer
│       ├── index.html                  # Landing page
│       ├── introduce.html              # Platform introduction
│       ├── chart.html                  # Chart page (Orbityx Chart Pro)
│       ├── crypto_currency.html        # Multi-window crypto dashboard
│       ├── btc_candlestick.html        # BTC-focused candlestick view
│       ├── table.html                  # Market data table
│       ├── login.html                  # Login form
│       ├── register.html               # Registration form
│       ├── profile.html                # User profile page
│       ├── settings.html               # Account settings
│       └── navigation.html             # Navigation partial
│
├── frontend/
│   └── src/
│       └── providers/
│           └── fastapi_provider.ts     # DataProvider for Orbityx Chart Pro
│
├── Orbityx-charts/                     # Chart Pro sub-library (standalone)
│   ├── src/
│   │   ├── main.ts
│   │   ├── core/
│   │   ├── services/
│   │   ├── ui/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── providers/
│   │   └── orbitscript/
│   ├── dist/                           # Compiled output
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
└── orbityxAI/                          # AI trading bot sub-library (standalone)
    ├── run_live.py
    ├── run_paper.py
    ├── run_backtest.py
    ├── run_training.py
    ├── config.py
    ├── data/
    ├── features/
    ├── indicators/
    ├── levels/
    ├── models/
    ├── signals/
    ├── strategy/
    ├── trading/
    ├── backtest/
    ├── bot/
    └── README.md
```

---

## 6. Backend — FastAPI Application

### 6.1 Application Factory

`backend/main.py` is the FastAPI application factory. It creates the `app` instance, registers all routers, configures middleware, and mounts static files and Jinja2 templates.

```python
# backend/main.py (simplified)
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import auth, candles, market, ai, ws
from backend.config import settings

app = FastAPI(
    title="Orbityx API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,    prefix="/api/auth",   tags=["auth"])
app.include_router(candles.router, prefix="/api/candles", tags=["candles"])
app.include_router(market.router,  prefix="/api/market",  tags=["market"])
app.include_router(ai.router,      prefix="/api/ai",      tags=["ai"])
app.include_router(ws.router,      tags=["websocket"])

# Static files
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
```

### 6.2 Configuration System

`backend/config.py` loads all configuration from environment variables using Pydantic's `BaseSettings`. This ensures that all required variables are present at startup and type-validated.

```python
# backend/config.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Auth
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Database
    database_url: str = "sqlite:///./orbityx.db"

    # Exchange
    binance_api_key: str = ""
    binance_secret_key: str = ""

    # CORS
    allowed_origins: List[str] = ["http://localhost:8000"]

    # SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

Access settings anywhere in the application:

```python
from backend.config import settings

print(settings.database_url)
print(settings.secret_key)
```

### 6.3 Database Layer

`backend/database.py` sets up the SQLAlchemy engine and session factory.

```python
# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from backend.config import settings

# connect_args required for SQLite only (allows multi-thread access)
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

The `get_db` function is used as a FastAPI dependency injection target:

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from backend.database import get_db

@router.get("/something")
def read_something(db: Session = Depends(get_db)):
    ...
```

### 6.4 ORM Models

`backend/models.py` defines two primary ORM models.

#### User Model

```python
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(50), unique=True, index=True, nullable=False)
    email      = Column(String(255), unique=True, index=True, nullable=False)
    phone      = Column(String(20), unique=True, nullable=True)
    hashed_pw  = Column(String(255), nullable=False)
    avatar     = Column(LargeBinary, nullable=True)    # stored as raw bytes
    is_active  = Column(Boolean, default=False)        # True after email confirm
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### OHLCV Model

```python
class OHLCV(Base):
    __tablename__ = "ohlcv"

    id        = Column(Integer, primary_key=True, index=True)
    symbol    = Column(String(20), index=True, nullable=False)
    timeframe = Column(String(10), index=True, nullable=False)
    timestamp = Column(BigInteger, index=True, nullable=False)  # milliseconds
    open      = Column(Float, nullable=False)
    high      = Column(Float, nullable=False)
    low       = Column(Float, nullable=False)
    close     = Column(Float, nullable=False)
    volume    = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp", name="uq_ohlcv"),
    )
```

The `UniqueConstraint` on `(symbol, timeframe, timestamp)` prevents duplicate candles during backfill operations.

### 6.5 Pydantic Schemas

`backend/schemas.py` defines all request and response schemas using Pydantic v2.

```python
# Request schemas
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)

class LoginRequest(BaseModel):
    credential: str   # email, username, or phone
    password: str

# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CandleResponse(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class PredictionResponse(BaseModel):
    symbol: str
    timeframe: str
    current_price: float
    predicted_price: float
    direction: str          # "LONG" | "SHORT" | "NEUTRAL"
    confidence: float       # 0.0 – 1.0
    signal: str             # "BUY" | "SELL" | "HOLD"
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    take_profit_3: float
    support_levels: List[float]
    resistance_levels: List[float]
    rsi: float
    macd_signal: str
    trend: str
    risk_reward: float
    on_chain: Optional[Dict[str, Any]] = None
```

### 6.6 Middleware

The application registers the following middleware layers in order:

1. **CORSMiddleware** — Handles cross-origin requests. In development `allow_origins=["*"]` is acceptable; in production set `ALLOWED_ORIGINS` explicitly.
2. **Request logging** — Optional structured logging middleware logs method, path, status code, and latency for every request.
3. **Static file serving** — Uvicorn handles `/static` mount before requests reach the FastAPI router tree.

---

## 7. Authentication System

### 7.1 Registration Flow

```
POST /api/auth/register
        |
        | Validate RegisterRequest schema
        v
Check duplicate username / email / phone in DB
        |
        | If duplicate → HTTP 400
        v
Hash password with bcrypt (cost factor 12)
        |
        v
Create User row (is_active=False)
        |
        v
Generate email confirmation token (JWT, 24h expiry)
        |
        v
Send confirmation email via SMTP (if configured)
        |
        v
Return UserResponse (201 Created)
```

Once the user clicks the confirmation link:

```
GET /api/auth/confirm-email/{token}
        |
        | Decode JWT, extract email
        v
Set user.is_active = True
        |
        v
Redirect to login page
```

### 7.2 JWT Token Lifecycle

Tokens are standard HS256 JWTs signed with `SECRET_KEY`.

**Token payload:**
```json
{
  "sub": "username",
  "exp": 1704153600,
  "iat": 1704067200
}
```

**Token generation:**

```python
from datetime import datetime, timedelta
from jose import jwt
from backend.config import settings

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
```

**Token validation:**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
```

### 7.3 Password Hashing

Passwords are hashed using `bcrypt` via `passlib`:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

Bcrypt with default cost factor (12) produces hashes that take ~250ms to compute, making brute-force attacks impractical.

### 7.4 Protected Routes

Use `Depends(get_current_user)` on any route to require authentication:

```python
from backend.services.auth_service import get_current_user
from backend.models import User

@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
```

Unauthenticated requests receive:
```json
HTTP 401 Unauthorized
{"detail": "Could not validate credentials"}
```

### 7.5 Avatar Management

Avatars are stored as raw bytes in the `User.avatar` column (BLOB).

**Upload:**
```
POST /api/auth/avatar
Content-Type: multipart/form-data
Authorization: Bearer eyJ...

file=<binary image data>
```

**Retrieve:**
```
GET /api/auth/avatar/{user_id}
→ Response: image/jpeg or image/png binary stream
```

The endpoint auto-detects the image MIME type from the first bytes (magic bytes) and sets the `Content-Type` header accordingly.

---

## 8. API Reference

### 8.1 Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create new account |
| `GET` | `/api/auth/confirm-email/{token}` | No | Confirm email address |
| `POST` | `/api/auth/login` | No | Login → JWT token |
| `GET` | `/api/auth/me` | Bearer | Get current user info |
| `POST` | `/api/auth/avatar` | Bearer | Upload profile avatar |
| `GET` | `/api/auth/avatar/{user_id}` | No | Get avatar image |

#### POST /api/auth/register

**Request body:**
```json
{
  "username": "trader42",
  "email": "trader42@example.com",
  "phone": "+1234567890",
  "password": "securepassword"
}
```

**Success response (201):**
```json
{
  "id": 1,
  "username": "trader42",
  "email": "trader42@example.com",
  "is_active": false,
  "created_at": "2026-03-28T12:00:00"
}
```

**Error responses:**
```json
HTTP 400: {"detail": "Username already registered"}
HTTP 400: {"detail": "Email already registered"}
HTTP 422: {"detail": [{"loc": ["body", "password"], "msg": "min length 8"}]}
```

#### POST /api/auth/login

**Request body:**
```json
{
  "credential": "trader42",
  "password": "securepassword"
}
```

The `credential` field accepts a username, email address, or phone number.

**Success response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error responses:**
```json
HTTP 401: {"detail": "Invalid credentials"}
HTTP 403: {"detail": "Email not confirmed"}
```

#### GET /api/auth/me

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success response (200):**
```json
{
  "id": 1,
  "username": "trader42",
  "email": "trader42@example.com",
  "is_active": true,
  "created_at": "2026-03-28T12:00:00"
}
```

---

### 8.2 Candles Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/candles` | No | Fetch OHLCV candles from DB |
| `POST` | `/api/candles/backfill` | No | Trigger background backfill |

#### GET /api/candles

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `symbol` | string | `BTC/USDT` | Trading pair (CCXT format) |
| `timeframe` | string | `1m` | Candle interval |
| `limit` | integer | `500` | Max candles returned (1–1000) |
| `to` | integer | — | End timestamp in ms (for history pagination) |

**Example requests:**

```bash
# Latest 500 1h candles for BTC/USDT
GET /api/candles?symbol=BTC%2FUSDT&timeframe=1h&limit=500

# Load history before a specific timestamp (lazy loading)
GET /api/candles?symbol=BTC%2FUSDT&timeframe=1h&limit=500&to=1704067200000

# ETH/USDT 15m candles
GET /api/candles?symbol=ETH%2FUSDT&timeframe=15m&limit=200
```

**Success response (200):**
```json
[
  {
    "timestamp": 1704067200000,
    "open": 42001.5,
    "high": 42500.0,
    "low": 41800.0,
    "close": 42300.0,
    "volume": 123.456
  },
  {
    "timestamp": 1704070800000,
    "open": 42300.0,
    "high": 42800.0,
    "low": 42100.0,
    "close": 42750.0,
    "volume": 98.123
  }
]
```

> Timestamps are always in **milliseconds** — compatible with `Date.now()` and the `DataProvider` interface in Orbityx Chart Pro.

**Behavior when no candles exist in DB:**

If no candles for the requested `symbol` / `timeframe` combination exist in the database, the endpoint automatically triggers a background backfill from Binance and returns an empty array. The backfill completes asynchronously; subsequent requests within a few seconds will return data.

#### POST /api/candles/backfill

Manually trigger a backfill for a symbol / timeframe.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `symbol` | string | `BTC/USDT` | Symbol to backfill |
| `timeframe` | string | `1h` | Timeframe to backfill |

**Success response (202):**
```json
{
  "status": "backfill_started",
  "symbol": "BTC/USDT",
  "timeframe": "1h"
}
```

The backfill runs in a `BackgroundTask` — the response is returned immediately.

---

### 8.3 Market Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/market/coins` | No | Top 50 coins by market cap |
| `GET` | `/api/market/stats/{coin_id}` | No | 24h stats for a single coin |

#### GET /api/market/coins

Fetches the top 50 coins by market cap from CoinGecko.

**Success response (200):**
```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "current_price": 67450.0,
    "market_cap": 1325000000000,
    "market_cap_rank": 1,
    "price_change_percentage_24h": 2.34,
    "total_volume": 28000000000,
    "image": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
  },
  ...
]
```

#### GET /api/market/stats/{coin_id}

**Path parameter:** `coin_id` — CoinGecko coin ID (e.g. `bitcoin`, `ethereum`, `solana`)

**Success response (200):**
```json
{
  "id": "bitcoin",
  "name": "Bitcoin",
  "symbol": "btc",
  "current_price": 67450.0,
  "market_cap": 1325000000000,
  "market_cap_rank": 1,
  "high_24h": 68200.0,
  "low_24h": 66800.0,
  "price_change_24h": 1540.0,
  "price_change_percentage_24h": 2.34,
  "ath": 73750.0,
  "ath_change_percentage": -8.52,
  "circulating_supply": 19650000,
  "total_supply": 21000000
}
```

---

### 8.4 AI Prediction Endpoint

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/ai/predict` | No | Full trading signal analysis |

#### GET /api/ai/predict

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `symbol` | string | `BTC/USDT` | Symbol to analyze (must have candles in DB) |
| `timeframe` | string | `1h` | Timeframe for analysis |

**Success response (200):**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "current_price": 67450.0,
  "predicted_price": 69200.0,
  "direction": "LONG",
  "confidence": 0.74,
  "signal": "BUY",
  "stop_loss": 65800.0,
  "take_profit_1": 69100.0,
  "take_profit_2": 71200.0,
  "take_profit_3": 74500.0,
  "support_levels": [65000.0, 63500.0, 61000.0],
  "resistance_levels": [69000.0, 72000.0, 75000.0],
  "rsi": 42.3,
  "macd_signal": "bullish",
  "trend": "uptrend",
  "risk_reward": 2.1,
  "on_chain": {
    "hash_rate": 621000000000000000000,
    "difficulty": 88100744036480,
    "mempool_size": 4200,
    "volume_24h": 28000000000,
    "market_cap": 1325000000000,
    "btc_dominance_rank": 1
  }
}
```

**Error responses:**
```json
HTTP 400: {"detail": "Not enough candle data for BTC/USDT 1h. Run backfill first."}
```

---

### 8.5 Error Responses

All API errors follow the FastAPI default format:

```json
{
  "detail": "Human-readable error message"
}
```

| Status Code | Meaning |
|---|---|
| `400 Bad Request` | Invalid parameters or business logic error |
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Authenticated but not authorized (e.g. email not confirmed) |
| `404 Not Found` | Requested resource does not exist |
| `422 Unprocessable Entity` | Request body failed Pydantic validation |
| `500 Internal Server Error` | Unhandled exception — check server logs |

---

## 9. WebSocket Protocol

### 9.1 Connection

Connect to the WebSocket endpoint:

```
ws://localhost:8000/stream
wss://yourdomain.com/stream   (production with TLS)
```

Connection is immediately accepted. The server does not require authentication at the WebSocket level — authentication can be added by passing a token as a query parameter if required.

```javascript
const ws = new WebSocket('ws://localhost:8000/stream');

ws.onopen = () => {
  console.log('Connected to Orbityx stream');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  handleMessage(msg);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
```

### 9.2 Subscribe / Unsubscribe

After connecting, send a JSON subscribe message to start receiving candle updates for a symbol:

**Subscribe:**
```json
{
  "type": "subscribe",
  "symbol": "BTC/USDT",
  "timeframe": "1m"
}
```

**Unsubscribe:**
```json
{
  "type": "unsubscribe",
  "symbol": "BTC/USDT"
}
```

Multiple subscriptions per connection are supported. Each subscription runs its own independent update loop.

### 9.3 Server Message Types

The server sends four types of messages:

#### heartbeat

Sent every 30 seconds to keep the connection alive and allow clients to detect stale connections:

```json
{
  "type": "heartbeat",
  "ts": 1704067200000
}
```

#### candle

A complete OHLCV candle update for a subscribed symbol. The `payload` has the same shape as the REST candle response:

```json
{
  "type": "candle",
  "symbol": "BTC/USDT",
  "timeframe": "1m",
  "payload": {
    "timestamp": 1704067260000,
    "open": 42300.0,
    "high": 42420.0,
    "low": 42280.0,
    "close": 42395.0,
    "volume": 12.345
  }
}
```

#### trade

An individual tick/trade event with the latest execution price:

```json
{
  "type": "trade",
  "symbol": "BTC/USDT",
  "price": 42395.12,
  "ts": 1704067261500
}
```

#### error

Sent when a subscribe request references an unsupported symbol or timeframe:

```json
{
  "type": "error",
  "message": "Unsupported timeframe: 3m"
}
```

### 9.4 Connection Manager Internals

`backend/services/ws_manager.py` manages all active WebSocket connections.

```python
class WebSocketManager:
    def __init__(self):
        # active_connections: { symbol → [ WebSocket, ... ] }
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, symbol: str):
        await websocket.accept()
        self.active_connections.setdefault(symbol, []).append(websocket)

    def disconnect(self, websocket: WebSocket, symbol: str):
        connections = self.active_connections.get(symbol, [])
        if websocket in connections:
            connections.remove(websocket)

    async def broadcast(self, symbol: str, message: dict):
        dead = []
        for ws in self.active_connections.get(symbol, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, symbol)
```

The broadcast loop runs as an `asyncio` background task. It fetches the latest candle from CCXT at a configurable interval (default: 5 seconds for 1m, 60 seconds for 1h) and broadcasts it to all subscribed connections.

---

## 10. AI Signal Engine

### 10.1 OrbityxPredictor Overview

`backend/services/ai_predictor.py` contains `OrbityxPredictor`, a pure-NumPy technical analysis engine that computes a full trading signal from a set of OHLCV candles. No external ML framework, no internet connection required — the predictor works entirely from data already in the local database.

```python
from backend.services.ai_predictor import OrbityxPredictor

predictor = OrbityxPredictor()
result = predictor.predict(candles, symbol="BTC/USDT", timeframe="1h")
```

Where `candles` is a list of `CandleResponse` objects (or any objects with `.open`, `.high`, `.low`, `.close`, `.volume`, `.timestamp`).

### 10.2 Indicators Computed

| Indicator | Period / Parameters | Purpose |
|---|---|---|
| RSI | 14-period, Wilder smoothing | Overbought / oversold |
| MACD | EMA(12) − EMA(26), signal EMA(9) | Trend momentum and direction |
| Bollinger Bands | SMA(20), ±2σ | Volatility, squeeze, breakout |
| SMA | 20, 50, 200 | Trend direction and strength |
| ATR | 14-period | Volatility for SL/TP sizing |
| Support / Resistance | Swing high/low, 20-bar lookback | Structural price levels |
| Volume Profile | 20-bin histogram, Point of Control | High-volume price nodes |

### 10.3 RSI — Relative Strength Index

The RSI is computed using Wilder's exponential smoothing (not simple moving average), which matches the industry-standard calculation used by TradingView.

**Formula:**
```
RS  = Average Gain(14) / Average Loss(14)
RSI = 100 - (100 / (1 + RS))
```

**Implementation:**
```python
def _compute_rsi(self, closes: np.ndarray, period: int = 14) -> float:
    delta = np.diff(closes)
    gains = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)

    # Initial simple averages
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    # Wilder's smoothing for the remaining bars
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))
```

**Signal interpretation:**
- RSI < 30 → oversold → **bullish signal** (+2.5 score)
- RSI > 70 → overbought → **bearish signal** (−2.5 score)
- RSI 30–50 → neutral to slightly bullish (+0.5)
- RSI 50–70 → neutral to slightly bearish (−0.5)

### 10.4 MACD

The MACD uses three exponential moving averages.

**Formula:**
```
EMA_fast   = EMA(close, 12)
EMA_slow   = EMA(close, 26)
MACD_line  = EMA_fast - EMA_slow
Signal_line = EMA(MACD_line, 9)
Histogram  = MACD_line - Signal_line
```

**Signal interpretation:**
- MACD line > signal line → bullish (+1.5 score)
- MACD line < signal line → bearish (−1.5 score)
- Histogram growing → momentum accelerating
- Histogram shrinking → momentum weakening (divergence warning)

### 10.5 Bollinger Bands

**Formula:**
```
Middle = SMA(close, 20)
Upper  = Middle + 2 × StdDev(close, 20)
Lower  = Middle - 2 × StdDev(close, 20)
Width  = (Upper - Lower) / Middle
```

**Signal interpretation:**
- Close < Lower band → oversold, potential reversal (+1.5 score)
- Close > Upper band → overbought, potential reversal (−1.5 score)
- Width contracting (squeeze) → breakout imminent, no directional bias
- Width expanding rapidly → trend continuation

### 10.6 ATR — Average True Range

ATR measures the average daily price range and is the foundation for all risk calculations.

**Formula:**
```
True Range = max(
    high - low,
    |high - prev_close|,
    |low  - prev_close|
)
ATR(14) = EMA(True Range, 14)
```

**ATR multipliers by timeframe:**

| Timeframe | SL Multiplier | Rationale |
|---|---|---|
| `1m` | 1.5× | Short-term noise requires tight stops |
| `5m` | 1.8× | |
| `15m` | 2.0× | |
| `1h` | 2.5× | Standard swing trade |
| `4h` | 3.0× | |
| `1d` | 4.0× | Daily candle swings are wider |

### 10.7 Support and Resistance Detection

The predictor identifies swing highs and lows using a fixed-window lookback approach.

**Algorithm:**
```python
def _find_support_resistance(self, highs, lows, closes, window=20):
    supports = []
    resistances = []

    for i in range(window, len(closes) - window):
        # Swing high: local maximum within [i-window, i+window]
        if highs[i] == np.max(highs[i - window:i + window]):
            resistances.append(highs[i])

        # Swing low: local minimum within [i-window, i+window]
        if lows[i] == np.min(lows[i - window:i + window]):
            supports.append(lows[i])

    # Deduplicate levels within 0.5% of each other
    supports    = self._cluster_levels(sorted(supports))
    resistances = self._cluster_levels(sorted(resistances))

    return supports[-3:], resistances[:3]   # Return 3 nearest each side
```

**Clustering:** Two levels are merged into one if they are within `0.5%` of each other. The merged level is the arithmetic mean of all levels in the cluster. This prevents the predictor from returning many near-identical levels that would clutter the signal output.

### 10.8 Volume Profile and POC

The Volume Profile distributes total traded volume across 20 equally-spaced price bins between the period's low and high. The **Point of Control (POC)** is the price bin with the highest volume.

```python
def _compute_volume_profile(self, highs, lows, closes, volumes, bins=20):
    price_min = np.min(lows)
    price_max = np.max(highs)
    bin_edges = np.linspace(price_min, price_max, bins + 1)
    bin_volume = np.zeros(bins)

    for i in range(len(closes)):
        # Assign the candle's volume to its close price bin
        bin_idx = np.searchsorted(bin_edges[1:], closes[i])
        bin_idx = min(bin_idx, bins - 1)
        bin_volume[bin_idx] += volumes[i]

    poc_idx = np.argmax(bin_volume)
    poc_price = (bin_edges[poc_idx] + bin_edges[poc_idx + 1]) / 2
    return poc_price, bin_volume, bin_edges
```

The POC acts as a magnetic price level — price tends to gravitate toward it in the absence of other catalysts. The predictor adds the POC to the support/resistance list if it is not already within 0.5% of an existing level.

### 10.9 Signal Scoring System

Each indicator contributes a score to a central accumulator. The final confidence value is the accumulator normalized to `[0, 1]`.

| Condition | Score Delta |
|---|---|
| RSI < 30 (oversold) | +2.5 |
| RSI 30–45 | +0.5 |
| RSI 45–55 | 0.0 |
| RSI 55–70 | −0.5 |
| RSI > 70 (overbought) | −2.5 |
| MACD line > signal | +1.5 |
| MACD line < signal | −1.5 |
| Close > SMA 200 | +1.5 |
| Close < SMA 200 | −1.5 |
| Close > SMA 50 | +0.5 |
| Close < SMA 50 | −0.5 |
| Close < Bollinger Lower | +1.5 |
| Close > Bollinger Upper | −1.5 |
| Volume > 1.2× 20-bar average | ±0.5 (direction-dependent) |
| Close near POC (within 0.5%) | +0.3 |

**Maximum possible score:** +8.8 (all bullish signals firing)
**Minimum possible score:** −8.8

**Normalization:**
```python
confidence = (score + 8.8) / 17.6    # Maps [-8.8, 8.8] → [0.0, 1.0]
```

**Direction classification:**
- `confidence > 0.60` → `LONG` / `BUY`
- `confidence < 0.40` → `SHORT` / `SELL`
- `0.40 ≤ confidence ≤ 0.60` → `NEUTRAL` / `HOLD`

### 10.10 Stop-Loss and Take-Profit Logic

**Stop-loss calculation:**
```python
atr_mult = {
    "1m": 1.5, "5m": 1.8, "15m": 2.0,
    "1h": 2.5, "4h": 3.0, "1d": 4.0
}.get(timeframe, 2.5)

raw_sl_distance = atr * atr_mult

# For LONG: SL below entry
sl = entry - raw_sl_distance

# Snap to nearest support level if within 20% of raw SL distance
for s in supports:
    if abs(s - sl) / raw_sl_distance < 0.20:
        sl = s - (raw_sl_distance * 0.05)   # 5% buffer below support
        break
```

**Take-profit levels:**
- **TP1:** Nearest resistance above entry (LONG) / support below entry (SHORT)
- **TP2:** Second resistance / support
- **TP3:** Estimated projection using `entry + 2× (TP1 - entry)`

**Risk/Reward calculation:**
```python
risk    = abs(entry - stop_loss)
reward  = abs(take_profit_1 - entry)
rr      = reward / risk if risk > 0 else 0.0
```

Signals with `risk_reward < 1.5` are downgraded from `BUY`/`SELL` to `HOLD`.

### 10.11 On-Chain Data Integration

For BTC/USDT pairs, the predictor fetches live on-chain metrics from two public APIs:

**blockchain.info/stats:**
```json
{
  "hash_rate": 621000000000000000000,
  "difficulty": 88100744036480,
  "n_tx": 354291,
  "mempool_size": 4200
}
```

**CoinGecko /coins/bitcoin:**
```json
{
  "market_data": {
    "market_cap": {"usd": 1325000000000},
    "total_volume": {"usd": 28000000000},
    "circulating_supply": 19650000,
    "ath_change_percentage": {"usd": -8.52}
  },
  "market_cap_rank": 1
}
```

These metrics are included in the prediction response under the `on_chain` key and are informational only — they do not currently affect the confidence score.

### 10.12 Full Prediction Response

```python
return PredictionResponse(
    symbol=symbol,
    timeframe=timeframe,
    current_price=float(closes[-1]),
    predicted_price=float(take_profit_1),
    direction=direction,
    confidence=round(confidence, 4),
    signal=signal,
    stop_loss=round(stop_loss, 2),
    take_profit_1=round(take_profit_1, 2),
    take_profit_2=round(take_profit_2, 2),
    take_profit_3=round(take_profit_3, 2),
    support_levels=[round(s, 2) for s in supports],
    resistance_levels=[round(r, 2) for r in resistances],
    rsi=round(rsi, 2),
    macd_signal="bullish" if macd_line > macd_signal_line else "bearish",
    trend=trend,
    risk_reward=round(rr, 2),
    on_chain=on_chain_data,
)
```

---

## 11. Market Data Layer

### 11.1 CCXT Binance Connector

`backend/services/ccxt_service.py` wraps the CCXT library to provide a unified interface for fetching OHLCV data from Binance.

```python
import ccxt
from backend.config import settings

def get_exchange() -> ccxt.binance:
    return ccxt.binance({
        "apiKey": settings.binance_api_key or None,
        "secret": settings.binance_secret_key or None,
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })

def fetch_ohlcv(
    symbol: str,
    timeframe: str,
    limit: int = 1000,
    since: int | None = None,
) -> list[list]:
    """
    Returns raw CCXT OHLCV: [[timestamp, open, high, low, close, volume], ...]
    Timestamps are milliseconds.
    """
    exchange = get_exchange()
    return exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
```

**Public vs. authenticated access:**

- Without API keys: public endpoints only — OHLCV data, market info.
- With API keys: order placement, account balance (used by OrbityxAI, not by the API).

The Binance public API allows up to 1200 requests/minute. The CCXT `enableRateLimit=True` option automatically throttles requests to stay within limits.

### 11.2 CoinGecko Integration

Market cap and 24h statistics are fetched from the CoinGecko free API (no API key required, 30 requests/minute limit).

```python
import httpx

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

async def fetch_top_coins(limit: int = 50) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{COINGECKO_BASE}/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": limit,
                "page": 1,
                "sparkline": False,
            },
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()
```

CoinGecko responses are cached in-memory for 60 seconds to avoid hitting rate limits under concurrent user load.

### 11.3 Candle Backfill System

The backfill system fetches up to 12 months of historical OHLCV data from Binance and stores it in the local database.

**Backfill algorithm:**
```
1. Determine the earliest timestamp needed (now - 12 months)
2. Find the oldest candle timestamp in DB for this symbol/timeframe
3. Fetch 1000 candles at a time, moving backward from the oldest DB timestamp
4. Insert candles using INSERT OR IGNORE to avoid conflicts
5. Stop when we reach the target start date or no more data is available
```

```python
async def run_backfill(symbol: str, timeframe: str, db: Session):
    now_ms   = int(time.time() * 1000)
    start_ms = now_ms - (365 * 24 * 3600 * 1000)   # 1 year back

    # Find oldest existing candle
    oldest = db.query(func.min(OHLCV.timestamp)).filter(
        OHLCV.symbol == symbol,
        OHLCV.timeframe == timeframe,
    ).scalar()

    fetch_until = oldest or now_ms

    while fetch_until > start_ms:
        since = max(start_ms, fetch_until - batch_ms(timeframe, 1000))
        candles = fetch_ohlcv(symbol, timeframe, limit=1000, since=since)
        if not candles:
            break
        _bulk_insert(db, symbol, timeframe, candles)
        fetch_until = candles[0][0]   # earliest timestamp in this batch
```

### 11.4 Timeframe Support

All CCXT-supported Binance timeframes are available:

| Timeframe | String | Typical Use |
|---|---|---|
| 1 minute | `1m` | Scalping, HFT signals |
| 3 minutes | `3m` | Micro-scalping |
| 5 minutes | `5m` | Short-term trading |
| 15 minutes | `15m` | Intraday swing |
| 30 minutes | `30m` | Intraday swing |
| 1 hour | `1h` | Standard swing, AI signals |
| 2 hours | `2h` | |
| 4 hours | `4h` | Position trading |
| 6 hours | `6h` | |
| 8 hours | `8h` | |
| 12 hours | `12h` | |
| 1 day | `1d` | Long-term, trend context |
| 3 days | `3d` | |
| 1 week | `1w` | Macro trend |
| 1 month | `1M` | Macro trend |

---

## 12. Frontend Integration — Orbityx Chart Pro

### 12.1 FastAPIProvider Implementation

`frontend/src/providers/fastapi_provider.ts` implements the `DataProvider` interface from Orbityx Chart Pro to connect the chart library to the Orbityx backend.

```typescript
import type { DataProvider, OHLCVBar, InstrumentInfo, MarketStats } from '../../Orbityx-charts/src/types';

export class FastAPIProvider implements DataProvider {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    async fetchBars(
        symbol: string,
        timeframe: string,
        limit: number,
        to?: number,
    ): Promise<OHLCVBar[]> {
        const params = new URLSearchParams({
            symbol,
            timeframe,
            limit: String(limit),
            ...(to !== undefined ? { to: String(to) } : {}),
        });

        const response = await fetch(`${this.baseUrl}/api/candles?${params}`);
        if (!response.ok) {
            throw new Error(`Candles fetch failed: ${response.statusText}`);
        }

        const data: Array<{
            timestamp: number;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
        }> = await response.json();

        return data.map(c => ({
            time: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
        }));
    }

    async fetchMarketStats(instrumentId: string): Promise<MarketStats | null> {
        // Map chart instrument IDs to CoinGecko IDs
        const geckoId = this.toGeckoId(instrumentId);
        if (!geckoId) return null;

        const response = await fetch(`${this.baseUrl}/api/market/stats/${geckoId}`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
            price: data.current_price,
            change24h: data.price_change_24h,
            changePct24h: data.price_change_percentage_24h,
            high24h: data.high_24h,
            low24h: data.low_24h,
            volume24h: data.total_volume,
            marketCap: data.market_cap,
        };
    }

    private toGeckoId(symbol: string): string | null {
        const map: Record<string, string> = {
            'BTC/USDT': 'bitcoin',
            'ETH/USDT': 'ethereum',
            'SOL/USDT': 'solana',
            'BNB/USDT': 'binancecoin',
            'XRP/USDT': 'ripple',
            'ADA/USDT': 'cardano',
            'DOGE/USDT': 'dogecoin',
            'AVAX/USDT': 'avalanche-2',
            'DOT/USDT': 'polkadot',
            'MATIC/USDT': 'matic-network',
        };
        return map[symbol] ?? null;
    }
}
```

### 12.2 Instrument Registration

Register instruments in your chart entry point to enable the symbol selector:

```typescript
import OrbityxChart from './Orbityx-charts/src/main.js';
import { FastAPIProvider } from './providers/fastapi_provider.js';

const chart = new OrbityxChart({ canvasId: 'chartCanvas' });

chart
    .setProvider(new FastAPIProvider('http://localhost:8000'))
    .registerInstruments([
        { id: 'BTC/USDT',  symbol: 'BTC/USDT',  name: 'Bitcoin',  icon: '₿', iconColor: '#f7931a' },
        { id: 'ETH/USDT',  symbol: 'ETH/USDT',  name: 'Ethereum', icon: 'Ξ', iconColor: '#627eea' },
        { id: 'SOL/USDT',  symbol: 'SOL/USDT',  name: 'Solana',   icon: '◎', iconColor: '#9945ff' },
        { id: 'BNB/USDT',  symbol: 'BNB/USDT',  name: 'BNB',      icon: 'B', iconColor: '#f3ba2f' },
        { id: 'XRP/USDT',  symbol: 'XRP/USDT',  name: 'XRP',      icon: 'X', iconColor: '#346aa9' },
    ])
    .setWebSocketUrl('ws://localhost:8000/stream')
    .setDefaultTimeframe('1h')
    .setDefaultInstrument('BTC/USDT');

await chart.init();
```

### 12.3 WebSocket Streaming from Backend

The `FastAPIProvider` does not handle WebSocket streaming directly. Streaming is managed by the chart engine's `WebSocketService`, which connects to `/stream` and dispatches messages to the chart engine.

The chart engine expects the server to send messages matching the protocol described in Section 9.3. The `candle` message type maps directly to chart engine's `appendBar` method.

```typescript
// Internally, Orbityx Chart Pro handles:
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'candle' && msg.symbol === currentSymbol) {
        engine.appendBar(msg.payload);
    }
};
```

### 12.4 Lazy History Loading

When a user scrolls left (backward in time) past the currently loaded data, the chart engine calls `provider.fetchBars(symbol, timeframe, limit, to)` with the `to` parameter set to the timestamp of the oldest loaded bar.

This maps to:
```
GET /api/candles?symbol=BTC/USDT&timeframe=1h&limit=500&to=1699999200000
```

The backend queries:
```sql
SELECT * FROM ohlcv
WHERE symbol = 'BTC/USDT'
  AND timeframe = '1h'
  AND timestamp < 1699999200000
ORDER BY timestamp DESC
LIMIT 500
```

And returns candles in ascending order. The chart engine prepends them to the in-memory buffer.

### 12.5 OrbitScript Custom Indicators

With OrbitScript (`.orb` files), you can write custom indicators that run entirely on the client side against chart data. No server changes required.

**Example: Volume-weighted RSI overlay:**

```orbitscript
// @name      VW-RSI
// @version   1
// @overlay   false

let period = input.int("Period", 14, min=2, max=100)

let gains = 0.0
let losses = 0.0
let vw_gains = 0.0
let vw_losses = 0.0

for i in 1..period {
    let delta = close[i-1] - close[i]
    let w = volume[i-1]
    if delta > 0 {
        vw_gains = vw_gains + delta * w
        gains = gains + w
    } else {
        vw_losses = vw_losses + math.abs(delta) * w
        losses = losses + w
    }
}

let avg_gain = if gains > 0 { vw_gains / gains } else { 0.0 }
let avg_loss = if losses > 0 { vw_losses / losses } else { 0.0 }
let rs = if avg_loss == 0 { 100.0 } else { avg_gain / avg_loss }
let rsi = 100.0 - (100.0 / (1.0 + rs))

plot(rsi, color=colors.purple, title="VW-RSI")
hline(70, color=colors.red,   style="dashed")
hline(30, color=colors.green, style="dashed")
```

Load it in the chart:
```typescript
await chart.loadScript('/path/to/vw_rsi.orb');
```

---

## 13. Templates and Static Assets

### 13.1 Jinja2 Template Hierarchy

All HTML templates are in `backend/templates/` and use Jinja2 template inheritance via `base.html`.

```
base.html
├── index.html          (landing page)
├── introduce.html      (platform introduction)
├── chart.html          (full-screen chart view)
├── crypto_currency.html (multi-window dashboard)
├── btc_candlestick.html (BTC-specific view)
├── table.html          (market data table)
├── login.html          (auth: login)
├── register.html       (auth: register)
├── profile.html        (user profile)
└── settings.html       (account settings)
```

`navigation.html` is included as a partial in `base.html` via `{% include 'navigation.html' %}`.

**Template rendering in routers:**

```python
from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="backend/templates")

@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
```

### 13.2 Theme System

The platform supports dark and light themes. Theme state is persisted in `localStorage` and applied via a CSS class on `<html>`.

**ThemeToggle.ts logic:**
```typescript
const THEME_KEY = 'orbityx-theme';

function applyTheme(theme: 'dark' | 'light'): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateLogo(theme);
}

function updateLogo(theme: 'dark' | 'light'): void {
    const logo = document.querySelector<HTMLImageElement>('.nav-logo');
    if (logo) {
        logo.src = theme === 'dark'
            ? '/static/img/Black-theme-logo.png'
            : '/static/img/Light-theme-logo.png';
    }
}

// Initialize on page load
const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
applyTheme(savedTheme ?? 'dark');
```

CSS variables drive the visual theme:
```css
:root[data-theme="dark"] {
    --bg-primary:    #0f141b;
    --bg-secondary:  #1a2332;
    --text-primary:  #e2e8f0;
    --text-secondary:#94a3b8;
    --accent:        #22c55e;
    --border:        #2d3748;
}

:root[data-theme="light"] {
    --bg-primary:    #ffffff;
    --bg-secondary:  #f8fafc;
    --text-primary:  #1e293b;
    --text-secondary:#64748b;
    --accent:        #16a34a;
    --border:        #e2e8f0;
}
```

### 13.3 JavaScript Animations

| File | Purpose |
|---|---|
| `items_animation.ts` | Fade-in/slide-in animations for page elements using `IntersectionObserver` |
| `parallax_animations.ts` | Parallax depth effect on the intro page planets (`intro-planet-dark.png`) |
| `rotate_animations.ts` | Continuous CSS rotation for orbital ring graphics |
| `window_mode.ts` | Fullscreen toggle for chart containers |

All TypeScript files compile to their `.js` counterparts in the same directory via `tsc`.

---

## 14. Database Migrations — Alembic

### 14.1 Creating Migrations

After modifying `backend/models.py`, generate a new migration:

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "add_user_preferences_column"

# Create a blank migration (for custom SQL)
alembic revision -m "add_index_on_ohlcv_timestamp"
```

The generated file appears in `alembic/versions/`. Review it before applying — autogenerate is not perfect for all cases (e.g. it may miss index changes or custom constraints).

### 14.2 Applying Migrations

```bash
# Upgrade to latest revision
alembic upgrade head

# Upgrade by a specific number of steps
alembic upgrade +1

# Upgrade to a specific revision
alembic upgrade 0003
```

### 14.3 Reverting Migrations

```bash
# Revert one migration
alembic downgrade -1

# Revert to a specific revision
alembic downgrade 0001

# Revert all migrations (empty database)
alembic downgrade base
```

### 14.4 Switching to PostgreSQL

**Step 1: Install the driver**

```bash
pip install psycopg2-binary
```

**Step 2: Update DATABASE_URL in .env**

```env
DATABASE_URL=postgresql+psycopg2://orbityx_user:password@localhost:5432/orbityx_db
```

**Step 3: Create the database and user in PostgreSQL**

```sql
CREATE USER orbityx_user WITH PASSWORD 'password';
CREATE DATABASE orbityx_db OWNER orbityx_user;
GRANT ALL PRIVILEGES ON DATABASE orbityx_db TO orbityx_user;
```

**Step 4: Apply migrations**

```bash
alembic upgrade head
```

No other code changes are required — SQLAlchemy handles the dialect differences transparently.

---

## 15. Production Deployment

### 15.1 Environment Hardening

Before deploying to production:

1. **Generate a strong SECRET_KEY:**
   ```bash
   python -c "import secrets; print(secrets.token_hex(64))"
   ```

2. **Set ALLOWED_ORIGINS explicitly:**
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Use PostgreSQL** (see Section 14.4).

4. **Disable debug mode** — FastAPI does not have a debug flag, but Uvicorn does:
   ```bash
   uvicorn backend.main:app --no-access-log   # suppress per-request logs in prod
   ```

5. **Never expose the `/docs` endpoint in production** unless behind authentication:
   ```python
   app = FastAPI(docs_url=None, redoc_url=None)  # Disable in production
   ```

### 15.2 Uvicorn Multi-Worker Setup

```bash
# 4 workers for a 4-core server (recommended: 2× CPU cores + 1)
uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-level warning
```

> **Note:** WebSocket connections are not shared across workers. If you run multiple workers, use a Redis-backed WebSocket manager (e.g. via `broadcaster`) instead of the in-memory `WebSocketManager`.

For high-traffic WebSocket use, run a single Uvicorn worker behind an Nginx upstream that handles WebSocket sticky sessions, or use Gunicorn with the Uvicorn worker class:

```bash
gunicorn backend.main:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000
```

### 15.3 Nginx Reverse Proxy

```nginx
upstream orbityx_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # WebSocket endpoint
    location /stream {
        proxy_pass http://orbityx_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;     # Keep WS connections alive
        proxy_send_timeout 86400s;
    }

    # API and web app
    location / {
        proxy_pass http://orbityx_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location /static/ {
        proxy_pass http://orbityx_backend;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1024;
}
```

### 15.4 systemd Service

Create `/etc/systemd/system/orbityx.service`:

```ini
[Unit]
Description=Orbityx Platform
After=network.target postgresql.service

[Service]
Type=exec
User=orbityx
Group=orbityx
WorkingDirectory=/opt/orbityx
EnvironmentFile=/opt/orbityx/.env
ExecStart=/opt/orbityx/.venv/bin/uvicorn backend.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --log-level warning
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbityx

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/orbityx

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable orbityx
sudo systemctl start orbityx
sudo systemctl status orbityx
```

**View logs:**
```bash
sudo journalctl -u orbityx -f
sudo journalctl -u orbityx --since "1 hour ago"
```

### 15.5 Docker Deployment

**Dockerfile:**
```dockerfile
FROM python:3.12-slim

# Install Node.js for TypeScript build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies and build TypeScript
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run migrations and start server
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 2"]
```

**docker-compose.yml:**
```yaml
version: "3.9"

services:
  orbityx:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+psycopg2://orbityx:password@db:5432/orbityx
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: orbityx
      POSTGRES_PASSWORD: password
      POSTGRES_DB: orbityx
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbityx"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - orbityx
    restart: unless-stopped

volumes:
  pgdata:
```

**Run:**
```bash
docker compose up -d
docker compose logs -f orbityx
```

### 15.6 Railway Deployment

Railway is a simple cloud platform for deploying FastAPI apps without managing infrastructure.

**railway.toml** (already in `orbityxAI/` — create one in root):
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3

[[services]]
name = "orbityx-api"
```

**Deploy:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project and deploy
railway init
railway up

# Set environment variables
railway variables set SECRET_KEY=your-secret
railway variables set DATABASE_URL=postgresql+psycopg2://...
```

Railway automatically provides a PostgreSQL database via the Postgres plugin. The `DATABASE_URL` variable is injected automatically.

### 15.7 SSL / TLS with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (added by certbot automatically, verify)
sudo systemctl status certbot.timer

# Manual renewal test
sudo certbot renew --dry-run
```

---

## 16. Security Considerations

### 16.1 JWT Best Practices

- **SHORT expiry:** `ACCESS_TOKEN_EXPIRE_MINUTES=60` is a reasonable default. For high-security deployments, reduce to 15 minutes and implement token refresh.
- **Strong secret:** The `SECRET_KEY` must be at least 64 hex characters (256 bits). Use `secrets.token_hex(64)` to generate.
- **Algorithm:** HS256 is acceptable for single-server deployments. For multi-server setups, use RS256 with asymmetric keys.
- **Token storage (frontend):** Store the JWT in `httpOnly` cookies rather than `localStorage` to prevent XSS theft. The current implementation uses `Authorization: Bearer` headers — suitable for API clients and chart libraries.

### 16.2 CORS Configuration

In development:
```python
allow_origins=["*"]   # Acceptable only locally
```

In production — be explicit:
```python
allow_origins=["https://yourdomain.com", "https://www.yourdomain.com"]
allow_credentials=True
allow_methods=["GET", "POST", "PUT", "DELETE"]
allow_headers=["Authorization", "Content-Type"]
```

### 16.3 Rate Limiting

The backend does not include rate limiting by default. For production add `slowapi`:

```bash
pip install slowapi
```

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...
```

### 16.4 Secret Management

| Environment | Recommended approach |
|---|---|
| Development | `.env` file (never commit) |
| Docker | Docker secrets or env file |
| Railway | Railway Variables dashboard |
| AWS | AWS Secrets Manager |
| GCP | Google Secret Manager |
| Kubernetes | Kubernetes Secrets + external-secrets-operator |

---

## 17. Testing

### 17.1 Backend Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest

# Run with coverage report
pytest --cov=backend --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth.py -v
```

**Example test for the auth endpoint:**

```python
# tests/test_auth.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Register
        resp = await client.post("/api/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "testuser"
        assert data["is_active"] is False

@pytest.mark.asyncio
async def test_candles_empty():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/candles?symbol=BTC%2FUSDT&timeframe=1h&limit=10")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
```

### 17.2 Frontend Tests — Vitest

Orbityx Chart Pro has 318 passing tests in `Orbityx-charts/tests/`.

```bash
cd Orbityx-charts
npm install
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Tests cover:
- Math utilities (EMA, SMA, RSI, MACD calculations)
- Format utilities (price formatting, date formatting)
- DataManager candle buffer logic
- Chart engine viewport calculations
- OrbitScript parser and interpreter

### 17.3 Integration Testing

Integration tests verify the full stack: database → service → router → HTTP response.

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, get_db
from backend.main import app

TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    from httpx import TestClient
    return TestClient(app)
```

---

## 18. Monitoring and Logging

### 18.1 Structured Logging

The platform uses Python's standard `logging` module configured for structured JSON output in production.

```python
# backend/utils/logger.py
import logging
import sys

def configure_logging(level: str = "INFO"):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        '{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","msg":"%(message)s"}'
    ))
    logging.basicConfig(handlers=[handler], level=getattr(logging, level))

# Usage in any module
import logging
logger = logging.getLogger(__name__)

logger.info("Backfill started", extra={"symbol": "BTC/USDT", "timeframe": "1h"})
logger.error("Exchange request failed", exc_info=True)
```

### 18.2 Health Check Endpoint

Add a health check endpoint for load balancer and uptime monitoring:

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "timestamp": int(time.time()),
    }
```

Monitor with:
```bash
# Simple uptime check
curl http://localhost:8000/health

# Using a monitoring tool (e.g. UptimeRobot)
# HTTP keyword monitor: URL = https://yourdomain.com/health, keyword = "ok"
```

### 18.3 Request Tracing

Add request ID tracking for debugging distributed issues:

```python
import uuid
from fastapi import Request

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

---

## 19. Troubleshooting

### 19.1 Common Errors

#### `sqlalchemy.exc.OperationalError: no such table: users`

The database migrations have not been applied. Run:
```bash
alembic upgrade head
```

If the database file doesn't exist yet, SQLAlchemy will create it on first run, but Alembic must be run to create the schema.

#### `jose.exceptions.JWTError: Signature verification failed`

The `SECRET_KEY` in `.env` has changed since the token was issued. All existing tokens are invalidated. Users must log in again.

#### `pydantic_settings.env_settings.EnvSettingsError: field required`

A required environment variable is missing from `.env`. Check that all variables in `.env.example` are present in your `.env`.

#### `ImportError: No module named 'backend'`

The working directory is not the project root. Always run commands from the `Orbityx/` directory, not from `backend/`:
```bash
cd /path/to/Orbityx
python run.py         # Correct
```

#### `ModuleNotFoundError: No module named 'ccxt'`

Dependencies are not installed. Run:
```bash
pip install -r requirements.txt
```

Or the virtual environment is not activated:
```bash
source .venv/bin/activate
```

### 19.2 WebSocket Issues

#### WebSocket connection closes immediately

Check that Nginx (if used) has the correct `Upgrade` and `Connection` headers (see Section 15.3). Without them, Nginx treats the WebSocket handshake as a normal HTTP request and closes it.

#### No candle updates arriving over WebSocket

1. Confirm you sent a valid subscribe message after connecting.
2. Check that candles exist in the DB for the subscribed symbol/timeframe (`GET /api/candles`).
3. Check server logs for exceptions in the broadcast loop.

#### WebSocket disconnects after 60 seconds

This is Nginx's default `proxy_read_timeout`. Set it to `86400s` as shown in Section 15.3.

### 19.3 Database Issues

#### `sqlite3.OperationalError: database is locked`

Another process has a write lock on the SQLite database. This typically happens when running multiple Uvicorn workers with SQLite. Switch to PostgreSQL for multi-worker deployments.

#### Alembic migration conflict

```bash
# View current migration state
alembic current

# View migration history
alembic history --verbose

# Stamp the current state without running migrations (use if DB is already up-to-date)
alembic stamp head
```

### 19.4 CCXT / Exchange Issues

#### `ccxt.errors.NetworkError: Binance request failed`

Binance may be rate-limiting your IP. CCXT's `enableRateLimit=True` should prevent this, but if you're running multiple processes (e.g. the API + OrbityxAI simultaneously), the combined request rate may exceed the limit.

Solutions:
- Run OrbityxAI with a different Binance API key.
- Add `time.sleep(0.5)` between backfill batches in `ccxt_service.py`.

#### `ccxt.errors.BadSymbol: binance does not have market symbol SOL/USDT`

The symbol must be in CCXT format: `SOL/USDT`, not `SOLUSDT`. Check your `symbol` parameter in the request.

---

## 20. Configuration Reference

Complete list of all environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | **Yes** | — | JWT signing secret (min 32 chars) |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Token validity in minutes |
| `DATABASE_URL` | No | `sqlite:///./orbityx.db` | SQLAlchemy connection string |
| `BINANCE_API_KEY` | No | `` | Binance API key (optional for public data) |
| `BINANCE_SECRET_KEY` | No | `` | Binance secret key |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port (587 = STARTTLS) |
| `SMTP_USER` | No | `` | SMTP username / sender address |
| `SMTP_PASS` | No | `` | SMTP password or app password |
| `ALLOWED_ORIGINS` | No | `http://localhost:8000` | Comma-separated CORS origins |

**Database URL formats:**

| Database | URL Format |
|---|---|
| SQLite (file) | `sqlite:///./orbityx.db` |
| SQLite (memory) | `sqlite:///:memory:` |
| PostgreSQL | `postgresql+psycopg2://user:pass@host:5432/dbname` |
| PostgreSQL (async) | `postgresql+asyncpg://user:pass@host:5432/dbname` |

---

## 21. Glossary

| Term | Definition |
|---|---|
| **OHLCV** | Open, High, Low, Close, Volume — the five data points that define a candlestick |
| **Candlestick** | A visual representation of price movement over a time interval |
| **Timeframe** | The duration of a single candle (e.g. 1m, 1h, 1d) |
| **Backfill** | Process of fetching historical OHLCV data to populate the local database |
| **ATR** | Average True Range — a measure of market volatility |
| **RSI** | Relative Strength Index — a momentum oscillator (0–100 scale) |
| **MACD** | Moving Average Convergence Divergence — a trend-following momentum indicator |
| **Bollinger Bands** | Volatility bands placed above and below a moving average |
| **POC** | Point of Control — the price level with the highest traded volume in a period |
| **Support** | A price level where buying pressure prevents further decline |
| **Resistance** | A price level where selling pressure prevents further advance |
| **SMA** | Simple Moving Average |
| **EMA** | Exponential Moving Average (more weight on recent data) |
| **JWT** | JSON Web Token — a compact, self-contained token for authentication |
| **CORS** | Cross-Origin Resource Sharing — browser security policy for cross-domain requests |
| **ASGI** | Asynchronous Server Gateway Interface — the Python async web server standard |
| **WebSocket** | A protocol for full-duplex, low-latency bidirectional communication |
| **CCXT** | CryptoCurrency eXchange Trading — a unified Python library for exchange APIs |
| **CoinGecko** | A cryptocurrency data aggregator providing market cap and price data |
| **S/R** | Support / Resistance — structural price levels used in technical analysis |
| **R:R** | Risk-to-Reward ratio — `|TP - entry| / |SL - entry|` |
| **OrbitScript** | Orbityx Chart Pro's built-in scripting language for custom indicators |
| **DataProvider** | An interface in Orbityx Chart Pro that abstracts the data source |

---

## 22. FAQ

**Q: Can I use Orbityx Chart Pro with a data source other than this backend?**

Yes. Implement the `DataProvider` interface (4 methods: `fetchBars`, `fetchMarketStats`, and optionally `getInstruments`, `getSupportedTimeframes`) and pass your implementation to `chart.setProvider()`. The chart library is completely provider-agnostic. See `Orbityx-charts/README.md` for the full interface specification.

**Q: Can I use the AI predictor without the web interface?**

Yes. Import `OrbityxPredictor` directly:

```python
from backend.services.ai_predictor import OrbityxPredictor
from backend.services.ccxt_service import fetch_ohlcv

candles_raw = fetch_ohlcv("BTC/USDT", "1h", limit=200)
# Convert to list of objects with .open/.high/.low/.close/.volume/.timestamp
candles = [
    type("C", (), {"open": c[1], "high": c[2], "low": c[3],
                   "close": c[4], "volume": c[5], "timestamp": c[0]})()
    for c in candles_raw
]

predictor = OrbityxPredictor()
result = predictor.predict(candles, "BTC/USDT", "1h")
print(result.direction, result.confidence, result.stop_loss)
```

**Q: What is the difference between the AI predictor in the API and OrbityxAI?**

The API predictor (`backend/services/ai_predictor.py`) is a pure-NumPy signal engine that returns signals via REST. It has no exchange connection, no order placement capability, and no ML models.

OrbityxAI (`orbityxAI/`) is a fully autonomous trading bot with ML ensemble models, live exchange connectors, position management, and Telegram integration. It is a separate process that runs independently of the web server.

**Q: Can I run OrbityxAI and the web server simultaneously?**

Yes. They are independent processes. Be mindful of shared CCXT rate limits if both are querying Binance.

**Q: How do I add a new trading pair to the chart?**

Add it to the `registerInstruments()` call in your chart initialization code and add the CoinGecko ID mapping to `FastAPIProvider.toGeckoId()`. The candle data will be fetched and backfilled automatically on first load.

**Q: Does the platform support live trading from the web interface?**

Not in the current version. Live trading is handled exclusively by OrbityxAI. The web interface is a read-only analytics dashboard.

**Q: What happens if Binance is unavailable during a candle fetch?**

CCXT raises a `NetworkError`. The API returns a `500` response with a generic error message. Existing candles in the database remain available. The backfill endpoint should be retried manually once Binance is available.

**Q: Is the platform suitable for high-frequency trading?**

The REST-based architecture with SQLite is not suitable for HFT. For sub-second trade execution, you would need direct exchange WebSocket connections, an in-memory data store (Redis), and a trading engine that bypasses HTTP entirely. OrbityxAI's CHECKLIST strategy targets swing-to-position timeframes (M5 to D1) and is not an HFT system.

---

## 23. Contributing

### Contribution Areas

| Area | Good First Issues |
|---|---|
| Backend | New exchange connectors (Kraken, OKX), new AI indicator, PostgreSQL performance tuning |
| Frontend | New OrbitScript examples, new drawing tools, mobile touch support |
| OrbityxAI | New entry patterns, additional ML models, additional exchanges |
| Documentation | Typo fixes, examples, translations |
| Testing | Increase coverage, add integration tests |

### Development Workflow

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/Orbityx.git
cd Orbityx

# 3. Create a feature branch
git checkout -b feature/my-feature

# 4. Set up development environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install

# 5. Make changes, then run tests
pytest
cd Orbityx-charts && npm run test

# 6. Commit with a clear message
git commit -m "feat: add Kraken exchange connector"

# 7. Push and open a pull request
git push origin feature/my-feature
```

### Code Style

**Python:**
- Follow PEP 8
- Use type hints on all function signatures
- Maximum line length: 120 characters
- Use `black` for formatting: `black backend/`

**TypeScript:**
- Follow the existing ESLint config in `Orbityx-charts/.eslintrc`
- Use `prettier` for formatting: `npx prettier --write src/`
- All public API functions must have JSDoc comments

### Pull Request Guidelines

- PRs must reference a GitHub issue (create one if it doesn't exist)
- Include tests for new functionality
- Do not include unrelated refactors in feature PRs
- Update relevant documentation sections

---

## 24. Version History

### v2.0.0 (2026-03-28)

- **New:** Migrated from Flask to FastAPI with full async support
- **New:** Alembic database migrations
- **New:** Pydantic v2 schemas throughout
- **New:** Background candle backfill with `BackgroundTask`
- **New:** WebSocket connection manager with per-symbol subscriptions
- **New:** Orbityx Chart Pro v2 integration with `FastAPIProvider`
- **New:** OrbityxAI v7.3 as integrated sub-library
- **New:** Avatar upload and retrieval endpoints
- **Improved:** AI predictor now includes Volume Profile and POC analysis
- **Improved:** Support/Resistance level clustering with 0.5% radius
- **Fixed:** Duplicate candle insertion during concurrent backfills

### v1.5.0

- Added OrbityxAI trading bot integration
- Added on-chain BTC metrics to AI predictor
- Added CoinGecko market stats endpoint
- Migrated frontend to TypeScript with `tsc` build

### v1.0.0

- Initial release
- Flask backend with SQLite
- Binance OHLCV data via CCXT
- Basic RSI/MACD/Bollinger signal engine
- Orbityx Chart Pro v1 integration

---

## 25. Authors

**Boris Maltsev** — Platform architecture, FastAPI backend, AI signal engine, Orbityx Chart Pro

[![GitHub](https://img.shields.io/badge/GitHub-BorisMalts-181717?style=flat-square&logo=github)](https://github.com/BorisMalts)

**Andrey Karavaev** — Frontend development, TypeScript, animation system, UI/UX

[![GitHub](https://img.shields.io/badge/GitHub-Andre--wb-181717?style=flat-square&logo=github)](https://github.com/Andre-wb)

---

## 26. License

This project is licensed under the **Apache License 2.0**.

```
Copyright 2026 Boris Maltsev, Andrey Karavaev

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

See [LICENSE](./LICENSE) for the full text.

---

## 27. Disclaimer

**This software is provided for educational and informational purposes only.**

Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor. Past performance of any trading system or methodology is not necessarily indicative of future results.

- The AI signal engine, OrbityxPredictor, is a technical analysis tool. It does not constitute financial advice.
- OrbityxAI executes trades autonomously. You are solely responsible for any financial outcomes from running the bot with real funds.
- Always test with paper trading before deploying real capital.
- Never risk more than you can afford to lose entirely.

The authors and contributors of Orbityx accept no liability for financial losses incurred through the use of this software.

---

<div align="center">

Built with precision by **Boris Maltsev** and **Andrey Karavaev**

[GitHub](https://github.com/BorisMalts/Orbityx) · [Issues](https://github.com/BorisMalts/Orbityx/issues) · [Orbityx Chart Pro](Orbityx-charts/README.md) · [OrbityxAI](orbityxAI/README.md)

</div>
