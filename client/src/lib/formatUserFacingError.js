/** Wallet / viem errors often nest `cause`; `message` may be empty on the outer object. */
export function formatUserFacingError(err) {
  if (err == null) return 'Something went wrong'
  if (typeof err === 'string') return err

  let cur = err
  const seen = new Set()
  for (let i = 0; i < 10 && cur != null && typeof cur === 'object' && !seen.has(cur); i += 1) {
    seen.add(cur)
    const code = cur.code
    const name = cur.name
    if (code === 4001 || name === 'UserRejectedRequestError' || name === 'ActionRejectedError') {
      return 'Transaction was rejected in the wallet'
    }
    const sm = cur.shortMessage
    if (typeof sm === 'string' && sm.trim()) return sm.trim()
    const msg = cur.message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
    const det = cur.details
    if (typeof det === 'string' && det.trim()) return det.trim()
    if (Array.isArray(det) && det.length) {
      const first = det.find((x) => typeof x === 'string' && x.trim())
      if (first) return String(first).trim()
    }
    cur = cur.cause
  }

  if (err instanceof Error && err.message?.trim()) return err.message.trim()
  const s = String(err)
  if (s && s !== '[object Object]') return s
  return 'Request failed'
}
