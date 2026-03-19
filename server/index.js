
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'THORNado server' })
})

app.get('/api/watchlist', (_req, res) => {
  res.json([
    { pair: 'BTC-USD', price: 108442, change: 2.81 },
    { pair: 'ETH-USD', price: 4182, change: 1.42 },
    { pair: 'SOL-USD', price: 242, change: -0.38 },
  ])
})

const server = app.listen(PORT, () => {
  console.log(`THORNado server listening on http://localhost:${PORT}`)
})

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to a free port and retry.`)
    process.exit(1)
  }

  console.error('Server failed to start:', error)
  process.exit(1)
})
