# THORNado

THORNado is a React + Go visual concept for an AI trading terminal.

## Prerequisites

- **Node.js** (for the Vite/React client)
- **Go 1.21+** (for the API gateway in `gateway/`)

## Run (one command)

From the repo root:

```bash
npm install
npm run install:all
npm run dev
```

This starts:

- **Frontend (Vite + React):** http://localhost:5173 — routes: `/` (landing), `/terminal`
- **Go gateway (Echo API):** http://localhost:3001 — e.g. http://localhost:3001/api/health

Override the gateway port: `PORT=4000 npm run dev` (Unix) or `set PORT=4000&& npm run dev` (Windows cmd).

## Run (two terminals)

If you prefer separate processes:

**Terminal 1 — gateway**

```bash
cd gateway
go run .
```

**Terminal 2 — client**

```bash
cd client
npm install   # first time only
npm run dev
```

## Stack

- React + Vite
- Tailwind CSS
- Go + Echo (`gateway/`)
