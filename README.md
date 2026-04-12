# THORNado

THORNado is a React + Go visual concept for an AI trading terminal.

RUN DOCKER: docker compose up --build
AND OPEN Browser: http://localhost:5173/

## Prerequisites

- **Node.js** (for the Vite/React client)
- **Go 1.21+** (for the API gateway in `gateway/`)
- **Rust toolchain** (`cargo`, for Rust gateways in `gateway/`)

## Run (frontend only)

From the repo root:

```bash
npm install
npm run install:all
npm run dev
```

This starts **only** the **Frontend (Vite + React):** http://localhost:5173 — routes: `/` (landing), `/terminal`

## Run (gateway + execution + portfolio + chart + markets + frontend)

**Option A — six terminals (recommended)**

**Terminal 1 — execution gateway (Rust)**

```bash
cd gateway/execution
cargo run
```

Execution API: http://localhost:3003 — e.g. http://localhost:3003/health

**Terminal 2 — portfolio gateway (Rust, per-user balances/positions/orders/trades)**

```bash
cd gateway/portfolio
cargo run
```

Portfolio API: http://localhost:3006 — e.g. http://localhost:3006/health  
Snapshot: `GET /v1/portfolio/snapshot?subaccount_name=default`  
WS: `ws://localhost:3006/ws/v1/portfolio?subaccount_name=default`

**Terminal 3 — chart gateway (Rust + timeseries-db)**

```bash
cd gateway/chart
cargo run
```

Chart API: http://localhost:3004 — e.g. http://localhost:3004/health  
Candles snapshot: `GET /v1/candles?symbol=BTC-PERP&tf=1m&limit=300`  
Candles WS: `ws://localhost:3004/ws/v1/candles/BTC-PERP?tf=1m`

**Terminal 4 — markets gateway (Rust, symbols/tickers/funding)**

```bash
cd gateway/markets
cargo run
```

Markets API: http://localhost:3005 — e.g. http://localhost:3005/health  
Markets snapshot: `GET /markets/snapshot`  
Markets WS: `ws://localhost:3005/ws/v1/markets`

**Terminal 5 — gateway (Go)**

```bash
cd gateway
go run .
```

Echo API: http://localhost:3001 — e.g. http://localhost:3001/api/health  
Override the gateway port: `PORT=4000 go run .` (Unix).

By default Go gateway forwards `/api/execution/*` to `EXECUTION_SERVICE_URL=http://127.0.0.1:3003` and `/api/portfolio/*` to `PORTFOLIO_SERVICE_URL=http://127.0.0.1:3006`.
Portfolio gateway uses the network gateway subscriptions endpoint by default (for testnet: `wss://gateway.test.nado.xyz/v1/subscribe`). If needed, set `PORTFOLIO_NADO_WS_URL` explicitly.

**Terminal 6 — client** (from repo root)

```bash
npm run dev
```

**Option B — one command (execution + portfolio + chart + markets + gateway + client)**

```bash
npm run dev:all
```

This runs execution gateway, portfolio gateway, chart gateway, markets gateway, Go gateway and client together.

## Run (frontend + gateway + execution + portfolio + chart + markets + timescaledb in Docker)

Copy envs once:

```bash
cp .env.example .env
```

Then start the full stack:

```bash
docker compose up --build
```

Services:

- Frontend (Vite): http://localhost:5173
- Gateway API: http://localhost:3001
- Execution gateway: http://localhost:3003
- Portfolio gateway: http://localhost:3006
- Chart gateway: http://localhost:3004
- Markets gateway: http://localhost:3005
- TimescaleDB: localhost:5433 by default

Notes:

- The frontend container proxies `/api/*` to the `gateway` Compose service via `VITE_API_PROXY_TARGET=http://gateway:3001`.
- Local host-based frontend development still defaults to proxying `/api/*` to `http://127.0.0.1:3001`.

## Run (client only, from `client/`)

```bash
cd client
npm install   # first time only
npm run dev
```

## Stack

- React + Vite
- Tailwind CSS
- Go + Echo (`gateway/`)
- Rust + Axum (`gateway/execution/`, `gateway/portfolio/`, `gateway/orderbook/`, `gateway/chart/`, `gateway/markets/`)

## Docs

- [Authorization](docs/AUTH.md)
- [Execution Gateway](docs/EXECUTION_GATEWAY.md)
- [Chart Gateway](docs/CHART_GATEWAY.md)
- [Markets Gateway](docs/MARKETS_GATEWAY.md)
