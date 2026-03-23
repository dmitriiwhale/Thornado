import React from 'react'
import { fmt } from '../../lib/portfolioAdapters.js'

export default function PortfolioBalances({ rows, query, embedded = false }) {
  const wrapperClass = embedded ? '' : 'rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md'
  return (
    <section className={wrapperClass}>
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Balances</h3>
      {query.isLoading && <p className="mt-3 text-sm text-slate-400">Loading balances...</p>}
      {!query.isLoading && query.error && (
        <p className="mt-3 text-sm text-rose-300">Could not load balances.</p>
      )}
      {!query.isLoading && !query.error && rows.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No balances yet.</p>
      )}
      {rows.length > 0 && (
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Asset</th>
                <th className="py-2">Balance / Value</th>
                <th className="py-2">Est. PnL / ROE%</th>
                <th className="py-2">Deposit APY</th>
                <th className="py-2">Borrow APY</th>
                <th className="py-2">Interest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-2 font-medium text-violet-100">{row.symbol}</td>
                  <td className="py-2">
                    {fmt.number(row.total)} / {fmt.currency(row.usdValue)}
                  </td>
                  <td className="py-2">— / —</td>
                  <td className="py-2">—</td>
                  <td className="py-2">—</td>
                  <td className="py-2">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
