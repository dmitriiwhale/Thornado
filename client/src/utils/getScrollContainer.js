export default function getScrollContainer(scrollContainerRef, fallback) {
  const candidate = scrollContainerRef?.current
  const hasWindow = typeof window !== 'undefined'
  if (candidate && (!hasWindow || candidate !== window)) {
    return candidate
  }
  if (fallback) return fallback
  return hasWindow ? window : undefined
}
