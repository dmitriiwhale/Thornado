import React from 'react'
import { fmt } from '../../lib/portfolioAdapters.js'

export default function PortfolioRisk({ risk, query }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Risk</h3>
      {query.isLoading && <p className="mt-3 text-sm text-slate-400">Loading risk metrics...</p>}
      {!query.isLoading && query.error && (
        <p className="mt-3 text-sm text-amber-200">
          Risk endpoint unavailable, showing partial health data.
        </p>
      )}
      <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <dt className="text-slate-500">Maintenance health</dt>
          <dd className="mt-1 font-mono text-slate-100">
            {risk?.maintenanceHealth ? String(risk.maintenanceHealth) : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <dt className="text-slate-500">Margin usage</dt>
          <dd className="mt-1 text-slate-100">{fmt.percent(risk?.marginUsage)}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <dt className="text-slate-500">Leverage</dt>
          <dd className="mt-1 text-slate-100">{fmt.number(risk?.leverage)}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <dt className="text-slate-500">Liquidation buffer</dt>
          <dd className="mt-1 text-slate-100">{fmt.currency(risk?.liquidationBuffer)}</dd>
        </div>
      </dl>
    </section>
  )
}
