# THORNADO — Product Roadmap

<aside>
🌪️

**THORNADO** — Trading Terminal for DEX Nado

**Product Roadmap** · v1.0 · [thornado.xyz](http://thornado.xyz)

</aside>

---

### 1) Vision

Thornado is a professional-grade, web-based trading terminal for **Nado DEX**. It upgrades the core trading experience with deeper market visibility, advanced analytics, and productivity-first execution tooling.

### 2) Goals

- **Increase trader effectiveness** with real-time intelligence and decision support.
- **Reduce friction** in execution with a fast, configurable terminal UX.
- **Enable social alpha** via copy trading and transparent performance analytics.
- **Build a scalable foundation** for low-latency data and microservice APIs.

---

### 3) Core value propositions

| Advanced Analytics | Market Intelligence | Copy Trading | Trading UX |
| --- | --- | --- | --- |
| Standard + custom indicators (RSI, Bollinger Bands, MACD, EMA) with ML-assisted trend signals. | Live order books, top-account tracking, funding-rate monitoring, and volatility context. | Leaderboard of consistently profitable traders with transparent stats and follower controls. | Hotkeys, order presets, and a configurable layout optimized for speed. |

---

### 4) Product scope

#### 4.1 Market data collection engine

High-frequency service that aggregates and normalizes real-time and historical market data from Nado DEX.

| Data type | Description |
| --- | --- |
| **Market state** | Real-time snapshots of price action, volatility, and market conditions. |
| **Indicators** | Built-in indicators plus custom formula support. |
| **Order books** | Live level-2 depth (bids/asks) for microstructure and liquidity analysis. |
| **Trader accounts** | Positions and performance metrics for top-performing accounts (high win-rate). |
| **Funding rates** | History and real-time rates across instruments. |

#### 4.2 Statistical analysis core (ML engine)

The intelligence layer that converts market data into actionable signals.

- Trend direction classifier trained on historical price behavior
- Signal confidence scoring with adjustable thresholds
- Backtesting module for strategy evaluation
- Real-time recommendation engine connected to the live feed
- REST API exposing signals, features, and metrics to the frontend

#### 4.3 Copy trading system

Social layer that allows users to follow and automatically mirror top strategies with risk controls.

| Feature | Details |
| --- | --- |
| **Leaderboard** | Ranked traders by win-rate, PnL, and risk-adjusted performance. |
| **Copy mechanics** | One-click follow with position sizing and risk limits. |
| **Revenue share** | Automated fee distribution to strategy leaders from follower profits. |
| **Performance stats** | Drawdown, Sharpe ratio, trade history, and instrument-level analytics. |

#### 4.4 Trading terminal (frontend)

Professional web interface built around TradingView charts.

- TradingView integration with custom overlays
- Modular drag-and-drop layout (charts, order book, positions, PnL)
- Keyboard hotkeys for placement, cancel, and position management
- Order presets (size, leverage, TP/SL) for consistent execution
- Dark-mode-first design, desktop + tablet responsive

#### 4.5 Backend architecture

Microservices backend enabling low-latency pipelines and scalable APIs.

| Service | Responsibility |
| --- | --- |
| **Data collector** | Ingests and normalizes market data; persists to the historical store. |
| **ML engine API** | HTTP service wrapping the analysis core (signals + metrics). |
| **Copy trade service** | Follower graph, mirroring logic, and fee settlement. |
| **WebSocket gateway** | Pushes real-time updates to connected clients. |
| **Historical DB** | Time-series store for OHLCV + indicator snapshots. |

---

### 5) Development roadmap (phases)

Each phase produces testable deliverables before proceeding.

| # | Phase | Outcome |
| --- | --- | --- |
| **01** | **Research & architecture** | Problem definition, user research, architecture spec, and stack decision. |
| **02** | **Data infrastructure** | Market data collector + time-series storage (real-time + historical). |
| **03** | **Intelligence layer** | ML engine + backtests + internal/external REST API. |
| **04** | **Platform development** | Backend services + full trading terminal + copy trading integration. |
| **05** | **Deployment & launch** | Containerized production release and [thornado.xyz](http://thornado.xyz) launch. |

---

### 6) Delivery timeline (current status)

| Phase | Key deliverables | Status |
| --- | --- | --- |
| **Phase 1** | Architecture doc, tech stack decision, UX research summary | `Planned` |
| **Phase 2** | Live market data collector + historical OHLCV store | `Planned` |
| **Phase 3** | ML engine + REST API, backtest results, signal quality metrics | `Planned` |
| **Phase 4** | Staging terminal + copy trading end-to-end | `Planned` |
| **Phase 5** | Production launch on [thornado.xyz](http://thornado.xyz) (Docker + dedicated server) | `Planned` |

---

### 7) Infrastructure & deployment

| Component | Specification |
| --- | --- |
| **Domain** | [thornado.xyz](http://thornado.xyz) — purchased and DNS-configured for production. |
| **Server** | Dedicated server with low-latency connectivity to Nado endpoints. |
| **Containerization** | Docker + docker-compose orchestration for all services. |
| **Frontend** | React SPA served via CDN-backed static hosting. |
| **Backend API** | Rust/Go services behind a reverse proxy (Nginx). |
| **Databases** | Time-series DB (InfluxDB or TimescaleDB) + PostgreSQL for relational data. |

---

### 8) Business model

Thornado uses a transaction-based model aligned with trading activity.

| Revenue stream | Mechanism |
| --- | --- |
| **Order commission** | A small basis-point fee applied per order placed through the Thornado terminal. |

<aside>
🧪

**MVP access policy:** During MVP, the terminal is **free of charge**. The commission model can be introduced progressively after validation and user feedback.

</aside>

---

### 9) Success metrics (targets)

Initial 6-month KPI targets. Values are planning estimates and should be refined with real usage data.

| Metric | Month 1 | Month 3 | Month 6 |
| --- | --- | --- | --- |
| **Active users (MAU)** | 200 | 1,000 | 5,000 |
| **Monthly trading volume (via terminal)** | $500K | $5M | $25M |
| **Copy trading followers** | 50 | 300 | 1,500 |
| **Strategy leaders (leaderboard)** | 10 | 50 | 200 |
| **Terminal uptime** | 99% | 99.5% | 99.9% |

---

### 10) Request to Nado team (Builder Program)

Thornado is seeking official recognition under the Nado Builder Program and requests the following support.

| Request | Details |
| --- | --- |
| **Technical documentation** | API docs for order execution, market data endpoints, WebSocket feeds, account/position data, and funding rates. |
| **Integration support** | A designated technical contact for integration questions and edge cases (Phases 1–3). |
| **Early notice of changes** | Changelog notifications for breaking changes and deprecations to keep the terminal stable. |

In return, Thornado commits to delivering a stable, high-quality trading terminal that increases market transparency and improves the trading experience on Nado DEX.

---

Thornado — Trading Terminal for DEX Nado · [thornado.xyz](http://thornado.xyz) · Product Roadmap v1.0