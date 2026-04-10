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

## Run (gateway + execution + chart + frontend)

**Option A — four terminals (recommended)**

**Terminal 1 — execution gateway (Rust)**

```bash
cd gateway/execution
cargo run
```

Execution API: http://localhost:3003 — e.g. http://localhost:3003/health

**Terminal 2 — chart gateway (Rust + timeseries-db)**

```bash
cd gateway/chart
cargo run
```

Chart API: http://localhost:3004 — e.g. http://localhost:3004/health  
Candles snapshot: `GET /v1/candles?symbol=BTC-PERP&tf=1m&limit=300`  
Candles WS: `ws://localhost:3004/ws/v1/candles/BTC-PERP?tf=1m`

**Terminal 3 — gateway (Go)**

```bash
cd gateway
go run .
```

Echo API: http://localhost:3001 — e.g. http://localhost:3001/api/health  
Override the gateway port: `PORT=4000 go run .` (Unix).

By default Go gateway forwards `/api/execution/*` to `EXECUTION_SERVICE_URL=http://127.0.0.1:3003`.

**Terminal 4 — client** (from repo root)

```bash
npm run dev
```

**Option B — one command (execution + chart + gateway + client)**

```bash
npm run dev:all
```

This runs execution gateway, chart gateway, Go gateway and client together.

## Run (frontend + gateway + execution + chart + timescaledb in Docker)

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
- Chart gateway: http://localhost:3004
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
- Rust + Axum (`gateway/execution/`, `gateway/orderbook/`, `gateway/chart/`)

## Docs

- [Authorization](docs/AUTH.md)
- [Execution Gateway](docs/EXECUTION_GATEWAY.md)
- [Chart Gateway](docs/CHART_GATEWAY.md)
