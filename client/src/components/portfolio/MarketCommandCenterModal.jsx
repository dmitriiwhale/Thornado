import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ProductEngineType } from '@nadohq/shared'
import Web3TokenIcon from './Web3TokenIcon.jsx'

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

const SYMBOL_CHUNK = 48

function classifyMarketTag(symbol, kind) {
  const s = String(symbol).toUpperCase()
  const base = s.split(/[\/-]/)[0] ?? s

  if (/USDJPY|GBPUSD|EURUSD|AUDUSD|USDCAD|NZDUSD/.test(s)) return 'forex'
  if (/\b(SPY|QQQ|IWM|DIA)\b/.test(s)) return 'indices'
  if (/\b(WTI|XAG|XAU|XPT)\b/.test(s) || /\b(OIL|GOLD|SILVER)\b/.test(s)) return 'commodity'
  if (
    /KPEPE|KBONK|PEPE|DOGE|FART|PUMP|PENGU|SHIB|MEME|TRUMP|BONK|FLOKI|WIF/.test(s)
  ) {
    return 'meme'
  }
  if (/UNI|AAVE|LINK|ENA|ONDO|LDO|CRV|MKR|COMP|SNX|ZRO|SKY|GMX|JUP|ASTER|WLFI|XPL|LIT/.test(base)) {
    return 'defi'
  }
  if (
    /^(BTC|ETH|SOL|BNB|ARB|OP|MATIC|POL|AVAX|HYPE|INJ|ATOM|SEI|TON|ZK|LTC|BCH|XRP|ADA|NEAR|APT|SUI|STRK|CELO|ONE|MON|ZEC)$/.test(
      base,
    )
  ) {
    return 'chain'
  }
  return kind === 'perp' ? 'perp' : 'spot'
}

async function fetchCommandCenterRows(getNadoClient) {
  const client = getNadoClient?.()
  if (!client) throw new Error('Client unavailable')

  const markets = await client.market.getAllMarkets()
  const pids = markets.map((m) => m.productId)

  const symbolsById = {}
  for (let i = 0; i < pids.length; i += SYMBOL_CHUNK) {
    const slice = pids.slice(i, i + SYMBOL_CHUNK)
    const res = await client.context.engineClient.getSymbols({ productIds: slice })
    const obj = res?.symbols ?? {}
    for (const [key, v] of Object.entries(obj)) {
      const pid = v?.productId ?? key
      const sym = v?.symbol ?? v?.ticker
      if (sym != null && pid != null) symbolsById[String(pid)] = String(sym)
    }
  }

  const perpIds = markets
    .filter((m) => m.type === ProductEngineType.PERP)
    .map((m) => Number(m.productId))
  const spotIds = markets
    .filter((m) => m.type === ProductEngineType.SPOT)
    .map((m) => Number(m.productId))

  let perpPrices = {}
  if (perpIds.length) {
    try {
      perpPrices = await client.perp.getMultiProductPerpPrices({ productIds: perpIds })
    } catch {
      perpPrices = {}
    }
  }

  const oracleById = {}
  if (spotIds.length) {
    try {
      const oracleList = await client.context.indexerClient.getOraclePrices({
        productIds: spotIds,
      })
      for (const o of oracleList || []) {
        oracleById[o.productId] = o.oraclePrice
      }
    } catch {
      /* optional */
    }
  }

  const rows = markets.map((m) => {
    const pid = Number(m.productId)
    const sym = symbolsById[String(pid)] ?? `Product ${pid}`
    const kind = m.type === ProductEngineType.PERP ? 'perp' : 'spot'
    let price = null
    if (kind === 'perp') {
      const p = perpPrices[pid] ?? perpPrices[String(pid)]
      if (p?.markPrice != null) {
        const bn = p.markPrice
        price = typeof bn.toNumber === 'function' ? bn.toNumber() : Number(bn)
      }
    } else {
      const o = oracleById[pid]
      if (o != null) {
        price = typeof o.toNumber === 'function' ? o.toNumber() : Number(o)
      }
    }
    const tag = classifyMarketTag(sym, kind)
    return { productId: pid, symbol: sym, kind, price, tag }
  })

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol))
  return rows
}

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
  const inputRef = useRef(null)

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['market-command-center', chainEnv],
    queryFn: () => fetchCommandCenterRows(getNadoClient),
    enabled: open && Boolean(getNadoClient),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCategory('all')
      return
    }
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

            <div
              role="radiogroup"
              aria-label="Market category"
              className="-mx-0.5 flex gap-1 overflow-x-auto pb-0.5 no-scrollbar"
            >
              {CATEGORIES.map((c) => {
                const active = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCategory(c.id)}
                    className={`shrink-0 rounded-md px-2.5 py-2 text-xs font-medium transition ${
                      active
                        ? 'bg-violet-500/25 text-violet-100'
                        : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.1] hover:text-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
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
                      <div className="text-[10px] text-slate-500">—</div>
                    </div>
                    <div className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-slate-400 sm:block">
                      —
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
