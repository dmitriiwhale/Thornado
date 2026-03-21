import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import { signMessage } from 'viem/actions'

function siweDomain() {
  return import.meta.env.VITE_SIWE_DOMAIN || (typeof window !== 'undefined' ? window.location.host : '')
}

/**
 * @param {string} address
 * @param {{
 *   chainId: number
 *   walletClient?: import('viem').WalletClient | null
 *   signMessageAsync: (args: { message: string; account: `0x${string}`; connector?: unknown }) => Promise<`0x${string}`>
 *   connector?: unknown
 * }} opts
 */
export async function signInWithThornado(address, opts) {
  const { chainId, walletClient, signMessageAsync, connector } = opts
  const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
  if (!nonceRes.ok) throw new Error('nonce failed')
  const { nonce } = await nonceRes.json()

  const checksummed = getAddress(address)
  const domain = siweDomain()
  const message = new SiweMessage({
    domain,
    address: checksummed,
    statement: 'Sign in to THORNado.',
    uri: typeof window !== 'undefined' ? window.location.origin : '',
    version: '1',
    chainId,
    nonce,
  })
  const msg = message.prepareMessage()

  let signature
  if (walletClient) {
    signature = await signMessage(walletClient, {
      account: checksummed,
      message: msg,
    })
  } else {
    signature = await signMessageAsync({
      message: msg,
      account: checksummed,
      ...(connector ? { connector } : {}),
    })
  }

  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, signature }),
  })
  if (!verifyRes.ok) {
    const err = await verifyRes.text()
    throw new Error(err || 'verify failed')
  }
  return verifyRes.json()
}

export async function logoutSession() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}
