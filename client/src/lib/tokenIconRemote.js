import { getAddress, isAddress } from 'viem'
import {
  BLOCKSCOUT_TOKEN_API_V2_BASE_BY_CHAIN_ID,
  fetchExplorerTokenIcon,
} from './explorerTokenIcon.js'
import { fetchOnChainTokenLogo } from './onChainTokenLogo.js'
import { fetchTimeoutMs } from './fetchTimeout.js'

/**
 * GeckoTerminal API v2 — `image_url` on token (CoinGecko CDN). Strong coverage for Ink/Base/etc.
 * @see https://apiguide.geckoterminal.com/
 */
const GECKO_TERMINAL_NETWORK_BY_CHAIN_ID = {
  1: 'eth',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon_pos',
  8453: 'base',
  42161: 'arbitrum',
  57073: 'ink',
}

/** CoinGecko `/coins/{platform}/contract/{address}` — used when GT + explorer miss (rate limits apply). */
const COINGECKO_PLATFORM_BY_CHAIN_ID = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  137: 'polygon-pos',
  8453: 'base',
  42161: 'arbitrum-one',
  57073: 'ink',
}

function checksummedAddress(address) {
  const s = String(address ?? '').trim()
  if (!isAddress(s)) return null
  try {
    return getAddress(s)
  } catch {
    return null
  }
}

async function safeNull(p) {
  try {
    return await p
  } catch {
    return null
  }
}

async function fetchGeckoTerminalTokenIcon(chainId, checksummed) {
  const network = GECKO_TERMINAL_NETWORK_BY_CHAIN_ID[Number(chainId)]
  if (!network || !checksummed) return null
  const addr = checksummed.toLowerCase()
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${addr}`
  const res = await fetch(url, { signal: fetchTimeoutMs(6000) })
  if (!res.ok) return null
  const j = await res.json()
  const img = j?.data?.attributes?.image_url
  if (typeof img === 'string' && img.startsWith('http')) return img
  return null
}

async function fetchCoinGeckoContractIcon(chainId, checksummed) {
  const platform = COINGECKO_PLATFORM_BY_CHAIN_ID[Number(chainId)]
  if (!platform || !checksummed) return null
  const addr = checksummed.toLowerCase()
  const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${addr}`
  const res = await fetch(url, { signal: fetchTimeoutMs(6000) })
  if (!res.ok) return null
  const j = await res.json()
  const img = j?.image?.small ?? j?.image?.thumb ?? j?.image?.large
  return typeof img === 'string' && img.startsWith('http') ? img : null
}

/**
 * Fast path: GeckoTerminal, Blockscout, CoinGecko in **parallel**; preference GT → BS → CG.
 * Slow path: on-chain reads only if all three miss (RPC).
 * @param {{ publicClient?: import('viem').PublicClient }} [options]
 * @returns {Promise<string|null>}
 */
export async function fetchRemoteTokenIcon(chainId, address, options = {}) {
  const { publicClient } = options
  const addr = checksummedAddress(address)
  if (!addr) return null

  const [gt, bs, cg] = await Promise.all([
    safeNull(fetchGeckoTerminalTokenIcon(chainId, addr)),
    safeNull(fetchExplorerTokenIcon(chainId, addr)),
    safeNull(fetchCoinGeckoContractIcon(chainId, addr)),
  ])

  if (gt) return gt
  if (bs) return bs
  if (cg) return cg

  if (publicClient) {
    const onchain = await safeNull(fetchOnChainTokenLogo(publicClient, addr))
    if (onchain) return onchain
  }

  return null
}

export function hasRemoteTokenIconLookup(chainId) {
  const cid = Number(chainId)
  return Boolean(
    GECKO_TERMINAL_NETWORK_BY_CHAIN_ID[cid] ||
      BLOCKSCOUT_TOKEN_API_V2_BASE_BY_CHAIN_ID[cid] ||
      COINGECKO_PLATFORM_BY_CHAIN_ID[cid],
  )
}
