import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import Web3TokenIcon from './Web3TokenIcon.jsx'
import {
  fetchMarketCommandCenterRows,
  MARKET_COMMAND_CENTER_STALE_MS,
  marketCommandCenterQueryKey,
} from '../../lib/accountPreload.js'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'perp', label: 'Perps' },
  { id: 'spot', label: 'Spot' },
  { id: 'meme', label: 'Memes' },
  { id: 'defi', label: 'DeFi' },
  { id: 'chain', label: 'Chains' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'forex', label: 'FX' },
  { id: 'indices', label: 'Indices' },
]

function formatPrice(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const opts =
    abs >= 1000
      ? { maximumFractionDigits: 2, minimumFractionDigits: 0 }
      : abs >= 1
        ? { maximumFractionDigits: 4, minimumFractionDigits: 0 }
        : { maximumFractionDigits: 6, maximumSignificantDigits: 6 }
  return new Intl.NumberFormat('en-US', opts).format(n)
}

/** 24h volume in quote (USDT0) from indexer v2 tickers */
function formatQuoteVolume(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

/** Custom listbox — Nado-like dark panel, not OS native select. */
function NadoCategorySelect({ value, onChange, options, menuOpen, onMenuOpenChange }) {
  const rootRef = useRef(null)
  const listId = 'nado-category-listbox'

  const selected = options.find((o) => o.id === value) ?? options[0]

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onMenuOpenChange(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen, onMenuOpenChange])

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id="market-category-filter"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={listId}
        onClick={() => onMenuOpenChange(!menuOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.1] bg-[linear-gradient(180deg,rgba(19,21,44,0.9),rgba(9,11,26,0.92))] px-3 py-2 text-left text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-violet-400/25 hover:bg-[rgba(22,24,48,0.95)] focus:outline-none focus:ring-2 focus:ring-violet-500/35"
      >
        <span className="min-w-0 truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-violet-400/90 transition-transform duration-200 ${
            menuOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {menuOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby="market-category-filter"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-[120] max-h-60 overflow-y-auto overflow-x-hidden rounded-lg border border-white/[0.1] bg-[rgba(10,12,28,0.98)] py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.04] backdrop-blur-md"
        >
          {options.map((c) => {
            const isSel = value === c.id
            return (
              <li key={c.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange(c.id)
                    onMenuOpenChange(false)
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                    isSel
                      ? 'bg-violet-500/20 font-medium text-violet-100'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Modal inspired by Nado "Command Center": search markets, filter by category, open Nado trade.
 */
export default function MarketCommandCenterModal({
  open,
  onClose,
  getNadoClient,
  chainEnv,
  nadoAppOrigin,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const inputRef = useRef(null)

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: marketCommandCenterQueryKey(chainEnv),
    queryFn: () => fetchMarketCommandCenterRows(getNadoClient),
    enabled: open && Boolean(getNadoClient),
    staleTime: MARKET_COMMAND_CENTER_STALE_MS,
  })

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCategory('all')
      setCategoryMenuOpen(false)
      return
    }
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (categoryMenuOpen) {
        setCategoryMenuOpen(false)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, categoryMenuOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== 'all') {
        if (category === 'perp' || category === 'spot') {
          if (r.kind !== category) return false
        } else if (r.tag !== category) return false
      }
      if (!q) return true
      return r.symbol.toLowerCase().includes(q)
    })
  }, [rows, query, category])

  const tradeHref = (symbol) => {
    const base = String(nadoAppOrigin ?? '').replace(/\/$/, '')
    if (!base) return null
    const enc = encodeURIComponent(symbol)
    return `${base}/?market=${enc}`
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-center-title"
        className="flex max-h-[min(80vh,600px)] w-full max-w-[650px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[rgba(12,14,32,0.96)] shadow-2xl shadow-black/40"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="command-center-title" className="sr-only">
          Command Center
        </h2>

        <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.08]">
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/25 p-1.5">
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Category
              </span>
              <NadoCategorySelect
                value={category}
                onChange={setCategory}
                options={CATEGORIES}
                menuOpen={categoryMenuOpen}
                onMenuOpenChange={setCategoryMenuOpen}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4">
              Markets
            </div>
            <div className="flex border-b border-white/[0.06] px-1.5 py-2 text-[11px] uppercase tracking-wide text-slate-500 sm:px-4">
              <div className="w-40 shrink-0">Market</div>
              <div className="min-w-0 flex-1 sm:max-w-[11rem]">Price</div>
              <div className="hidden w-28 shrink-0 text-right sm:block">Volume USDT0</div>
              <div className="ml-auto hidden w-16 shrink-0 text-right lg:block" />
            </div>

            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Loading markets…</div>
            )}
            {isError && (
              <div className="px-4 py-8 text-center text-sm text-red-400">
                {error instanceof Error ? error.message : 'Failed to load markets.'}
              </div>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No markets match.</div>
            )}
            {!isLoading &&
              !isError &&
              filtered.map((r) => {
                const href = tradeHref(r.symbol)
                return (
                  <div
                    key={`${r.kind}-${r.productId}`}
                    className="flex min-h-11 cursor-pointer items-center border-b border-white/[0.05] px-1.5 py-2 transition hover:bg-white/[0.04] sm:px-4"
                  >
                    <div className="flex w-40 shrink-0 items-center gap-2.5">
                      <Web3TokenIcon
                        symbol={r.symbol}
                        seed={String(r.productId)}
                        size={24}
                        nadoAppOrigin={nadoAppOrigin}
                      />
                      <span className="truncate text-xs font-medium text-slate-100">{r.symbol}</span>
                    </div>
                    <div className="min-w-0 flex-1 sm:max-w-[11rem]">
                      <div className="text-xs tabular-nums text-slate-100">{formatPrice(r.price)}</div>
                      {r.change24h != null && (
                        <div
                          className={`text-[10px] tabular-nums ${
                            r.change24h >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
                          }`}
                        >
                          {r.change24h >= 0 ? '+' : ''}
                          {r.change24h.toFixed(2)}% <span className="text-slate-500">24h</span>
                        </div>
                      )}
                    </div>
                    <div className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-slate-300 sm:block">
                      {formatQuoteVolume(r.quoteVolume)}
                    </div>
                    <div className="ml-auto hidden w-16 shrink-0 text-right lg:block">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-medium text-slate-400 hover:text-violet-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Trade
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-600">Trade</span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
