import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import NadoDepositWithdrawModal from './NadoDepositWithdrawModal.jsx'
import NadoTransferModal from './NadoTransferModal.jsx'
import MarketCommandCenterModal from './MarketCommandCenterModal.jsx'
import NadoPositionsTable from './NadoPositionsTable.jsx'
import { CHAIN_ENV_TO_CHAIN } from '@nadohq/shared'
import {
  fmt,
  tradeSideClass,
  buildCumulativeRealizedPnlSeries,
} from '../../lib/portfolioAdapters.js'
import {
  depositWithdrawProductsQueryKey,
  DW_PRODUCTS_STALE_MS,
  fetchDepositWithdrawProducts,
  fetchTransferBootstrap,
  TRANSFER_BOOTSTRAP_STALE_MS,
  transferBootstrapQueryKey,
} from '../../lib/accountPreload.js'
import PnlCurveChart from './PnlCurveChart.jsx'
import PortfolioAvatar from './PortfolioAvatar.jsx'
import Web3TokenIcon from './Web3TokenIcon.jsx'

/** Thornado UI tokens — aligned with Account.jsx & Terminal widgets */
const C = {
  card: 'rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] backdrop-blur-md',
  label: 'text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500',
  muted: 'text-slate-500',
  mono: 'font-mono text-xs text-slate-200 tabular-nums',
}

function AssetCell({ symbol, seed, nadoAppOrigin }) {
  return (
    <div className="flex items-center gap-2.5">
      <Web3TokenIcon symbol={symbol} seed={seed} size={21} nadoAppOrigin={nadoAppOrigin} />
      <div className="min-w-0">
        <div className="truncate font-sans text-[14px] font-medium leading-snug text-slate-200">
          {symbol || '—'}
        </div>
      </div>
    </div>
  )
}

function scheduleIdlePrefetch(task, delayMs = 0) {
  if (typeof window === 'undefined') return () => {}
  let delayId = null
  let idleId = null
  let disposed = false

  const run = () => {
    if (disposed) return
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        if (!disposed) task()
      }, { timeout: 1500 })
      return
    }
    idleId = window.setTimeout(() => {
      if (!disposed) task()
    }, 0)
  }

  delayId = window.setTimeout(run, delayMs)

  return () => {
    disposed = true
    if (delayId != null) window.clearTimeout(delayId)
    if (idleId == null) return
    if (typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId)
      return
    }
    window.clearTimeout(idleId)
  }
}

function NadoSummaryRow({ label, value, valueClassName = '', children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 text-[13px] text-slate-300">{label}</div>
      <div
        className={`min-w-0 text-right font-mono text-[13px] tabular-nums text-slate-100 ${valueClassName}`}
      >
        {children ?? value ?? '—'}
      </div>
    </div>
  )
}

export default function NadoPortfolioView({
  walletAddress,
  chainEnv,
  nadoAppOrigin,
  portfolio,
  getNadoClient,
  onInvalidatePortfolio,
  depositWithdrawEnabled = false,
  publicClient = null,
}) {
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState('overview')
  const [dwModal, setDwModal] = useState(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const chainId = CHAIN_ENV_TO_CHAIN[chainEnv]?.id

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'margin', label: 'Margin' },
    { id: 'history', label: 'History' },
  ]

  useEffect(() => {
    if (!getNadoClient || !chainEnv) return undefined

    if (!depositWithdrawEnabled) return

    const cancelTransfer = scheduleIdlePrefetch(() => {
      void queryClient.prefetchQuery({
        queryKey: transferBootstrapQueryKey(chainId ?? 'unknown'),
        queryFn: () => fetchTransferBootstrap(getNadoClient),
        staleTime: TRANSFER_BOOTSTRAP_STALE_MS,
      })
    }, 400)

    const cancelDw = scheduleIdlePrefetch(() => {
      void queryClient.prefetchQuery({
        queryKey: depositWithdrawProductsQueryKey(chainId ?? 'unknown'),
        queryFn: () => fetchDepositWithdrawProducts(getNadoClient),
        staleTime: DW_PRODUCTS_STALE_MS,
      })
    }, 1400)

    return () => {
      cancelTransfer()
      cancelDw()
    }
  }, [queryClient, getNadoClient, chainEnv, chainId, depositWithdrawEnabled])

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Toolbar — compact */}
      <div className={`${C.card} p-3 sm:p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <PortfolioAvatar walletAddress={walletAddress} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">Portfolio</div>
              <div className={`${C.muted} truncate text-xs`}>
                {chainEnv === 'inkMainnet' ? 'Mainnet' : 'Testnet'} · subaccount default
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            <button
              type="button"
              disabled={!depositWithdrawEnabled}
              onClick={() => setTransferOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Transfer
            </button>
            <button
              type="button"
              onClick={() => setDwModal('withdraw')}
              disabled={!depositWithdrawEnabled}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Withdraw
            </button>
            <button
              type="button"
              onClick={() => setDwModal('deposit')}
              disabled={!depositWithdrawEnabled}
              className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deposit
            </button>
          </div>
        </div>

        {/* Segmented tabs */}
        <div className="mt-3 flex rounded-lg border border-white/10 bg-black/20 p-0.5 sm:mt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium transition ${
                mainTab === t.id
                  ? 'bg-violet-500/20 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {mainTab === 'overview' && (
        <OverviewTab
          portfolio={portfolio}
          fmt={fmt}
          chainId={chainId}
          publicClient={publicClient}
          nadoAppOrigin={nadoAppOrigin}
          getNadoClient={getNadoClient}
          chainEnv={chainEnv}
        />
      )}

      {mainTab === 'margin' && <MarginManagerTab portfolio={portfolio} fmt={fmt} />}

      {mainTab === 'history' && (
        <HistoryTab portfolio={portfolio} fmt={fmt} nadoAppOrigin={nadoAppOrigin} />
      )}

      <NadoDepositWithdrawModal
        open={Boolean(dwModal)}
        mode={dwModal}
        onClose={() => setDwModal(null)}
        getNadoClient={getNadoClient}
        ownerAddress={walletAddress}
        subaccountName="default"
        onCompleted={onInvalidatePortfolio}
        nadoAppOrigin={nadoAppOrigin}
      />
      <NadoTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        getNadoClient={getNadoClient}
        ownerAddress={walletAddress}
        subaccountName="default"
        onCompleted={onInvalidatePortfolio}
        nadoAppOrigin={nadoAppOrigin}
      />
    </div>
  )
}

function OverviewTab({
  portfolio,
  fmt,
  chainId,
  publicClient,
  nadoAppOrigin,
  getNadoClient,
  chainEnv,
}) {
  const [portfolioDataTab, setPortfolioDataTab] = useState('balances')
  const [commandCenterOpen, setCommandCenterOpen] = useState(false)
  const summaryCard = portfolio.nadoSummary
  const loading =
    portfolio.queries.summary.isLoading || portfolio.queries.accountSnapshot?.isLoading
  const noSubaccount = portfolio.queries.summary.isSuccess && portfolio.summary?.exists === false
  const ordersError = portfolio.queries.orders?.error
  const positionsError =
    portfolio.queries.canonicalPositions?.error ?? portfolio.queries.positions?.error
  const balancesRanked = useMemo(() => {
    const list = portfolio.balances ?? []
    const isActive = (b) => {
      const t = typeof b.total === 'number' ? b.total : 0
      const a = typeof b.available === 'number' ? b.available : 0
      const u = typeof b.usdValue === 'number' ? b.usdValue : 0
      return Math.abs(t) > 0 || Math.abs(a) > 0 || Math.abs(u) > 0
    }

    return {
      isActive,
      ranked: [...list].sort((a, b) => {
        const ar = isActive(a) ? 0 : 1
        const br = isActive(b) ? 0 : 1
        if (ar !== br) return ar - br
        return (b.usdValue ?? 0) - (a.usdValue ?? 0)
      }),
    }
  }, [portfolio.balances])

  // Show "account tokens" first (active), then a few more inactive tokens.
  // No "Show more" button; the table itself is scrollable.
  const visibleBalances = useMemo(() => {
    // Show all tokens, but sorted with "active first" (handled in balancesRanked.ranked).
    return balancesRanked?.ranked ?? []
  }, [balancesRanked])

  const pnlSeries = useMemo(
    () => buildCumulativeRealizedPnlSeries(portfolio.trades),
    [portfolio.trades],
  )
  const maintenanceBarWidth = useMemo(() => {
    const value = summaryCard?.maintenanceMarginUsagePercent ?? null
    if (value == null) return 0
    return Math.min(100, Math.max(0, value))
  }, [summaryCard?.maintenanceMarginUsagePercent])

  return (
    <div className="flex flex-col gap-3">
      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="border-b border-white/[0.08] px-2.5 py-1.5">
          <span className="text-xs font-medium text-slate-200">Account</span>
        </div>
        <div className="px-2.5 py-1.5">
          {loading && (
            <p className="text-xs text-slate-500">Loading account summary…</p>
          )}
          {!loading && noSubaccount && (
            <p className="text-xs text-amber-200/90">
              No subaccount on engine yet — deposit on Nado first; margin metrics stay empty.
            </p>
          )}
          {!loading && !noSubaccount && (
            <div className="divide-y divide-white/[0.06]">
              <NadoSummaryRow label="Balance" value={fmt.currency(summaryCard?.balanceUsd)} />
              <NadoSummaryRow
                label="Unrealized Perp PnL"
                value={fmt.signedCurrency(summaryCard?.unrealizedPerpPnlUsd)}
                valueClassName={
                  summaryCard?.unrealizedPerpPnlUsd > 0
                    ? 'text-emerald-300'
                    : summaryCard?.unrealizedPerpPnlUsd < 0
                      ? 'text-red-300'
                      : ''
                }
              />
              <NadoSummaryRow
                label="Unrealized Spot PnL"
                value={fmt.signedCurrency(summaryCard?.unrealizedSpotPnlUsd)}
                valueClassName={
                  summaryCard?.unrealizedSpotPnlUsd > 0
                    ? 'text-emerald-300'
                    : summaryCard?.unrealizedSpotPnlUsd < 0
                      ? 'text-red-300'
                      : ''
                }
              />
              <NadoSummaryRow
                label="Available Margin"
                value={fmt.currency(summaryCard?.availableMarginUsd)}
              />
              <NadoSummaryRow label="Maintenance Margin & Ratio">
                <div className="flex items-center justify-end gap-1.5">
                  <span>
                    {summaryCard?.maintenanceMarginUsd != null
                      ? fmt.currency(summaryCard.maintenanceMarginUsd)
                      : '—'}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span>
                    {summaryCard?.maintenanceMarginUsagePercent != null
                      ? fmt.percentPlain(summaryCard.maintenanceMarginUsagePercent)
                      : '—'}
                  </span>
                  <div className="relative h-1 w-12 overflow-hidden rounded-full bg-white/10 sm:w-16">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-violet-400/80"
                      style={{ width: `${maintenanceBarWidth}%` }}
                    />
                  </div>
                </div>
              </NadoSummaryRow>
            </div>
          )}
        </div>
      </section>

      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="border-b border-white/[0.08] px-3 py-2">
          <span className="text-xs font-medium text-slate-200">Realized PnL curve</span>
        </div>
        <div className="w-full min-w-0 px-2 pb-2 pt-1">
          <PnlCurveChart
            series={pnlSeries}
            isLoading={Boolean(portfolio.queries.trades?.isLoading)}
          />
        </div>
      </section>

      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-white/[0.08] p-1.5">
          <div className="flex flex-wrap gap-0.5">
            {[
              { id: 'balances', label: 'Spot' },
              { id: 'positions', label: 'Positions' },
              { id: 'orders', label: 'Open orders' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPortfolioDataTab(tab.id)}
                className={`rounded-md px-3.5 py-1.5 text-[14px] font-medium leading-snug transition ${
                  portfolioDataTab === tab.id
                    ? 'bg-violet-500/20 text-violet-100'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Search markets"
            disabled={!getNadoClient}
            title={getNadoClient ? 'Search markets' : 'Connect wallet to search markets'}
            onClick={() => setCommandCenterOpen(true)}
            className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-violet-500/20 bg-white/[0.04] text-violet-400 transition hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {portfolioDataTab === 'balances' && (
          <TableCard
            key="balances"
            showTitle={false}
            columns={['Asset', 'Balance / Value', 'Init.', 'Maint.']}
            empty="No spot balances."
            rows={visibleBalances.map((b) => ({
              key: b.id,
              cells: [
                <AssetCell
                  key={`asset-${b.id}`}
                  symbol={b.symbol}
                  seed={b.tokenAddr ?? String(b.productId ?? b.id)}
                  nadoAppOrigin={nadoAppOrigin}
                />,
                `${fmt.number(b.total)} · ${fmt.currency(b.usdValue)}`,
                fmt.weightPercent(b.weightInitial),
                fmt.weightPercent(b.weightMaintenance),
              ],
            }))}
            loading={
              portfolio.queries.summary.isLoading ||
              portfolio.queries.symbols?.isLoading ||
              portfolio.queries.spotTokenSymbols?.isLoading
            }
            maxBodyHeightPx={381}
          />
        )}
        {portfolioDataTab === 'positions' && (
          <div className="max-h-[381px] min-h-0 overflow-y-auto">
            <NadoPositionsTable
              positions={portfolio.positions}
              loading={
                portfolio.queries.canonicalPositions?.isLoading ??
                portfolio.queries.positions.isLoading
              }
              error={positionsError}
              nadoAppOrigin={nadoAppOrigin}
            />
          </div>
        )}
        {portfolioDataTab === 'orders' && (
          <TableCard
            key="orders"
            showTitle={false}
            columns={['Market', 'Side', 'Price', 'Size', 'Status']}
            empty={ordersError ? 'Failed to load open orders.' : 'No open orders.'}
            rows={portfolio.orders.map((o) => ({
              key: o.id,
              cells: [o.market, o.side, fmt.number(o.price), fmt.number(o.size), o.status],
            }))}
            loading={portfolio.queries.orders.isLoading}
            maxBodyHeightPx={381}
          />
        )}
      </section>

      <MarketCommandCenterModal
        open={commandCenterOpen}
        onClose={() => setCommandCenterOpen(false)}
        getNadoClient={getNadoClient}
        chainEnv={chainEnv}
        nadoAppOrigin={nadoAppOrigin}
      />
    </div>
  )
}

function MarginManagerTab({ portfolio, fmt }) {
  const um = portfolio.unifiedMargin
  return (
    <section className={`${C.card} p-4`}>
      <h3 className={C.label}>Margin & health</h3>
      <div className="mt-3 space-y-2.5 text-sm">
        <Row
          label="Initial margin usage"
          value={
            um?.initialMarginUsagePercent != null
              ? fmt.percentPlain(um.initialMarginUsagePercent)
              : '—'
          }
        />
        <Row
          label="Maintenance margin usage"
          value={
            um?.maintenanceMarginUsagePercent != null
              ? fmt.percentPlain(um.maintenanceMarginUsagePercent)
              : '—'
          }
        />
        <Row
          label="Maintenance buffer (assets − liab.)"
          value={um?.availableMargin != null ? fmt.currency(um.availableMargin) : '—'}
        />
        <Row
          label="Maintenance health"
          value={um?.fundsUntilLiquidation != null ? fmt.number(um.fundsUntilLiquidation, 6) : '—'}
        />
        <Row label="Subaccount on engine" value={portfolio.summary?.exists ? 'yes' : 'no'} />
      </div>
    </section>
  )
}

function historyTradeStats(trades) {
  const list = trades ?? []
  let fees = 0
  let realized = 0
  for (const t of list) {
    const f = typeof t.fee === 'number' && Number.isFinite(t.fee) ? t.fee : 0
    const p =
      typeof t.realizedPnl === 'number' && Number.isFinite(t.realizedPnl)
        ? t.realizedPnl
        : 0
    fees += f
    realized += p
  }
  return { count: list.length, fees, realized }
}

function historyFundingStats(rows) {
  const list = rows ?? []
  let sum = 0
  for (const r of list) {
    const p = typeof r.payment === 'number' && Number.isFinite(r.payment) ? r.payment : 0
    sum += p
  }
  return { count: list.length, sum }
}

function pnlCellClass(value) {
  if (value == null || Number.isNaN(Number(value))) return 'text-slate-400'
  const n = Number(value)
  if (n > 0) return 'text-emerald-300/95'
  if (n < 0) return 'text-rose-300/95'
  return 'text-slate-400'
}

function VirtualizedGridTable({
  columns,
  rows,
  loading,
  errorText,
  emptyText,
  rowHeight = 52,
  maxHeight = 381,
  gridClassName,
  renderRow,
}) {
  const parentRef = useRef(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
      <div
        className={`sticky top-0 z-10 grid border-b border-white/[0.08] bg-[rgba(12,14,32,0.97)] text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm ${gridClassName}`}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={`whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium ${column.headerClassName ?? ''}`}
          >
            {column.label}
          </div>
        ))}
      </div>

      {loading && (
        <div className="px-3 py-5 text-center text-[14px] text-slate-500">Loading…</div>
      )}
      {!loading && errorText && (
        <div className="px-3 py-7 text-center text-[14px] text-slate-500">{errorText}</div>
      )}
      {!loading && !errorText && rows.length === 0 && (
        <div className="px-3 py-7 text-center text-[14px] text-slate-500">{emptyText}</div>
      )}
      {!loading && !errorText && rows.length > 0 && (
        <div
          className="relative"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            const cells = renderRow(row)

            return (
              <div
                key={row.key}
                className={`absolute left-0 top-0 grid w-full items-center border-t border-white/[0.06] ${gridClassName}`}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {cells.map((cell, idx) => (
                  <div
                    key={`${row.key}-${columns[idx]?.key ?? idx}`}
                    className={columns[idx]?.cellClassName ?? 'px-2.5 py-2.5 text-[14px] text-slate-300'}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HistoryTab({ portfolio, fmt, nadoAppOrigin }) {
  const [historyPanel, setHistoryPanel] = useState('trades')
  const q = portfolio.queries.trades
  const qf = portfolio.queries.funding
  const trades = portfolio.trades ?? []
  const funding = portfolio.funding ?? []
  const fundingScopeEmpty = portfolio.fundingScopeEmpty === true
  const tradeStats = useMemo(
    () => (historyPanel === 'trades' ? historyTradeStats(trades) : { count: 0, fees: 0, realized: 0 }),
    [historyPanel, trades],
  )
  const fundStats = useMemo(
    () => (historyPanel === 'funding' ? historyFundingStats(funding) : { count: 0, sum: 0 }),
    [historyPanel, funding],
  )
  const tradeRows = useMemo(
    () =>
      trades.map((t) => ({
        key: t.id,
        values: t,
      })),
    [trades],
  )
  const fundingRows = useMemo(
    () =>
      funding.map((f) => ({
        key: f.id,
        values: f,
      })),
    [funding],
  )

  const subTabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setHistoryPanel(id)}
      className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium transition ${
        historyPanel === id
          ? 'bg-violet-500/20 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className={`${C.card} overflow-hidden p-0`}>
      <div className="border-b border-white/[0.08] px-3 py-2">
        <div className="mb-2 flex rounded-lg border border-white/10 bg-black/20 p-0.5">
          {subTabBtn('trades', 'Trade history')}
          {subTabBtn('funding', 'Funding history')}
        </div>
        {historyPanel === 'trades' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className={C.label}>Trade history</h3>
            {!q.isLoading && !q.error && tradeStats.count > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Fills (loaded)
                  </div>
                  <div className="font-mono text-sm tabular-nums text-slate-100">{tradeStats.count}</div>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Fees Σ (loaded)
                  </div>
                  <div className="font-mono text-sm tabular-nums text-slate-200">
                    {fmt.currency(tradeStats.fees)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Realized Σ (loaded)
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold tabular-nums ${pnlCellClass(tradeStats.realized)}`}
                  >
                    {fmt.signedCurrency(tradeStats.realized)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {historyPanel === 'funding' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className={C.label}>Funding history</h3>
            {!qf.isLoading && !qf.error && !fundingScopeEmpty && fundStats.count > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Ticks (scope)
                  </div>
                  <div className="font-mono text-sm tabular-nums text-slate-100">{fundStats.count}</div>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Payment Σ (scope)
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold tabular-nums ${pnlCellClass(fundStats.sum)}`}
                  >
                    {fmt.signedCurrency(fundStats.sum)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {historyPanel === 'trades' && (
        <VirtualizedGridTable
          columns={[
            {
              key: 'time',
              label: 'Time',
              cellClassName: 'whitespace-nowrap px-2.5 py-2.5 font-mono text-[13px] text-slate-400',
            },
            {
              key: 'market',
              label: 'Market',
              cellClassName: 'max-w-[14rem] min-w-[8rem] px-2.5 py-2.5',
            },
            {
              key: 'side',
              label: 'Side',
              cellClassName: 'px-2.5 py-2.5',
            },
            {
              key: 'price',
              label: 'Price',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 font-mono text-[14px] tabular-nums text-slate-300',
            },
            {
              key: 'size',
              label: 'Size',
              headerClassName: 'text-right',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[14px] tabular-nums text-slate-300',
            },
            {
              key: 'fee',
              label: 'Fee',
              headerClassName: 'text-right',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[14px] tabular-nums text-slate-400',
            },
            {
              key: 'pnl',
              label: 'PnL',
              headerClassName: 'text-right',
              cellClassName: 'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[15px] font-semibold tabular-nums tracking-tight',
            },
          ]}
          rows={tradeRows}
          loading={q.isLoading}
          errorText={q.error ? "Couldn't load fills with this SDK response." : ''}
          emptyText="No trades yet."
          rowHeight={56}
          gridClassName="min-w-[780px] grid-cols-[140px_minmax(190px,2fr)_100px_110px_110px_120px_120px]"
          renderRow={({ values: t }) => [
            fmt.datetime(t.time),
            <AssetCell
              key={`asset-${t.id}`}
              symbol={t.market}
              seed={t.id}
              nadoAppOrigin={nadoAppOrigin}
            />,
            <span
              key={`side-${t.id}`}
              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${tradeSideClass(t.side)}`}
            >
              {t.side}
            </span>,
            fmt.number(t.price, 0),
            fmt.number(t.size),
            fmt.currency(t.fee),
            <span key={`pnl-${t.id}`} className={pnlCellClass(t.realizedPnl)}>
              {fmt.signedCurrency(t.realizedPnl)}
            </span>,
          ]}
        />
      )}
      {historyPanel === 'funding' && (
        <VirtualizedGridTable
          columns={[
            {
              key: 'time',
              label: 'Time',
              cellClassName: 'whitespace-nowrap px-2.5 py-2.5 font-mono text-[13px] text-slate-400',
            },
            {
              key: 'market',
              label: 'Market',
              cellClassName: 'max-w-[14rem] min-w-[8rem] px-2.5 py-2.5',
            },
            {
              key: 'payment',
              label: 'Payment',
              headerClassName: 'text-right',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[14px] font-semibold tabular-nums',
            },
            {
              key: 'rate',
              label: 'Rate (APR)',
              headerClassName: 'text-right',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[13px] tabular-nums text-slate-300',
            },
            {
              key: 'oracle',
              label: 'Oracle',
              headerClassName: 'text-right',
              cellClassName:
                'whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[13px] tabular-nums text-slate-400',
            },
            {
              key: 'mode',
              label: 'Mode',
              cellClassName: 'whitespace-nowrap px-2.5 py-2.5 text-slate-400',
            },
          ]}
          rows={fundingRows}
          loading={qf.isLoading}
          errorText={
            qf.error
              ? "Couldn't load funding history from the indexer."
              : fundingScopeEmpty
                ? 'No product scope yet — fund the account or get a fill so we can query funding per market.'
                : ''
          }
          emptyText="No funding payments for the current product scope."
          rowHeight={56}
          gridClassName="min-w-[780px] grid-cols-[140px_minmax(190px,2fr)_130px_120px_110px_100px]"
          renderRow={({ values: f }) => [
            fmt.datetime(f.time),
            <AssetCell
              key={`asset-${f.id}`}
              symbol={f.market}
              seed={f.id}
              nadoAppOrigin={nadoAppOrigin}
            />,
            <span key={`payment-${f.id}`} className={pnlCellClass(f.payment)}>
              {fmt.signedCurrency(f.payment)}
            </span>,
            f.annualRate != null ? fmt.weightPercent(f.annualRate) : '—',
            fmt.number(f.oraclePrice, 4),
            f.isolated ? 'Isolated' : 'Cross',
          ]}
        />
      )}
    </section>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={C.muted}>{label}</span>
      <span
        className={`max-w-[65%] text-right text-slate-200 ${mono ? 'break-all font-mono text-xs' : 'text-sm'}`}
      >
        {value}
      </span>
    </div>
  )
}

function TableCard({
  title,
  showTitle = true,
  columns,
  rows,
  empty,
  loading,
  maxBodyHeightPx,
  footer,
}) {
  return (
    <section className={`${showTitle ? C.card : ''} overflow-hidden p-0`}>
      {showTitle && title != null && (
        <div className="border-b border-white/[0.08] px-3 py-2">
          <h3 className={C.label}>{title}</h3>
        </div>
      )}
      <div
        className={`overflow-x-auto ${maxBodyHeightPx ? 'overflow-y-auto' : ''}`}
        style={maxBodyHeightPx ? { maxHeight: maxBodyHeightPx } : undefined}
      >
        <table className="w-full min-w-[630px] text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-white/[0.08] text-slate-500">
              {columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-5 text-center text-[14px] text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-7 text-center text-[14px] text-slate-500"
                >
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.key} className="border-t border-white/[0.06]">
                  {r.cells.map((cell, i) => (
                    <td
                      key={i}
                      className="px-2.5 py-2.5 font-mono text-[14px] text-slate-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-white/[0.08] px-3 py-2">{footer}</div>
      )}
    </section>
  )
}
