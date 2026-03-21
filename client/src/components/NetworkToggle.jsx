import React from 'react'
import { useNadoNetwork } from '../context/NadoNetworkContext.jsx'

export default function NetworkToggle() {
  const { mode, setMode, mainnetEnabled } = useNadoNetwork()

  const btn =
    'rounded-md px-2.5 py-1 transition-colors min-w-[4.5rem] text-center'
  const active = 'bg-violet-500/35 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.2)]'
  const idle = 'text-slate-500 hover:text-slate-300'
  const disabled = 'cursor-not-allowed opacity-40 text-slate-600'

  return (
    <div
      className="inline-flex items-center rounded-lg border border-white/10 bg-[rgba(12,14,32,0.55)] p-0.5 text-[11px] font-semibold uppercase tracking-wide"
      role="group"
      aria-label="Nado network"
    >
      <button
        type="button"
        className={`${btn} ${mode === 'testnet' ? active : idle}`}
        onClick={() => setMode('testnet')}
      >
        Testnet
      </button>
      <button
        type="button"
        disabled={!mainnetEnabled}
        title={
          mainnetEnabled
            ? undefined
            : 'Mainnet is not available in this version of THORNado.'
        }
        className={`${btn} ${
          !mainnetEnabled ? disabled : mode === 'mainnet' ? active : idle
        }`}
        onClick={() => mainnetEnabled && setMode('mainnet')}
      >
        Mainnet
      </button>
    </div>
  )
}
