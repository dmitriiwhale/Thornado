import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  adaptPerpPositionsFromBalances,
  adaptSpotBalances,
  collectSpotTokenAddresses,
  adaptOrders,
  adaptPnl,
  adaptPositions,
  adaptRisk,
  adaptSummary,
  adaptTrades,
  deriveUnifiedMargin,
  isNonZeroOpenPosition,
  normalizePerpMarketLabel,
} from '../lib/portfolioAdapters.js'
import { fetchErc20Symbols } from '../lib/erc20TokenSymbols.js'

function getInvoker(target, name) {
  const fn = target?.[name]
  return typeof fn === 'function' ? fn.bind(target) : null
}

async function callFirstAvailable(methods, args) {
  for (const candidate of methods) {
    try {
      const v = candidate?.()
      if (typeof v === 'function') {
        return await v(args)
      }
    } catch {
      // Try next known method to stay compatible across SDK versions.
    }
  }
  return null
}

export function usePortfolioData({
  getNadoClient,
  enabled,
  ownerAddress,
  chainEnv,
  subaccountName = 'default',
}) {
  const summaryQuery = useQuery({
    queryKey: ['portfolio-summary', ownerAddress, chainEnv, subaccountName],
    enabled: Boolean(enabled && ownerAddress),
    queryFn: async () => {
      const client = getNadoClient?.()
      if (!client) throw new Error('Nado client unavailable')
      return client.subaccount.getSubaccountSummary({
        subaccountOwner: ownerAddress,
        subaccountName,
      })
    },
  })

  const rawBalances = summaryQuery.data?.balances ?? null

  const [positionsQuery, ordersQuery, tradesQuery, pnlQuery, riskQuery] = useQueries({
    queries: [
      {
        queryKey: ['portfolio-positions', ownerAddress, chainEnv, subaccountName],
        enabled: Boolean(enabled && ownerAddress),
        queryFn: async () => {
          const client = getNadoClient?.()
          if (!client) throw new Error('Nado client unavailable')
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountPositions'),
              () => getInvoker(client?.subaccount, 'getPositions'),
              () => getInvoker(client?.portfolio, 'getPositions'),
              () => getInvoker(client?.account, 'getPositions'),
            ],
            { subaccountOwner: ownerAddress, subaccountName },
          )
        },
      },
      {
        queryKey: ['portfolio-orders', ownerAddress, chainEnv, subaccountName],
        enabled: Boolean(enabled && ownerAddress),
        queryFn: async () => {
          const client = getNadoClient?.()
          if (!client) throw new Error('Nado client unavailable')
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountOrders'),
              () => getInvoker(client?.orders, 'getOpenOrders'),
              () => getInvoker(client?.order, 'getOpenOrders'),
              () => getInvoker(client?.portfolio, 'getOpenOrders'),
            ],
            { subaccountOwner: ownerAddress, subaccountName },
          )
        },
      },
      {
        queryKey: ['portfolio-trades', ownerAddress, chainEnv, subaccountName],
        enabled: Boolean(enabled && ownerAddress),
        queryFn: async () => {
          const client = getNadoClient?.()
          if (!client) throw new Error('Nado client unavailable')
          const indexer = client.context?.indexerClient
          if (typeof indexer?.getPaginatedSubaccountMatchEvents === 'function') {
            return indexer.getPaginatedSubaccountMatchEvents({
              subaccountOwner: ownerAddress,
              subaccountName,
              limit: 50,
            })
          }
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountTrades'),
              () => getInvoker(client?.trades, 'getTrades'),
              () => getInvoker(client?.archive, 'getTrades'),
              () => getInvoker(client?.portfolio, 'getTradeHistory'),
            ],
            { subaccountOwner: ownerAddress, subaccountName, limit: 50 },
          )
        },
      },
      {
        queryKey: ['portfolio-pnl', ownerAddress, chainEnv, subaccountName],
        enabled: Boolean(enabled && ownerAddress),
        queryFn: async () => {
          const client = getNadoClient?.()
          if (!client) throw new Error('Nado client unavailable')
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountPnl'),
              () => getInvoker(client?.portfolio, 'getPnl'),
              () => getInvoker(client?.account, 'getPnl'),
            ],
            { subaccountOwner: ownerAddress, subaccountName },
          )
        },
      },
      {
        queryKey: ['portfolio-risk', ownerAddress, chainEnv, subaccountName],
        enabled: Boolean(enabled && ownerAddress),
        queryFn: async () => {
          const client = getNadoClient?.()
          if (!client) throw new Error('Nado client unavailable')
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountRisk'),
              () => getInvoker(client?.portfolio, 'getRisk'),
              () => getInvoker(client?.account, 'getRisk'),
            ],
            { subaccountOwner: ownerAddress, subaccountName },
          )
        },
      },
    ],
  })

  const tradeProductIds = useMemo(() => {
    const ev = tradesQuery.data?.events
    if (!Array.isArray(ev)) return []
    const ids = ev.map((e) => e?.productId ?? e?.product_id ?? null).filter((x) => x != null)
    return Array.from(new Set(ids)).sort((a, b) => Number(a) - Number(b))
  }, [tradesQuery.data])

  const productIdsForSymbols = useMemo(() => {
    const fromBalances =
      Array.isArray(rawBalances) && rawBalances.length > 0
        ? rawBalances.map((b) => b?.productId ?? b?.product_id ?? null).filter((x) => x != null)
        : []
    const uniq = Array.from(new Set([...fromBalances, ...tradeProductIds]))
    return uniq.sort((a, b) => Number(a) - Number(b))
  }, [rawBalances, tradeProductIds])

  /** Large `productIds` arrays can yield incomplete `symbols` from the engine in one call. */
  const SYMBOL_QUERY_CHUNK = 48

  const symbolsQuery = useQuery({
    queryKey: [
      'portfolio-symbols',
      ownerAddress,
      chainEnv,
      subaccountName,
      productIdsForSymbols.join(','),
    ],
    enabled: Boolean(enabled && ownerAddress && productIdsForSymbols.length),
    queryFn: async () => {
      const client = getNadoClient?.()
      if (!client) throw new Error('Nado client unavailable')
      const ec = client.context.engineClient
      const ids = productIdsForSymbols
      const merged = { symbols: {} }
      for (let i = 0; i < ids.length; i += SYMBOL_QUERY_CHUNK) {
        const chunk = ids.slice(i, i + SYMBOL_QUERY_CHUNK)
        const res = await ec.getSymbols({ productIds: chunk })
        const obj = res?.symbols ?? {}
        if (obj && typeof obj === 'object') {
          Object.assign(merged.symbols, obj)
        }
      }
      return merged
    },
  })

  const symbolsByProductId = useMemo(() => {
    const symbolsObj = symbolsQuery.data?.symbols ?? null
    if (!symbolsObj || typeof symbolsObj !== 'object') return {}
    const map = {}
    for (const [key, v] of Object.entries(symbolsObj)) {
      const pid = v?.productId ?? key
      const sym = v?.symbol ?? v?.ticker ?? null
      if (sym != null && pid != null) map[String(pid)] = String(sym)
    }
    return map
  }, [symbolsQuery.data])

  const spotTokenAddresses = useMemo(() => {
    const raw = summaryQuery.data?.balances ?? []
    const addrs = collectSpotTokenAddresses(raw)
    return [...new Set(addrs.map((a) => String(a)))].sort()
  }, [summaryQuery.data])

  const spotTokenSymbolsQuery = useQuery({
    queryKey: [
      'portfolio-spot-erc20-symbols',
      chainEnv,
      spotTokenAddresses.join(','),
    ],
    enabled: Boolean(
      enabled && ownerAddress && spotTokenAddresses.length > 0,
    ),
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        const pc = client?.context?.publicClient
        if (!pc) return {}
        return await fetchErc20Symbols(pc, spotTokenAddresses)
      } catch {
        return {}
      }
    },
  })

  const summary = useMemo(() => adaptSummary(summaryQuery.data), [summaryQuery.data])
  const balances = useMemo(
    () =>
      adaptSpotBalances(
        summaryQuery.data?.balances ?? summary?.balances ?? [],
        symbolsByProductId,
        spotTokenSymbolsQuery.data ?? {},
      ),
    [
      summaryQuery.data,
      summary,
      symbolsByProductId,
      spotTokenSymbolsQuery.data,
    ],
  )
  const crossPositions = useMemo(
    () => adaptPositions(positionsQuery.data),
    [positionsQuery.data],
  )

  const perpPositionsFromBalances = useMemo(
    () =>
      adaptPerpPositionsFromBalances(
        summaryQuery.data?.balances ?? [],
        symbolsByProductId,
      ),
    [summaryQuery.data, symbolsByProductId],
  )

  const positions = useMemo(() => {
    const base =
      crossPositions?.length > 0
        ? crossPositions
        : perpPositionsFromBalances
    if (!base?.length) return base
    return base
      .filter(isNonZeroOpenPosition)
      .map((row) => ({
        ...row,
        market: normalizePerpMarketLabel(row.market),
      }))
  }, [crossPositions, perpPositionsFromBalances])
  const orders = useMemo(() => adaptOrders(ordersQuery.data), [ordersQuery.data])
  const trades = useMemo(
    () => adaptTrades(tradesQuery.data, symbolsByProductId),
    [tradesQuery.data, symbolsByProductId],
  )
  const pnl = useMemo(
    () => adaptPnl(pnlQuery.data, summary),
    [pnlQuery.data, summary],
  )
  const risk = useMemo(
    () => adaptRisk(riskQuery.data, summary),
    [riskQuery.data, summary],
  )

  const unifiedMargin = useMemo(
    () => deriveUnifiedMargin(summaryQuery.data),
    [summaryQuery.data],
  )

  const queries = [
    summaryQuery,
    symbolsQuery,
    positionsQuery,
    ordersQuery,
    tradesQuery,
    pnlQuery,
    riskQuery,
  ]
  const isLoadingAny = queries.some((q) => q.isLoading)
  const hasAnyError = queries.some((q) => q.error)

  return {
    summary,
    balances,
    positions,
    orders,
    trades,
    pnl,
    risk,
    unifiedMargin,
    queries: {
      summary: summaryQuery,
      symbols: symbolsQuery,
      spotTokenSymbols: spotTokenSymbolsQuery,
      positions: positionsQuery,
      orders: ordersQuery,
      trades: tradesQuery,
      pnl: pnlQuery,
      risk: riskQuery,
    },
    isLoadingAny,
    hasAnyError,
  }
}
