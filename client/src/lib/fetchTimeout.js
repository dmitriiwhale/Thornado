/** AbortSignal.timeout polyfill for older engines. */
export function fetchTimeoutMs(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  return undefined
}
