import React, { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useChainId, useSwitchChain } from 'wagmi'
import { ArrowLeftRight, X } from 'lucide-react'
import BigNumber from 'bignumber.js'
import {
  executeTransferQuote,
  fetchQuoteSpotBalance,
  parseHumanEngineAmount,
  pollUntilNSubmissionsIncreased,
  readNSubmissions,
} from '../../lib/nadoSpotCollateral.js'
import {
  fetchTransferBootstrap,
  TRANSFER_BOOTSTRAP_STALE_MS,
  transferBootstrapQueryKey,
} from '../../lib/accountPreload.js'
import { formatUserFacingError } from '../../lib/formatUserFacingError.js'
import { useNadoNetwork } from '../../context/NadoNetworkContext.jsx'
import Web3TokenIcon from './Web3TokenIcon.jsx'

const rowSurface = 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]'

const SUB_SUGGESTIONS = ['default', 'main', 'trading']

export default function NadoTransferModal({
  open,
  onClose,
  getNadoClient,
  ownerAddress,
  subaccountName = 'default',
  onCompleted,
  nadoAppOrigin = null,
}) {
  const queryClient = useQueryClient()
  const { activeChain } = useNadoNetwork()
  const chainId = useChainId()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  const [fromSub, setFromSub] = useState(subaccountName)
  const [toSub, setToSub] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState(null)
  const [fromBal, setFromBal] = useState(null)
  const [toBal, setToBal] = useState(null)
  const [quoteMeta, setQuoteMeta] = useState(null)
  const [quoteSymbol, setQuoteSymbol] = useState('USDT0')
  const [loadErr, setLoadErr] = useState(null)

  const wrongChain = chainId !== activeChain.id

  const reset = useCallback(() => {
    setFromSub(subaccountName)
    setToSub('')
    setAmount('')
    setError(null)
    setStep('')
    setFromBal(null)
    setToBal(null)
    setQuoteSymbol('USDT0')
    setLoadErr(null)
  }, [subaccountName])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    setFromSub(subaccountName)
  }, [open, subaccountName, reset])

  useEffect(() => {
    if (!open || !ownerAddress) return
    let cancelled = false
    ;(async () => {
      const client = getNadoClient?.()
      if (!client) {
        setLoadErr('Wallet client not ready')
        return
      }
      setLoadErr(null)
      try {
        const data = await queryClient.fetchQuery({
          queryKey: transferBootstrapQueryKey(activeChain?.id ?? 'unknown'),
          queryFn: () => fetchTransferBootstrap(getNadoClient),
          staleTime: TRANSFER_BOOTSTRAP_STALE_MS,
        })
        if (cancelled) return
        setQuoteMeta(data.quoteMeta)
        setQuoteSymbol(data.quoteSymbol)
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Failed to load quote asset')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, getNadoClient, ownerAddress, queryClient, activeChain?.id])

  useEffect(() => {
    if (!open || !ownerAddress || !quoteMeta) return
    const from = String(fromSub).trim()
    if (!from) {
      setFromBal(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const client = getNadoClient?.()
      if (!client) return
      try {
        const b = await fetchQuoteSpotBalance(client, {
          subaccountOwner: ownerAddress,
          subaccountName: from,
        })
        if (!cancelled) setFromBal(b)
      } catch {
        if (!cancelled) setFromBal(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, ownerAddress, fromSub, quoteMeta, getNadoClient])

  useEffect(() => {
    if (!open || !ownerAddress || !quoteMeta) return
    const to = String(toSub).trim()
    if (!to) {
      setToBal(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const client = getNadoClient?.()
      if (!client) return
      try {
        const b = await fetchQuoteSpotBalance(client, {
          subaccountOwner: ownerAddress,
          subaccountName: to,
        })
        if (!cancelled) setToBal(b)
      } catch {
        if (!cancelled) setToBal(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, ownerAddress, toSub, quoteMeta, getNadoClient])

  const sameSub =
    String(fromSub).trim() !== '' &&
    String(toSub).trim() !== '' &&
    String(fromSub).trim() === String(toSub).trim()

  const swapSides = () => {
    const f = String(fromSub).trim()
    const t = String(toSub).trim()
    setFromSub(t || subaccountName)
    setToSub(f)
    setError(null)
  }

  const applyPct = (pct) => {
    if (fromBal?.raw == null || fromBal.decimals == null) return
    const max = new BigNumber(fromBal.raw.toString())
    const part = max.multipliedBy(pct).dividedBy(100).integerValue(BigNumber.ROUND_FLOOR)
    if (!part.isFinite() || part.isNegative()) return
    setAmount(formatUnits(BigInt(part.toFixed(0)), fromBal.decimals))
    setError(null)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const client = getNadoClient?.()
    if (!client?.context?.walletClient) {
      setError('Connect wallet on the correct network')
      return
    }
    if (wrongChain) {
      setError(`Switch wallet to ${activeChain.name}`)
      return
    }
    const from = String(fromSub).trim()
    const to = String(toSub).trim()
    if (!from || !to) {
      setError('Enter both subaccount names')
      return
    }
    if (from === to) {
      setError('You cannot transfer to the same subaccount.')
      return
    }
    if (!quoteMeta) {
      setError('Quote asset not loaded')
      return
    }
    const trimmed = amount.trim().replace(',', '.')
    const n = parseFloat(trimmed)
    if (!trimmed || !Number.isFinite(n) || n <= 0) {
      setError('Enter a positive amount')
      return
    }
    let raw
    try {
      raw = parseHumanEngineAmount(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid amount')
      return
    }
    if (fromBal?.engineX18 != null && raw > fromBal.engineX18) {
      setError('Amount exceeds available quote balance on the source subaccount.')
      return
    }

    setBusy(true)
    setStep('Sign transfer in wallet…')
    try {
      const nBefore = await readNSubmissions(client)
      await executeTransferQuote(client, {
        subaccountName: from,
        recipientSubaccountName: to,
        amount: raw,
      })
      setStep('Waiting for sequencer…')
      await pollUntilNSubmissionsIncreased(client, nBefore, { maxAttempts: 50, delayMs: 2000 })
      setStep('')
      onCompleted?.()
      onClose?.()
    } catch (err) {
      setError(formatUserFacingError(err))
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tf-title"
    >
      <div className="relative flex w-full max-w-[min(480px,95vw)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[rgba(14,16,36,0.98)] text-sm text-slate-300 shadow-2xl shadow-black/40">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4">
          <h2 id="tf-title" className="flex-1 text-base font-medium text-slate-100">
            Transfer quote
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose?.()}
            className="relative -right-1 inline-flex rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <form
          className="no-scrollbar flex max-h-[75vh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 py-4"
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">From</span>
              <input
                list="sub-suggestions-from"
                className={`w-full rounded-md border border-white/[0.08] bg-black/25 px-2 py-2 text-xs text-slate-100 outline-none ring-violet-500/20 focus:ring-2 ${rowSurface}`}
                value={fromSub}
                onChange={(ev) => {
                  setFromSub(ev.target.value)
                  setError(null)
                }}
                disabled={busy}
                placeholder="default"
              />
              <datalist id="sub-suggestions-from">
                {SUB_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">To</span>
              <input
                list="sub-suggestions-to"
                className={`w-full rounded-md border border-white/[0.08] bg-black/25 px-2 py-2 text-xs text-slate-100 outline-none ring-violet-500/20 focus:ring-2 ${rowSurface}`}
                value={toSub}
                onChange={(ev) => {
                  setToSub(ev.target.value)
                  setError(null)
                }}
                disabled={busy}
                placeholder="recipient name"
              />
              <datalist id="sub-suggestions-to">
                {SUB_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-3">
            <div className={`flex flex-col gap-2 rounded-sm p-3 ${rowSurface}`}>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-200">
                <Web3TokenIcon
                  symbol={quoteSymbol}
                  seed={fromBal?.tokenAddr ?? quoteMeta?.tokenAddr ?? quoteSymbol}
                  size={18}
                  nadoAppOrigin={nadoAppOrigin}
                />
                <span className="truncate">From balance</span>
              </div>
              <div className="text-center font-mono text-xs tabular-nums text-slate-300">
                {fromBal ? `${fromBal.human} ${quoteSymbol}` : loadErr ? '—' : '…'}
              </div>
            </div>
            <button
              type="button"
              className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border border-white/10 bg-[rgb(18,20,42)] text-slate-300 shadow-lg hover:bg-white/[0.06] disabled:opacity-40"
              onClick={swapSides}
              disabled={busy}
              title="Swap from / to"
              aria-label="Swap from and to"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <div className={`flex flex-col gap-2 rounded-sm p-3 ${rowSurface}`}>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-200">
                <Web3TokenIcon
                  symbol={quoteSymbol}
                  seed={toBal?.tokenAddr ?? quoteMeta?.tokenAddr ?? quoteSymbol}
                  size={18}
                  nadoAppOrigin={nadoAppOrigin}
                />
                <span className="truncate">To balance</span>
              </div>
              <div className="text-center font-mono text-xs tabular-nums text-slate-300">
                {toSub.trim() ? toBal ? `${toBal.human} ${quoteSymbol}` : '…' : '—'}
              </div>
            </div>
          </div>

          {sameSub && (
            <div className="rounded-md border border-rose-500/25 bg-rose-950/35 px-3 py-2 text-xs text-rose-200/95">
              You cannot transfer to the same subaccount.
            </div>
          )}

          {wrongChain && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/20 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/95">
              <span>Wallet network doesn&apos;t match.</span>
              <button
                type="button"
                disabled={busy || switchPending}
                onClick={() => switchChain({ chainId: activeChain.id })}
                className="rounded-md bg-amber-500/20 px-2 py-1 font-medium text-amber-50 hover:bg-amber-500/30"
              >
                {switchPending ? 'Switching…' : `Switch to ${activeChain.name}`}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Amount
              {quoteMeta ? (
                <span className="ml-1 font-normal normal-case text-slate-600">
                  ({quoteMeta.decimals} decimals)
                </span>
              ) : null}
            </label>
            <div className="flex overflow-hidden rounded-md border border-white/[0.08] bg-black/25">
              <div className="flex min-w-[6rem] items-center gap-2 border-r border-white/[0.08] px-2 py-2">
                <Web3TokenIcon
                  symbol={quoteSymbol}
                  seed={quoteMeta?.tokenAddr ?? quoteSymbol}
                  size={18}
                  nadoAppOrigin={nadoAppOrigin}
                />
                <span className="text-sm text-slate-100">{quoteSymbol}</span>
              </div>
              <input
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(ev) => {
                  setAmount(ev.target.value)
                  setError(null)
                }}
                disabled={busy || !quoteMeta}
              />
            </div>
            {fromBal?.human != null && (
              <button
                type="button"
                className="mt-1.5 text-xs text-violet-400 hover:text-violet-300"
                onClick={() => applyPct(100)}
                disabled={busy}
              >
                Use max ({fromBal.human})
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy || !fromBal?.raw}
                onClick={() => applyPct(p)}
                className="rounded-md bg-white/[0.06] px-2 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.1] disabled:opacity-40"
              >
                {p}%
              </button>
            ))}
          </div>

          {loadErr && <p className="text-sm text-amber-200/90">{loadErr}</p>}
          {step && <p className="text-xs text-slate-500">{step}</p>}
          {error && (
            <p role="alert" className="rounded-md border border-rose-500/25 bg-rose-950/40 px-3 py-2 text-sm text-rose-200/95">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={
                busy ||
                !quoteMeta ||
                sameSub ||
                wrongChain ||
                !String(fromSub).trim() ||
                !String(toSub).trim() ||
                !amount.trim()
              }
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Transfer'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose?.()}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
