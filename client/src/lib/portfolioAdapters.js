function toNumber(value) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'bigint') return Number(value)
  if (typeof value?.toString === 'function') {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pick(obj, keys, fallback = null) {
  if (!obj) return fallback
  for (const key of keys) {
    if (obj[key] != null) return obj[key]
  }
  return fallback
}

function formatCompact(value, digits = 2) {
  const n = toNumber(value)
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(n)
}

function formatCurrency(value, digits = 2) {
  const n = toNumber(value)
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  }).format(n)
}

function formatSignedCurrency(value, digits = 2) {
  const n = toNumber(value)
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatCurrency(n, digits)}`
}

function formatPercent(value, digits = 2) {
  const n = toNumber(value)
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

function unwrapArray(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.rows)) return payload.rows
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.balances)) return payload.balances
  if (Array.isArray(payload.positions)) return payload.positions
  if (Array.isArray(payload.orders)) return payload.orders
  if (Array.isArray(payload.trades)) return payload.trades
  return []
}

export function adaptSummary(summary) {
  if (!summary) return null
  const balances = unwrapArray(summary.balances ?? summary)
  const maintenanceHealth = pick(summary.health?.maintenance, ['health'], null)
  const totalEquity = pick(summary, ['equity', 'totalEquity', 'accountValue'], null)
  const unrealizedPnl = pick(summary, ['unrealizedPnl', 'uPnl'], null)
  const realizedPnl = pick(summary, ['realizedPnl', 'rPnl'], null)

  return {
    exists: Boolean(summary.exists),
    balances,
    balancesCount: balances.length,
    maintenanceHealth:
      maintenanceHealth == null ? null : String(maintenanceHealth),
    totalEquity,
    unrealizedPnl,
    realizedPnl,
  }
}

export function adaptBalances(payload) {
  return unwrapArray(payload).map((row, idx) => {
    const symbol = pick(row, ['symbol', 'asset', 'token', 'name'], `Asset ${idx + 1}`)
    const total = pick(row, ['total', 'balance', 'amount', 'equity'])
    const available = pick(row, ['available', 'free', 'availableBalance'])
    const usdValue = pick(row, ['usdValue', 'valueUsd', 'notionalUsd', 'value'])
    return {
      id: `${symbol}-${idx}`,
      symbol: String(symbol),
      total,
      available,
      usdValue,
    }
  })
}

export function adaptPositions(payload) {
  return unwrapArray(payload).map((row, idx) => {
    const market = pick(row, ['market', 'symbol', 'instrument', 'product'], `Market ${idx + 1}`)
    const sideRaw = pick(row, ['side', 'direction'], '')
    const side = String(sideRaw || '').toUpperCase()
    const size = pick(row, ['size', 'quantity', 'qty', 'positionSize'])
    const entry = pick(row, ['entryPrice', 'avgEntryPrice', 'entry'])
    const mark = pick(row, ['markPrice', 'price', 'lastPrice'])
    const pnl = pick(row, ['unrealizedPnl', 'pnl', 'uPnl'])
    const notional = pick(row, ['notionalUsd', 'notional', 'valueUsd'])
    return {
      id: `${market}-${idx}`,
      market: String(market),
      side: side || '—',
      size,
      entry,
      mark,
      pnl,
      notional,
    }
  })
}

export function adaptOrders(payload) {
  return unwrapArray(payload).map((row, idx) => {
    const market = pick(row, ['market', 'symbol', 'instrument', 'product'], `Market ${idx + 1}`)
    const side = String(pick(row, ['side', 'direction'], '—')).toUpperCase()
    const price = pick(row, ['price', 'limitPrice', 'triggerPrice'])
    const size = pick(row, ['size', 'quantity', 'qty'])
    const status = String(pick(row, ['status', 'state'], 'open')).toUpperCase()
    const createdAt = pick(row, ['createdAt', 'timestamp', 'time'], null)
    return {
      id: String(pick(row, ['id', 'orderId', 'clientOrderId'], `${market}-${idx}`)),
      market: String(market),
      side,
      price,
      size,
      status,
      createdAt,
    }
  })
}

export function adaptTrades(payload) {
  return unwrapArray(payload).map((row, idx) => {
    const market = pick(row, ['market', 'symbol', 'instrument', 'product'], `Market ${idx + 1}`)
    const side = String(pick(row, ['side', 'direction'], '—')).toUpperCase()
    const price = pick(row, ['price', 'executionPrice'])
    const size = pick(row, ['size', 'quantity', 'qty'])
    const fee = pick(row, ['fee', 'feeUsd', 'fees'])
    const realizedPnl = pick(row, ['realizedPnl', 'pnl', 'rPnl'])
    const time = pick(row, ['timestamp', 'time', 'createdAt'], null)
    return {
      id: String(pick(row, ['id', 'tradeId'], `${market}-${idx}`)),
      market: String(market),
      side,
      price,
      size,
      fee,
      realizedPnl,
      time,
    }
  })
}

export function adaptPnl(payload, summary) {
  const source = payload || summary || {}
  const equity = pick(source, ['equity', 'totalEquity', 'accountValue'], summary?.totalEquity)
  const unrealized = pick(source, ['unrealizedPnl', 'uPnl'], summary?.unrealizedPnl)
  const realized = pick(source, ['realizedPnl', 'rPnl'], summary?.realizedPnl)
  const dayPnl = pick(source, ['dayPnl', 'dailyPnl', 'pnl24h'], null)
  const volume30d = pick(source, ['volume30d', 'tradingVolume30d', 'monthVolume'], null)
  const feeTier = pick(source, ['feeTier', 'tier'], null)
  const nlpBalance = pick(source, ['nlpBalance', 'nlpValue'], null)
  const apr = pick(source, ['apr', 'nlpApr'], null)
  return { equity, unrealized, realized, dayPnl, volume30d, feeTier, nlpBalance, apr }
}

export function adaptRisk(payload, summary) {
  const source = payload || summary || {}
  return {
    maintenanceHealth:
      pick(source.health?.maintenance, ['health'], summary?.maintenanceHealth) ??
      summary?.maintenanceHealth ??
      null,
    marginUsage: pick(source, ['marginUsage', 'marginUtilization', 'utilization'], null),
    leverage: pick(source, ['leverage', 'effectiveLeverage'], null),
    liquidationBuffer: pick(source, ['liquidationBuffer', 'liqBuffer'], null),
  }
}

/** Percent without leading + (for margin usage etc.). */
function formatPercentPlain(value, digits = 2) {
  const n = toNumber(value)
  if (n == null) return '—'
  return `${n.toFixed(digits)}%`
}

export const fmt = {
  compact: formatCompact,
  currency: formatCurrency,
  signedCurrency: formatSignedCurrency,
  percent: formatPercent,
  percentPlain: formatPercentPlain,
  number(value, digits = 4) {
    const n = toNumber(value)
    if (n == null) return '—'
    return n.toLocaleString('en-US', { maximumFractionDigits: digits })
  },
  datetime(value) {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString()
  },
}
