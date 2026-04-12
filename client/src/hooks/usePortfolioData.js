import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  adaptFundingPayments,
  adaptOrders,
  adaptPnl,
  adaptPositions,
  adaptRisk,
  adaptSpotBalances,
  adaptSummary,
  adaptTrades,
  collectSpotTokenAddresses,
  deriveUnifiedMargin,
  extractTotalSpotUnrealizedPnlFromSnapshots,
  fromX18,
  isNonZeroOpenPosition,
  normalizePerpMarketLabel,
  perpPositionKey,
  pickEstimatedExitPrice,
  toNumber,
} from '../lib/portfolioAdapters.js'
import { fetchErc20Symbols } from '../lib/erc20TokenSymbols.js'

const SNAPSHOT_REFETCH_MS = 60_000
const TOKEN_SYMBOLS_STALE_MS = 60 * 60_000
const REFETCH_ON_WINDOW_FOCUS = false
const WS_RECONNECT_BASE_MS = 1_000
const WS_RECONNECT_MAX_MS = 10_000

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

function normalizeSubaccountName(name) {
  const value = String(name ?? 'default').trim()
  return value.length > 0 ? value : 'default'
}

function buildPortfolioSnapshotPath(subaccountName) {
  const path = '/api/portfolio/snapshot'
  const params = new URLSearchParams()
  const safeName = normalizeSubaccountName(subaccountName)
  if (safeName) params.set('subaccount_name', safeName)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

function buildPortfolioWsUrl(subaccountName) {
  if (typeof window === 'undefined') return null
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = new URL(`${protocol}//${window.location.host}/api/portfolio/ws`)
  const safeName = normalizeSubaccountName(subaccountName)
  if (safeName) url.searchParams.set('subaccount_name', safeName)
  return url.toString()
}

async function fetchPortfolioSnapshot({ subaccountName, signal }) {
  const response = await fetch(buildPortfolioSnapshotPath(subaccountName), {
    method: 'GET',
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'Sign in required'
        : `Portfolio gateway error (${response.status})`

    try {
      const payload = await response.json()
      const upstream = payload?.error
      if (typeof upstream === 'string' && upstream.trim().length > 0) {
        message = upstream.trim()
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message)
  }

  return response.json()
}

function safeJsonParse(raw) {
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return null
  const portfolio = payload?.portfolio
  if (!portfolio || typeof portfolio !== 'object') return null

  const parsedAsOf = toNumber(payload?.as_of_ms ?? payload?.asOfMs)
  const asOfMs =
    parsedAsOf != null && Number.isFinite(parsedAsOf)
      ? Math.max(0, Math.trunc(parsedAsOf))
      : Date.now()

  return {
    asOfMs,
    cause: String(payload?.cause ?? 'snapshot'),
    portfolio,
  }
}

function pickLatestEnvelope(prev, next) {
  if (!prev) return next
  if (!next) return prev
  return next.asOfMs >= prev.asOfMs ? next : prev
}

function asFiniteNumber(value) {
  const parsed = toNumber(value)
  return parsed != null && Number.isFinite(parsed) ? parsed : null
}

function createQueryLike({ isLoading, error, isSuccess, refetch }) {
  return {
    isLoading: Boolean(isLoading),
    error: error ?? null,
    isSuccess: Boolean(isSuccess),
    refetch,
  }
}

export function usePortfolioData({
  getNadoClient,
  enabled,
  ownerAddress,
  chainEnv,
  subaccountName = 'default',
}) {
  const isPageVisible = useDocumentVisibility()
  const safeSubaccountName = normalizeSubaccountName(subaccountName)
  const shouldLoad = Boolean(enabled)

  const snapshotQuery = useQuery({
    queryKey: ['portfolio-summary', ownerAddress, chainEnv, safeSubaccountName],
    enabled: shouldLoad,
    refetchInterval: isPageVisible ? SNAPSHOT_REFETCH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: REFETCH_ON_WINDOW_FOCUS,
    queryFn: ({ signal }) =>
      fetchPortfolioSnapshot({
        subaccountName: safeSubaccountName,
        signal,
      }),
  })

  const [liveEnvelope, setLiveEnvelope] = useState(null)
  const [wsStatus, setWsStatus] = useState('idle')
  const [wsRuntimeError, setWsRuntimeError] = useState(null)
  const reconnectAttemptRef = useRef(0)

  useEffect(() => {
    setLiveEnvelope(null)
    setWsRuntimeError(null)
    setWsStatus('idle')
    reconnectAttemptRef.current = 0

    if (!shouldLoad) {
      return undefined
    }

    let stopped = false
    let ws = null
    let reconnectTimer = null

    const connect = () => {
      if (stopped) return

      const wsUrl = buildPortfolioWsUrl(safeSubaccountName)
      if (!wsUrl) return

      setWsStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting')

      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (stopped) return
        reconnectAttemptRef.current = 0
        setWsRuntimeError(null)
        setWsStatus('connected')
      }

      ws.onmessage = (event) => {
        if (stopped) return
        const payload = safeJsonParse(event.data)
        if (!payload || typeof payload !== 'object') return

        const messageType = String(payload?.type ?? '').trim().toLowerCase()

        if (messageType === 'snapshot' || messageType === 'update') {
          const nextEnvelope = normalizeEnvelope(payload)
          if (!nextEnvelope) return
          setLiveEnvelope((prev) => pickLatestEnvelope(prev, nextEnvelope))
          setWsRuntimeError(null)
          return
        }

        if (messageType === 'error') {
          const msg = String(payload?.message ?? '').trim() || 'Portfolio websocket error'
          setWsRuntimeError(new Error(msg))
          return
        }

        if (messageType === 'status') {
          const status = String(payload?.status ?? '').trim().toLowerCase()
          if (status) setWsStatus(status)
        }
      }

      ws.onclose = () => {
        if (stopped) return
        setWsStatus('disconnected')
        reconnectAttemptRef.current += 1
        const delay = Math.min(
          WS_RECONNECT_MAX_MS,
          WS_RECONNECT_BASE_MS * reconnectAttemptRef.current,
        )
        reconnectTimer = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onclose handles reconnect lifecycle.
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer != null) clearTimeout(reconnectTimer)
      if (ws && ws.readyState <= WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [shouldLoad, safeSubaccountName, ownerAddress])

  const snapshotEnvelope = useMemo(
    () => normalizeEnvelope(snapshotQuery.data),
    [snapshotQuery.data],
  )

  const activeEnvelope = useMemo(() => {
    if (!snapshotEnvelope) return liveEnvelope
    if (!liveEnvelope) return snapshotEnvelope
    return liveEnvelope.asOfMs >= snapshotEnvelope.asOfMs
      ? liveEnvelope
      : snapshotEnvelope
  }, [snapshotEnvelope, liveEnvelope])

  const payload = activeEnvelope?.portfolio ?? null
  const summarySource = payload?.summary ?? null
  const rawBalances = summarySource?.balances ?? []
  const rawSymbols = payload?.symbols ?? null
  const rawOrders = payload?.orders ?? []
  const rawTrades = payload?.trades ?? []
  const rawPnl = payload?.pnl ?? null
  const rawRisk = payload?.risk ?? null
  const rawCrossPositions = payload?.positions ?? []
  const rawIsolatedPositions =
    payload?.isolatedPositions ?? payload?.isolated_positions ?? []
  const rawFundingRows =
    payload?.funding?.fundingPayments ?? payload?.fundingPayments ?? []
  const rawLatestMarketPrices =
    payload?.latestMarketPrices ?? payload?.latest_market_prices ?? []
  const rawLatestOraclePrices =
    payload?.latestOraclePrices ?? payload?.latest_oracle_prices ?? []
  const rawAccountSnapshot =
    payload?.accountSnapshot ?? payload?.account_snapshot ?? null

  const symbolsByProductId = useMemo(() => {
    const out = {}
    const symbols = rawSymbols?.symbols
    if (!symbols || typeof symbols !== 'object') return out

    for (const [key, row] of Object.entries(symbols)) {
      const productId = row?.productId ?? row?.product_id ?? key
      const symbol = row?.symbol
      if (productId == null || symbol == null) continue
      const cleanSymbol = String(symbol).trim()
      if (!cleanSymbol) continue
      out[String(productId)] = cleanSymbol
    }

    return out
  }, [rawSymbols])

  const productIdsForScope = useMemo(() => {
    const ids = new Set()

    for (const row of rawBalances) {
      const productId = row?.productId ?? row?.product_id
      if (productId != null) ids.add(String(productId))
    }

    const tradeEvents = Array.isArray(rawTrades?.events) ? rawTrades.events : []
    for (const event of tradeEvents) {
      const productId = event?.productId ?? event?.product_id
      if (productId != null) ids.add(String(productId))
    }

    return Array.from(ids)
  }, [rawBalances, rawTrades])

  const spotTokenAddresses = useMemo(() => {
    const addresses = collectSpotTokenAddresses(rawBalances)
    return [...new Set(addresses.map((address) => String(address)))].sort()
  }, [rawBalances])

  const spotTokenSymbolsQuery = useQuery({
    queryKey: [
      'portfolio-spot-erc20-symbols',
      ownerAddress,
      chainEnv,
      safeSubaccountName,
      spotTokenAddresses.join(','),
    ],
    enabled: Boolean(shouldLoad && spotTokenAddresses.length > 0),
    staleTime: TOKEN_SYMBOLS_STALE_MS,
    queryFn: async () => {
      try {
        const client = getNadoClient?.()
        const publicClient = client?.context?.publicClient
        if (!publicClient) return {}
        return await fetchErc20Symbols(publicClient, spotTokenAddresses)
      } catch {
        return {}
      }
    },
  })

  const summary = useMemo(() => adaptSummary(summarySource), [summarySource])

  const balances = useMemo(
    () =>
      adaptSpotBalances(
        rawBalances,
        symbolsByProductId,
        spotTokenSymbolsQuery.data ?? {},
      ),
    [rawBalances, symbolsByProductId, spotTokenSymbolsQuery.data],
  )

  const latestMarketPricesByProductId = useMemo(() => {
    const out = {}
    for (const row of rawLatestMarketPrices) {
      const productId = row?.productId ?? row?.product_id
      if (productId == null) continue
      out[String(productId)] = row
    }
    return out
  }, [rawLatestMarketPrices])

  const latestOraclePricesByProductId = useMemo(() => {
    const out = {}
    for (const row of rawLatestOraclePrices) {
      const productId = row?.productId ?? row?.product_id
      const price = asFiniteNumber(row?.oraclePrice ?? row?.oracle_price)
      if (productId == null || price == null) continue
      out[String(productId)] = price
    }
    return out
  }, [rawLatestOraclePrices])

  const crossPositions = useMemo(
    () => adaptPositions(rawCrossPositions),
    [rawCrossPositions],
  )

  const snapshotMetricsByProductId = useMemo(
    () => extractPerpSnapshotMetricsByProductId(rawAccountSnapshot),
    [rawAccountSnapshot],
  )

  const snapshotByPositionKey = useMemo(
    () => extractPerpSnapshotByPositionKey(rawAccountSnapshot),
    [rawAccountSnapshot],
  )

  const perpPositionsFromBalances = useMemo(
    () =>
      adaptPerpPositionsFromBalances(
        rawBalances,
        symbolsByProductId,
      ),
    [rawBalances, symbolsByProductId],
  )

  const funding = useMemo(
    () => adaptFundingPayments(rawFundingRows, symbolsByProductId),
    [rawFundingRows, symbolsByProductId],
  )

  const fundingUsdByProductId = useMemo(() => {
    const fromSnap = {}
    for (const [productId, metrics] of Object.entries(snapshotMetricsByProductId)) {
      if (metrics?.fundingUsd != null && Number.isFinite(metrics.fundingUsd)) {
        fromSnap[productId] = metrics.fundingUsd
      }
    }

    const fromPayments = aggregateFundingPaymentsUsdByProductId(funding)
    const out = { ...fromPayments }
    for (const productId of Object.keys(fromSnap)) {
      out[productId] = fromSnap[productId]
    }
    return out
  }, [snapshotMetricsByProductId, funding])

  const canonicalPerpPositions = useMemo(
    () =>
      adaptCanonicalPerpPositions(
        rawBalances,
        rawIsolatedPositions,
        symbolsByProductId,
      ),
    [rawBalances, rawIsolatedPositions, symbolsByProductId],
  )

  const positions = useMemo(() => {
    if (canonicalPerpPositions.length > 0) {
      return canonicalPerpPositions
        .map((row) => {
          const productId = row.productId
          const productKey = productId != null ? String(productId) : null
          const snapshot =
            productKey != null
              ? snapshotByPositionKey[perpPositionKey(productId, row.isolated)]
              : null

          const fallbackOracle =
            (productKey != null ? latestOraclePricesByProductId[productKey] : null) ?? row.oraclePrice
          const isLong = row.side === 'LONG'
          const exitPrice =
            pickEstimatedExitPrice(
              isLong,
              productKey != null ? latestMarketPricesByProductId[productKey] : null,
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
            productKey != null &&
            snapshotMetricsByProductId[productKey]?.entry != null &&
            Number.isFinite(snapshotMetricsByProductId[productKey].entry)
              ? snapshotMetricsByProductId[productKey].entry
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
              : productKey != null &&
                  fundingUsdByProductId[productKey] != null &&
                  Number.isFinite(fundingUsdByProductId[productKey])
                ? fundingUsdByProductId[productKey]
                : null

          const crossMarginRaw =
            row.isolated || !row.row
              ? null
              : calcPerpBalanceValueUsd(row.row.amount, row.row.oraclePrice, row.row.vQuoteBalance)

          const crossMargin =
            crossMarginRaw != null && Number.isFinite(Number(crossMarginRaw))
              ? Math.max(
                  0,
                  Number(crossMarginRaw) -
                    (fromX18(row.row?.healthContributions?.initial) ?? 0),
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
            : summarySource?.health?.maintenance?.health

          const marginValue =
            row.isolated && isoMargin != null && Number.isFinite(Number(isoMargin))
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

    return base
      .filter(isNonZeroOpenPosition)
      .map((row) => {
        const productKey = row.productId != null ? String(row.productId) : null
        return {
          ...row,
          market: normalizePerpMarketLabel(row.market),
          entry:
            productKey != null &&
            snapshotMetricsByProductId[productKey]?.entry != null &&
            Number.isFinite(snapshotMetricsByProductId[productKey].entry)
              ? snapshotMetricsByProductId[productKey].entry
              : row.entry,
          pnl:
            productKey != null &&
            snapshotMetricsByProductId[productKey]?.pnl != null &&
            Number.isFinite(snapshotMetricsByProductId[productKey].pnl)
              ? snapshotMetricsByProductId[productKey].pnl
              : row.pnl,
          fundingUsd:
            productKey != null &&
            fundingUsdByProductId[productKey] != null &&
            Number.isFinite(fundingUsdByProductId[productKey])
              ? fundingUsdByProductId[productKey]
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
    summarySource,
  ])

  const orders = useMemo(() => adaptOrders(rawOrders), [rawOrders])

  const trades = useMemo(
    () => adaptTrades(rawTrades, symbolsByProductId),
    [rawTrades, symbolsByProductId],
  )

  const pnl = useMemo(() => adaptPnl(rawPnl, summary), [rawPnl, summary])

  const risk = useMemo(() => adaptRisk(rawRisk, summary), [rawRisk, summary])

  const unifiedMargin = useMemo(
    () => deriveUnifiedMargin(summarySource),
    [summarySource],
  )

  const nadoSummary = useMemo(() => {
    const initialHealthUsd = fromX18(summarySource?.health?.initial?.health)
    const maintenanceLiabilitiesUsd = fromX18(
      summarySource?.health?.maintenance?.liabilities,
    )

    const spotUnrealizedFromSnapshots =
      extractTotalSpotUnrealizedPnlFromSnapshots(rawAccountSnapshot)

    let perpUnrealizedUsd = null
    if (positions.length > 0) {
      let total = 0
      let seen = false
      for (const row of positions) {
        const value = asFiniteNumber(row?.pnl)
        if (value == null) continue
        total += value
        seen = true
      }
      if (seen) perpUnrealizedUsd = total
    }

    let balancesValueUsd = null
    if (balances.length > 0) {
      let total = 0
      let seen = false
      for (const row of balances) {
        const value = asFiniteNumber(row?.usdValue)
        if (value == null) continue
        total += value
        seen = true
      }
      if (seen) balancesValueUsd = total
    }

    const balanceUsd =
      asFiniteNumber(pnl?.equity) ??
      asFiniteNumber(summary?.totalEquity) ??
      (balancesValueUsd != null && perpUnrealizedUsd != null
        ? balancesValueUsd + perpUnrealizedUsd
        : balancesValueUsd)

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
      maintenanceMarginUsagePercent:
        unifiedMargin?.maintenanceMarginUsagePercent ?? null,
    }
  }, [summarySource, rawAccountSnapshot, positions, balances, pnl, summary, unifiedMargin])

  const snapshotError = snapshotQuery.error ?? null
  const baseError = activeEnvelope ? null : wsRuntimeError ?? snapshotError
  const isLoadingBase = shouldLoad && !activeEnvelope && snapshotQuery.isLoading
  const isSuccessBase = Boolean(activeEnvelope) || snapshotQuery.isSuccess

  const sharedQuery = {
    isLoading: isLoadingBase,
    error: baseError,
    isSuccess: isSuccessBase,
    refetch: snapshotQuery.refetch,
  }

  const queries = {
    summary: createQueryLike(sharedQuery),
    symbols: createQueryLike(sharedQuery),
    accountSnapshot: createQueryLike(sharedQuery),
    canonicalPositions: createQueryLike(sharedQuery),
    isolatedPositions: createQueryLike(sharedQuery),
    latestMarketPrices: createQueryLike(sharedQuery),
    latestOraclePrices: createQueryLike(sharedQuery),
    spotTokenSymbols: createQueryLike({
      isLoading: spotTokenSymbolsQuery.isLoading,
      error: spotTokenSymbolsQuery.error,
      isSuccess: spotTokenSymbolsQuery.isSuccess,
      refetch: spotTokenSymbolsQuery.refetch,
    }),
    positions: createQueryLike(sharedQuery),
    orders: createQueryLike(sharedQuery),
    trades: createQueryLike(sharedQuery),
    funding: createQueryLike(sharedQuery),
    pnl: createQueryLike(sharedQuery),
    risk: createQueryLike(sharedQuery),
  }

  const isLoadingAny = Object.values(queries).some((query) => query.isLoading)
  const hasAnyError = Object.values(queries).some((query) => query.error)

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
    queries,
    isLoadingAny,
    hasAnyError,
    fundingScopeEmpty: productIdsForScope.length === 0,
    streamStatus: wsStatus,
  }
}
