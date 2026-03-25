import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { useChainId, useSwitchChain } from 'wagmi'
import { ChevronDown, X } from 'lucide-react'
import BigNumber from 'bignumber.js'
import {
  ensureDepositAllowance,
  executeDeposit,
  executeWithdraw,
  fetchLatestCollateralEvents,
  fetchMaxWithdrawable,
  getSpotCollateralMeta,
  listSpotCollateralProducts,
  parseHumanAmount,
  pollUntilNSubmissionsIncreased,
  pollUntilSubmissionFinalized,
  readNSubmissions,
} from '../../lib/nadoSpotCollateral.js'
import { useNadoNetwork } from '../../context/NadoNetworkContext.jsx'
import { tokenLogoCandidates } from '../../lib/tokenLogoUrls.js'

/** Nado-style: surface row (combobox trigger). */
const rowTrigger =
  'group relative flex w-full cursor-pointer items-center justify-between gap-x-2 rounded-sm px-2 py-2 text-left text-sm text-slate-200 transition before:pointer-events-none before:absolute before:inset-0 before:rounded-sm before:transition-colors hover:before:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50'

const rowSurface = 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]'

function bnToBigInt(v) {
  if (v == null) return null
  if (typeof v === 'bigint') return v
  try {
    const bn = BigNumber.isBigNumber(v) ? v : new BigNumber(String(v))
    if (!bn.isFinite()) return null
    return BigInt(bn.integerValue(BigNumber.ROUND_FLOOR).toFixed(0))
  } catch {
    return null
  }
}

function shortAddr(a) {
  if (!a || typeof a !== 'string') return ''
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

/** Small chain glyph — Nado shows ETH-style icon; we use Ink-themed badge. */
function ChainGlyph({ testnet }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
        testnet ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/30' : 'bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/30'
      }`}
      aria-hidden
    >
      {testnet ? 'S' : 'I'}
    </span>
  )
}

function TokenGlyph({ tokenAddress, symbol, chainId }) {
  const candidates = useMemo(
    () => tokenLogoCandidates({ tokenAddress, symbol, chainId }),
    [tokenAddress, symbol, chainId],
  )
  const [idx, setIdx] = useState(0)
  const label = String(symbol ?? '?')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 2)

  if (!candidates.length || idx >= candidates.length) {
    return (
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-slate-200 ring-1 ring-white/15">
        {label || '?'}
      </span>
    )
  }
  return (
    <img
      src={candidates[idx]}
      alt=""
      width={18}
      height={18}
      className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/10"
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
    />
  )
}

export default function NadoDepositWithdrawModal({
  open,
  mode,
  onClose,
  getNadoClient,
  ownerAddress,
  subaccountName = 'default',
  onCompleted,
  docsDepositUrl = 'https://docs.nado.xyz/developer-resources/api/depositing',
  docsWithdrawUrl = 'https://docs.nado.xyz/developer-resources/api/withdrawing-on-chain',
}) {
  const { mode: networkMode, setMode, activeChain, mainnetEnabled } = useNadoNetwork()
  const chainId = useChainId()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  const [productId, setProductId] = useState(null)
  const [spotOptions, setSpotOptions] = useState([])
  const [amount, setAmount] = useState('')
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [maxWithdraw, setMaxWithdraw] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState(null)

  const [openChainMenu, setOpenChainMenu] = useState(false)
  const [openAssetMenu, setOpenAssetMenu] = useState(false)
  const chainMenuRef = useRef(null)
  const assetMenuRef = useRef(null)

  const chainOptions = useMemo(() => {
    const test = {
      id: 'testnet',
      label: 'Ink Sepolia',
      shortLabel: 'Sepolia',
      mode: 'testnet',
      testnet: true,
    }
    const main = {
      id: 'mainnet',
      label: 'Ink',
      shortLabel: 'Ink',
      mode: 'mainnet',
      testnet: false,
    }
    return mainnetEnabled ? [test, main] : [test]
  }, [mainnetEnabled])

  const selectedChain = chainOptions.find((c) => c.mode === networkMode) ?? chainOptions[0]

  const reset = useCallback(() => {
    setAmount('')
    setStep('')
    setError(null)
    setMetaError(null)
    setSpotOptions([])
    setProductId(null)
    setMeta(null)
    setMaxWithdraw(null)
    setOpenChainMenu(false)
    setOpenAssetMenu(false)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    let cancelled = false
    ;(async () => {
      const client = getNadoClient?.()
      if (!client) {
        setMetaError('Wallet client not ready')
        return
      }
      setMetaError(null)
      try {
        const list = await listSpotCollateralProducts(client)
        if (cancelled) return
        setSpotOptions(list)
        setProductId((prev) => {
          if (prev != null && list.some((x) => x.productId === prev)) return prev
          return list[0]?.productId ?? null
        })
      } catch (e) {
        if (!cancelled) {
          setMetaError(e instanceof Error ? e.message : 'Failed to load markets')
          setSpotOptions([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, getNadoClient, reset, networkMode])

  useEffect(() => {
    if (!open || productId == null) return
    let cancelled = false
    ;(async () => {
      const client = getNadoClient?.()
      if (!client) return
      setMetaError(null)
      try {
        const m = await getSpotCollateralMeta(client, productId)
        if (cancelled) return
        setMeta(m)
        if (mode === 'withdraw' && ownerAddress) {
          const max = await fetchMaxWithdrawable(client, {
            subaccountOwner: ownerAddress,
            subaccountName,
            productId,
          })
          if (!cancelled) setMaxWithdraw(max)
        } else {
          setMaxWithdraw(null)
        }
      } catch (e) {
        if (!cancelled) {
          setMetaError(e instanceof Error ? e.message : 'Failed to load token')
          setMeta(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, productId, mode, getNadoClient, ownerAddress, subaccountName])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (chainMenuRef.current && !chainMenuRef.current.contains(e.target)) {
        setOpenChainMenu(false)
      }
      if (assetMenuRef.current && !assetMenuRef.current.contains(e.target)) {
        setOpenAssetMenu(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selectedToken = spotOptions.find((o) => o.productId === productId)

  const runDeposit = async () => {
    const client = getNadoClient?.()
    if (!client?.context?.walletClient) throw new Error('Connect wallet on the correct network')
    if (meta == null || productId == null) throw new Error('Choose a token')
    if (chainId !== activeChain.id) {
      throw new Error('Switch wallet to the selected Nado network first')
    }
    const raw = parseHumanAmount(amount, meta.decimals)
    setStep('Checking allowance…')
    const nBeforeDeposit = await readNSubmissions(client)
    const approve = await ensureDepositAllowance(client, {
      productId,
      amount: raw,
    })
    if (!approve.skipped && approve.txHash) {
      setStep('Confirm approval in wallet…')
      await waitForTransactionReceipt(client.context.publicClient, {
        hash: approve.txHash,
      })
    }
    setStep('Confirm deposit in wallet…')
    const depHash = await executeDeposit(client, {
      subaccountName,
      productId,
      amount: raw,
    })
    setStep('Waiting for confirmation…')
    await waitForTransactionReceipt(client.context.publicClient, { hash: depHash })
    setStep('Waiting for sequencer (nSubmissions / indexer)…')
    const progressed = await pollUntilNSubmissionsIncreased(client, nBeforeDeposit, {
      maxAttempts: 50,
      delayMs: 2000,
    })
    if (progressed) {
      setStep('Verifying indexer…')
      try {
        const events = await fetchLatestCollateralEvents(client, {
          subaccountOwner: ownerAddress,
          subaccountName,
          limit: 5,
        })
        const list = events ?? []
        const top = list.length ? list[list.length - 1] : null
        const subIdx = top?.submissionIndex
        const idx = bnToBigInt(subIdx ?? top?.submission_index)
        if (idx != null) {
          await pollUntilSubmissionFinalized(client, idx, { maxAttempts: 30, delayMs: 2000 })
        }
      } catch {
        // non-fatal
      }
    }
    setStep('')
  }

  const runWithdraw = async () => {
    const client = getNadoClient?.()
    if (!client?.context?.walletClient) throw new Error('Connect wallet on the correct network')
    if (meta == null || productId == null) throw new Error('Choose a token')
    if (chainId !== activeChain.id) {
      throw new Error('Switch wallet to the selected Nado network first')
    }
    const raw = parseHumanAmount(amount, meta.decimals)
    const maxRaw = maxWithdraw != null ? bnToBigInt(maxWithdraw) : null
    if (maxRaw != null && raw > maxRaw) {
      throw new Error('Amount exceeds max withdrawable')
    }
    const nBefore = await readNSubmissions(client)
    setStep('Sign withdraw in wallet…')
    await executeWithdraw(client, {
      subaccountOwner: ownerAddress,
      subaccountName,
      productId,
      amount: raw,
    })
    setStep('Waiting for engine / chain…')
    await pollUntilNSubmissionsIncreased(client, nBefore, { maxAttempts: 50, delayMs: 2000 })
    setStep('Verifying indexer…')
    try {
      const events = await fetchLatestCollateralEvents(client, {
        subaccountOwner: ownerAddress,
        subaccountName,
        limit: 5,
      })
      const list = events ?? []
      const top = list.length ? list[list.length - 1] : null
      const idx = bnToBigInt(top?.submissionIndex ?? top?.submission_index)
      if (idx != null) {
        await pollUntilSubmissionFinalized(client, idx, { maxAttempts: 25, delayMs: 2000 })
      }
    } catch {
      // ignore
    }
    setStep('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const trimmed = amount.trim().replace(',', '.')
    const n = parseFloat(trimmed)
    if (!trimmed || !Number.isFinite(n) || n <= 0) {
      setError('Enter a positive amount')
      return
    }
    if (productId == null) {
      setError('Select an asset')
      return
    }
    setBusy(true)
    try {
      if (mode === 'deposit') await runDeposit()
      else await runWithdraw()
      onCompleted?.()
      onClose?.()
    } catch (err) {
      const msg =
        err?.shortMessage ??
        err?.details ??
        err?.response?.data?.error ??
        err?.message ??
        (typeof err === 'string' ? err : 'Request failed')
      setError(String(msg))
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  if (!open || !mode) return null

  const title = mode === 'deposit' ? 'Deposit' : 'Withdraw'
  const maxLabel =
    maxWithdraw != null && meta
      ? formatUnits(bnToBigInt(maxWithdraw) ?? 0n, meta.decimals)
      : null

  const wrongChain = chainId !== activeChain.id
  const chainIdForLogos = activeChain?.id

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dw-title"
    >
      <div className="relative flex w-full max-w-[min(480px,95vw)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[rgba(14,16,36,0.98)] text-sm text-slate-300 shadow-2xl shadow-black/40">
        {/* Header — Nado: title row + bottom border */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4">
          <h2 id="dw-title" className="flex-1 text-base font-medium text-slate-100">
            {title}
          </h2>
          <a
            href={mode === 'deposit' ? docsDepositUrl : docsWithdrawUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-violet-400/90 hover:text-violet-300"
          >
            Docs
          </a>
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
          {/* Combobox rows — layout like Nado portfolio.html */}
          <div className="flex flex-col gap-y-2">
            <div className="relative" ref={chainMenuRef}>
              <button
                type="button"
                disabled={busy}
                className={`${rowTrigger} ${rowSurface}`}
                aria-expanded={openChainMenu}
                aria-haspopup="listbox"
                onClick={() => {
                  setOpenAssetMenu(false)
                  setOpenChainMenu((o) => !o)
                }}
              >
                <div className="relative z-[1] flex items-center gap-x-2">
                  <ChainGlyph testnet={selectedChain?.testnet ?? true} />
                  <span className="text-slate-100">{selectedChain?.shortLabel ?? 'Network'}</span>
                  <span className="hidden text-xs text-slate-500 sm:inline">
                    {selectedChain?.label}
                  </span>
                </div>
                <ChevronDown
                  className={`relative z-[1] h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-slate-400 ${openChainMenu ? 'rotate-180' : ''}`}
                />
              </button>
              {openChainMenu && chainOptions.length > 0 && (
                <ul
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-white/[0.1] bg-[rgb(18,20,42)] py-1 shadow-xl ring-1 ring-black/40"
                  role="listbox"
                >
                  {chainOptions.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06] ${
                          networkMode === c.mode ? 'text-violet-200' : 'text-slate-200'
                        }`}
                        onClick={() => {
                          setMode(c.mode)
                          setOpenChainMenu(false)
                        }}
                      >
                        <ChainGlyph testnet={c.testnet} />
                        <span>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative" ref={assetMenuRef}>
              <button
                type="button"
                disabled={busy || spotOptions.length === 0}
                className={`${rowTrigger} ${rowSurface}`}
                aria-expanded={openAssetMenu}
                aria-haspopup="listbox"
                onClick={() => {
                  setOpenChainMenu(false)
                  setOpenAssetMenu((o) => !o)
                }}
              >
                <div className="relative z-[1] flex min-w-0 items-center gap-x-2">
                  {selectedToken ? (
                    <>
                      <TokenGlyph
                        tokenAddress={selectedToken.tokenAddr}
                        symbol={selectedToken.symbol}
                        chainId={chainIdForLogos}
                      />
                      <span className="truncate text-slate-100">{selectedToken.symbol}</span>
                      <span className="text-xs text-slate-500">#{productId}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">Select Asset</span>
                  )}
                </div>
                <ChevronDown
                  className={`relative z-[1] h-4 w-4 shrink-0 text-slate-500 ${openAssetMenu ? 'rotate-180' : ''}`}
                />
              </button>
              {openAssetMenu && spotOptions.length > 0 && (
                <ul
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-white/[0.1] bg-[rgb(18,20,42)] py-1 shadow-xl ring-1 ring-black/40"
                  role="listbox"
                >
                  {spotOptions.map((o) => (
                    <li key={o.productId}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06] ${
                          productId === o.productId ? 'bg-white/[0.04] text-violet-200' : 'text-slate-200'
                        }`}
                        onClick={() => {
                          setProductId(o.productId)
                          setOpenAssetMenu(false)
                        }}
                      >
                        <TokenGlyph
                          tokenAddress={o.tokenAddr}
                          symbol={o.symbol}
                          chainId={chainIdForLogos}
                        />
                        <span className="min-w-0 flex-1 truncate">{o.symbol}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">#{o.productId}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

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
              {meta ? (
                <span className="ml-1 font-normal normal-case text-slate-600">
                  ({meta.decimals} decimals)
                </span>
              ) : null}
            </label>
            <input
              className="w-full rounded-md border border-white/[0.08] bg-black/25 px-3 py-2.5 text-slate-100 outline-none ring-violet-500/20 placeholder:text-slate-600 focus:ring-2"
              inputMode="decimal"
              placeholder={mode === 'deposit' ? '0.00' : maxLabel ?? '0'}
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              disabled={busy || !meta}
            />
            {mode === 'withdraw' && maxLabel != null && (
              <button
                type="button"
                className="mt-1.5 text-xs text-violet-400 hover:text-violet-300"
                onClick={() => setAmount(maxLabel)}
                disabled={busy}
              >
                Use max ({maxLabel})
              </button>
            )}
            {selectedToken && (
              <p className="mt-1 font-mono text-[10px] text-slate-600">{shortAddr(selectedToken.tokenAddr)}</p>
            )}
          </div>

          {metaError && <p className="text-sm text-amber-200/90">{metaError}</p>}
          {step && <p className="text-xs text-slate-500">{step}</p>}
          {error && <p className="text-sm text-rose-300/90">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={
                busy ||
                !meta ||
                !amount.trim() ||
                productId == null ||
                spotOptions.length === 0 ||
                wrongChain
              }
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? 'Working…' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
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

        {mode === 'withdraw' && (
          <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-slate-500">
            Engine <code className="text-slate-400">withdraw_collateral</code>. Completion via{' '}
            <code className="text-slate-400">nSubmissions</code> / indexer.
          </p>
        )}
      </div>
    </div>
  )
}
