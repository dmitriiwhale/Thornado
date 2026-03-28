import { getAddress, isAddress } from 'viem'
import { fetchTimeoutMs } from './fetchTimeout.js'

/**
 * Blockscout HTTP API v2 `GET /tokens/{address}` — field `icon_url` (often CoinGecko CDN).
 * CORS allows browser fetch (`access-control-allow-origin: *` on public instances).
 * @see https://docs.blockscout.com/api-reference/get-token-info
 */
export const BLOCKSCOUT_TOKEN_API_V2_BASE_BY_CHAIN_ID = {
  1: 'https://eth.blockscout.com/api/v2',
  10: 'https://optimism.blockscout.com/api/v2',
  137: 'https://polygon.blockscout.com/api/v2',
  8453: 'https://base.blockscout.com/api/v2',
  42161: 'https://arbitrum.blockscout.com/api/v2',
  57073: 'https://explorer.inkonchain.com/api/v2',
  763373: 'https://explorer-sepolia.inkonchain.com/api/v2',
}

export function hasBlockscoutTokenApi(chainId) {
  return Boolean(BLOCKSCOUT_TOKEN_API_V2_BASE_BY_CHAIN_ID[Number(chainId)])
}

/**
 * @returns {Promise<string|null>} HTTPS image URL or null
 */
export async function fetchExplorerTokenIcon(chainId, address) {
  const base = BLOCKSCOUT_TOKEN_API_V2_BASE_BY_CHAIN_ID[Number(chainId)]
  if (!base || address == null) return null
  const s = String(address).trim()
  if (!isAddress(s)) return null
  const addr = getAddress(s)
  const url = `${base}/tokens/${addr}`
  const res = await fetch(url, { signal: fetchTimeoutMs(6000) })
  if (!res.ok) return null
  const j = await res.json()
  const candidates = [
    j?.icon_url,
    j?.image_url,
    j?.token?.icon_url,
    j?.token?.image_url,
  ]
  for (const icon of candidates) {
    if (typeof icon === 'string' && icon.startsWith('http')) return icon
  }
  return null
}
