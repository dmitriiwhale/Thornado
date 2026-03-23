import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  adaptBalances,
  adaptOrders,
  adaptPnl,
  adaptPositions,
  adaptRisk,
  adaptSummary,
  adaptTrades,
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
          return callFirstAvailable(
            [
              () => getInvoker(client?.subaccount, 'getSubaccountTrades'),
              () => getInvoker(client?.trades, 'getTrades'),
              () => getInvoker(client?.archive, 'getTrades'),
              () => getInvoker(client?.portfolio, 'getTradeHistory'),
            ],
            { subaccountOwner: ownerAddress, subaccountName, limit: 20 },
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

  const summary = useMemo(() => adaptSummary(summaryQuery.data), [summaryQuery.data])
  const balances = useMemo(
    () => adaptBalances(summaryQuery.data?.balances ?? summary?.balances ?? []),
    [summaryQuery.data, summary],
  )
  const positions = useMemo(
    () => adaptPositions(positionsQuery.data),
    [positionsQuery.data],
  )
  const orders = useMemo(() => adaptOrders(ordersQuery.data), [ordersQuery.data])
  const trades = useMemo(() => adaptTrades(tradesQuery.data), [tradesQuery.data])
  const pnl = useMemo(
    () => adaptPnl(pnlQuery.data, summary),
    [pnlQuery.data, summary],
  )
  const risk = useMemo(
    () => adaptRisk(riskQuery.data, summary),
    [riskQuery.data, summary],
  )

  const queries = [summaryQuery, positionsQuery, ordersQuery, tradesQuery, pnlQuery, riskQuery]
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
    queries: {
      summary: summaryQuery,
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
