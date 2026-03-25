import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  adaptBalances,
  adaptIsolatedPositions,
  adaptPerpPositionsFromBalances,
  adaptOrders,
  adaptPnl,
  adaptPositions,
  adaptRisk,
  adaptSummary,
  adaptTrades,
  deriveUnifiedMargin,
} from '../lib/portfolioAdapters.js'

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
      return client.context.engineClient.getSymbols({
        productIds: productIdsForSymbols,
      })
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

  const isolatedPositionsQuery = useQuery({
    queryKey: ['portfolio-isolated-positions', ownerAddress, chainEnv, subaccountName],
    enabled: Boolean(enabled && ownerAddress),
    queryFn: async () => {
      const client = getNadoClient?.()
      if (!client) throw new Error('Nado client unavailable')
      // In this SDK version we only have isolated positions (cross positions endpoint is not exposed).
      return client.subaccount.getIsolatedPositions({
        subaccountOwner: ownerAddress,
        subaccountName,
      })
    },
  })

  const summary = useMemo(() => adaptSummary(summaryQuery.data), [summaryQuery.data])
  const balances = useMemo(
    () =>
      adaptBalances(
        summaryQuery.data?.balances ?? summary?.balances ?? [],
        symbolsByProductId,
      ),
    [summaryQuery.data, summary, symbolsByProductId],
  )
  const crossPositions = useMemo(
    () => adaptPositions(positionsQuery.data),
    [positionsQuery.data],
  )

  const isolatedPositions = useMemo(
    () =>
      adaptIsolatedPositions(
        isolatedPositionsQuery.data,
        symbolsByProductId,
      ),
    [isolatedPositionsQuery.data, symbolsByProductId],
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
    // Prefer standard positions when available; otherwise fall back to isolated positions.
    if (crossPositions?.length) return crossPositions
    if (isolatedPositions?.length) return isolatedPositions
    return perpPositionsFromBalances
  }, [crossPositions, isolatedPositions, perpPositionsFromBalances])
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
    isolatedPositionsQuery,
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
      positions: positionsQuery,
      isolatedPositions: isolatedPositionsQuery,
      orders: ordersQuery,
      trades: tradesQuery,
      pnl: pnlQuery,
      risk: riskQuery,
    },
    isLoadingAny,
    hasAnyError,
  }
}
