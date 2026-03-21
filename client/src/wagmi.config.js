import { createConfig, http, injected } from 'wagmi'
import { CHAIN_ENV_TO_CHAIN } from '@nadohq/shared'

export const inkTestnet = CHAIN_ENV_TO_CHAIN.inkTestnet
export const inkMainnet = CHAIN_ENV_TO_CHAIN.inkMainnet

/** @deprecated use inkTestnet */
export const nadoTestnetChain = inkTestnet

export const wagmiConfig = createConfig({
  chains: [inkTestnet, inkMainnet],
  connectors: [injected()],
  transports: {
    [inkTestnet.id]: http(),
    [inkMainnet.id]: http(),
  },
})
