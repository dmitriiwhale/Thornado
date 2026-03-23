import React from 'react'

function shortAddress(value) {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export default function PortfolioHeader({
  walletAddress,
  sessionAddress,
  networkName,
  chainEnv,
  sessionMatchesWallet,
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(12,14,32,0.72)] p-5 backdrop-blur-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Portfolio</h2>
          <p className="mt-1 text-xs text-slate-400">
            Network: {networkName} ({chainEnv === 'inkMainnet' ? 'mainnet' : 'testnet'})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100"
          >
            Deposit
          </button>
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              sessionMatchesWallet
                ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border border-amber-400/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            {sessionMatchesWallet ? 'Session synced' : 'Session mismatch'}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-xs text-slate-300">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-slate-500">Wallet</p>
          <p className="mt-1 font-mono text-violet-100">{shortAddress(walletAddress)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-slate-500">Signed session</p>
          <p className="mt-1 font-mono text-violet-100">{shortAddress(sessionAddress)}</p>
        </div>
      </div>
    </section>
  )
}
