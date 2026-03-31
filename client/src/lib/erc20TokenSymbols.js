import { erc20Abi } from 'viem'

const READ_SYMBOL_BATCH_SIZE = 6

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

  for (let i = 0; i < unique.length; i += READ_SYMBOL_BATCH_SIZE) {
    const batch = unique.slice(i, i + READ_SYMBOL_BATCH_SIZE)
    await Promise.all(
      batch.map(async (addr) => {
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
  }

  return out
}
