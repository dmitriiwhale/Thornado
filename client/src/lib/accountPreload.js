import { NLP_PRODUCT_ID, ProductEngineType, QUOTE_PRODUCT_ID } from '@nadohq/shared'
import {
  DEFAULT_COLLATERAL_PRODUCT_ID,
  fetchQuoteProductSymbol,
  getSpotCollateralMeta,
  listSpotCollateralProducts,
} from './nadoSpotCollateral.js'

const SEARCH_SYMBOL_CHUNK = 48

export const MARKET_COMMAND_CENTER_STALE_MS = 60_000
export const TRANSFER_BOOTSTRAP_STALE_MS = 5 * 60_000
export const DW_PRODUCTS_STALE_MS = 5 * 60_000

function getClientOrThrow(getNadoClient) {
  const client = getNadoClient?.()
  if (!client) throw new Error('Client unavailable')
  return client
}

function classifyMarketTag(symbol, kind) {
  const s = String(symbol).toUpperCase()
  const base = s.split(/[\/-]/)[0] ?? s

  if (/USDJPY|GBPUSD|EURUSD|AUDUSD|USDCAD|NZDUSD/.test(s)) return 'forex'
  if (/\b(SPY|QQQ|IWM|DIA)\b/.test(s)) return 'indices'
  if (/\b(WTI|XAG|XAU|XPT)\b/.test(s) || /\b(OIL|GOLD|SILVER)\b/.test(s)) return 'commodity'
  if (
    /KPEPE|KBONK|PEPE|DOGE|FART|PUMP|PENGU|SHIB|MEME|TRUMP|BONK|FLOKI|WIF/.test(s)
  ) {
    return 'meme'
  }
  if (
    /UNI|AAVE|LINK|ENA|ONDO|LDO|CRV|MKR|COMP|SNX|ZRO|SKY|GMX|JUP|ASTER|WLFI|XPL|LIT/.test(base)
  ) {
    return 'defi'
  }
  if (
    /^(BTC|ETH|SOL|BNB|ARB|OP|MATIC|POL|AVAX|HYPE|INJ|ATOM|SEI|TON|ZK|LTC|BCH|XRP|ADA|NEAR|APT|SUI|STRK|CELO|ONE|MON|ZEC)$/.test(
      base,
    )
  ) {
    return 'chain'
  }
  return kind === 'perp' ? 'perp' : 'spot'
}

export function marketCommandCenterQueryKey(chainEnv) {
  return ['market-command-center', chainEnv]
}

export async function fetchMarketCommandCenterRows(getNadoClient) {
  const client = getClientOrThrow(getNadoClient)

  const markets = (await client.market.getAllMarkets()).filter((m) => {
    const pid = Number(m.productId)
    return pid !== QUOTE_PRODUCT_ID && pid !== NLP_PRODUCT_ID
  })
  const pids = markets.map((m) => m.productId)

  const symbolsById = {}
  for (let i = 0; i < pids.length; i += SEARCH_SYMBOL_CHUNK) {
    const slice = pids.slice(i, i + SEARCH_SYMBOL_CHUNK)
    const res = await client.context.engineClient.getSymbols({ productIds: slice })
    const obj = res?.symbols ?? {}
    for (const [key, v] of Object.entries(obj)) {
      const pid = v?.productId ?? key
      const sym = v?.symbol ?? v?.ticker
      if (sym != null && pid != null) symbolsById[String(pid)] = String(sym)
    }
  }

  const perpIds = markets
    .filter((m) => m.type === ProductEngineType.PERP)
    .map((m) => Number(m.productId))
  const spotIds = markets
    .filter((m) => m.type === ProductEngineType.SPOT)
    .map((m) => Number(m.productId))

  let perpPrices = {}
  if (perpIds.length) {
    try {
      perpPrices = await client.perp.getMultiProductPerpPrices({ productIds: perpIds })
    } catch {
      perpPrices = {}
    }
  }

  const oracleById = {}
  if (spotIds.length) {
    try {
      const oracleList = await client.context.indexerClient.getOraclePrices({
        productIds: spotIds,
      })
      for (const o of oracleList || []) {
        oracleById[o.productId] = o.oraclePrice
      }
    } catch {
      // optional
    }
  }

  const tickerByProductId = {}
  try {
    const ix = client.context?.indexerClient
    if (typeof ix?.getV2Tickers === 'function') {
      const tickers = await ix.getV2Tickers({ edge: true })
      for (const t of Object.values(tickers ?? {})) {
        if (t?.productId == null) continue
        tickerByProductId[Number(t.productId)] = t
      }
    }
  } catch {
    // optional
  }

  const rows = markets
    .map((m) => {
      const pid = Number(m.productId)
      const sym = symbolsById[String(pid)] ?? `Product ${pid}`
      const kind = m.type === ProductEngineType.PERP ? 'perp' : 'spot'
      let price = null
      if (kind === 'perp') {
        const p = perpPrices[pid] ?? perpPrices[String(pid)]
        if (p?.markPrice != null) {
          const bn = p.markPrice
          price = typeof bn.toNumber === 'function' ? bn.toNumber() : Number(bn)
        }
      } else {
        const o = oracleById[pid]
        if (o != null) {
          price = typeof o.toNumber === 'function' ? o.toNumber() : Number(o)
        }
      }
      const tag = classifyMarketTag(sym, kind)
      const tk = tickerByProductId[pid]
      const quoteVolume = tk?.quoteVolume
      const change24h = tk?.priceChangePercent24h
      return {
        productId: pid,
        symbol: sym,
        kind,
        price,
        tag,
        quoteVolume:
          typeof quoteVolume === 'number' && Number.isFinite(quoteVolume) ? quoteVolume : null,
        change24h:
          typeof change24h === 'number' && Number.isFinite(change24h) ? change24h : null,
      }
    })
    .filter((row) => row.price != null && Number.isFinite(row.price))

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol))
  return rows
}

export function transferBootstrapQueryKey(chainEnv, productId = DEFAULT_COLLATERAL_PRODUCT_ID) {
  return ['transfer-quote-bootstrap', chainEnv, Number(productId)]
}

export async function fetchTransferBootstrap(
  getNadoClient,
  productId = DEFAULT_COLLATERAL_PRODUCT_ID,
) {
  const client = getClientOrThrow(getNadoClient)
  const [quoteMeta, quoteSymbol] = await Promise.all([
    getSpotCollateralMeta(client, productId),
    fetchQuoteProductSymbol(client, productId),
  ])
  return { quoteMeta, quoteSymbol }
}

export function depositWithdrawProductsQueryKey(chainEnv) {
  return ['deposit-withdraw-products', chainEnv]
}

export async function fetchDepositWithdrawProducts(getNadoClient) {
  const client = getClientOrThrow(getNadoClient)
  return listSpotCollateralProducts(client)
}
