import { ProductEngineType } from '@nadohq/shared'

/**
 * Map perp `productId` → quote/base spot token address for logos (health group links perp to a spot product).
 */
export async function buildPerpBaseTokenAddressMap(engineClient) {
  const [hg, markets] = await Promise.all([
    engineClient.getHealthGroups(),
    engineClient.getAllMarkets(),
  ])

  const spotTokenByProductId = {}
  for (const m of markets ?? []) {
    if (m.type === ProductEngineType.SPOT && m.product?.tokenAddr) {
      spotTokenByProductId[Number(m.productId)] = String(m.product.tokenAddr)
    }
  }

  /** @type {Record<string, string>} */
  const perpToToken = {}
  for (const { spotProductId, perpProductId } of hg?.healthGroups ?? []) {
    const sid = Number(spotProductId)
    const pid = Number(perpProductId)
    // Docs: pair is [spot, perp], e.g. BTC spot + BTC-PERP; 0 = missing leg.
    if (!sid || !pid) continue
    const addr = spotTokenByProductId[sid]
    if (addr) perpToToken[String(pid)] = addr
  }
  return perpToToken
}
