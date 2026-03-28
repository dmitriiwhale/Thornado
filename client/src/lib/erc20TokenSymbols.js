import { erc20Abi } from 'viem'

/**
 * Read ERC-20 `symbol()` for each address (on-chain names wallets use).
 * Keys in the returned map are lowercased hex addresses.
 */
export async function fetchErc20Symbols(publicClient, addresses) {
  const unique = [
    ...new Set(
      addresses
        .filter((a) => a != null && String(a).trim() !== '')
        .map((a) => String(a).trim()),
    ),
  ]
  const out = {}
  await Promise.all(
    unique.map(async (addr) => {
      try {
        const sym = await publicClient.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: 'symbol',
        })
        if (sym != null && String(sym).trim() !== '') {
          out[addr.toLowerCase()] = String(sym).trim()
        }
      } catch {
        /* non-standard token or RPC */
      }
    }),
  )
  return out
}
