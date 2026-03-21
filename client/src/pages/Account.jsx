import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { Loader2, LogOut, Wallet } from 'lucide-react'
import { useInvalidateSession, useSession } from '../hooks/useSession.js'
import { logoutSession, signInWithThornado } from '../lib/siweAuth.js'
import { useNadoLinkedSigner } from '../context/NadoLinkedSignerContext.jsx'
import { useNadoNetwork } from '../context/NadoNetworkContext.jsx'

function formatAddress(a) {
  if (!a) return ''
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/** Nado engine errors that mean the wallet needs an on-chain / engine deposit first. */
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
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession()
  const invalidateSession = useInvalidateSession()
  const {
    address,
    connector,
    isConnected,
    chainId,
    status: connStatus,
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

  const canQueryNado =
    Boolean(
      session &&
        address &&
        publicClient &&
        sessionAddr === walletAddr &&
        !onWrongChain
    )

  const nadoQuery = useQuery({
    queryKey: [
      'nado-subaccount-summary',
      walletAddr,
      chainEnv,
      derivedSignerAddress ?? 'no-linked-signer',
    ],
    enabled: canQueryNado,
    queryFn: async () => {
      const client = getNadoClient()
      if (!client) {
        throw new Error('Nado client unavailable')
      }
      return client.subaccount.getSubaccountSummary({
        subaccountOwner: address,
        subaccountName: 'default',
      })
    },
  })

  const runSiwe = useCallback(async () => {
    if (!address) return
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
    onWrongChain,
    session,
    sessionMatchesWallet,
  ])

  const onSignOut = useCallback(async () => {
    await logoutSession()
    await invalidateSession()
    disconnect()
  }, [invalidateSession, disconnect])

  const healthMaintenance = useMemo(() => {
    const h = nadoQuery.data?.health?.maintenance?.health
    if (h == null) return null
    return typeof h?.toString === 'function' ? h.toString() : String(h)
  }, [nadoQuery.data])

  const needsServerSession =
    isConnected &&
    !sessionLoading &&
    (!session || !sessionMatchesWallet) &&
    !onWrongChain

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-10 text-slate-200">
      <div>
        <Link
          to="/"
          className="text-sm text-violet-300/90 hover:text-violet-200"
        >
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Account
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Wallet connect only links your extension to this site. A SIWE signature lets
          the Thornado server issue a session cookie. That is separate from Nado on-chain
          trading auth.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          THORNado session
        </h2>
        {sessionLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading session…
          </div>
        )}
        {sessionError && (
          <p className="mt-4 text-sm text-rose-300">Could not load session.</p>
        )}
        {!sessionLoading && !session && (
          <p className="mt-4 text-sm text-slate-400">
            No server session yet. Connect your wallet on {activeChain.name} (chain{' '}
            {activeChain.id}), then approve the sign-in prompt.
          </p>
        )}
        {signing && needsServerSession && (
          <div className="mt-4 flex items-center gap-2 text-sm text-violet-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in to Thornado…
          </div>
        )}
        {session && (
          <div className="mt-4 space-y-2 font-mono text-sm">
            <div>
              <span className="text-slate-500">Signed in as </span>
              <span className="text-violet-100">{session.address}</span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <p className="max-w-md text-[11px] leading-relaxed text-slate-500">
              Ends your Thornado session and disconnects your wallet.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Wallet
        </h2>
        {connStatus === 'connecting' || connStatus === 'reconnecting' ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting…
          </div>
        ) : !isConnected ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={connectPending}
              onClick={() => {
                const c = connectors[0]
                if (c) connect({ connector: c })
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              {connectPending ? 'Connecting…' : 'Connect wallet'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <div className="font-mono text-violet-100">{formatAddress(address)}</div>
            <div className="text-slate-500">
              Chain: {chainId ?? '—'}{' '}
              {onWrongChain && `(needs ${activeChain.name})`}
            </div>
            {onWrongChain && (
              <button
                type="button"
                disabled={switchPending}
                onClick={() => switchChain({ chainId: activeChain.id })}
                className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100"
              >
                {switchPending ? 'Switching…' : `Switch to ${activeChain.name}`}
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
      </section>

      {isConnected && !onWrongChain && walletClient && (
        <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Nado linked signer
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            After setup, Nado orders can be signed by a session key in this browser (no
            wallet popup per order). You sign once to derive the key and once to register
            it on the engine. The key is stored in{' '}
            <span className="text-slate-400">localStorage</span> for this wallet + chain.
          </p>
          <div className="mt-3 space-y-1 font-mono text-[11px] text-slate-400">
            {engineSignerLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking engine…
              </div>
            ) : (
              <>
                <div>
                  Engine linked signer:{' '}
                  {engineSigner && engineSigner !==
                  '0x0000000000000000000000000000000000000000'
                    ? engineSigner
                    : '—'}
                </div>
                <div>
                  Local session key:{' '}
                  {derivedSignerAddress ? derivedSignerAddress : '—'}
                </div>
                {derivedSignerAddress && engineSignerMatchesLocal && (
                  <p className="text-emerald-300/90">
                    Linked signer ready — Terminal can use{' '}
                    <code className="text-emerald-200/90">useNadoLinkedSigner()</code>{' '}
                    + <code className="text-emerald-200/90">getNadoClient()</code>.
                  </p>
                )}
                {derivedSignerAddress &&
                  !engineSignerMatchesLocal &&
                  engineSigner &&
                  engineSigner !==
                    '0x0000000000000000000000000000000000000000' && (
                    <p className="text-amber-200/90">
                      Engine has a different linked signer — use &quot;Forget local
                      key&quot; or re-link after clearing on-chain state.
                    </p>
                  )}
              </>
            )}
          </div>
          {linkError && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-rose-300">{linkError}</p>
              {isNadoDepositPrerequisiteError(linkError) && (
                <div className="rounded-lg border border-amber-400/25 bg-amber-950/25 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                linking ||
                (engineSignerMatchesLocal && Boolean(derivedSignerAddress))
              }
              onClick={() => void linkSigner()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600/90 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
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
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Forget local key
            </button>
          </div>
        </section>
      )}

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

      {session && sessionMatchesWallet && !onWrongChain && (
        <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Nado ({chainEnv === 'inkMainnet' ? 'mainnet' : 'testnet'}) — subaccount
            &quot;default&quot;
          </h2>
          {nadoQuery.isLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading engine data…
            </div>
          )}
          {nadoQuery.error && (
            <p className="mt-4 text-sm text-rose-300">
              {nadoQuery.error.message || 'Query failed (empty account or RPC).'}
            </p>
          )}
          {nadoQuery.data && (
            <dl className="mt-4 space-y-2 font-mono text-xs text-slate-300">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Exists on engine</dt>
                <dd>{nadoQuery.data.exists ? 'yes' : 'no'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Balance rows</dt>
                <dd>{nadoQuery.data.balances?.length ?? 0}</dd>
              </div>
              {healthMaintenance != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Maintenance health</dt>
                  <dd className="max-w-[60%] break-all">{healthMaintenance}</dd>
                </div>
              )}
              <p className="pt-2 text-[11px] leading-relaxed text-slate-500">
                Read-only summary from the Nado engine ({activeChain.name}). Extend this
                panel with per-product balances when you wire the terminal.
              </p>
            </dl>
          )}
        </section>
      )}
    </div>
  )
}
