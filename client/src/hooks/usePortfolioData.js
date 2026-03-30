import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  adaptPerpPositionsFromBalances,
  adaptCanonicalPerpPositions,
  aggregateFundingPaymentsUsdByProductId,
  calcEstimatedLiqPriceFromBalance,
  calcPerpBalanceValueUsd,
  calcRoeDenominatorUsdFromSnapshotEvent,
  calcUnrealizedPnlFromSnapshotEvent,
  entryPriceFromNetEntryUnrealized,
  extractPerpSnapshotMetricsByProductId,
  extractPerpSnapshotByPositionKey,
  extractTotalSpotUnrealizedPnlFromSnapshots,
  adaptSpotBalances,
  collectSpotTokenAddresses,
  adaptOrders,
  adaptPnl,
  adaptPositions,
  adaptRisk,
  adaptSummary,
  adaptTrades,
  adaptFundingPayments,
  deriveUnifiedMargin,
  fromX18,
  isNonZeroOpenPosition,
  normalizePerpMarketLabel,
  perpPositionKey,
  pickEstimatedExitPrice,
  toBigNumberish,
  toNumber,
} from '../lib/portfolioAdapters.js'
import { fetchErc20Symbols } from '../lib/erc20TokenSymbols.js'

function getInvoker(target, name) {
  const fn = target?.[name]
  return typeof fn === 'function' ? fn.bind(target) : null
}

const FUNDING_PAGE_LIMIT = 200
const FUNDING_MAX_PAGES = 200
const FAST_REFETCH_MS = 5_000
const MEDIUM_REFETCH_MS = 15_000
const SNAPSHOT_REFETCH_MS = 30_000
const TRADES_REFETCH_MS = 60_000
const SYMBOLS_STALE_MS = 5 * 60_000
const FUNDING_STALE_MS = 15 * 60_000
const TOKEN_SYMBOLS_STALE_MS = 60 * 60_000

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

function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return isVisible
}

export function usePortfolioData({
  getNadoClient,
  enabled,
  ownerAddress,
  chainEnv,
  subaccountName = 'default',
}) {
  const isPageVisible = useDocumentVisibility()
  const fastRefetchInterval = isPageVisible ? FAST_REFETCH_MS : false
  const mediumRefetchInterval = isPageVisible ? MEDIUM_REFETCH_MS : false
  const snapshotRefetchInterval = isPageVisible ? SNAPSHOT_REFETCH_MS : false
  const tradesRefetchInterval = isPageVisible ? TRADES_REFETCH_MS : false

  const summaryQuery = useQuery({
    queryKey: ['portfolio-summary', ownerAddress, chainEnv, subaccountName],
    enabled: Boolean(enabled && ownerAddress),
    refetchInterval: mediumRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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
        refetchInterval: mediumRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
        refetchInterval: mediumRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
        refetchInterval: tradesRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
        refetchInterval: snapshotRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
        refetchInterval: snapshotRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
    staleTime: SYMBOLS_STALE_MS,
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

  /** Indexer snapshot: same perp vQuote/amount semantics as Nado app (engine summary can differ slightly). */
  const accountSnapshotQuery = useQuery({
    queryKey: ['portfolio-account-snapshot', ownerAddress, chainEnv, subaccountName],
    enabled: Boolean(enabled && ownerAddress),
    refetchInterval: snapshotRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        if (!client) return null
        const indexer = client.context?.indexerClient
        if (typeof indexer?.getMultiSubaccountSnapshots !== 'function') return null
        const ts = Math.floor(Date.now() / 1000)
        return await indexer.getMultiSubaccountSnapshots({
          subaccounts: [{ subaccountOwner: ownerAddress, subaccountName }],
          timestamps: [ts],
        })
      } catch {
        return null
      }
    },
  })

  const isolatedPositionsQuery = useQuery({
    queryKey: ['portfolio-isolated-positions', ownerAddress, chainEnv, subaccountName],
    enabled: Boolean(enabled && ownerAddress),
    refetchInterval: mediumRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        if (!client) return []
        if (typeof client.subaccount?.getIsolatedPositions !== 'function') return []
        const res = await client.subaccount.getIsolatedPositions({
          subaccountOwner: ownerAddress,
          subaccountName,
        })
        return Array.isArray(res?.isolatedPositions) ? res.isolatedPositions : []
      } catch {
        return []
      }
    },
  })

  const latestMarketPricesQuery = useQuery({
    queryKey: [
      'portfolio-latest-market-prices',
      ownerAddress,
      chainEnv,
      subaccountName,
      productIdsForSymbols.join(','),
    ],
    enabled: Boolean(enabled && ownerAddress && productIdsForSymbols.length > 0),
    refetchInterval: fastRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        if (!client || typeof client.market?.getLatestMarketPrices !== 'function') return []
        const res = await client.market.getLatestMarketPrices({ productIds: productIdsForSymbols })
        return Array.isArray(res?.marketPrices) ? res.marketPrices : []
      } catch {
        return []
      }
    },
  })

  const latestOraclePricesQuery = useQuery({
    queryKey: [
      'portfolio-latest-oracle-prices',
      ownerAddress,
      chainEnv,
      subaccountName,
      productIdsForSymbols.join(','),
    ],
    enabled: Boolean(enabled && ownerAddress && productIdsForSymbols.length > 0),
    refetchInterval: fastRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        const indexer = client?.context?.indexerClient
        if (!indexer || typeof indexer.getOraclePrices !== 'function') return []
        return await indexer.getOraclePrices({ productIds: productIdsForSymbols })
      } catch {
        return []
      }
    },
  })

  const fundingQuery = useQuery({
    queryKey: [
      'portfolio-funding',
      ownerAddress,
      chainEnv,
      subaccountName,
      productIdsForSymbols.join(','),
    ],
    enabled: Boolean(enabled && ownerAddress && productIdsForSymbols.length > 0),
    staleTime: FUNDING_STALE_MS,
    queryFn: async () => {
      const client = getNadoClient?.()
      if (!client) throw new Error('Nado client unavailable')
      const indexer = client.context?.indexerClient
      if (typeof indexer?.getPaginatedSubaccountInterestFundingPayments !== 'function') {
        return { fundingPayments: [], interestPayments: [] }
      }

      const fundingPayments = []
      const interestPayments = []
      let startCursor = undefined

      for (let page = 0; page < FUNDING_MAX_PAGES; page += 1) {
        const res = await indexer.getPaginatedSubaccountInterestFundingPayments({
          subaccountOwner: ownerAddress,
          subaccountName,
          productIds: productIdsForSymbols,
          limit: FUNDING_PAGE_LIMIT,
          ...(startCursor ? { startCursor } : {}),
        })

        if (Array.isArray(res?.fundingPayments)) fundingPayments.push(...res.fundingPayments)
        if (Array.isArray(res?.interestPayments)) interestPayments.push(...res.interestPayments)

        const nextCursor = res?.meta?.nextCursor ?? res?.nextCursor ?? null
        const hasMore = Boolean(res?.meta?.hasMore ?? nextCursor)
        if (!hasMore || !nextCursor) break
        startCursor = nextCursor
      }

      return { fundingPayments, interestPayments }
    },
  })

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
    staleTime: TOKEN_SYMBOLS_STALE_MS,
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

  const snapshotMetricsByProductId = useMemo(
    () => extractPerpSnapshotMetricsByProductId(accountSnapshotQuery.data),
    [accountSnapshotQuery.data],
  )

  const snapshotByPositionKey = useMemo(
    () => extractPerpSnapshotByPositionKey(accountSnapshotQuery.data),
    [accountSnapshotQuery.data],
  )

  const perpPositionsFromBalances = useMemo(
    () =>
      adaptPerpPositionsFromBalances(
        summaryQuery.data?.balances ?? [],
        symbolsByProductId,
      ),
    [summaryQuery.data, symbolsByProductId],
  )

  const funding = useMemo(
    () =>
      adaptFundingPayments(fundingQuery.data?.fundingPayments ?? [], symbolsByProductId),
    [fundingQuery.data, symbolsByProductId],
  )

  const latestMarketPricesByProductId = useMemo(() => {
    const map = {}
    for (const row of latestMarketPricesQuery.data ?? []) {
      const pid = row?.productId
      if (pid == null) continue
      map[String(pid)] = row
    }
    return map
  }, [latestMarketPricesQuery.data])

  const latestOraclePricesByProductId = useMemo(() => {
    const map = {}
    for (const row of latestOraclePricesQuery.data ?? []) {
      const pid = row?.productId
      const oraclePrice = toNumber(row?.oraclePrice)
      if (pid == null || oraclePrice == null || !Number.isFinite(oraclePrice)) continue
      map[String(pid)] = oraclePrice
    }
    return map
  }, [latestOraclePricesQuery.data])

  /** USD net funding (indexer snapshot tracked vars); payment-sum fallback if snapshot missing. */
  const fundingUsdByProductId = useMemo(() => {
    const fromSnap = {}
    for (const [pid, metrics] of Object.entries(snapshotMetricsByProductId)) {
      if (metrics?.fundingUsd != null && Number.isFinite(metrics.fundingUsd)) {
        fromSnap[pid] = metrics.fundingUsd
      }
    }
    const fromPayments = aggregateFundingPaymentsUsdByProductId(funding)
    const out = { ...fromPayments }
    for (const k of Object.keys(fromSnap)) {
      out[k] = fromSnap[k]
    }
    return out
  }, [snapshotMetricsByProductId, funding])

  const canonicalPerpPositions = useMemo(
    () =>
      adaptCanonicalPerpPositions(
        summaryQuery.data?.balances ?? [],
        isolatedPositionsQuery.data ?? [],
        symbolsByProductId,
      ),
    [summaryQuery.data, isolatedPositionsQuery.data, symbolsByProductId],
  )

  const positions = useMemo(() => {
    if (canonicalPerpPositions.length > 0) {
      return canonicalPerpPositions
        .map((row) => {
          const pid = row.productId
          const pidKey = pid != null ? String(pid) : null
          const snapshot =
            pidKey != null
              ? snapshotByPositionKey[perpPositionKey(pid, row.isolated)]
              : null
          const fallbackOracle =
            (pidKey != null ? latestOraclePricesByProductId[pidKey] : null) ?? row.oraclePrice
          const isLong = row.side === 'LONG'
          const exitPrice =
            pickEstimatedExitPrice(
              isLong,
              pidKey != null ? latestMarketPricesByProductId[pidKey] : null,
              fallbackOracle,
            ) ?? fallbackOracle

          const snapshotEntry =
            snapshot != null
              ? entryPriceFromNetEntryUnrealized(
                  snapshot?.state?.postBalance?.amount,
                  snapshot?.trackedVars?.netEntryUnrealized,
                )
              : null

          const fallbackEntry =
            pidKey != null &&
            snapshotMetricsByProductId[pidKey]?.entry != null &&
            Number.isFinite(snapshotMetricsByProductId[pidKey].entry)
              ? snapshotMetricsByProductId[pidKey].entry
              : row.entry != null && Number.isFinite(Number(row.entry))
                ? row.entry
                : null

          const pnlFromSnapshot =
            snapshot != null && exitPrice != null
              ? calcUnrealizedPnlFromSnapshotEvent(snapshot, exitPrice)
              : null

          const fundingUsd =
            snapshot?.trackedVars?.netFundingUnrealized != null
              ? fromX18(snapshot.trackedVars.netFundingUnrealized)
              : pidKey != null &&
                  fundingUsdByProductId[pidKey] != null &&
                  Number.isFinite(fundingUsdByProductId[pidKey])
                ? fundingUsdByProductId[pidKey]
                : null

          const crossMargin =
            row.isolated || !row.row
              ? null
              : calcPerpBalanceValueUsd(row.row.amount, row.row.oraclePrice, row.row.vQuoteBalance) != null
                ? Number(
                    Math.max(
                      0,
                      calcPerpBalanceValueUsd(
                        row.row.amount,
                        row.row.oraclePrice,
                        row.row.vQuoteBalance,
                      ) -
                        (fromX18(row.row?.healthContributions?.initial) ?? 0),
                    ),
                  )
                : null

          const isoMargin =
            row.isolated
              ? ((fromX18(row.isoQuoteBalance) ?? 0) +
                  (calcPerpBalanceValueUsd(row.amount, fallbackOracle, row.vQuoteBalance) ?? 0))
              : null

          const crossRoeMargin =
            snapshot != null ? calcRoeDenominatorUsdFromSnapshotEvent(snapshot) : null

          const isoRoeMargin =
            row.isolated && snapshot?.trackedVars?.netEntryUnrealized != null
              ? Math.abs(fromX18(snapshot.trackedVars.netEntryUnrealized) ?? NaN)
              : null

          const maintenanceHealth = row.isolated
            ? row.isoHealths?.maintenance
            : summaryQuery.data?.health?.maintenance?.health

          const marginValue =
            row.isolated && isoMargin != null && Number.isFinite(isoMargin)
              ? isoMargin
              : crossMargin

          const leverage =
            row.notional != null &&
            marginValue != null &&
            Number.isFinite(Number(row.notional)) &&
            Number.isFinite(Number(marginValue)) &&
            Math.abs(Number(marginValue)) > 1e-12
              ? Math.abs(Number(row.notional)) / Math.abs(Number(marginValue))
              : null

          return {
            ...row,
            market: normalizePerpMarketLabel(row.market),
            entry: snapshotEntry ?? fallbackEntry,
            pnl:
              pnlFromSnapshot != null && Number.isFinite(pnlFromSnapshot)
                ? pnlFromSnapshot
                : row.pnl != null && Number.isFinite(Number(row.pnl))
                  ? row.pnl
                  : null,
            mark: fallbackOracle,
            margin: marginValue,
            roeMargin:
              row.isolated && isoRoeMargin != null && Number.isFinite(isoRoeMargin)
                ? isoRoeMargin
                : crossRoeMargin,
            fundingUsd,
            leverage,
            estimatedLiquidationPrice:
              row.row != null
                ? calcEstimatedLiqPriceFromBalance(row.row, maintenanceHealth)
                : null,
          }
        })
        .filter(isNonZeroOpenPosition)
    }

    const base = crossPositions?.length > 0 ? crossPositions : perpPositionsFromBalances
    if (!base?.length) return base
    return base.filter(isNonZeroOpenPosition).map((row) => {
      const pidKey = row.productId != null ? String(row.productId) : null
      return {
        ...row,
        market: normalizePerpMarketLabel(row.market),
        entry:
          pidKey != null &&
          snapshotMetricsByProductId[pidKey]?.entry != null &&
          Number.isFinite(snapshotMetricsByProductId[pidKey].entry)
            ? snapshotMetricsByProductId[pidKey].entry
            : row.entry,
        pnl:
          pidKey != null &&
          snapshotMetricsByProductId[pidKey]?.pnl != null &&
          Number.isFinite(snapshotMetricsByProductId[pidKey].pnl)
            ? snapshotMetricsByProductId[pidKey].pnl
            : row.pnl,
        fundingUsd:
          pidKey != null &&
          fundingUsdByProductId[pidKey] != null &&
          Number.isFinite(fundingUsdByProductId[pidKey])
            ? fundingUsdByProductId[pidKey]
            : null,
        leverage:
          row.leverage != null && Number.isFinite(Number(row.leverage))
            ? Number(row.leverage)
            : row.notional != null &&
                row.margin != null &&
                Number.isFinite(Number(row.notional)) &&
                Number.isFinite(Number(row.margin)) &&
                Math.abs(Number(row.margin)) > 1e-12
              ? Math.abs(Number(row.notional)) / Math.abs(Number(row.margin))
              : null,
      }
    })
  }, [
    canonicalPerpPositions,
    crossPositions,
    perpPositionsFromBalances,
    snapshotMetricsByProductId,
    snapshotByPositionKey,
    fundingUsdByProductId,
    latestMarketPricesByProductId,
    latestOraclePricesByProductId,
    summaryQuery.data,
  ])
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

  const nadoSummary = useMemo(() => {
    const initialHealthUsd = fromX18(summaryQuery.data?.health?.initial?.health)
    const maintenanceLiabilitiesUsd = fromX18(summaryQuery.data?.health?.maintenance?.liabilities)
    const spotUnrealizedFromSnapshots = extractTotalSpotUnrealizedPnlFromSnapshots(
      accountSnapshotQuery.data,
    )

    let perpUnrealizedUsd = null
    if (positions.length > 0) {
      let sum = 0
      let seen = false
      for (const row of positions) {
        const pnl = Number(row?.pnl)
        if (!Number.isFinite(pnl)) continue
        sum += pnl
        seen = true
      }
      if (seen) perpUnrealizedUsd = sum
    }

    let balancesValueUsd = null
    if (balances.length > 0) {
      let sum = 0
      let seen = false
      for (const row of balances) {
        const value = Number(row?.usdValue)
        if (!Number.isFinite(value)) continue
        sum += value
        seen = true
      }
      if (seen) balancesValueUsd = sum
    }

    const balanceUsd =
      pnl?.equity ??
      summary?.totalEquity ??
      (balancesValueUsd != null && perpUnrealizedUsd != null
        ? balancesValueUsd + perpUnrealizedUsd
        : balancesValueUsd) ??
      null

    return {
      balanceUsd,
      unrealizedPerpPnlUsd: perpUnrealizedUsd,
      unrealizedSpotPnlUsd: spotUnrealizedFromSnapshots,
      availableMarginUsd:
        initialHealthUsd != null && Number.isFinite(initialHealthUsd)
          ? Math.max(0, initialHealthUsd)
          : unifiedMargin?.availableMargin ?? null,
      maintenanceMarginUsd:
        maintenanceLiabilitiesUsd != null && Number.isFinite(maintenanceLiabilitiesUsd)
          ? maintenanceLiabilitiesUsd
          : null,
      maintenanceMarginUsagePercent: unifiedMargin?.maintenanceMarginUsagePercent ?? null,
    }
  }, [
    accountSnapshotQuery.data,
    balances,
    pnl?.equity,
    positions,
    summary?.totalEquity,
    summaryQuery.data,
    unifiedMargin,
  ])

  const queries = [
    summaryQuery,
    symbolsQuery,
    accountSnapshotQuery,
    isolatedPositionsQuery,
    latestMarketPricesQuery,
    latestOraclePricesQuery,
    positionsQuery,
    ordersQuery,
    tradesQuery,
    fundingQuery,
    pnlQuery,
    riskQuery,
  ]
  const isLoadingAny = queries.some((q) => q.isLoading)
  const hasAnyError = queries.some((q) => q.error)
  const canonicalPositionsQuery = {
    isLoading:
      summaryQuery.isLoading ||
      symbolsQuery.isLoading ||
      accountSnapshotQuery.isLoading ||
      isolatedPositionsQuery.isLoading ||
      latestMarketPricesQuery.isLoading ||
      latestOraclePricesQuery.isLoading,
    error:
      summaryQuery.error ??
      symbolsQuery.error ??
      accountSnapshotQuery.error ??
      isolatedPositionsQuery.error ??
      latestMarketPricesQuery.error ??
      latestOraclePricesQuery.error ??
      null,
  }

  return {
    summary,
    balances,
    positions,
    orders,
    trades,
    funding,
    pnl,
    risk,
    unifiedMargin,
    nadoSummary,
    queries: {
      summary: summaryQuery,
      symbols: symbolsQuery,
      accountSnapshot: accountSnapshotQuery,
      canonicalPositions: canonicalPositionsQuery,
      isolatedPositions: isolatedPositionsQuery,
      latestMarketPrices: latestMarketPricesQuery,
      latestOraclePrices: latestOraclePricesQuery,
      spotTokenSymbols: spotTokenSymbolsQuery,
      positions: positionsQuery,
      orders: ordersQuery,
      trades: tradesQuery,
      funding: fundingQuery,
      pnl: pnlQuery,
      risk: riskQuery,
    },
    isLoadingAny,
    hasAnyError,
    /** True when the indexer funding query has no product ids to query (empty balances / no symbols yet). */
    fundingScopeEmpty: productIdsForSymbols.length === 0,
  }
}
