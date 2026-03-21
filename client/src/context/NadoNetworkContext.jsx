import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CHAIN_ENV_TO_CHAIN } from '@nadohq/shared'
import { useChainId, useConnection, useSwitchChain } from 'wagmi'

const STORAGE_KEY = 'thornado:nado-network'

/** Flip to `true` when this build should allow Nado Ink mainnet. */
export const NADO_MAINNET_ENABLED = false

const NadoNetworkContext = createContext(null)

export function NadoNetworkProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'testnet'
      if (!NADO_MAINNET_ENABLED) {
        try {
          localStorage.setItem(STORAGE_KEY, 'testnet')
        } catch {
          /* ignore */
        }
        return 'testnet'
      }
      return localStorage.getItem(STORAGE_KEY) === 'mainnet' ? 'mainnet' : 'testnet'
    } catch {
      return 'testnet'
    }
  })

  const chainEnv = mode === 'mainnet' ? 'inkMainnet' : 'inkTestnet'
  const activeChain =
    CHAIN_ENV_TO_CHAIN[chainEnv] ?? CHAIN_ENV_TO_CHAIN.inkTestnet

  const { switchChainAsync } = useSwitchChain()
  const switchChainAsyncRef = useRef(switchChainAsync)
  switchChainAsyncRef.current = switchChainAsync

  const chainId = useChainId()
  const { isConnected } = useConnection()

  /** Only updates mode + storage. Wallet chain is synced in the effect below so we do not
   *  double-call switchChain or depend on unstable `switchChain` identity from useMutation. */
  const setMode = useCallback((next) => {
    const m = next === 'mainnet' ? 'mainnet' : 'testnet'
    if (m === 'mainnet' && !NADO_MAINNET_ENABLED) return
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    if (chainId === activeChain.id) return
    const run = switchChainAsyncRef.current
    if (!run) return
    void run({ chainId: activeChain.id }).catch(() => {})
  }, [isConnected, chainId, activeChain.id])

  const value = useMemo(
    () => ({
      mode,
      chainEnv,
      activeChain,
      setMode,
      mainnetEnabled: NADO_MAINNET_ENABLED,
    }),
    [mode, chainEnv, activeChain, setMode]
  )

  return (
    <NadoNetworkContext.Provider value={value}>
      {children}
    </NadoNetworkContext.Provider>
  )
}

export function useNadoNetwork() {
  const ctx = useContext(NadoNetworkContext)
  if (!ctx) {
    throw new Error('useNadoNetwork must be used within NadoNetworkProvider')
  }
  return ctx
}
