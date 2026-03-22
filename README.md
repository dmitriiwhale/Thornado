# THORNado

THORNado is a React + Go visual concept for an AI trading terminal.

## Prerequisites

- **Node.js** (for the Vite/React client)
- **Go 1.21+** (for the API gateway in `gateway/`)

## Run (frontend only)

From the repo root:

```bash
npm install
npm run install:all
npm run dev
```

This starts **only** the **Frontend (Vite + React):** http://localhost:5173 — routes: `/` (landing), `/terminal`

## Run (gateway + frontend)

**Option A — two terminals (recommended)**

**Terminal 1 — gateway**

```bash
cd gateway
go run .
```

Echo API: http://localhost:3001 — e.g. http://localhost:3001/api/health  
Override the gateway port: `PORT=4000 go run .` (Unix).

**Terminal 2 — client** (from repo root)

```bash
npm run dev
```

**Option B — one command (both processes)**

```bash
npm run dev:all
```

This runs the gateway and the client together (same as the old `npm run dev` behavior).

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
