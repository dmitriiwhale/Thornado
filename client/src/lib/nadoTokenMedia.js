import { normalizePerpMarketLabel } from './portfolioAdapters.js'

/**
 * Nado app (Next.js) serves token SVGs as `/_next/static/media/{slug}.{contenthash}.svg`
 * — see snapshots in /portfolio.html (markets + balances). Filenames are content-hashed;
 * after Nado updates an asset, the hash may change and this map should be refreshed from their HTML/network tab.
 *
 * @type {Record<string, string>}
 */
export const NADO_TOKEN_MEDIA_FILES = {
  AAVE: 'aave.7e767bbb.svg',
  ASTER: 'aster.a4ef691c.svg',
  BCH: 'bch.1eff764a.svg',
  BNB: 'bnb.ba2d0a87.svg',
  BTC: 'btc.a7bb970b.svg',
  DOGE: 'doge.a3a33acc.svg',
  ENA: 'ena.26343b8e.svg',
  ETH: 'eth.b2205244.svg',
  EURUSD: 'eurusd.252f1e32.svg',
  FARTCOIN: 'fartcoin.ed1aad49.svg',
  GBPUSD: 'gbpusd.ff6b5f89.svg',
  HYPE: 'hype.1738e6d5.svg',
  JUP: 'jup.93f1fedb.svg',
  KBTC: 'kbtc.0d267c0a.svg',
  BONK: 'bonk.5b233595.svg',
  PEPE: 'pepe.aa30ccb2.svg',
  KBONK: 'bonk.5b233595.svg',
  KPEPE: 'pepe.aa30ccb2.svg',
  LINK: 'link.eb1a4e56.svg',
  LIT: 'lit.bf817220.svg',
  MON: 'mon.8d4ebd3e.svg',
  /** Spot balances quote collateral (balances table snapshot). */
  NLP: 'nlp.16db6504.svg',
  ONDO: 'ondo.a36629f1.svg',
  PENGU: 'pengu.79ebbccc.svg',
  PUMP: 'pump.2f15571b.svg',
  QQQ: 'qqq.27f7d8bb.svg',
  SOL: 'sol.5c652667.svg',
  SPY: 'spy.bcded553.svg',
  SUI: 'sui.43c57828.svg',
  TAO: 'tao.14bfb7e5.svg',
  UNI: 'uni.25e4c1ac.svg',
  USDC: 'usdc.3acc98a8.svg',
  /** Primary quote on Ink (balances table). */
  USDT0: 'usdt0.86867de2.svg',
  USDT: 'usdt0.86867de2.svg',
  USDJPY: 'usdjpy.4986c9c4.svg',
  WETH: 'weth.62c152dc.svg',
  WLFI: 'wlfi.d716323c.svg',
  WTI: 'oil.46a7063c.svg',
  XAG: 'silver.3c82ff15.svg',
  XAUT: 'xaut.854eba77.svg',
  XMR: 'xmr.77f6ddb2.svg',
  XPL: 'xpl.be9a150a.svg',
  XRP: 'xrp.a69dd461.svg',
  ZEC: 'zec.410e9be6.svg',
  ZRO: 'zro.3b26cfc0.svg',
}

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function baseKeyFromSymbol(raw) {
  const t = normalizePerpMarketLabel(String(raw ?? '').trim())
  if (!t) return ''
  const first = t.split(/[-/]/)[0].trim()
  return first.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * @param {string|null|undefined} symbol
 * @returns {string|null} Full media filename, e.g. `btc.a7bb970b.svg`, or null if unknown.
 */
export function resolveNadoTokenMediaFile(symbol) {
  let k = baseKeyFromSymbol(symbol)
  if (!k) return null
  if (/^1000[A-Z0-9]+$/.test(k) && k.length > 4) {
    k = k.slice(4)
  }
  const file = NADO_TOKEN_MEDIA_FILES[k]
  return file ?? null
}

/**
 * @param {string} origin e.g. https://app.nado.xyz (no trailing slash)
 * @param {string|null|undefined} symbol
 * @returns {string|null}
 */
export function nadoTokenIconUrl(origin, symbol) {
  const o = String(origin ?? '').replace(/\/$/, '')
  if (!o.startsWith('http')) return null
  const file = resolveNadoTokenMediaFile(symbol)
  if (!file) return null
  return `${o}/_next/static/media/${file}`
}
