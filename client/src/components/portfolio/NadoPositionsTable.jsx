import React from 'react'
import { ArrowLeftRight, ArrowUpDown, Plus, Share2 } from 'lucide-react'
import Web3TokenIcon from './Web3TokenIcon.jsx'
import { fmt, normalizePerpMarketLabel } from '../../lib/portfolioAdapters.js'

function pnlToneClass(v) {
  if (v == null || Number.isNaN(Number(v))) return 'text-slate-400'
  const n = Number(v)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-rose-400'
  return 'text-slate-400'
}

function nadoPerpUrl(origin, market) {
  const base = String(origin ?? '').replace(/\/$/, '')
  if (!base) return null
  const m = normalizePerpMarketLabel(market)
  return `${base}/perpetuals?market=${encodeURIComponent(m)}`
}

function baseTicker(market) {
  const s = normalizePerpMarketLabel(String(market ?? ''))
  return s.split('/')[0]?.trim() || '—'
}

function marginCell(p) {
  const m = p.margin
  return m != null && Number.isFinite(Number(m)) ? fmt.currency(m) : '—'
}

/** Net funding paid/received in USD (indexer snapshot: cumulative + unrealized). */
function fundingCell(p) {
  const v = p.fundingUsd
  if (v == null || !Number.isFinite(v)) return '—'
  return fmt.signedCurrency(v)
}

function leverageCell(p) {
  const v = Number(p?.leverage)
  if (!Number.isFinite(v) || Math.abs(v) <= 1e-12) return '—'
  return `${fmt.number(v, 2)}x`
}

function roeCell(p) {
  const pnl = Number(p?.pnl)
  const margin = Number(p?.roeMargin)
  if (!Number.isFinite(pnl) || !Number.isFinite(margin) || Math.abs(margin) <= 1e-12) return '—'
  return fmt.percent((pnl / margin) * 100)
}

function SortHead({ children }) {
  return (
    <div className="flex cursor-default items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
      <ArrowUpDown className="h-2.5 w-2.5 shrink-0 text-slate-600" aria-hidden />
    </div>
  )
}

function DashedHead({ children }) {
  return (
    <div
      className="cursor-help whitespace-nowrap border-b border-dotted border-slate-600 pb-px text-[11px] font-semibold uppercase tracking-wider text-slate-500"
      title="From Nado engine when available"
    >
      {children}
    </div>
  )
}

/**
 * Positions grid modeled after Nado perp table: Market (sticky) · scrollable metrics · actions (sticky).
 * Metrics without engine fields show —; actions link to Nado app.
 */
export default function NadoPositionsTable({
  positions = [],
  loading,
  error,
  nadoAppOrigin,
}) {
  if (loading) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center px-4 py-8 text-sm text-slate-500">
        Loading positions…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center px-4 py-8 text-sm text-amber-200/95">
        Failed to load positions.
      </div>
    )
  }
  if (!positions.length) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center px-4 py-8 text-sm text-slate-500">
        No open positions.
      </div>
    )
  }

  const headerCenter = (
    <div className="flex h-9 min-w-max items-stretch border-b border-white/[0.08]">
      <div className="flex min-w-[7.5rem] flex-1 items-center pl-3 pr-1">
        <SortHead>Size</SortHead>
      </div>
      <div className="flex min-w-[6.5rem] flex-1 items-center px-1">
        <SortHead>Value</SortHead>
      </div>
      <div className="flex min-w-[5.5rem] flex-1 items-center px-1">
        <DashedHead>Leverage</DashedHead>
      </div>
      <div className="flex min-w-[6.5rem] flex-1 items-center px-1">
        <DashedHead>Entry Price</DashedHead>
      </div>
      <div className="flex min-w-[6.5rem] flex-1 items-center px-1">
        <DashedHead>Est. Liq. Price</DashedHead>
      </div>
      <div className="flex min-w-[5.5rem] flex-1 items-center px-1">
        <DashedHead>TP/SL</DashedHead>
      </div>
      <div className="flex min-w-[9.5rem] flex-1 items-center px-1">
        <SortHead>Est. PnL (ROE%)</SortHead>
      </div>
      <div className="flex min-w-[5.5rem] flex-1 items-center px-1">
        <DashedHead>Margin</DashedHead>
      </div>
      <div
        className="flex min-w-[6rem] flex-1 items-center pr-3 pl-1"
        title="Net funding in USD (indexer account snapshot, or sum of recent payment ticks)"
      >
        <SortHead>Funding</SortHead>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 w-full min-w-0 overflow-hidden rounded-b-lg border-t border-white/[0.06]">
      {/* Left — Market */}
      <div className="flex shrink-0 flex-col border-r border-white/[0.08] bg-[rgba(10,12,28,0.5)]">
        <div className="flex h-9 items-center border-b border-white/[0.08] px-3">
          <SortHead>Market</SortHead>
        </div>
        {positions.map((p) => {
          const href = nadoPerpUrl(nadoAppOrigin, p.market)
          const side = String(p.side ?? '').toUpperCase()
          const sideShort = side === 'LONG' ? 'Long' : side === 'SHORT' ? 'Short' : '—'
          return (
            <div
              key={p.id}
              className="flex min-h-11 items-center border-b border-white/[0.05] px-3 py-0.5 last:border-b-0"
            >
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-0 items-start gap-2 text-left"
                >
                  <Web3TokenIcon
                    symbol={p.market}
                    seed={String(p.productId ?? p.id)}
                    size={22}
                    nadoAppOrigin={nadoAppOrigin}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs font-medium text-slate-100">
                        {normalizePerpMarketLabel(p.market)}
                      </span>
                      <span
                        className={`inline-block rounded px-1 py-0.5 text-[10px] font-semibold uppercase leading-none ${
                          side === 'LONG'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : side === 'SHORT'
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'bg-white/[0.06] text-slate-500'
                        }`}
                      >
                        {sideShort}
                      </span>
                    </div>
                    <span className="text-[11px] capitalize text-slate-500">
                      {p.isolated ? 'Isolated' : 'Cross'}
                    </span>
                  </div>
                </a>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <Web3TokenIcon
                    symbol={p.market}
                    seed={String(p.productId ?? p.id)}
                    size={22}
                    nadoAppOrigin={nadoAppOrigin}
                  />
                  <span className="truncate text-xs font-medium text-slate-200">{p.market}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Center — scroll */}
      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="min-w-max">
          {headerCenter}
          {positions.map((p) => {
            const base = baseTicker(p.market)
            const entryDisp =
              p.entry != null && Number.isFinite(Number(p.entry))
                ? fmt.number(p.entry)
                : '—'
            const valueDisp = p.notional != null ? fmt.currency(p.notional) : '—'
            const leverageDisp = leverageCell(p)
            const sizeDisp =
              p.size != null ? (
                <span className="flex items-baseline gap-x-1">
                  {fmt.number(p.size)}
                  <span className="text-slate-500">{base}</span>
                </span>
              ) : (
                '—'
            )
            const tradeBase = nadoPerpUrl(nadoAppOrigin, p.market)

            return (
              <div
                key={p.id}
                className="flex min-h-11 min-w-max items-stretch border-b border-white/[0.05] py-0.5 last:border-b-0"
              >
                <div className="flex min-w-[7.5rem] flex-1 items-center pl-3 pr-1 text-xs tabular-nums text-slate-200">
                  {sizeDisp}
                </div>
                <div className="flex min-w-[6.5rem] flex-1 items-center px-1 text-xs tabular-nums text-slate-200">
                  {valueDisp}
                </div>
                <div className="flex min-w-[5.5rem] flex-1 items-center px-1 text-xs tabular-nums text-slate-200">
                  {leverageDisp}
                </div>
                <div className="flex min-w-[6.5rem] flex-1 items-center px-1 text-xs tabular-nums text-slate-200">
                  {entryDisp}
                </div>
                <div className="flex min-w-[6.5rem] flex-1 items-center px-1 text-xs tabular-nums text-slate-500">
                  —
                </div>
                <div className="flex min-w-[5.5rem] flex-1 items-center px-1">
                  {tradeBase ? (
                    <a
                      href={tradeBase}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-violet-500/25 hover:bg-violet-500/10 hover:text-violet-100"
                    >
                      <Plus className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.5} aria-hidden />
                      Add
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-0.5 rounded-md border border-white/5 bg-black/20 px-1.5 py-1 text-[11px] text-slate-600"
                    >
                      <Plus className="h-3 w-3 opacity-50" aria-hidden />
                      Add
                    </button>
                  )}
                </div>
                <div className="flex min-w-[9.5rem] flex-1 items-center gap-2 px-1">
                  <div
                    className={`flex min-w-0 flex-col gap-0.5 text-xs tabular-nums ${pnlToneClass(p.pnl)}`}
                  >
                    <span>{fmt.signedCurrency(p.pnl)}</span>
                    <span className="text-[10px] text-slate-500">{roeCell(p)}</span>
                  </div>
                  <button
                    type="button"
                    title="Copy PnL"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.07] hover:text-slate-200"
                    onClick={() => {
                      const t = `${p.market} ${fmt.signedCurrency(p.pnl)}`
                      void navigator.clipboard?.writeText(t)
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <div className="flex min-w-[5.5rem] flex-1 items-center px-1 text-xs tabular-nums text-slate-200">
                  {marginCell(p)}
                </div>
                <div className="flex min-w-[6rem] flex-1 items-center pr-3 pl-1 text-xs tabular-nums text-slate-200">
                  {fundingCell(p)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right — compact segmented actions (links to Nado) */}
      <div className="flex w-[148px] shrink-0 flex-col border-l border-white/[0.08] bg-[rgba(10,12,28,0.5)]">
        <div className="flex h-9 items-center justify-center border-b border-white/[0.08] px-2">
          {nadoAppOrigin ? (
            <a
              href={String(nadoAppOrigin).replace(/\/$/, '')}
              target="_blank"
              rel="noopener noreferrer"
              title="Manage closes on Nado"
              className="w-full rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-2 py-1 text-center text-[11px] font-semibold leading-tight text-rose-200/95 transition hover:border-rose-400/40 hover:bg-rose-500/15"
            >
              Close all
            </a>
          ) : (
            <span className="w-full rounded-md border border-white/10 px-2 py-1 text-center text-[11px] text-slate-600">
              Close all
            </span>
          )}
        </div>
        {positions.map((p) => {
          const u = nadoPerpUrl(nadoAppOrigin, p.market)
          const seg =
            'flex items-center justify-center border-white/[0.08] py-1.5 text-[11px] font-medium leading-none text-slate-200 transition hover:bg-white/[0.07] hover:text-white'
          return (
            <div
              key={`actions-${p.id}`}
              className="flex min-h-11 items-center justify-center border-b border-white/[0.05] px-1.5 last:border-b-0"
            >
              {u ? (
                <div className="inline-flex w-full max-w-[9.25rem] overflow-hidden rounded-lg border border-white/10 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Reverse position"
                    className={`${seg} w-8 shrink-0 border-r`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Limit close"
                    className={`${seg} min-w-0 flex-1 border-r px-0.5`}
                  >
                    Limit
                  </a>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Market close"
                    className={`${seg} min-w-0 flex-1 px-0.5`}
                  >
                    Mkt
                  </a>
                </div>
              ) : (
                <div className="inline-flex w-full max-w-[9.25rem] overflow-hidden rounded-lg border border-white/5 opacity-40">
                  <span className={`${seg} w-8 shrink-0 border-r`}>
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className={`${seg} min-w-0 flex-1 border-r px-0.5`}>Limit</span>
                  <span className={`${seg} min-w-0 flex-1 px-0.5`}>Mkt</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
