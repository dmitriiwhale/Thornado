import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createNadoClient } from '@nadohq/client'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { getAddress, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { useNadoNetwork } from './NadoNetworkContext.jsx'
import {
  clearLinkedSignerPrivateKey,
  createLinkedSignerWalletClient,
  loadLinkedSignerPrivateKey,
  saveLinkedSignerPrivateKey,
} from '../lib/nadoLinkedSigner.js'

const SUBACCOUNT_NAME = 'default'

const NadoLinkedSignerContext = createContext(null)

function signerIsUnset(signer) {
  if (!signer) return true
  try {
    return getAddress(signer) === getAddress(zeroAddress)
  } catch {
    return true
  }
}

export function NadoLinkedSignerProvider({ children }) {
  const queryClient = useQueryClient()
  const { address, isConnected } = useConnection()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { chainEnv, activeChain } = useNadoNetwork()

  const [linkedSignerWalletClient, setLinkedSignerWalletClient] = useState(null)
  const [linkError, setLinkError] = useState(null)
  const [linking, setLinking] = useState(false)

  const chainId = activeChain?.id

  useEffect(() => {
    setLinkError(null)
    if (!address || !chainId) {
      setLinkedSignerWalletClient(null)
      return
    }
    const pk = loadLinkedSignerPrivateKey(address, chainId, SUBACCOUNT_NAME)
    if (!pk) {
      setLinkedSignerWalletClient(null)
      return
    }
    try {
      setLinkedSignerWalletClient(createLinkedSignerWalletClient(pk, activeChain))
    } catch {
      clearLinkedSignerPrivateKey(address, chainId, SUBACCOUNT_NAME)
      setLinkedSignerWalletClient(null)
    }
  }, [address, chainId, activeChain])

  const engineSignerQuery = useQuery({
    queryKey: [
      'nado-engine-linked-signer',
      address,
      chainEnv,
      SUBACCOUNT_NAME,
    ],
    enabled: Boolean(
      isConnected && address && publicClient && walletClient && chainId,
    ),
    queryFn: async () => {
      const client = createNadoClient(chainEnv, {
        publicClient,
        walletClient,
      })
      return client.context.engineClient.getLinkedSigner({
        subaccountOwner: address,
        subaccountName: SUBACCOUNT_NAME,
      })
    },
  })

  const derivedSignerAddress = linkedSignerWalletClient?.account?.address

  const engineSignerMatchesLocal = useMemo(() => {
    if (!derivedSignerAddress || !engineSignerQuery.data?.signer) return false
    if (signerIsUnset(engineSignerQuery.data.signer)) return false
    try {
      return (
        getAddress(engineSignerQuery.data.signer) ===
        getAddress(derivedSignerAddress)
      )
    } catch {
      return false
    }
  }, [derivedSignerAddress, engineSignerQuery.data])

  const linkSigner = useCallback(async () => {
    if (!address || !publicClient || !walletClient || !activeChain) {
      setLinkError('Wallet not ready')
      return
    }
    setLinking(true)
    setLinkError(null)
    try {
      const client = createNadoClient(chainEnv, {
        publicClient,
        walletClient,
      })

      const existingPk = loadLinkedSignerPrivateKey(
        address,
        chainId,
        SUBACCOUNT_NAME,
      )
      if (existingPk) {
        const { signer: onEngine } =
          await client.context.engineClient.getLinkedSigner({
            subaccountOwner: address,
            subaccountName: SUBACCOUNT_NAME,
          })
        const localAddr = getAddress(privateKeyToAccount(existingPk).address)
        if (
          !signerIsUnset(onEngine) &&
          getAddress(onEngine) === localAddr
        ) {
          setLinkedSignerWalletClient(
            createLinkedSignerWalletClient(existingPk, activeChain),
          )
          await queryClient.invalidateQueries({
            queryKey: ['nado-engine-linked-signer'],
          })
          return
        }
      }

      const { privateKey, account } =
        await client.subaccount.createStandardLinkedSigner(SUBACCOUNT_NAME)

      const { signer: onEngine } =
        await client.context.engineClient.getLinkedSigner({
          subaccountOwner: address,
          subaccountName: SUBACCOUNT_NAME,
        })

      const want = getAddress(account.address)
      const needsOnChain =
        signerIsUnset(onEngine) || getAddress(onEngine) !== want

      if (needsOnChain) {
        await client.subaccount.linkSigner({
          subaccountName: SUBACCOUNT_NAME,
          signer: account.address,
        })
      }

      saveLinkedSignerPrivateKey(address, chainId, SUBACCOUNT_NAME, privateKey)
      setLinkedSignerWalletClient(
        createLinkedSignerWalletClient(privateKey, activeChain),
      )
      await queryClient.invalidateQueries({
        queryKey: ['nado-engine-linked-signer'],
      })
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Link signer failed')
    } finally {
      setLinking(false)
    }
  }, [
    address,
    publicClient,
    walletClient,
    activeChain,
    chainEnv,
    chainId,
    queryClient,
  ])

  const forgetLocalLinkedSigner = useCallback(() => {
    if (address && chainId) {
      clearLinkedSignerPrivateKey(address, chainId, SUBACCOUNT_NAME)
    }
    setLinkedSignerWalletClient(null)
    setLinkError(null)
    void queryClient.invalidateQueries({ queryKey: ['nado-engine-linked-signer'] })
  }, [address, chainId, queryClient])

  const getNadoClient = useCallback(() => {
    if (!publicClient || !walletClient) return null
    return createNadoClient(chainEnv, {
      publicClient,
      walletClient,
      ...(linkedSignerWalletClient
        ? { linkedSignerWalletClient }
        : {}),
    })
  }, [chainEnv, publicClient, walletClient, linkedSignerWalletClient])

  const value = useMemo(
    () => ({
      subaccountName: SUBACCOUNT_NAME,
      linkedSignerWalletClient,
      derivedSignerAddress: derivedSignerAddress ?? null,
      engineSigner: engineSignerQuery.data?.signer ?? null,
      engineSignerMatchesLocal,
      engineSignerLoading: engineSignerQuery.isLoading,
      linkError,
      linking,
      linkSigner,
      forgetLocalLinkedSigner,
      getNadoClient,
    }),
    [
      linkedSignerWalletClient,
      derivedSignerAddress,
      engineSignerQuery.data,
      engineSignerQuery.isLoading,
      engineSignerMatchesLocal,
      linkError,
      linking,
      linkSigner,
      forgetLocalLinkedSigner,
      getNadoClient,
    ],
  )

  return (
    <NadoLinkedSignerContext.Provider value={value}>
      {children}
    </NadoLinkedSignerContext.Provider>
  )
}

export function useNadoLinkedSigner() {
  const ctx = useContext(NadoLinkedSignerContext)
  if (!ctx) {
    throw new Error('useNadoLinkedSigner must be used within NadoLinkedSignerProvider')
  }
  return ctx
}
