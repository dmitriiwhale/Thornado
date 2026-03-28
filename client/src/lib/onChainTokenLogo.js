import { getAddress, isAddress } from 'viem'

/** Optional ERC-20 / metadata extensions (EIP-1046–style, NFT metadata, etc.) */
const READ_ABI = [
  {
    name: 'logoURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'uri',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
]

function ipfsToHttp(uri) {
  const s = String(uri).trim()
  if (!s.startsWith('ipfs://')) return null
  let path = s.slice('ipfs://'.length).replace(/^ipfs\//, '')
  if (!path) return null
  return `https://ipfs.io/ipfs/${path}`
}

/**
 * If `raw` is JSON metadata, pull `image` / `logo`.
 * @param {string} raw
 * @returns {string|null}
 */
function imageFromJsonMetadata(raw) {
  const t = String(raw).trim()
  if (!t.startsWith('{')) return null
  try {
    const j = JSON.parse(t)
    const img = j.image ?? j.logo ?? j.image_url
    return typeof img === 'string' ? img.trim() : null
  } catch {
    return null
  }
}

/**
 * Resolve tokenURI / logoURI result to an https image URL usable in <img src>.
 * Handles ipfs://, inline JSON, and optional follow for http JSON (best-effort).
 */
export async function resolveTokenUriToImageUrl(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s) return null

  const fromJson = imageFromJsonMetadata(s)
  if (fromJson) {
    const nested = await resolveTokenUriToImageUrl(fromJson)
    return nested
  }

  if (s.startsWith('ipfs://')) {
    const http = ipfsToHttp(s)
    return http ? resolveTokenUriToImageUrl(http) : null
  }

  if (s.startsWith('data:')) {
    if (s.startsWith('data:application/json')) {
      try {
        const base64 = s.split(',')[1]
        if (!base64) return null
        const json = atob(base64)
        const img = imageFromJsonMetadata(json)
        if (img) return resolveTokenUriToImageUrl(img)
      } catch {
        return null
      }
    }
    return s.startsWith('data:image/') ? s : null
  }

  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(s)) return s

    try {
      const r = await fetch(s, {
        method: 'GET',
        signal:
          typeof AbortSignal !== 'undefined' &&
          typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(4500)
            : undefined,
      })
      if (!r.ok) return s
      const ct = (r.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('json')) {
        const text = await r.text()
        const img = imageFromJsonMetadata(text)
        if (img) {
          const out = await resolveTokenUriToImageUrl(img)
          if (out) return out
        }
      }
    } catch {
      /* CORS or network — still return URL for <img> to try */
    }
    return s
  }

  return null
}

/**
 * @param {import('viem').PublicClient} publicClient
 * @param {string} tokenAddress checksummed or raw
 * @returns {Promise<string|null>} https (or data URI) or null
 */
export async function fetchOnChainTokenLogo(publicClient, tokenAddress) {
  if (!publicClient || tokenAddress == null) return null
  const s = String(tokenAddress).trim()
  if (!isAddress(s)) return null
  const addr = getAddress(s)

  const reads = await Promise.allSettled([
    publicClient.readContract({
      address: addr,
      abi: READ_ABI,
      functionName: 'logoURI',
      args: [],
    }),
    publicClient.readContract({
      address: addr,
      abi: READ_ABI,
      functionName: 'tokenURI',
      args: [],
    }),
    publicClient.readContract({
      address: addr,
      abi: READ_ABI,
      functionName: 'uri',
      args: [0n],
    }),
    publicClient.readContract({
      address: addr,
      abi: READ_ABI,
      functionName: 'uri',
      args: [1n],
    }),
  ])

  for (const r of reads) {
    if (r.status !== 'fulfilled') continue
    const raw = r.value
    if (typeof raw !== 'string' || !raw.trim()) continue
    const url = await resolveTokenUriToImageUrl(raw.trim())
    if (url && (url.startsWith('http') || url.startsWith('data:image/'))) {
      return url
    }
  }
  return null
}
