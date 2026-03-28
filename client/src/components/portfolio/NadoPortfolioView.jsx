import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import NadoDepositWithdrawModal from './NadoDepositWithdrawModal.jsx'
import NadoTransferModal from './NadoTransferModal.jsx'
import { CHAIN_ENV_TO_CHAIN } from '@nadohq/shared'
import {
  fmt,
  tradeSideClass,
  buildCumulativeRealizedPnlSeries,
} from '../../lib/portfolioAdapters.js'
import PnlCurveChart from './PnlCurveChart.jsx'
import {
  fetchRemoteTokenIcon,
  hasRemoteTokenIconLookup,
} from '../../lib/tokenIconRemote.js'
import { tokenLogoCandidates } from '../../lib/tokenLogoUrls.js'

/** Thornado UI tokens — aligned with Account.jsx & Terminal widgets */
const C = {
  card: 'rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] backdrop-blur-md',
  label: 'text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500',
  muted: 'text-slate-500',
  mono: 'font-mono text-xs text-slate-200 tabular-nums',
}

/** Prefer quote collateral (USDT in label); else first row. `balances` are spot-only. */
function pickCollateralRow(balances) {
  if (!balances?.length) return null
  const bySymbol = balances.find(
    (b) =>
      String(b.symbol).toUpperCase().includes('USDT') ||
      String(b.symbol).toUpperCase() === 'USDT0'
  )
  if (bySymbol) return bySymbol
  return balances[0]
}

function hashString(seed) {
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

function TokenAvatar({ seed, symbol, size = 21 }) {
  const rawHash = hashString(seed)
  const hue = rawHash % 360
  const clean = String(symbol ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const label = clean.slice(0, 2) || '?'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`g-${rawHash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 90% 55%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 90% 45%)`} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.2" fill={`url(#g-${rawHash})`} />
      <circle
        cx="12"
        cy="12"
        r="10.2"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1"
      />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize={size >= 21 ? 12 : size >= 18 ? 10 : 9}
        fill="white"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
        style={{ fontWeight: 800 }}
      >
        {label}
      </text>
    </svg>
  )
}

function TokenImageOrFallback({ candidates, seed, symbol, size = 21 }) {
  const [idx, setIdx] = useState(0)
  if (!candidates?.length || idx >= candidates.length) {
    return <TokenAvatar seed={seed} symbol={symbol} size={size} />
  }
  return (
    <img
      src={candidates[idx]}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-white/5 object-cover ring-1 ring-white/10"
      style={{ width: size, height: size }}
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
      decoding="async"
    />
  )
}

function AssetCell({ symbol, seed, tokenAddress, chainId, publicClient }) {
  const remoteIconQuery = useQuery({
    queryKey: [
      'remote-token-icon',
      chainId,
      tokenAddress,
      publicClient?.chain?.id,
    ],
    queryFn: () =>
      fetchRemoteTokenIcon(chainId, tokenAddress, { publicClient }),
    enabled: Boolean(
      chainId != null &&
      tokenAddress &&
      isAddress(String(tokenAddress).trim()) &&
      (hasRemoteTokenIconLookup(chainId) || publicClient),
    ),
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 8 * 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const candidates = useMemo(() => {
    const staticList = tokenLogoCandidates({ tokenAddress, symbol, chainId })
    const u = remoteIconQuery.data
    if (
      typeof u === 'string' &&
      (u.startsWith('http') || u.startsWith('data:image/'))
    ) {
      return [...new Set([u, ...staticList])]
    }
    return staticList
  }, [tokenAddress, symbol, chainId, remoteIconQuery.data])
  return (
    <div className="flex items-center gap-2.5">
      <TokenImageOrFallback
        key={candidates.join('|')}
        candidates={candidates}
        seed={seed}
        symbol={symbol}
        size={21}
      />
      <div className="min-w-0">
        <div className="truncate font-sans text-[14px] font-medium leading-snug text-slate-200">
          {symbol || '—'}
        </div>
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
  const [mainTab, setMainTab] = useState('overview')
  const [dwModal, setDwModal] = useState(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const chainId = CHAIN_ENV_TO_CHAIN[chainEnv]?.id

  const um = portfolio.unifiedMargin
  const usdtRow = pickCollateralRow(portfolio.balances)

  const marginBarWidth = useMemo(() => {
    const m =
      um?.maintenanceMarginUsagePercent ?? um?.initialMarginUsagePercent ?? null
    if (m == null) return 0
    return Math.min(100, Math.max(0, m))
  }, [um])

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'margin', label: 'Margin' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Toolbar — compact */}
      <div className={`${C.card} p-3 sm:p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-200 ring-1 ring-violet-400/30">
              {walletAddress?.slice(2, 4)?.toUpperCase() ?? '?'}
            </div>
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
          marginBarWidth={marginBarWidth}
          usdtRow={usdtRow}
          fmt={fmt}
          chainId={chainId}
          publicClient={publicClient}
        />
      )}

      {mainTab === 'margin' && <MarginManagerTab portfolio={portfolio} fmt={fmt} />}

      {mainTab === 'history' && <HistoryTab portfolio={portfolio} fmt={fmt} />}

      <NadoDepositWithdrawModal
        open={Boolean(dwModal)}
        mode={dwModal}
        onClose={() => setDwModal(null)}
        getNadoClient={getNadoClient}
        ownerAddress={walletAddress}
        subaccountName="default"
        onCompleted={onInvalidatePortfolio}
      />
      <NadoTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        getNadoClient={getNadoClient}
        ownerAddress={walletAddress}
        subaccountName="default"
        onCompleted={onInvalidatePortfolio}
      />
    </div>
  )
}

function OverviewTab({
  portfolio,
  marginBarWidth,
  usdtRow,
  fmt,
  chainId,
  publicClient,
}) {
  const [portfolioDataTab, setPortfolioDataTab] = useState('balances')
  const um = portfolio.unifiedMargin
  const loading = portfolio.queries.summary.isLoading
  const noSubaccount = portfolio.queries.summary.isSuccess && portfolio.summary?.exists === false
  const ordersError = portfolio.queries.orders?.error
  const positionsError = portfolio.queries.positions?.error
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

  return (
    <div className="flex flex-col gap-3">
      <section className={`${C.card} p-4`}>
        <h3 className={C.label}>Unified margin</h3>
        {loading && (
          <p className="mt-3 text-xs text-slate-500">Loading engine summary…</p>
        )}
        {!loading && noSubaccount && (
          <p className="mt-3 text-xs text-amber-200/90">
            No subaccount on engine yet — deposit on Nado first; margin metrics stay empty.
          </p>
        )}
        {!loading && !noSubaccount && (
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCompact
              label="Margin usage (initial)"
              value={
                um?.initialMarginUsagePercent != null
                  ? fmt.percentPlain(um.initialMarginUsagePercent)
                  : '—'
              }
            />
            <div className="flex flex-col gap-1">
              <span className={`${C.muted} text-xs`}>Maint. usage</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${C.mono} text-sm text-slate-100`}>
                  {um?.maintenanceMarginUsagePercent != null
                    ? fmt.percentPlain(um.maintenanceMarginUsagePercent)
                    : '—'}
                </span>
                <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:w-24">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/80"
                    style={{ width: `${marginBarWidth}%` }}
                  />
                </div>
              </div>
            </div>
            <MetricCompact
              label="Available (maint.)"
              value={
                um?.availableMargin != null ? fmt.currency(um.availableMargin) : '—'
              }
            />
            <MetricCompact
              label="Health (maint.)"
              value={
                um?.fundsUntilLiquidation != null
                  ? fmt.number(um.fundsUntilLiquidation, 4)
                  : '—'
              }
            />
          </div>
        )}
      </section>

      {/* Collateral snapshot */}
      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
          <span className="text-xs font-medium text-slate-200">
            {usdtRow?.symbol ? `${usdtRow.symbol} balance` : 'Collateral'}
          </span>
          <span className={C.muted + ' text-[10px]'}>engine</span>
        </div>
        <div className="px-3 py-3">
          {usdtRow ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div>
                <div className={C.muted + ' text-[10px]'}>Balance</div>
                <div className={C.mono}>{fmt.number(usdtRow.total)}</div>
              </div>
              <div>
                <div className={C.muted + ' text-[10px]'}>Unreal. PnL</div>
                <div className={C.mono}>{fmt.signedCurrency(portfolio.pnl?.unrealized)}</div>
              </div>
              <div>
                <div className={C.muted + ' text-[10px]'}>Available</div>
                <div className={C.mono}>{fmt.number(usdtRow.available)}</div>
              </div>
              <div>
                <div className={C.muted + ' text-[10px]'}>Init. wgt</div>
                <div className={C.mono}>{fmt.weightPercent(usdtRow.weightInitial)}</div>
              </div>
              <div>
                <div className={C.muted + ' text-[10px]'}>Maint. wgt</div>
                <div className={C.mono}>{fmt.weightPercent(usdtRow.weightMaintenance)}</div>
              </div>
            </div>
          ) : (
            <p className={`${C.muted} text-center text-xs`}>No balance row yet.</p>
          )}
        </div>
      </section>

      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
          <span className="text-xs font-medium text-slate-200">Realized PnL</span>
          <span className={`${C.muted} text-[10px]`}>cum. from recent fills</span>
        </div>
        <div className="w-full min-w-0 px-2 pb-2 pt-1">
          <PnlCurveChart
            series={pnlSeries}
            isLoading={Boolean(portfolio.queries.trades?.isLoading)}
          />
        </div>
      </section>

      <section className={`${C.card} overflow-hidden p-0`}>
        <div className="flex flex-wrap gap-0.5 border-b border-white/[0.08] p-1.5">
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
                  tokenAddress={b.tokenAddr}
                  chainId={chainId}
                  publicClient={publicClient}
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
          <TableCard
            key="positions"
            showTitle={false}
            columns={['Market', 'Side', 'Size', 'Entry', 'Mark', 'PnL', 'Notional']}
            empty={positionsError ? 'Failed to load positions.' : 'No positions.'}
            rows={portfolio.positions.map((p) => ({
              key: p.id,
              cells: [
                <AssetCell
                  key={`pos-${p.id}`}
                  symbol={p.market}
                  seed={String(p.productId ?? p.tokenAddr ?? p.id)}
                  tokenAddress={p.tokenAddr}
                  chainId={chainId}
                  publicClient={publicClient}
                />,
                <span key={`side-${p.id}`} className={tradeSideClass(p.side)}>
                  {p.side}
                </span>,
                fmt.number(p.size),
                fmt.number(p.entry),
                fmt.number(p.mark),
                fmt.signedCurrency(p.pnl),
                fmt.currency(p.notional),
              ],
            }))}
            loading={portfolio.queries.positions.isLoading}
            maxBodyHeightPx={381}
          />
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
          label="Available (maint. assets − liab.)"
          value={um?.availableMargin != null ? fmt.currency(um.availableMargin) : '—'}
        />
        <Row
          label="Maintenance health (x18→dec)"
          value={um?.fundsUntilLiquidation != null ? fmt.number(um.fundsUntilLiquidation, 6) : '—'}
        />
        <Row label="Subaccount on engine" value={portfolio.summary?.exists ? 'yes' : 'no'} />
      </div>
      <p className={`${C.muted} mt-4 text-[11px] leading-relaxed`}>
        Figures come from your Nado engine account snapshot (margin and health). If more risk
        details are available from Nado, they appear here automatically.
      </p>
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

function pnlCellClass(value) {
  if (value == null || Number.isNaN(Number(value))) return 'text-slate-400'
  const n = Number(value)
  if (n > 0) return 'text-emerald-300/95'
  if (n < 0) return 'text-rose-300/95'
  return 'text-slate-400'
}

function HistoryTab({ portfolio, fmt }) {
  const q = portfolio.queries.trades
  const trades = portfolio.trades ?? []
  const stats = useMemo(() => historyTradeStats(trades), [trades])

  return (
    <section className={`${C.card} overflow-hidden p-0`}>
      <div className="border-b border-white/[0.08] px-3 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className={C.label}>Trade history</h3>
          {!q.isLoading && !q.error && stats.count > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Fills (loaded)
                </div>
                <div className="font-mono text-sm tabular-nums text-slate-100">{stats.count}</div>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Fees Σ
                </div>
                <div className="font-mono text-sm tabular-nums text-slate-200">
                  {fmt.currency(stats.fees)}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Realized Σ
                </div>
                <div
                  className={`font-mono text-sm font-semibold tabular-nums ${pnlCellClass(stats.realized)}`}
                >
                  {fmt.signedCurrency(stats.realized)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight: 381 }}
      >
        <table className="w-full min-w-[630px] text-left text-[14px] leading-snug">
          <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[rgba(12,14,32,0.97)] shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
            <tr className="text-slate-500">
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium">Time</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium">Market</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium">Side</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium">Price</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-medium">
                Size
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-medium">
                Fee
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-medium">
                PnL
              </th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-5 text-center text-[14px] text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!q.isLoading && q.error && (
              <tr>
                <td colSpan={7} className="px-3 py-7 text-center text-[14px] text-slate-500">
                  Couldn&apos;t load fills with this SDK response.
                </td>
              </tr>
            )}
            {!q.isLoading &&
              !q.error &&
              trades.map((t) => (
                <tr key={t.id} className="border-t border-white/[0.06]">
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[13px] text-slate-400">
                    {fmt.datetime(t.time)}
                  </td>
                  <td className="max-w-[10rem] truncate px-2.5 py-2.5 font-medium text-slate-200">
                    {t.market}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${tradeSideClass(t.side)}`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[14px] tabular-nums text-slate-300">
                    {fmt.number(t.price)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[14px] tabular-nums text-slate-300">
                    {fmt.number(t.size)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[14px] tabular-nums text-slate-400">
                    {fmt.currency(t.fee)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[15px] font-semibold tabular-nums tracking-tight ${pnlCellClass(t.realizedPnl)}`}
                  >
                    {fmt.signedCurrency(t.realizedPnl)}
                  </td>
                </tr>
              ))}
            {!q.isLoading && !q.error && trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-7 text-center text-[14px] text-slate-500">
                  No trades yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!q.isLoading && !q.error && trades.length > 0 && (
        <div className="border-t border-white/[0.08] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          Totals above are for the fills listed in this table (same window as the API). Older
          activity may not appear.
        </div>
      )}
    </section>
  )
}

function MetricCompact({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${C.muted} text-[10px] uppercase tracking-wide`}>{label}</span>
      <span className={`${C.mono} text-sm text-slate-100`}>{value}</span>
    </div>
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
