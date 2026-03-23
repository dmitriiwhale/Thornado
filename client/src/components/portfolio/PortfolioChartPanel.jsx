import React from 'react'
import TinyChart from '../TinyChart.jsx'

export default function PortfolioChartPanel() {
  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Performance
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="h-[180px]">
          <TinyChart />
        </div>
      </div>
    </section>
  )
}
