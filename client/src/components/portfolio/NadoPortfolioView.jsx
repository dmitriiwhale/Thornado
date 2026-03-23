import React, { useMemo, useState } from 'react'
import { fmt } from '../../lib/portfolioAdapters.js'

/** Thornado UI tokens — aligned with Account.jsx & Terminal widgets */
const C = {
  card: 'rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] backdrop-blur-md',
  label: 'text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500',
  muted: 'text-slate-500',
  mono: 'font-mono text-xs text-slate-200 tabular-nums',
}

/** API may return 0–1 or 0–100 for utilization. */
function normalizePct(value) {
  if (value == null) return null
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(n)) return null
  if (n >= 0 && n <= 1 && n !== 0) return n * 100
  return n
}

function pickUsdtRow(balances) {
  if (!balances?.length) return null
  const u = balances.find(
    (b) =>
      String(b.symbol).toUpperCase().includes('USDT') ||
      String(b.symbol).toUpperCase() === 'USDT0'
  )
  return u ?? balances[0]
}

export default function NadoPortfolioView({
  walletAddress,
  chainEnv,
  nadoAppOrigin,
  portfolio,
  healthMaintenance,
}) {
  const [mainTab, setMainTab] = useState('overview')

  const marginUsageRaw = portfolio.risk?.marginUsage
  const marginUsage = useMemo(() => normalizePct(marginUsageRaw), [marginUsageRaw])
  const maintPct = useMemo(() => {
    const h = healthMaintenance
    if (h == null) return null
    const n = Number.parseFloat(String(h).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? normalizePct(n) : null
  }, [healthMaintenance])

  const liqBuffer = portfolio.risk?.liquidationBuffer
  const availableMargin = portfolio.pnl?.equity
  const usdtRow = pickUsdtRow(portfolio.balances)

  const marginBarWidth = useMemo(() => {
    const m = marginUsage ?? maintPct
    if (m == null) return 0
    const n = Number(m)
    if (!Number.isFinite(n)) return 0
    return Math.min(100, Math.max(0, n))
  }, [marginUsage, maintPct])

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
            <a
              href={nadoAppOrigin}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              Transfer
            </a>
            <a
              href={nadoAppOrigin}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              Withdraw
            </a>
            <a
              href={nadoAppOrigin}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-500"
            >
              Deposit
            </a>
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
          marginUsage={marginUsage}
          maintPct={maintPct}
          availableMargin={availableMargin}
          liqBuffer={liqBuffer}
          usdtRow={usdtRow}
          fmt={fmt}
        />
      )}

      {mainTab === 'margin' && (
        <MarginManagerTab portfolio={portfolio} healthMaintenance={healthMaintenance} fmt={fmt} />
      )}

      {mainTab === 'history' && <HistoryTab portfolio={portfolio} fmt={fmt} />}
    </div>
  )
}

function OverviewTab({
  portfolio,
  marginBarWidth,
  marginUsage,
  maintPct,
  availableMargin,
  liqBuffer,
  usdtRow,
  fmt,
}) {
  return (
    <div className="flex flex-col gap-3">
      <section className={`${C.card} p-4`}>
        <h3 className={C.label}>Unified margin</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCompact
            label="Margin usage"
            value={marginUsage != null ? fmt.percentPlain(marginUsage) : '—'}
          />
          <div className="flex flex-col gap-1">
            <span className={`${C.muted} text-xs`}>Maint. usage</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${C.mono} text-sm text-slate-100`}>
                {maintPct != null || marginUsage != null
                  ? fmt.percentPlain(maintPct ?? marginUsage ?? 0)
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
          <MetricCompact label="Available" value={fmt.currency(availableMargin)} />
          <MetricCompact label="Until liq." value={fmt.currency(liqBuffer)} />
        </div>
        <a
          href="#isolated"
          className="mt-3 inline-flex items-center gap-1 text-xs text-violet-300/90 hover:text-violet-200"
        >
          Isolated positions ↓
        </a>
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
                <div className={C.mono}>—</div>
              </div>
              <div>
                <div className={C.muted + ' text-[10px]'}>Maint. wgt</div>
                <div className={C.mono}>—</div>
              </div>
            </div>
          ) : (
            <p className={`${C.muted} text-center text-xs`}>No balance row yet.</p>
          )}
        </div>
      </section>

      <TableCard
        title="Balances"
        columns={['Asset', 'Balance / Value', 'Init.', 'Maint.']}
        empty="No balances."
        rows={portfolio.balances.map((b) => ({
          key: b.id,
          cells: [b.symbol, `${fmt.number(b.total)} · ${fmt.currency(b.usdValue)}`, '—', '—'],
        }))}
        loading={portfolio.queries.summary.isLoading}
      />

      <TableCard
        title="Perps"
        columns={['Position', 'Notional', 'Est. PnL', '—', '—', '—']}
        empty="No perp positions."
        rows={portfolio.positions.map((p) => ({
          key: p.id,
          cells: [
            p.market,
            fmt.currency(p.notional),
            fmt.signedCurrency(p.pnl),
            '—',
            '—',
            '—',
          ],
        }))}
        loading={portfolio.queries.positions.isLoading}
      />

      <TableCard
        title="Open orders"
        columns={['Market', 'Side', 'Price', 'Size', 'Status']}
        empty="No open orders."
        rows={portfolio.orders.map((o) => ({
          key: o.id,
          cells: [o.market, o.side, fmt.number(o.price), fmt.number(o.size), o.status],
        }))}
        loading={portfolio.queries.orders.isLoading}
      />

      <section id="isolated" className={`${C.card} scroll-mt-4 p-4`}>
        <h3 className={C.label}>Isolated</h3>
        <p className={`${C.muted} mt-2 text-xs`}>No isolated positions (placeholder).</p>
      </section>
    </div>
  )
}

function MarginManagerTab({ portfolio, healthMaintenance, fmt }) {
  return (
    <section className={`${C.card} p-4`}>
      <h3 className={C.label}>Margin & health</h3>
      <div className="mt-3 space-y-2.5 text-sm">
        <Row label="Maintenance health" value={healthMaintenance ?? '—'} mono />
        <Row
          label="Margin usage"
          value={fmt.percentPlain(normalizePct(portfolio.risk?.marginUsage) ?? null)}
        />
        <Row label="Leverage" value={fmt.number(portfolio.risk?.leverage, 2)} />
        <Row label="Liquidation buffer" value={fmt.currency(portfolio.risk?.liquidationBuffer)} />
        <Row label="Subaccount on engine" value={portfolio.summary?.exists ? 'yes' : 'no'} />
      </div>
      <p className={`${C.muted} mt-4 text-[11px] leading-relaxed`}>
        Data from Nado SDK when exposed; empty fields may stay until the API returns them.
      </p>
    </section>
  )
}

function HistoryTab({ portfolio, fmt }) {
  const q = portfolio.queries.trades
  return (
    <section className={`${C.card} overflow-hidden p-0`}>
      <div className="border-b border-white/[0.08] px-3 py-2">
        <h3 className={C.label}>Trade history</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] text-slate-500">
              <th className="px-2.5 py-2 font-medium">Time</th>
              <th className="px-2.5 py-2 font-medium">Market</th>
              <th className="px-2.5 py-2 font-medium">Side</th>
              <th className="px-2.5 py-2 font-medium">Price</th>
              <th className="px-2.5 py-2 font-medium">Size</th>
              <th className="px-2.5 py-2 font-medium">Fee</th>
              <th className="px-2.5 py-2 font-medium">PnL</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!q.isLoading && q.error && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Unavailable for this SDK response.
                </td>
              </tr>
            )}
            {!q.isLoading &&
              !q.error &&
              portfolio.trades.map((t) => (
                <tr key={t.id} className="border-t border-white/[0.06]">
                  <td className="px-2.5 py-1.5 font-mono text-[11px]">{fmt.datetime(t.time)}</td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-violet-200/90">
                    {t.market}
                  </td>
                  <td className="px-2.5 py-1.5">{t.side}</td>
                  <td className="px-2.5 py-1.5 font-mono">{fmt.number(t.price)}</td>
                  <td className="px-2.5 py-1.5 font-mono">{fmt.number(t.size)}</td>
                  <td className="px-2.5 py-1.5 font-mono">{fmt.currency(t.fee)}</td>
                  <td className="px-2.5 py-1.5 font-mono">{fmt.signedCurrency(t.realizedPnl)}</td>
                </tr>
              ))}
            {!q.isLoading && !q.error && portfolio.trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No trades yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

function TableCard({ title, columns, rows, empty, loading }) {
  return (
    <section className={`${C.card} overflow-hidden p-0`}>
      <div className="border-b border-white/[0.08] px-3 py-2">
        <h3 className={C.label}>{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] text-slate-500">
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2.5 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-5 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.key} className="border-t border-white/[0.06]">
                  {r.cells.map((cell, i) => (
                    <td key={i} className="px-2.5 py-1.5 font-mono text-[11px] text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
