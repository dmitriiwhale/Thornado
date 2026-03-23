import React from 'react'
import { fmt } from '../../lib/portfolioAdapters.js'

export default function PortfolioPnl({ pnl, query }) {
  const cards = [
    { label: 'Total Equity', value: fmt.currency(pnl?.equity) },
    { label: '24h PnL', value: fmt.signedCurrency(pnl?.dayPnl) },
    { label: '30d Volume', value: fmt.currency(pnl?.volume30d) },
    { label: 'Fee Tier', value: pnl?.feeTier ?? 'Tier 1' },
    { label: 'NLP Balance', value: fmt.currency(pnl?.nlpBalance) },
    { label: 'APR', value: pnl?.apr != null ? fmt.percent(pnl?.apr) : '—' },
  ]

  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        Portfolio stats
      </h3>
      {query.isLoading && <p className="mt-3 text-sm text-slate-400">Loading PnL...</p>}
      {!query.isLoading && query.error && (
        <p className="mt-3 text-sm text-amber-200">
          PnL endpoint unavailable, using summary fallback where possible.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-slate-100">
          PnL
        </span>
        <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
          Volume
        </span>
        <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
          24h
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
