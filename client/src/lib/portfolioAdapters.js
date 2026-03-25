import BigNumber from 'bignumber.js'

/** Engine / SDK health numbers use 18-decimal fixed point. */
const X18 = new BigNumber(10).pow(18)

function toBigNumberish(v) {
  if (v == null) return null
  try {
    const s = typeof v === 'object' && typeof v.toString === 'function' ? v.toString() : String(v)
    const b = new BigNumber(s)
    return b.isNaN() ? null : b
  } catch {
    return null
  }
}

/** Convert x18 integer (or already-decimal BN) to JS number for display. */
function fromX18(bn) {
  const b = toBigNumberish(bn)
  if (!b) return null
  const d = b.dividedBy(X18)
  return d.isFinite() ? d.toNumber() : null
}

/**
 * Unified margin metrics from getSubaccountSummary (SubaccountSummaryState).
 * @see HealthStatus in @nadohq/shared — health, assets, liabilities (BigNumber, x18).
 */
export function deriveUnifiedMargin(summary) {
  const empty = {
    initialMarginUsagePercent: null,
    maintenanceMarginUsagePercent: null,
    availableMargin: null,
    fundsUntilLiquidation: null,
    hasHealth: false,
  }
  if (!summary?.health) return empty

  const hi = summary.health.initial
  const hm = summary.health.maintenance

  /** Same fixed-point scale on num/den — ratio does not need x18. */
  const pct = (assetsBn, liabBn) => {
    const a = toBigNumberish(assetsBn)
    const l = toBigNumberish(liabBn)
    if (!a || !l || a.isZero()) return null
    const p = l.dividedBy(a).multipliedBy(100)
    const n = p.toNumber()
    if (!Number.isFinite(n)) return null
    return Math.min(100, Math.max(0, n))
  }

  const initialMarginUsagePercent = hi ? pct(hi.assets, hi.liabilities) : null
  const maintenanceMarginUsagePercent = hm ? pct(hm.assets, hm.liabilities) : null

  let availableMargin = null
  if (hm) {
    const a = toBigNumberish(hm.assets)
    const l = toBigNumberish(hm.liabilities)
    if (a && l) {
      const excess = a.minus(l).dividedBy(X18)
      const n = excess.toNumber()
      if (Number.isFinite(n)) availableMargin = Math.max(0, n)
    }
  }

  const fundsUntilLiquidation = hm ? fromX18(hm.health) : null

  return {
    initialMarginUsagePercent,
    maintenanceMarginUsagePercent,
    availableMargin,
    fundsUntilLiquidation,
    hasHealth: true,
  }
}

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

/** Nado BalanceWithProduct: type is ProductEngineType (0 = SPOT, 1 = PERP). */
function engineBalanceKind(row) {
  const t = row?.type
  if (t === 0 || t === '0' || t === 'SPOT' || t === 'spot') return 'spot'
  if (t === 1 || t === '1' || t === 'PERP' || t === 'perp') return 'perp'
  return null
}

function shortTokenAddr(addr) {
  if (!addr || typeof addr !== 'string') return ''
  const a = addr.trim().toLowerCase()
  if (a.length < 12) return addr
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/**
 * Engine rows omit `symbol`; use product type, id, and spot token address.
 */
function balanceLabelFromRow(row, idx) {
  const sym = pick(row, ['symbol', 'asset', 'token', 'name'], null)
  if (sym != null && String(sym).trim() !== '') return String(sym).trim()

  const id = row.productId ?? row.product_id
  const kind = engineBalanceKind(row)

  if (kind === 'spot') {
    const addr = row.tokenAddr ?? row.token
    if (addr) return `Spot ${shortTokenAddr(addr)}`
    return id != null ? `Spot #${id}` : `Spot ${idx + 1}`
  }
  if (kind === 'perp') {
    return id != null ? `Perp #${id}` : `Perp ${idx + 1}`
  }
  return id != null ? `Product #${id}` : `Balance ${idx + 1}`
}

/** Spot/perp `amount` from engine is x18 fixed-point. */
function adaptBalanceAmount(row) {
  const raw = pick(row, ['amount', 'total', 'balance', 'equity'], null)
  if (raw == null) return null
  const x18 = fromX18(raw)
  if (x18 != null) return x18
  return toNumber(raw)
}

function deriveBalanceUsd(row) {
  const explicit = pick(row, ['usdValue', 'valueUsd', 'notionalUsd', 'value'], null)
  if (explicit != null) return toNumber(explicit)
  const px = toNumber(row.oraclePrice)
  const amt = fromX18(row.amount)
  if (px == null || amt == null) return null
  return px * amt
}

/** Long vs short risk weights: use short weights when base position amount is negative (perp short). */
function pickRiskWeights(row) {
  const rawAmt = pick(row, ['amount', 'total', 'balance', 'equity'], null)
  const b = toBigNumberish(rawAmt)
  const useShort = b != null && b.isNegative()
  if (useShort) {
    return {
      weightInitial: toNumber(row.shortWeightInitial),
      weightMaintenance: toNumber(row.shortWeightMaintenance),
    }
  }
  return {
    weightInitial: toNumber(row.longWeightInitial),
    weightMaintenance: toNumber(row.longWeightMaintenance),
  }
}

/**
 * Engine summary has no top-level unrealized PnL; perp rows carry `vQuoteBalance` (x18 quote leg).
 * Sum across perps as account-level uPnL proxy when indexer PnL is unavailable.
 */
function deriveUnrealizedPnlFromRawBalances(rawBalances) {
  const rows = unwrapArray(rawBalances)
  if (!rows.length) return 0
  let sum = new BigNumber(0)
  let hasPerpQuote = false
  for (const row of rows) {
    if (row?.vQuoteBalance == null) continue
    hasPerpQuote = true
    const x = fromX18(row.vQuoteBalance)
    if (x != null) sum = sum.plus(x)
  }
  if (!hasPerpQuote) return 0
  const n = sum.toNumber()
  return Number.isFinite(n) ? n : null
}

export function adaptBalances(payload, symbolsByProductId) {
  return unwrapArray(payload).map((row, idx) => {
    let symbol = balanceLabelFromRow(row, idx)
    const kind = engineBalanceKind(row)
    const productId = row.productId ?? row.product_id ?? null
    const tokenAddr = row.tokenAddr ?? row.token ?? null

    // If engine can resolve a "real" symbol for this productId, prefer it.
    // Example: Spot products -> ERC20 ticker like USDT/USDC/BTC.
    if (productId != null && symbolsByProductId) {
      const mapped = symbolsByProductId[String(productId)]
      if (mapped != null && String(mapped).trim() !== '') symbol = String(mapped).trim()
    }

    const total = adaptBalanceAmount(row)
    const availableRaw = pick(row, ['available', 'free', 'availableBalance'], null)
    const availableNum =
      availableRaw != null ? adaptBalanceAmount({ ...row, amount: availableRaw }) : total

    const usdValue = deriveBalanceUsd(row)
    const { weightInitial, weightMaintenance } = pickRiskWeights(row)

    return {
      id: `${kind ?? 'bal'}-${productId ?? idx}-${idx}`,
      symbol: String(symbol),
      kind,
      productId,
      tokenAddr: tokenAddr ? String(tokenAddr) : null,
      total,
      available: availableNum ?? total,
      usdValue,
      weightInitial,
      weightMaintenance,
    }
  })
}

export function adaptPositions(payload) {
  return unwrapArray(payload).map((row, idx) => {
    const market = pick(row, ['market', 'symbol', 'instrument', 'product'], `Market ${idx + 1}`)
    const productId = pick(row, ['productId', 'product_id'], null)
    const tokenAddr = pick(row, ['tokenAddr', 'token', 'baseTokenAddress'], null)
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
      productId,
      tokenAddr: tokenAddr ? String(tokenAddr) : null,
      side: side || '—',
      size,
      entry,
      mark,
      pnl,
      notional,
    }
  })
}

/**
 * Engine isolated positions shape (from getIsolatedPositions):
 * { subaccount, healths, baseBalance, quoteBalance }
 *
 * We map it into the same table row shape expected by the UI:
 * { market, side, size, entry, mark, pnl, notional }
 */
export function adaptIsolatedPositions(payload, symbolsByProductId) {
  return unwrapArray(payload).map((row, idx) => {
    const base = row?.baseBalance ?? row?.base_balance ?? {}
    const productId = base?.productId ?? base?.product_id ?? null

    const mappedSymbol =
      productId != null && symbolsByProductId
        ? symbolsByProductId[String(productId)]
        : null

    const oraclePx = toNumber(base?.oraclePrice)
    const rawSizeX18 = fromX18(base?.amount) ?? toNumber(base?.amount)
    const hasSize = rawSizeX18 != null
    const side = hasSize ? (rawSizeX18 >= 0 ? 'LONG' : 'SHORT') : '—'
    const size = hasSize ? Math.abs(rawSizeX18) : null

    const notional =
      oraclePx != null && size != null ? oraclePx * size : fromX18(base?.vQuoteBalance)

    const tokenAddr = base?.tokenAddr ?? base?.token ?? null

    return {
      id: `isol-${productId ?? idx}-${idx}`,
      market: mappedSymbol ?? (productId != null ? `Perp #${productId}` : `Perp ${idx + 1}`),
      productId,
      tokenAddr: tokenAddr ? String(tokenAddr) : null,
      side,
      size,
      entry: null,
      mark: null,
      pnl: null,
      notional,
    }
  })
}

/**
 * Cross perp positions are represented in `getSubaccountSummary().balances` as `BalanceWithProduct`
 * rows with:
 * - type = PERP
 * - amount = base position amount (x18)
 * - oraclePrice on the product (already decimals, not x18)
 * - vQuoteBalance (x18) – we use it as a proxy for unrealized pnl/quote leg.
 */
export function adaptPerpPositionsFromBalances(payload, symbolsByProductId) {
  const rows = unwrapArray(payload)
  return rows
    .filter((r) => engineBalanceKind(r) === 'perp')
    .map((row, idx) => {
      const productId = row.productId ?? row.product_id ?? null
      const symbol =
        productId != null && symbolsByProductId
          ? symbolsByProductId[String(productId)]
          : null

      const rawAmt = pick(row, ['amount', 'total', 'balance', 'equity'], null)
      const amtX18 = fromX18(rawAmt)
      const amtNum = amtX18 != null ? amtX18 : toNumber(rawAmt)

      const oraclePx = toNumber(row.oraclePrice)
      const size = amtNum != null ? Math.abs(amtNum) : null
      const side = amtNum == null ? '—' : amtNum >= 0 ? 'LONG' : 'SHORT'

      const notional =
        oraclePx != null && size != null && Number.isFinite(oraclePx * size)
          ? oraclePx * size
          : null

      const pnlProxy = row?.vQuoteBalance != null ? fromX18(row.vQuoteBalance) : null
      const tokenAddr = row.tokenAddr ?? row.token ?? null

      return {
        id: `perp-bal-${productId ?? idx}-${idx}`,
        market: String(symbol ?? (productId != null ? `Perp #${productId}` : `Perp ${idx + 1}`)),
        productId,
        tokenAddr: tokenAddr ? String(tokenAddr) : null,
        side,
        size,
        entry: null,
        mark: oraclePx != null ? oraclePx : null,
        pnl: pnlProxy,
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

function normalizeTradesRows(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.events)) return payload.events
  return unwrapArray(payload)
}

function isIndexerMatchEvent(row) {
  return (
    row &&
    typeof row === 'object' &&
    row.submissionIndex != null &&
    row.baseFilled != null &&
    row.postBalances != null &&
    row.preBalances != null
  )
}

/** Normalize API / legacy strings to LONG | SHORT | — */
export function normalizeTradeSide(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (s === 'BUY' || s === 'LONG') return 'LONG'
  if (s === 'SELL' || s === 'SHORT') return 'SHORT'
  if (s === '' || s === '—' || s === '-') return '—'
  return s
}

/** Tailwind classes for LONG (green) / SHORT (red) in trade tables */
export function tradeSideClass(side) {
  const n = normalizeTradeSide(side)
  if (n === 'LONG') return 'font-semibold text-emerald-400'
  if (n === 'SHORT') return 'font-semibold text-red-400'
  return 'text-slate-500'
}

function sideFromMatchEvent(row) {
  try {
    const pre = row.preBalances?.base?.amount
    const post = row.postBalances?.base?.amount
    const preBn = toBigNumberish(pre)
    const postBn = toBigNumberish(post)
    if (preBn && postBn) {
      const d = postBn.minus(preBn)
      if (d.isPositive()) return 'LONG'
      if (d.isNegative()) return 'SHORT'
    }
    const orderAmt = toBigNumberish(row.order?.amount)
    if (orderAmt && !orderAmt.isZero()) {
      return orderAmt.isPositive() ? 'LONG' : 'SHORT'
    }
  } catch {
    // fall through
  }
  return '—'
}

function adaptIndexerMatchRow(row, symbolsByProductId, idx) {
  const pid = row.productId ?? row.product_id
  const sym =
    (pid != null && symbolsByProductId[String(pid)]) ||
    (pid != null ? `Product ${pid}` : `Market ${idx + 1}`)
  const q = toBigNumberish(row.quoteFilled)
  const b = toBigNumberish(row.baseFilled)
  let price = null
  if (q && b && !b.isZero()) {
    const p = q.abs().dividedBy(b.abs())
    const n = p.toNumber()
    price = Number.isFinite(n) ? n : null
  }
  const size = fromX18(b?.abs())
  const fee = fromX18(row.totalFee)
  const realizedPnl = fromX18(row.realizedPnl)
  const ts = row.timestamp
  let time = null
  if (ts != null) {
    const raw = typeof ts === 'object' && typeof ts.toString === 'function' ? ts.toString() : String(ts)
    const n = Number(raw)
    if (Number.isFinite(n)) {
      time = n < 1e12 ? n * 1000 : n
    }
  }
  const idBase = row.digest ?? row.submissionIndex
  return {
    id: `${String(idBase != null ? idBase : 'trade')}-${idx}`,
    market: String(sym),
    side: sideFromMatchEvent(row),
    price,
    size,
    fee,
    realizedPnl,
    time,
  }
}

export function adaptTrades(payload, symbolsByProductId = {}) {
  const rows = normalizeTradesRows(payload)
  return rows.map((row, idx) => {
    if (isIndexerMatchEvent(row)) {
      return adaptIndexerMatchRow(row, symbolsByProductId, idx)
    }
    const market = pick(row, ['market', 'symbol', 'instrument', 'product'], `Market ${idx + 1}`)
    const side = normalizeTradeSide(pick(row, ['side', 'direction'], '—'))
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
  const pnlPayload = payload && typeof payload === 'object' ? payload : null
  const equity =
    pick(pnlPayload ?? {}, ['equity', 'totalEquity', 'accountValue'], null) ??
    summary?.totalEquity ??
    null

  const unrealizedExplicit =
    pick(pnlPayload ?? {}, ['unrealizedPnl', 'uPnl'], null) ??
    pick(summary ?? {}, ['unrealizedPnl', 'uPnl'], null)

  const unrealized =
    unrealizedExplicit != null
      ? unrealizedExplicit
      : summary
        ? deriveUnrealizedPnlFromRawBalances(summary.balances)
        : null

  const realized =
    pick(pnlPayload ?? {}, ['realizedPnl', 'rPnl'], null) ?? summary?.realizedPnl ?? null
  const dayPnl = pick(pnlPayload ?? {}, ['dayPnl', 'dailyPnl', 'pnl24h'], null)
  const volume30d = pick(pnlPayload ?? {}, ['volume30d', 'tradingVolume30d', 'monthVolume'], null)
  const feeTier = pick(pnlPayload ?? {}, ['feeTier', 'tier'], null)
  const nlpBalance = pick(pnlPayload ?? {}, ['nlpBalance', 'nlpValue'], null)
  const apr = pick(pnlPayload ?? {}, ['apr', 'nlpApr'], null)
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
  /** Risk weight from engine (0–1 fraction) → percent string. */
  weightPercent(value) {
    const n = toNumber(value)
    if (n == null) return '—'
    const pct = n <= 1 && n >= 0 ? n * 100 : n
    return formatPercentPlain(pct)
  },
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
