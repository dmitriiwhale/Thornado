import { getAddress, isAddress } from 'viem'

const ONE_INCH_IMAGE = (addrLower) =>
  `https://tokens-data.1inch.io/images/${addrLower}.png`

const TRUSTWALLET_LOGO = (blockchain, checksummed) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${blockchain}/assets/${checksummed}/logo.png`

const CRYPTO_ICON_SVG = (tickerLower) =>
  `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${tickerLower}.svg`

/** Trust Wallet folder names (subset). Unknown L2s fall back to ethereum (bridged clones). */
const TRUST_SLUGS_BY_CHAIN = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygon',
  56: 'smartchain',
  43114: 'avalanchec',
  57073: 'ethereum',
  763373: 'ethereum',
}

function trustSlug(chainId) {
  if (chainId == null) return 'ethereum'
  return TRUST_SLUGS_BY_CHAIN[chainId] ?? 'ethereum'
}

/**
 * Map UI symbol → cryptocurrency-icons filename (lowercase), best-effort.
 * @see https://github.com/spothq/cryptocurrency-icons
 */
export function symbolToCryptoIconTicker(symbol) {
  const raw = String(symbol ?? '').trim()
  if (!raw) return ''
  let t = raw.split(/[-/]/)[0].replace(/[^A-Za-z0-9]/g, '')
  if (!t) return ''
  const u = t.toUpperCase()
  // Match common wrappers by substring too (e.g. "rUSDT", "sUSDC", "WBTC", "renBTC")
  if (u.includes('USDT')) return 'usdt'
  if (u.includes('USDC')) return 'usdc'
  if (u.includes('DAI')) return 'dai'
  if (u.includes('WBTC') || u.includes('W-BTC')) return 'wbtc'
  if (u.includes('BTC')) return 'btc'
  if (u.includes('WETH') || u === 'ETH' || u.includes('ETH')) return 'eth'
  if (u.includes('SOL')) return 'sol'
  return t.slice(0, 12).toLowerCase()
}

/**
 * Ordered list of image URLs for a balance row. First working URL wins in the UI (onError chain).
 * @param {{ tokenAddress: string|null, symbol: string, chainId?: number }} p
 * @returns {string[]}
 */
export function tokenLogoCandidates({ tokenAddress, symbol, chainId }) {
  const out = []
  const addr = tokenAddress && isAddress(tokenAddress) ? getAddress(tokenAddress) : null
  const addrLower = addr ? addr.toLowerCase() : null

  if (addrLower) {
    out.push(ONE_INCH_IMAGE(addrLower))
    const slug = trustSlug(chainId)
    out.push(TRUSTWALLET_LOGO(slug, addr))
    if (slug !== 'ethereum') {
      out.push(TRUSTWALLET_LOGO('ethereum', addr))
    }
    if (slug !== 'base') {
      out.push(TRUSTWALLET_LOGO('base', addr))
    }
  }

  const ticker = symbolToCryptoIconTicker(symbol)
  if (ticker) {
    out.push(CRYPTO_ICON_SVG(ticker))
  }

  return [...new Set(out)]
}
