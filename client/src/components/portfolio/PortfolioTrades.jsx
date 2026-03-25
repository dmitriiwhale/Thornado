import React from 'react'
import { fmt, tradeSideClass } from '../../lib/portfolioAdapters.js'

export default function PortfolioTrades({ rows, query }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        History
      </h3>
      {query.isLoading && <p className="mt-3 text-sm text-slate-400">Loading trades...</p>}
      {!query.isLoading && query.error && (
        <p className="mt-3 text-sm text-amber-200">Trades unavailable in current API response.</p>
      )}
      {!query.isLoading && !query.error && rows.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No trades yet.</p>
      )}
      {rows.length > 0 && (
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[680px] text-left text-xs text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Market</th>
                <th className="py-2">Side</th>
                <th className="py-2">Price</th>
                <th className="py-2">Size</th>
                <th className="py-2">Fee</th>
                <th className="py-2">Realized PnL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-2">{fmt.datetime(row.time)}</td>
                  <td className="py-2 text-violet-100">{row.market}</td>
                  <td className={`py-2 ${tradeSideClass(row.side)}`}>{row.side}</td>
                  <td className="py-2">{fmt.number(row.price)}</td>
                  <td className="py-2">{fmt.number(row.size)}</td>
                  <td className="py-2">{fmt.currency(row.fee)}</td>
                  <td className="py-2">{fmt.signedCurrency(row.realizedPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
