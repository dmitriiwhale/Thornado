import React from 'react'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'balances', label: 'Balances' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Open Orders' },
  { id: 'history', label: 'History' },
  { id: 'margin', label: 'Margin Manager' },
]

export { TABS as PORTFOLIO_TABS }

export default function PortfolioTabBar({ activeId, onChange }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div
        className="flex min-w-max gap-1 rounded-lg border border-white/10 bg-[rgba(8,10,24,0.85)] p-1"
        role="tablist"
        aria-label="Portfolio sections"
      >
        {TABS.map((tab) => {
          const active = activeId === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition ${
                active
                  ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
