import React from 'react'
import { fmt } from '../../lib/portfolioAdapters.js'

export default function PortfolioPositions({ rows, query, embedded = false }) {
  const wrapperClass = embedded ? '' : 'rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md'
  return (
    <section className={wrapperClass}>
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Positions</h3>
      {query.isLoading && <p className="mt-3 text-sm text-slate-400">Loading positions...</p>}
      {!query.isLoading && query.error && (
        <p className="mt-3 text-sm text-amber-200">Positions unavailable in current API response.</p>
      )}
      {!query.isLoading && !query.error && rows.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No open positions.</p>
      )}
      {rows.length > 0 && (
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[640px] text-left text-xs text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Market</th>
                <th className="py-2">Side</th>
                <th className="py-2">Size</th>
                <th className="py-2">Entry</th>
                <th className="py-2">Mark</th>
                <th className="py-2">PnL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-2 text-violet-100">{row.market}</td>
                  <td className="py-2">{row.side}</td>
                  <td className="py-2">{fmt.number(row.size)}</td>
                  <td className="py-2">{fmt.number(row.entry)}</td>
                  <td className="py-2">{fmt.number(row.mark)}</td>
                  <td
                    className={`py-2 ${
                      Number(row.pnl) > 0
                        ? 'text-emerald-300'
                        : Number(row.pnl) < 0
                          ? 'text-rose-300'
                          : ''
                    }`}
                  >
                    {fmt.signedCurrency(row.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
