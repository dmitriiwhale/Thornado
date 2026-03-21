import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const PREFIX = 'thornado:nado-linked-signer:'

function keyFor(owner, chainId, subaccountName) {
  return `${PREFIX}${String(owner).toLowerCase()}:${chainId}:${subaccountName}`
}

/**
 * Persist linked-signer private key (hex). Stored in localStorage — treat as sensitive.
 * @param {`0x${string}`} owner
 * @param {number} chainId
 * @param {string} subaccountName
 * @param {`0x${string}`} privateKey
 */
export function saveLinkedSignerPrivateKey(owner, chainId, subaccountName, privateKey) {
  try {
    localStorage.setItem(keyFor(owner, chainId, subaccountName), privateKey)
  } catch {
    /* ignore */
  }
}

export function loadLinkedSignerPrivateKey(owner, chainId, subaccountName) {
  try {
    const v = localStorage.getItem(keyFor(owner, chainId, subaccountName))
    return v && v.startsWith('0x') ? /** @type {`0x${string}`} */ (v) : null
  } catch {
    return null
  }
}

export function clearLinkedSignerPrivateKey(owner, chainId, subaccountName) {
  try {
    localStorage.removeItem(keyFor(owner, chainId, subaccountName))
  } catch {
    /* ignore */
  }
}

/**
 * @param {`0x${string}`} privateKey
 * @param {import('viem/chains').Chain} chain
 */
export function createLinkedSignerWalletClient(privateKey, chain) {
  const account = privateKeyToAccount(privateKey)
  const url = chain.rpcUrls?.default?.http?.[0]
  return createWalletClient({
    account,
    chain,
    transport: url ? http(url) : http(),
  })
}
