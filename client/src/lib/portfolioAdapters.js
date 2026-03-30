import BigNumber from 'bignumber.js'
import { getAddress, isAddress } from 'viem'

/** Engine / SDK health numbers use 18-decimal fixed point. */
const X18 = new BigNumber(10).pow(18)

/** UI label from engine symbol (e.g. `SOL-PERP` → `SOL`). */
export function normalizePerpMarketLabel(market) {
  const s = String(market ?? '').trim()
  if (!s) return s
  return s.replace(/-PERP$/i, '').trim() || s
}

function pickChecksumAddr(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!isAddress(s)) return null
  try {
    return getAddress(s)
  } catch {
    return null
  }
}

export function toBigNumberish(v) {
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
export function fromX18(bn) {
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
      if (Number.isFinite(n)) availableMargin = n
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

export function toNumber(value) {
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
 * For **spot**, do not use `row.symbol` from the summary — it often mirrors the ERC-20
 * ticker (e.g. WBTC) while `getSymbols` carries Nado market names (e.g. kBTC / kBTC/USDT0).
 */
function balanceLabelFromRow(row, idx) {
  const id = row.productId ?? row.product_id
  const kind = engineBalanceKind(row)

  if (kind === 'spot') {
    const addr = row.tokenAddr ?? row.token
    if (addr) return `Spot ${shortTokenAddr(addr)}`
    return id != null ? `Spot #${id}` : `Spot ${idx + 1}`
  }

  const sym = pick(row, ['symbol', 'asset', 'token', 'name'], null)
  if (sym != null && String(sym).trim() !== '') return String(sym).trim()
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

/**
 * Nado UI uses market names like kBTC for the wrapped BTC vault; engine / ERC-20 often say WBTC.
 */
function normalizeNadoSpotMarketSymbol(symbol) {
  const s = String(symbol ?? '').trim()
  if (!s) return s
  if (/^WBTC$/i.test(s)) return 'kBTC'
  if (/^WBTC\//i.test(s)) return s.replace(/^WBTC\//i, 'kBTC/')
  return s
}

export function adaptBalances(
  payload,
  symbolsByProductId,
  erc20SymbolByLowerAddress,
) {
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

    // On-chain ERC-20 `symbol()` only if engine `getSymbols` did not return a label for this product.
    // Otherwise wrapped tokens show contract tickers (e.g. WBTC) while Nado lists engine names (e.g. kBTC).
    if (
      kind === 'spot' &&
      tokenAddr &&
      erc20SymbolByLowerAddress &&
      typeof erc20SymbolByLowerAddress === 'object'
    ) {
      const engineSym =
        productId != null && symbolsByProductId
          ? symbolsByProductId[String(productId)]
          : null
      const hasEngineSymbol = engineSym != null && String(engineSym).trim() !== ''
      if (!hasEngineSymbol) {
        const onChain = erc20SymbolByLowerAddress[String(tokenAddr).toLowerCase()]
        if (onChain != null && String(onChain).trim() !== '') {
          symbol = String(onChain).trim()
        }
      }
    }

    const total = adaptBalanceAmount(row)
    const availableRaw = pick(row, ['available', 'free', 'availableBalance'], null)
    const availableNum =
      availableRaw != null ? adaptBalanceAmount({ ...row, amount: availableRaw }) : total

    const usdValue = deriveBalanceUsd(row)
    const { weightInitial, weightMaintenance } = pickRiskWeights(row)

    let displaySymbol = String(symbol)
    if (kind === 'spot') {
      displaySymbol = normalizeNadoSpotMarketSymbol(displaySymbol)
    }

    return {
      id: `${kind ?? 'bal'}-${productId ?? idx}-${idx}`,
      symbol: displaySymbol,
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

/** Unique spot `tokenAddr` values from raw summary balances (for ERC-20 symbol reads). */
export function collectSpotTokenAddresses(payload) {
  return unwrapArray(payload)
    .filter((row) => engineBalanceKind(row) === 'spot')
    .map((row) => row.tokenAddr ?? row.token)
    .filter((a) => a != null && String(a).trim() !== '')
}

/** Spot-only rows for the Balances UI; perps belong in Positions (see adaptPerpPositionsFromBalances). */
export function adaptSpotBalances(
  payload,
  symbolsByProductId,
  erc20SymbolByLowerAddress,
) {
  const rows = unwrapArray(payload).filter(
    (row) => engineBalanceKind(row) === 'spot',
  )
  return adaptBalances(rows, symbolsByProductId, erc20SymbolByLowerAddress)
}

/** Ignore float dust when deciding if a perp row is an open position. */
const NON_ZERO_POSITION_EPS = 1e-12

/**
 * True when `size` parses to a finite non-zero absolute value (open exposure).
 * Used by the Positions table to hide flat / dust perp product rows.
 */
export function isNonZeroOpenPosition(row) {
  const s = row?.size
  if (s == null) return false
  const n = toNumber(s)
  if (n == null || !Number.isFinite(n)) return false
  return Math.abs(n) > NON_ZERO_POSITION_EPS
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
    const margin = pick(row, ['margin', 'marginUsd', 'initialMargin', 'initial_margin'], null)
    const leverage = pick(row, ['leverage', 'effectiveLeverage'], null)
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
      margin,
      leverage,
    }
  })
}

/**
 * Cross perp positions are represented in `getSubaccountSummary().balances` as `BalanceWithProduct`
 * rows with:
 * - type = PERP
 * - amount = base position amount (x18)
 * - oraclePrice on the product (already decimals, not x18)
 * - vQuoteBalance (x18) – with amount defines implied avg entry as -vQuoteBalance/amount (see entryPriceFromPerpAmountAndVQuote).
 *
 * Side follows engine convention: **negative** base `amount` (x18) = short, **positive** = long
 * (same as `pickRiskWeights`). Prefer `BigNumber` sign over float `>= 0` to avoid mis-labeling.
 */
function perpSideFromRawAmount(rawAmt) {
  const b = toBigNumberish(rawAmt)
  if (b != null && !b.isNaN()) {
    if (b.isZero()) return '—'
    return b.isNegative() ? 'SHORT' : 'LONG'
  }
  const amtX18 = fromX18(rawAmt)
  const amtNum = amtX18 != null ? amtX18 : toNumber(rawAmt)
  if (amtNum == null) return '—'
  if (amtNum === 0) return '—'
  return amtNum >= 0 ? 'LONG' : 'SHORT'
}

/**
 * Implied average entry from engine balance: with uPnL = amount * mark + vQuoteBalance,
 * entry = -vQuoteBalance / amount (same convention as calcIndexerPerpBalanceValue in @nadohq/indexer-client).
 * Both values are x18 fixed-point from the engine.
 */
export function entryPriceFromPerpAmountAndVQuote(amountRaw, vQuoteRaw) {
  const amt = toBigNumberish(amountRaw)
  const vq = toBigNumberish(vQuoteRaw)
  if (!amt || !vq || amt.isNaN() || vq.isNaN() || amt.isZero()) return null
  const p = vq.negated().dividedBy(amt)
  const n = p.toNumber()
  if (!Number.isFinite(n) || !(Math.abs(n) > 0)) return null
  return Math.abs(n)
}

function trackedVarTotal(tv, cumulativeKey, unrealizedKey) {
  const c = toBigNumberish(tv?.[cumulativeKey])
  const u = toBigNumberish(tv?.[unrealizedKey])
  if ((c == null || c.isNaN()) && (u == null || u.isNaN())) return null
  let sum = new BigNumber(0)
  if (c != null && !c.isNaN()) sum = sum.plus(c)
  if (u != null && !u.isNaN()) sum = sum.plus(u)
  return sum
}

function perpPnlUsdFromAmountMarkAndQuote(amountRaw, markPrice, quoteRaw) {
  const amount = fromX18(amountRaw)
  const quote = fromX18(quoteRaw)
  const mark = toNumber(markPrice)
  if (amount == null || quote == null || mark == null) return null
  const pnl = amount * mark + quote
  return Number.isFinite(pnl) ? pnl : null
}

export function perpPositionKey(productId, isolated = false) {
  return `${String(productId)}:${isolated ? 'isolated' : 'cross'}`
}

export function entryPriceFromNetEntryUnrealized(amountRaw, netEntryUnrealizedRaw) {
  const amt = toBigNumberish(amountRaw)
  const netEntry = toBigNumberish(netEntryUnrealizedRaw)
  if (!amt || !netEntry || amt.isNaN() || netEntry.isNaN() || amt.isZero()) return null
  const price = netEntry.dividedBy(amt).abs()
  const n = price.toNumber()
  return Number.isFinite(n) ? n : null
}

export function calcPerpBalanceValueUsd(amountRaw, oraclePrice, vQuoteRaw) {
  return perpPnlUsdFromAmountMarkAndQuote(amountRaw, oraclePrice, vQuoteRaw)
}

export function calcUnrealizedPnlFromSnapshotEvent(snapshotEvent, exitPrice) {
  const amount = snapshotEvent?.state?.postBalance?.amount
  const netEntry = snapshotEvent?.trackedVars?.netEntryUnrealized
  const px = toNumber(exitPrice)
  if (amount == null || netEntry == null || px == null) return null
  const pnl = perpPnlUsdFromAmountMarkAndQuote(amount, px, toBigNumberish(netEntry)?.negated())
  return pnl
}

export function calcSpotUnrealizedPnlFromSnapshotEvent(
  snapshotEvent,
  oraclePrice = snapshotEvent?.state?.market?.product?.oraclePrice,
) {
  const productId = snapshotEvent?.productId
  if (productId === 0 || productId === '0') return 0
  const amount = toBigNumberish(snapshotEvent?.state?.postBalance?.amount)
  const price = toBigNumberish(oraclePrice)
  const netEntry = toBigNumberish(snapshotEvent?.trackedVars?.netEntryUnrealized)
  if (!amount || !price || !netEntry || amount.isNaN() || price.isNaN() || netEntry.isNaN()) {
    return null
  }
  const pnl = amount.multipliedBy(price).minus(netEntry)
  const n = fromX18(pnl)
  return n != null && Number.isFinite(n) ? n : null
}

export function calcRoeDenominatorUsdFromSnapshotEvent(snapshotEvent) {
  const netEntry = toBigNumberish(snapshotEvent?.trackedVars?.netEntryUnrealized)
  const longWeightInitial = toBigNumberish(snapshotEvent?.state?.market?.product?.longWeightInitial)
  if (!netEntry || !longWeightInitial || netEntry.isNaN() || longWeightInitial.isNaN()) return null
  const denominator = netEntry.abs().multipliedBy(new BigNumber(1).minus(longWeightInitial))
  const n = fromX18(denominator)
  return n != null && Number.isFinite(n) ? n : null
}

export function calcEstimatedLiqPriceFromBalance(row, maintenanceHealthRaw) {
  const maintHealth = toBigNumberish(maintenanceHealthRaw)
  const amount = toBigNumberish(row?.amount)
  const oraclePrice = toBigNumberish(row?.oraclePrice)
  const longWeightMaintenance = toBigNumberish(row?.longWeightMaintenance)
  const shortWeightMaintenance = toBigNumberish(row?.shortWeightMaintenance)
  if (
    !maintHealth ||
    !amount ||
    !oraclePrice ||
    !longWeightMaintenance ||
    !shortWeightMaintenance ||
    maintHealth.isNaN() ||
    amount.isNaN() ||
    oraclePrice.isNaN() ||
    longWeightMaintenance.isNaN() ||
    shortWeightMaintenance.isNaN() ||
    amount.isZero()
  ) {
    return null
  }

  if (amount.isPositive()) {
    const px = oraclePrice.minus(maintHealth.dividedBy(amount).dividedBy(longWeightMaintenance))
    const n = px.toNumber()
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const px = oraclePrice.plus(
    maintHealth.dividedBy(amount.abs()).dividedBy(shortWeightMaintenance),
  )
  const n = px.toNumber()
  const oracle = oraclePrice.toNumber()
  if (!Number.isFinite(n) || !Number.isFinite(oracle)) return null
  return n < oracle * 10 ? n : null
}

export function pickEstimatedExitPrice(isLong, latestMarketPrice, fallbackOraclePrice) {
  const bid = toNumber(latestMarketPrice?.bid)
  const ask = toNumber(latestMarketPrice?.ask)
  const safeBid = Number.isFinite(bid) && bid > 0 ? bid : null
  const safeAsk =
    Number.isFinite(ask) && ask > 0 && ask < 1e30 ? ask : null
  if (isLong) return safeBid ?? toNumber(fallbackOraclePrice)
  return safeAsk ?? toNumber(fallbackOraclePrice)
}

export function adaptCanonicalPerpPositions(
  crossPerpBalances,
  isolatedPositions,
  symbolsByProductId,
) {
  const crossRows = unwrapArray(crossPerpBalances)
    .filter((r) => engineBalanceKind(r) === 'perp')
    .map((row, idx) => {
      const productId = row.productId ?? row.product_id ?? null
      const symbol =
        productId != null && symbolsByProductId
          ? symbolsByProductId[String(productId)]
          : null
      const rawAmt = pick(row, ['amount', 'total', 'balance', 'equity'], null)
      const size = fromX18(toBigNumberish(rawAmt)?.abs())
      const oraclePrice = toNumber(row.oraclePrice)
      const notional =
        size != null && oraclePrice != null ? Math.abs(size * oraclePrice) : null
      return {
        id: `cross-${productId ?? idx}`,
        productId,
        market: String(symbol ?? (productId != null ? `Perp #${productId}` : `Perp ${idx + 1}`)),
        side: perpSideFromRawAmount(rawAmt),
        size,
        amount: rawAmt,
        oraclePrice,
        vQuoteBalance: row?.vQuoteBalance ?? null,
        notional,
        isolated: false,
        isoSubaccountName: null,
        row,
      }
    })

  const isoRows = unwrapArray(isolatedPositions).map((position, idx) => {
    const base = position?.baseBalance
    const quote = position?.quoteBalance
    const productId = base?.productId ?? null
    const symbol =
      productId != null && symbolsByProductId
        ? symbolsByProductId[String(productId)]
        : null
    const rawAmt = base?.amount ?? null
    const size = fromX18(toBigNumberish(rawAmt)?.abs())
    const oraclePrice = toNumber(base?.oraclePrice)
    const notional =
      size != null && oraclePrice != null ? Math.abs(size * oraclePrice) : null
    return {
      id: `isolated-${productId ?? idx}-${position?.subaccount?.subaccountName ?? idx}`,
      productId,
      market: String(symbol ?? (productId != null ? `Perp #${productId}` : `Perp ${idx + 1}`)),
      side: perpSideFromRawAmount(rawAmt),
      size,
      amount: rawAmt,
      oraclePrice,
      vQuoteBalance: base?.vQuoteBalance ?? null,
      notional,
      isolated: true,
      isoSubaccountName: position?.subaccount?.subaccountName ?? null,
      isoQuoteBalance: quote?.amount ?? null,
      isoHealths: position?.healths ?? null,
      row: base,
    }
  })

  return [...crossRows, ...isoRows]
}

/** productId string -> implied entry from `getSubaccountSummary` perp rows (for merging into API positions). */
export function buildEntryPriceByProductIdFromBalances(payload) {
  const out = {}
  const rows = unwrapArray(payload).filter((r) => engineBalanceKind(r) === 'perp')
  for (const row of rows) {
    const pid = row.productId ?? row.product_id
    if (pid == null) continue
    const rawAmt = pick(row, ['amount', 'total', 'balance', 'equity'], null)
    const e = entryPriceFromPerpAmountAndVQuote(rawAmt, row?.vQuoteBalance)
    if (e != null && Number.isFinite(e)) out[String(pid)] = e
  }
  return out
}

/**
 * Same formula as {@link entryPriceFromPerpAmountAndVQuote} on indexer `postBalance` from
 * `getMultiSubaccountSnapshots` — aligns with Nado UI, which is indexer-backed (engine can differ slightly).
 * Prefer cross (`isolated === false`) when the same product appears twice.
 */
/** Initial/maintenance health contribution (x18) → USD for perp row margin display. */
function marginUsdFromEnginePerpRow(row) {
  const hc = row?.healthContributions
  const initialHealth = toBigNumberish(hc?.initial)
  if (!initialHealth || initialHealth.isNaN()) return { initial: null, maintenance: null }
  const balanceValue = toBigNumberish(row?.amount)
    ?.multipliedBy(toBigNumberish(row?.oraclePrice) ?? new BigNumber(0))
    .plus(toBigNumberish(row?.vQuoteBalance) ?? new BigNumber(0))
  if (!balanceValue || balanceValue.isNaN()) return { initial: null, maintenance: null }
  const marginUsed = fromX18(BigNumber.maximum(0, balanceValue.minus(initialHealth)))
  return {
    initial: marginUsed != null && Number.isFinite(marginUsed) ? marginUsed : null,
    maintenance: null,
  }
}

export function buildMarginByProductIdFromBalances(payload) {
  const out = {}
  for (const row of unwrapArray(payload).filter((r) => engineBalanceKind(r) === 'perp')) {
    const pid = row.productId ?? row.product_id
    if (pid == null) continue
    const m = marginUsdFromEnginePerpRow(row)
    if (m.initial != null || m.maintenance != null) out[String(pid)] = m
  }
  return out
}

/**
 * Net funding PnL in quote (USD) from indexer account snapshot: cumulative + unrealized (x18).
 * Prefer cross-margin rows when the same product appears twice.
 */
export function extractNetFundingUsdByProductIdFromIndexerSnapshots(snapshotResponse) {
  const out = {}
  const snapshots = snapshotResponse?.snapshots
  if (!snapshots || typeof snapshots !== 'object') return out

  /** @type {Map<string, { usd: number, isolated: boolean }>} */
  const best = new Map()

  for (const subHex of Object.keys(snapshots)) {
    const byTs = snapshots[subHex]
    if (!byTs || typeof byTs !== 'object') continue
    for (const ts of Object.keys(byTs)) {
      const shot = byTs[ts]
      const balances = shot?.balances
      if (!Array.isArray(balances)) continue
      for (const ev of balances) {
        if (ev?.state?.type !== 1) continue
        const pid = ev.productId
        if (pid == null) continue
        const tv = ev.trackedVars
        if (!tv) continue
        const c = toBigNumberish(tv.netFundingCumulative)
        const u = toBigNumberish(tv.netFundingUnrealized)
        if ((c == null || c.isNaN()) && (u == null || u.isNaN())) continue
        let sum = new BigNumber(0)
        if (c != null && !c.isNaN()) sum = sum.plus(c)
        if (u != null && !u.isNaN()) sum = sum.plus(u)
        const usd = fromX18(sum)
        if (usd == null || !Number.isFinite(usd)) continue
        const key = String(pid)
        const isIso = Boolean(ev.isolated)
        const prev = best.get(key)
        if (!prev) best.set(key, { usd, isolated: isIso })
        else if (prev.isolated && !isIso) best.set(key, { usd, isolated: false })
      }
    }
  }

  for (const [k, v] of best) out[k] = v.usd
  return out
}

/** Sum of adapted funding `payment` amounts per productId (partial window — fallback only). */
export function aggregateFundingPaymentsUsdByProductId(adaptedFundingRows) {
  const sums = {}
  if (!Array.isArray(adaptedFundingRows)) return sums
  for (const r of adaptedFundingRows) {
    const pid = r.productId
    if (pid == null || r.payment == null) continue
    const k = String(pid)
    const n = Number(r.payment)
    if (!Number.isFinite(n)) continue
    sums[k] = (sums[k] ?? 0) + n
  }
  return sums
}

export function extractEntryPriceByProductIdFromIndexerSnapshots(snapshotResponse) {
  const out = {}
  const snapshots = snapshotResponse?.snapshots
  if (!snapshots || typeof snapshots !== 'object') return out

  /** @type {Map<string, { price: number, isolated: boolean }>} */
  const best = new Map()

  for (const subHex of Object.keys(snapshots)) {
    const byTs = snapshots[subHex]
    if (!byTs || typeof byTs !== 'object') continue
    for (const ts of Object.keys(byTs)) {
      const shot = byTs[ts]
      const balances = shot?.balances
      if (!Array.isArray(balances)) continue
      for (const ev of balances) {
        if (ev?.state?.type !== 1) continue
        const pid = ev.productId
        if (pid == null) continue
        const post = ev.state?.postBalance
        if (!post) continue
        const e = entryPriceFromPerpAmountAndVQuote(post.amount, post.vQuoteBalance)
        if (e == null || !Number.isFinite(e)) continue
        const key = String(pid)
        const isIso = Boolean(ev.isolated)
        const prev = best.get(key)
        if (!prev) best.set(key, { price: e, isolated: isIso })
        else if (prev.isolated && !isIso) best.set(key, { price: e, isolated: false })
      }
    }
  }

  for (const [k, v] of best) out[k] = v.price
  return out
}

/**
 * Current cross-margin perp metrics derived from the indexer snapshot, which exposes
 * entry and funding legs separately. This matches Nado more closely than raw `vQuoteBalance`.
 */
export function extractPerpSnapshotMetricsByProductId(snapshotResponse) {
  const out = {}
  const snapshots = snapshotResponse?.snapshots
  if (!snapshots || typeof snapshots !== 'object') return out

  /** @type {Map<string, { isolated: boolean, entry: number | null, fundingUsd: number | null, pnl: number | null, mark: number | null }>} */
  const best = new Map()

  for (const subHex of Object.keys(snapshots)) {
    const byTs = snapshots[subHex]
    if (!byTs || typeof byTs !== 'object') continue
    for (const ts of Object.keys(byTs)) {
      const shot = byTs[ts]
      const balances = shot?.balances
      if (!Array.isArray(balances)) continue
      for (const ev of balances) {
        if (ev?.state?.type !== 1) continue
        const pid = ev.productId
        if (pid == null) continue
        const post = ev.state?.postBalance
        if (!post) continue
        const fundingQuote = trackedVarTotal(
          ev.trackedVars,
          'netFundingCumulative',
          'netFundingUnrealized',
        )
        const entry = entryPriceFromPerpAmountAndVQuote(post.amount, post.vQuoteBalance)
        const fundingUsd = fundingQuote != null ? fromX18(fundingQuote) : null
        const mark = toNumber(ev.state?.market?.oraclePrice)
        const pnl =
          post.vQuoteBalance != null
            ? perpPnlUsdFromAmountMarkAndQuote(post.amount, mark, post.vQuoteBalance)
            : null
        const key = String(pid)
        const isIso = Boolean(ev.isolated)
        const prev = best.get(key)
        const next = { isolated: isIso, entry, fundingUsd, pnl, mark }
        if (!prev) best.set(key, next)
        else if (prev.isolated && !isIso) best.set(key, next)
      }
    }
  }

  for (const [k, v] of best) {
    out[k] = {
      entry: v.entry,
      fundingUsd: v.fundingUsd,
      pnl: v.pnl,
      mark: v.mark,
    }
  }
  return out
}

export function extractPerpSnapshotByPositionKey(snapshotResponse) {
  const out = {}
  const snapshots = snapshotResponse?.snapshots
  if (!snapshots || typeof snapshots !== 'object') return out

  for (const subHex of Object.keys(snapshots)) {
    const byTs = snapshots[subHex]
    if (!byTs || typeof byTs !== 'object') continue
    for (const ts of Object.keys(byTs)) {
      const shot = byTs[ts]
      const balances = shot?.balances
      if (!Array.isArray(balances)) continue
      for (const ev of balances) {
        if (ev?.state?.type !== 1) continue
        const pid = ev.productId
        if (pid == null) continue
        out[perpPositionKey(pid, Boolean(ev.isolated))] = ev
      }
    }
  }

  return out
}

export function extractTotalSpotUnrealizedPnlFromSnapshots(snapshotResponse) {
  const snapshots = snapshotResponse?.snapshots
  if (!snapshots || typeof snapshots !== 'object') return null

  let total = 0
  let seen = false

  for (const subHex of Object.keys(snapshots)) {
    const byTs = snapshots[subHex]
    if (!byTs || typeof byTs !== 'object') continue
    for (const ts of Object.keys(byTs)) {
      const shot = byTs[ts]
      const balances = shot?.balances
      if (!Array.isArray(balances)) continue
      for (const ev of balances) {
        if (ev?.isolated || ev?.state?.type !== 0) continue
        const pnl = calcSpotUnrealizedPnlFromSnapshotEvent(ev)
        if (pnl == null || !Number.isFinite(pnl)) continue
        total += pnl
        seen = true
      }
    }
  }

  return seen ? total : null
}

/**
 * @param {unknown} payload
 * @param {Record<string, string>} symbolsByProductId
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
      const bAmt = toBigNumberish(rawAmt)
      let size = null
      if (amtNum != null && Number.isFinite(amtNum)) {
        size = Math.abs(amtNum)
      } else if (bAmt != null && !bAmt.isNaN()) {
        const a = bAmt.abs().dividedBy(X18)
        size = a.isFinite() ? a.toNumber() : null
      }
      const side = perpSideFromRawAmount(rawAmt)

      const notional =
        oraclePx != null && size != null && Number.isFinite(oraclePx * size)
          ? oraclePx * size
          : null

      const pnlProxy =
        row?.vQuoteBalance != null
          ? perpPnlUsdFromAmountMarkAndQuote(rawAmt, oraclePx, row.vQuoteBalance)
          : null
      const tokenAddr = pickChecksumAddr(row.tokenAddr ?? row.token)

      const rawAmtForEntry = pick(row, ['amount', 'total', 'balance', 'equity'], null)
      const entryPrice = entryPriceFromPerpAmountAndVQuote(rawAmtForEntry, row?.vQuoteBalance)
      const marginUsd = marginUsdFromEnginePerpRow(row)

      return {
        id: `perp-bal-${productId ?? idx}-${idx}`,
        market: String(symbol ?? (productId != null ? `Perp #${productId}` : `Perp ${idx + 1}`)),
        productId,
        tokenAddr,
        side,
        size,
        entry: entryPrice,
        mark: oraclePx != null ? oraclePx : null,
        pnl: pnlProxy,
        notional,
        margin: marginUsd.initial,
        roeMargin: marginUsd.maintenance ?? marginUsd.initial,
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
    market: normalizePerpMarketLabel(String(sym)),
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
      market: normalizePerpMarketLabel(String(market)),
      side,
      price,
      size,
      fee,
      realizedPnl,
      time,
    }
  })
}

function fundingTimestampMs(row) {
  const ts = row?.timestamp
  if (ts == null) return null
  try {
    const raw = typeof ts === 'object' && typeof ts.toString === 'function' ? ts.toString() : String(ts)
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return n < 1e12 ? n * 1000 : n
  } catch {
    return null
  }
}

function bnToNumber(v) {
  const b = toBigNumberish(v)
  if (!b) return null
  const n = b.toNumber()
  return Number.isFinite(n) ? n : null
}

/**
 * Indexer interest/funding API: `fundingPayments` only (perp funding ticks).
 */
export function adaptFundingPayments(rows, symbolsByProductId = {}) {
  const list = unwrapArray(rows)
  const out = list.map((row, idx) => {
    const pid = row.productId ?? row.product_id
    const sym =
      (pid != null && symbolsByProductId[String(pid)]) ||
      (pid != null ? `Product ${pid}` : `Product ${idx + 1}`)
    const time = fundingTimestampMs(row)
    const payBn = toBigNumberish(row.paymentAmount)
    const paymentFromX18 = payBn != null && !payBn.isNaN() ? fromX18(payBn) : null
    const payment =
      paymentFromX18 != null && Number.isFinite(paymentFromX18)
        ? paymentFromX18
        : bnToNumber(row.paymentAmount)
    return {
      id: `${String(row.submissionIndex ?? 'f')}-${pid ?? idx}-${idx}`,
      productId: pid ?? null,
      market: normalizePerpMarketLabel(String(sym)),
      payment,
      annualRate: bnToNumber(row.annualPaymentRate),
      oraclePrice: bnToNumber(row.oraclePrice),
      isolated: Boolean(row.isolated),
      time,
    }
  })
  out.sort((a, b) => {
    const ta = a.time ?? 0
    const tb = b.time ?? 0
    return tb - ta
  })
  return out
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

/**
 * Cumulative realized PnL over time from adapted trade rows (oldest → newest).
 * Uses `time` when present; otherwise preserves fetch order via stable index.
 */
export function buildCumulativeRealizedPnlSeries(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return []
  const toNum = (v) => {
    if (v == null) return 0
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const rows = trades.map((t, i) => ({
    time: t.time != null ? Number(t.time) : null,
    rp: toNum(t.realizedPnl),
    i,
    market: t.market != null ? String(t.market) : null,
    side: t.side != null ? String(t.side) : null,
    id: t.id != null ? String(t.id) : null,
  }))
  rows.sort((a, b) => {
    if (a.time != null && b.time != null) return a.time - b.time
    if (a.time != null) return -1
    if (b.time != null) return 1
    return a.i - b.i
  })
  let sum = 0
  return rows.map((row, idx) => {
    const fillPnl = row.rp
    sum += row.rp
    return {
      time: row.time,
      cumulative: sum,
      fillPnl,
      market: row.market,
      side: row.side,
      tradeId: row.id,
      fillIndex: idx + 1,
      fillCount: rows.length,
    }
  })
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
