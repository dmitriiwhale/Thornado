import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { Check, Loader2, LogOut, Wallet } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvalidateSession, useSession } from '../hooks/useSession.js'
import { logoutSession, signInWithThornado } from '../lib/siweAuth.js'
import { usePortfolioData } from '../hooks/usePortfolioData.js'
import { useNadoLinkedSigner } from '../context/NadoLinkedSignerContext.jsx'
import { useNadoNetwork } from '../context/NadoNetworkContext.jsx'
import NadoPortfolioView from '../components/portfolio/NadoPortfolioView.jsx'
import { inkMainnet, inkTestnet } from '../wagmi.config.js'

/** Pill for Ink testnet vs mainnet; unknown chains get a neutral badge (still shows id beside). */
function WalletNetworkBadge({ chainId }) {
  if (chainId == null) {
    return <span className="text-slate-500">—</span>
  }
  const isInkMain = chainId === inkMainnet.id
  const isInkTest = chainId === inkTestnet.id
  const label = isInkMain ? 'Mainnet' : isInkTest ? 'Testnet' : 'Other chain'
  const pillClass = isInkMain
    ? 'bg-emerald-500/15 text-emerald-200/95'
    : isInkTest
      ? 'bg-amber-500/15 text-amber-100/95'
      : 'bg-slate-500/25 text-slate-200/90'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pillClass}`}
    >
      {label}
    </span>
  )
}

/** Sidebar: show 0x1234…abcd; click copies full address (clipboard). */
function AddressAbbr({ address, className = '' }) {
  const full = address ? String(address).trim() : ''
  const [copied, setCopied] = useState(false)
  const copyClearRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyClearRef.current) clearTimeout(copyClearRef.current)
    }
  }, [])

  const handleCopy = useCallback(
    async (e) => {
      e?.stopPropagation?.()
      try {
        await navigator.clipboard.writeText(full)
        setCopied(true)
        if (copyClearRef.current) clearTimeout(copyClearRef.current)
        copyClearRef.current = setTimeout(() => setCopied(false), 2000)
      } catch {
        /* ignore */
      }
    },
    [full],
  )

  if (!full) {
    return <span className={className}>—</span>
  }

  const shown =
    full.length <= 14 ? full : `${full.slice(0, 6)}…${full.slice(-4)}`

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
      <button
        type="button"
        onClick={handleCopy}
        className={`min-w-0 max-w-full rounded px-0.5 py-0.5 text-left font-mono text-sm tabular-nums transition hover:bg-white/5 ${className}`}
        aria-label={`Copy address: ${full}`}
      >
        <span className="block min-w-0 truncate">{shown}</span>
      </button>
      {copied ? (
        <span
          role="status"
          className="inline-flex shrink-0 items-center gap-1 font-sans"
        >
          <Check
            className="h-3.5 w-3.5 text-emerald-400"
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="text-[10px] font-medium text-emerald-400">Copied!</span>
        </span>
      ) : null}
    </span>
  )
}

/** Nado engine errors that mean the wallet needs an on-chain / engine deposit first. */
/** MetaMask “Sepolia” default — not the same network as Ink Sepolia (Nado testnet). */
const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111

function isNadoDepositPrerequisiteError(message) {
  if (!message || typeof message !== 'string') return false
  const m = message.toLowerCase()
  return (
    /\b2024\b/.test(message) ||
    m.includes('no previous deposits') ||
    m.includes('prior deposits') ||
    m.includes('has no previous deposits') ||
    (m.includes('deposit') && m.includes('address'))
  )
}

const NADO_ZERO_SIGNER = '0x0000000000000000000000000000000000000000'

export default function Account() {
  const {
    derivedSignerAddress,
    engineSigner,
    engineSignerLoading,
    engineSignerMatchesLocal,
    linkError,
    linking,
    linkSigner,
    forgetLocalLinkedSigner,
    getNadoClient,
  } = useNadoLinkedSigner()
  const { chainEnv, activeChain } = useNadoNetwork()
  const isMainnetEnv = chainEnv === 'inkMainnet'
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession()
  const invalidateSession = useInvalidateSession()
  const queryClient = useQueryClient()

  const invalidatePortfolio = useCallback(() => {
    const hotKeys = [
      'portfolio-summary',
      'portfolio-positions',
      'portfolio-orders',
      'portfolio-pnl',
      'portfolio-risk',
      'portfolio-account-snapshot',
      'portfolio-isolated-positions',
      'portfolio-latest-market-prices',
      'portfolio-latest-oracle-prices',
    ]

    hotKeys.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: [key] })
    })
  }, [queryClient])
  const {
    address,
    connector,
    isConnected,
    chainId,
    status: connStatus,
    isReconnecting,
  } = useConnection()
  const connectors = useConnectors()
  const { connect, isPending: connectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { switchChain, isPending: switchPending } = useSwitchChain()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [signError, setSignError] = useState(null)
  const [signing, setSigning] = useState(false)
  const siweAttemptKey = useRef('')

  const onWrongChain = chainId != null && chainId !== activeChain.id

  const sessionAddr = session?.address?.toLowerCase()
  const walletAddr = address?.toLowerCase()
  const sessionMatchesWallet =
    !sessionAddr || !walletAddr ? true : sessionAddr === walletAddr

  /** Engine summary for gating linked signer — does not require THORNado SIWE session. */
  const canQueryNadoEngine =
    Boolean(address && publicClient && walletClient && !onWrongChain)

  const canShowNadoSummarySection =
    Boolean(
      session &&
        address &&
        publicClient &&
        sessionAddr === walletAddr &&
        !onWrongChain
    )

  const portfolio = usePortfolioData({
    getNadoClient,
    enabled: canShowNadoSummarySection,
    ownerAddress: address,
    chainEnv,
    subaccountName: 'default',
  })

  const nadoDepositRequiredForLinkedSigner =
    portfolio.queries.summary.isSuccess &&
    portfolio.summary &&
    portfolio.summary.exists === false

  const nadoEngineCheckLoading =
    canShowNadoSummarySection && portfolio.queries.summary.isLoading

  const nadoAppOrigin =
    chainEnv === 'inkMainnet' ? 'https://app.nado.xyz' : 'https://testnet.nado.xyz'

  const runSiwe = useCallback(async () => {
    if (!address) return
    if (isReconnecting) return
    setSignError(null)
    setSigning(true)
    try {
      if (onWrongChain) {
        await switchChain({ chainId: activeChain.id })
        return
      }
      await signInWithThornado(address, {
        chainId: activeChain.id,
        walletClient,
        signMessageAsync,
        connector,
      })
      await invalidateSession()
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setSigning(false)
    }
  }, [
    address,
    isReconnecting,
    onWrongChain,
    walletClient,
    signMessageAsync,
    connector,
    switchChain,
    invalidateSession,
    activeChain.id,
  ])

  const runSiweRef = useRef(runSiwe)
  runSiweRef.current = runSiwe

  useEffect(() => {
    siweAttemptKey.current = ''
  }, [address, chainId])

  useEffect(() => {
    if (sessionLoading) return
    if (!isConnected || !address) return
    if (isReconnecting) return
    if (onWrongChain) return
    if (session && sessionMatchesWallet) return
    const key = `${address}-${chainId}`
    if (siweAttemptKey.current === key) return

    siweAttemptKey.current = key
    void runSiweRef.current()
  }, [
    sessionLoading,
    isConnected,
    address,
    chainId,
    isReconnecting,
    onWrongChain,
    session,
    sessionMatchesWallet,
  ])

  const onSignOut = useCallback(async () => {
    await logoutSession()
    await invalidateSession()
    disconnect()
  }, [invalidateSession, disconnect])

  const needsServerSession =
    isConnected &&
    !sessionLoading &&
    (!session || !sessionMatchesWallet) &&
    !onWrongChain

  const asideCard =
    'rounded-lg border border-white/10 bg-[rgba(12,14,32,0.85)] p-3 backdrop-blur-md'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 text-slate-200 sm:px-5 sm:py-8">
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm text-violet-300/90 hover:text-violet-200"
        >
          ← Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:mt-4">
          Account
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Main: portfolio first on mobile (order), primary reading column on desktop */}
        <div className="order-1 flex min-w-0 flex-1 flex-col gap-6 lg:order-1">
          {signError && isConnected && !onWrongChain && (
            <section className="rounded-xl border border-rose-400/30 bg-rose-950/20 p-5">
              <p className="text-sm text-rose-200">{signError}</p>
              <button
                type="button"
                disabled={signing}
                onClick={() => {
                  siweAttemptKey.current = ''
                  void runSiwe()
                }}
                className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
              >
                {signing ? '…' : 'Retry sign-in'}
              </button>
            </section>
          )}

          {(connStatus === 'connecting' || connStatus === 'reconnecting') &&
            !isConnected && (
              <section className="flex justify-center px-0 sm:px-2">
                <div className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(10,12,28,0.92)] px-6 py-12 text-center shadow-[0_24px_48px_-20px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-md sm:px-8">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/35 to-transparent"
                    aria-hidden
                  />
                  <div className="relative flex min-h-[10rem] flex-col items-center justify-center gap-3">
                    <Loader2
                      className="h-9 w-9 shrink-0 animate-spin text-violet-400/90"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-slate-300">
                      Reconnecting wallet…
                    </p>
                    <p className="max-w-[14rem] text-[11px] leading-relaxed text-slate-500">
                      Approve the connection in your wallet if a window opens.
                    </p>
                  </div>
                </div>
              </section>
            )}

          {!isConnected &&
            connStatus !== 'connecting' &&
            connStatus !== 'reconnecting' && (
              <section className="flex justify-center px-0 sm:px-2">
                <div className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(10,12,28,0.92)] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-md">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/35 to-transparent"
                    aria-hidden
                  />
                  <div className="relative px-5 pb-7 pt-6 sm:px-6">
                    <div className="flex gap-3.5 rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/[0.18]">
                        <Wallet
                          className="h-[1.15rem] w-[1.15rem] text-violet-100"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[13px] font-medium leading-snug text-slate-200">
                          Signed out
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                          Wallet disconnected — THORNado can&apos;t load your account yet.
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              isMainnetEnv
                                ? 'bg-emerald-500/15 text-emerald-200/95'
                                : 'bg-amber-500/15 text-amber-100/95'
                            }`}
                          >
                            {isMainnetEnv ? 'Mainnet' : 'Testnet'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <h2 className="mt-6 text-center text-xl font-semibold tracking-tight text-white">
                      Connect to continue
                    </h2>
                    <p className="mt-2 text-center text-[13px] leading-relaxed text-slate-400">
                      {isMainnetEnv ? (
                        <>
                          Next step uses{' '}
                          <span className="font-medium text-slate-300">mainnet</span>: real funds on
                          Nado and this app.
                        </>
                      ) : (
                        <>
                          Next step uses{' '}
                          <span className="font-medium text-slate-300">testnet</span> — practice
                          with sandbox funds only.
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={connectPending}
                      onClick={() => {
                        const c = connectors[0]
                        if (c) connect({ connector: c })
                      }}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-950/40 transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Wallet className="h-4 w-4 shrink-0 opacity-95" />
                      {connectPending ? 'Connecting…' : 'Connect wallet'}
                    </button>
                  </div>
                </div>
              </section>
            )}

          {canShowNadoSummarySection && (
            <>
              <NadoPortfolioView
                walletAddress={address}
                chainEnv={chainEnv}
                nadoAppOrigin={nadoAppOrigin}
                portfolio={portfolio}
                getNadoClient={getNadoClient}
                onInvalidatePortfolio={invalidatePortfolio}
                depositWithdrawEnabled={canQueryNadoEngine}
                publicClient={publicClient}
              />
              {portfolio.hasAnyError && !portfolio.isLoadingAny && (
                <section className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-4">
                  <p className="text-sm text-amber-100">
                    Some portfolio sections are partially unavailable with the current Nado API
                    methods in this SDK version. Core account access and linked signer flow stay
                    operational.
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Secondary: wallet + session + linked signer — only after wallet connects */}
        {isConnected && (
          <aside className="order-2 flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:order-2 lg:w-72 lg:max-w-[18rem] lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto">
            <section className={asideCard}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Session
              </h2>
              {connStatus === 'connecting' || connStatus === 'reconnecting' ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting wallet…
                </div>
              ) : (
                <div className="mt-2 space-y-1.5 text-xs leading-snug">
                <div className="text-violet-100">
                  <AddressAbbr address={address} />
                </div>
                <div className="text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400">Network:</span>
                    <WalletNetworkBadge chainId={chainId} />
                    {chainId != null &&
                      chainId !== inkMainnet.id &&
                      chainId !== inkTestnet.id && (
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {chainId}
                        </span>
                      )}
                  </div>
                  {onWrongChain && (
                    <p className="mt-1.5 text-amber-200/90">
                      Wrong chain — switch to{' '}
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${
                          isMainnetEnv
                            ? 'bg-emerald-500/15 text-emerald-200/95'
                            : 'bg-amber-500/15 text-amber-100/95'
                        }`}
                      >
                        {isMainnetEnv ? 'Mainnet' : 'Testnet'}
                      </span>
                      .
                    </p>
                  )}
                </div>
                {onWrongChain && chainId === ETHEREUM_SEPOLIA_CHAIN_ID && (
                  <p className="text-xs leading-relaxed text-amber-100/90">
                    You are on <span className="font-medium">Ethereum Sepolia</span> (L1 testnet).
                    THORNado / Nado use a different Ink-based network. Getting ETH from an Ethereum
                    Sepolia faucet does not fund that network — switch here, then use an{' '}
                    <span className="font-medium">Ink</span> testnet faucet if you still need gas.
                  </p>
                )}
                {onWrongChain && (
                  <button
                    type="button"
                    disabled={switchPending}
                    onClick={() => switchChain({ chainId: activeChain.id })}
                    className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-xs font-medium text-amber-100"
                  >
                    {switchPending
                      ? 'Switching…'
                      : isMainnetEnv
                        ? 'Switch to mainnet'
                        : 'Switch to testnet'}
                  </button>
                )}
                {!session && (
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="block text-xs text-slate-500 underline hover:text-slate-300"
                  >
                    Disconnect wallet
                  </button>
                )}
              </div>
            )}
            {sessionLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading session…
              </div>
            )}
            {sessionError && (
              <p className="mt-3 text-xs text-rose-300">Could not load session.</p>
            )}
            {!sessionLoading && !session && isConnected && (
              <p className="mt-3 text-xs text-slate-400">
                No server session yet. Approve the sign-in prompt when prompted.
              </p>
            )}
            {signing && needsServerSession && (
              <div className="mt-3 flex items-center gap-2 text-xs text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </div>
            )}
            {session && (
              <div className="mt-2 space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Signed in </span>
                  <AddressAbbr address={session.address} className="text-violet-100" />
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Ends session and disconnects wallet.
                </p>
              </div>
            )}
            </section>

          {!onWrongChain && walletClient && (
            <section className={asideCard}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Nado linked signer
              </h2>
              <p className="mt-1.5 text-xs leading-snug text-slate-500">
                Session key for Nado orders ·{' '}
                <span className="text-slate-400">localStorage</span>
              </p>
          {nadoEngineCheckLoading && (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking subaccount on Nado engine…
            </p>
          )}
          {nadoDepositRequiredForLinkedSigner && (
            <div className="mt-2 rounded-md border border-amber-400/30 bg-amber-950/30 px-2.5 py-2 text-xs leading-relaxed text-amber-100/95">
              <span className="font-semibold text-amber-50">
                Deposit on Nado before linked signer.
              </span>{' '}
              Nado returns error <span className="font-mono">2024</span> until this subaccount
              has a deposit on the engine. Open{' '}
              <a
                href={nadoAppOrigin}
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 underline hover:text-violet-200"
              >
                {nadoAppOrigin.replace('https://', '')}
              </a>
              , use the same wallet on <span className="text-amber-50/95">{activeChain.name}</span>
              , claim testnet funds if needed, then deposit. Reload this page — when the
              engine shows your subaccount exists (see the Nado panel if you are signed in
              to THORNado), this button unlocks.
            </div>
          )}
          <div className="mt-2 space-y-1.5 text-xs text-slate-400">
            {engineSignerLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking engine…
              </div>
            ) : engineSignerMatchesLocal && derivedSignerAddress ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="shrink-0 text-slate-500">Linked signer:</span>
                  <AddressAbbr address={derivedSignerAddress} />
                </div>
                <p className="text-[11px] leading-snug text-emerald-300/90">
                  Fast signing on — terminal orders without per-tx wallet popups.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="shrink-0 text-slate-500">Engine:</span>
                  {engineSigner && engineSigner !== NADO_ZERO_SIGNER ? (
                    <AddressAbbr address={engineSigner} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="shrink-0 text-slate-500">Local key:</span>
                  {derivedSignerAddress ? (
                    <AddressAbbr address={derivedSignerAddress} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                {derivedSignerAddress &&
                  !engineSignerMatchesLocal &&
                  engineSigner &&
                  engineSigner !== NADO_ZERO_SIGNER && (
                    <p className="text-[11px] leading-snug text-amber-200/90">
                      Engine linked signer differs from this browser&apos;s key —
                      use &quot;Forget local key&quot; or set up linking again.
                    </p>
                  )}
                {derivedSignerAddress &&
                  (!engineSigner || engineSigner === NADO_ZERO_SIGNER) && (
                    <p className="text-[11px] leading-snug text-amber-200/90">
                      This browser has a session key, but the engine has no linked
                      signer yet. Use &quot;Set up linked signer&quot; to register it.
                    </p>
                  )}
                {engineSigner &&
                  engineSigner !== NADO_ZERO_SIGNER &&
                  !derivedSignerAddress && (
                    <p className="text-[11px] leading-snug text-amber-200/90">
                      The engine lists a linked signer, but this browser has no
                      saved key. Set up here or use a device that already has the
                      key.
                    </p>
                  )}
              </>
            )}
          </div>
          {linkError && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs leading-snug text-rose-300">{linkError}</p>
              {isNadoDepositPrerequisiteError(linkError) && (
                <div className="rounded-md border border-amber-400/25 bg-amber-950/25 px-2.5 py-2 text-xs leading-relaxed text-amber-100/95">
                  <span className="font-semibold text-amber-50">
                    Deposit required on Nado first.
                  </span>{' '}
                  The engine only allows this step after your wallet has funded a
                  subaccount on <span className="text-amber-50/95">{activeChain.name}</span>.
                  Use the official Nado app for this network, make a testnet deposit with
                  this same address, then try &quot;Set up linked signer&quot; again.
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                linking ||
                (engineSignerMatchesLocal && Boolean(derivedSignerAddress)) ||
                nadoDepositRequiredForLinkedSigner ||
                nadoEngineCheckLoading
              }
              onClick={() => void linkSigner()}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600/90 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {linking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Linking…
                </>
              ) : engineSignerMatchesLocal && derivedSignerAddress ? (
                'Linked signer active'
              ) : (
                'Set up linked signer'
              )}
            </button>
            <button
              type="button"
              disabled={linking || !derivedSignerAddress}
              onClick={forgetLocalLinkedSigner}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Forget local key
            </button>
          </div>
            </section>
          )}
          </aside>
        )}
      </div>
    </div>
  )
}
