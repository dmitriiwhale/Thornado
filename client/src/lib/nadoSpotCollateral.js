import { ProductEngineType } from '@nadohq/shared'
import { erc20Abi, parseUnits } from 'viem'

export const DEFAULT_COLLATERAL_PRODUCT_ID = 0

/** Spot amounts from the engine (`getMaxWithdrawable`, balances) use 18-decimal fixed point (x18), not ERC20 raw units. */
export const ENGINE_AMOUNT_X18_DECIMALS = 18

/**
 * Convert engine x18 amount to token raw units (for `parseUnits` / `withdraw` args).
 * @param {bigint | { toString(): string }} x18
 * @param {number} tokenDecimals ERC20 decimals
 */
export function engineX18ToTokenRaw(x18, tokenDecimals) {
  const x = typeof x18 === 'bigint' ? x18 : BigInt(String(x18))
  const td = BigInt(tokenDecimals)
  const scale = 10n ** td
  const denom = 10n ** BigInt(ENGINE_AMOUNT_X18_DECIMALS)
  return (x * scale) / denom
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Nado deposit/withdraw picker: USDT0 (and USDT) + USDC — not every SPOT market from `getAllMarkets()`.
 * Pair-style symbols (e.g. BTC-USDT) are excluded.
 */
function isDepositCollateralTicker(symbol) {
  const raw = String(symbol ?? '').trim()
  if (!raw) return false
  const s = raw.toUpperCase()
  if (s.includes('-') || s.includes('/')) return false
  if (s === 'USDT0' || s === 'USDT') return true
  if (s.startsWith('USDC')) return true
  return false
}

function compareDepositCollateralRows(a, b) {
  const ua = String(a.symbol).toUpperCase()
  const ub = String(b.symbol).toUpperCase()
  const rank = (u) => {
    if (u.includes('USDT')) return 0
    if (u.includes('USDC')) return 1
    return 2
  }
  const d = rank(ua) - rank(ub)
  if (d !== 0) return d
  return a.productId - b.productId
}

/**
 * Spot collateral products shown in Nado-style deposit/withdraw (USDT0 + USDC, not all SPOT books).
 * @returns {Promise<Array<{ productId: number, tokenAddr: `0x${string}`, symbol: string }>>}
 */
export async function listSpotCollateralProducts(client) {
  const markets = await client.context.engineClient.getAllMarkets()
  const spots = markets.filter((m) => m.type === ProductEngineType.SPOT)
  const productIds = spots.map((s) => s.productId).sort((a, b) => Number(a) - Number(b))
  const symbolsById = {}
  if (productIds.length) {
    try {
      const res = await client.context.engineClient.getSymbols({ productIds })
      const obj = res?.symbols ?? {}
      for (const [k, v] of Object.entries(obj)) {
        const pid = v?.productId ?? k
        const sym = v?.symbol ?? v?.ticker ?? null
        if (sym != null && pid != null) symbolsById[String(pid)] = String(sym)
      }
    } catch {
      /* symbols optional */
    }
  }

  let chosen = spots
  if (Object.keys(symbolsById).length > 0) {
    chosen = spots.filter((s) => {
      const pid = Number(s.productId)
      const sym = symbolsById[String(pid)]
      // Quote (USDT0) is always product 0; `getSymbols` often omits it while still listing USDC.
      if (pid === DEFAULT_COLLATERAL_PRODUCT_ID) return true
      return sym != null && isDepositCollateralTicker(sym)
    })
  } else {
    chosen = spots.filter((s) => Number(s.productId) === DEFAULT_COLLATERAL_PRODUCT_ID)
  }

  const rows = chosen.map((s) => {
    const pid = s.productId
    const n = Number(pid)
    return {
      productId: n,
      tokenAddr: s.product.tokenAddr,
      symbol:
        symbolsById[String(pid)] ??
        (n === DEFAULT_COLLATERAL_PRODUCT_ID ? 'USDT0' : `Product ${pid}`),
    }
  })
  rows.sort(compareDepositCollateralRows)
  return rows
}

export async function getSpotCollateralMeta(client, productId = DEFAULT_COLLATERAL_PRODUCT_ID) {
  const markets = await client.context.engineClient.getAllMarkets()
  const spot = markets.find(
    (m) =>
      Number(m.productId) === Number(productId) && m.type === ProductEngineType.SPOT,
  )
  if (!spot?.product?.tokenAddr) {
    throw new Error(`Spot product ${productId} not found`)
  }
  const tokenAddr = spot.product.tokenAddr
  const decimals = await client.context.publicClient.readContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  return {
    productId,
    tokenAddr,
    decimals: Number(decimals),
  }
}

export function parseHumanAmount(amountStr, decimals) {
  const s = String(amountStr ?? '').trim()
  if (!s) throw new Error('Enter an amount')
  return parseUnits(s, decimals)
}

/**
 * Approve Endpoint if current allowance is below `amount` (raw units).
 */
export async function ensureDepositAllowance(client, { productId, amount }) {
  const owner = client.context.walletClient.account.address
  const endpointAddr = client.context.contractAddresses.endpoint
  const { tokenAddr } = await getSpotCollateralMeta(client, productId)
  const allowance = await client.context.publicClient.readContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, endpointAddr],
  })
  if (allowance >= amount) {
    return { skipped: true }
  }
  const txHash = await client.spot.approveAllowance({ productId, amount })
  return { skipped: false, txHash }
}

export async function executeDeposit(client, { subaccountName, productId, amount }) {
  return client.spot.deposit({
    subaccountName,
    productId,
    amount,
  })
}

export async function executeWithdraw(client, { subaccountOwner, subaccountName, productId, amount }) {
  return client.spot.withdraw({
    subaccountOwner,
    subaccountName,
    productId,
    amount,
  })
}

export async function fetchMaxWithdrawable(client, { subaccountOwner, subaccountName, productId }) {
  const v = await client.context.engineClient.getMaxWithdrawable({
    subaccountOwner,
    subaccountName,
    productId,
  })
  return v
}

/**
 * On-chain Endpoint: total submissions processed (see Nado contracts docs).
 * Used with indexer `submissionIndex`: finalized when submissionIndex < nSubmissions.
 */
export async function readNSubmissions(client) {
  return client.context.contracts.endpoint.read.nSubmissions()
}

/**
 * After a deposit/withdraw path, poll until the endpoint has advanced past `submissionIndex`
 * (per Nado docs: event is settled when submission_idx < nSubmissions).
 */
export async function pollUntilSubmissionFinalized(client, submissionIndex, options = {}) {
  const { maxAttempts = 40, delayMs = 2000 } = options
  const idx = typeof submissionIndex === 'bigint' ? submissionIndex : BigInt(submissionIndex)
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const n = await readNSubmissions(client)
      if (idx < n) return true
    } catch {
      // ignore transient RPC errors
    }
    await sleep(delayMs)
  }
  return false
}

/** Poll until Endpoint `nSubmissions` increases (e.g. after an on-chain deposit). */
export async function pollUntilNSubmissionsIncreased(client, before, options = {}) {
  const { maxAttempts = 45, delayMs = 2000 } = options
  const b = typeof before === 'bigint' ? before : BigInt(before)
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const n = await readNSubmissions(client)
      if (n > b) return true
    } catch {
      // ignore
    }
    await sleep(delayMs)
  }
  return false
}

/**
 * Latest collateral events (deposit / withdraw) for polling completion.
 */
export async function fetchLatestCollateralEvents(client, { subaccountOwner, subaccountName, limit = 5 }) {
  const idx = client.context.indexerClient
  if (typeof idx?.getPaginatedSubaccountCollateralEvents !== 'function') {
    return []
  }
  const res = await idx.getPaginatedSubaccountCollateralEvents({
    subaccountOwner,
    subaccountName,
    limit,
    eventTypes: ['deposit_collateral', 'withdraw_collateral'],
  })
  return res?.events ?? []
}
