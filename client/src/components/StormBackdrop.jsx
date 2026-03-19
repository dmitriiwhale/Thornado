import { useEffect, useState } from 'react'
import Lightning from './Lightning'

export default function StormBackdrop({ scrollContainerRef, isLanding }) {
  const [contentHeight, setContentHeight] = useState(() => {
    if (typeof window === 'undefined') return 1080
    return window.innerHeight
  })
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const scroller = scrollContainerRef?.current
    if (!scroller || !isLanding) {
      setScrollTop(0)
      if (typeof window !== 'undefined') {
        setContentHeight(window.innerHeight)
      }
      return undefined
    }

    const updateMetrics = () => {
      const viewportOverflow =
        typeof window !== 'undefined'
          ? Math.max(0, window.innerHeight - scroller.clientHeight)
          : 0

      setScrollTop(scroller.scrollTop || 0)
      setContentHeight(
        Math.max(
          scroller.scrollHeight + viewportOverflow,
          scroller.clientHeight,
          typeof window !== 'undefined' ? window.innerHeight : 0,
        ),
      )
    }

    const onScroll = () => {
      setScrollTop(scroller.scrollTop || 0)
    }

    updateMetrics()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateMetrics)

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateMetrics)
      resizeObserver.observe(scroller)
      if (scroller.firstElementChild) {
        resizeObserver.observe(scroller.firstElementChild)
      }
    }

    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateMetrics)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [scrollContainerRef, isLanding])

  const lightningTrackStyle = isLanding
    ? {
        height: `${contentHeight}px`,
        transform: `translate3d(0, ${-scrollTop}px, 0)`,
      }
    : undefined

  return (
    <div className="storm-backdrop fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="storm-sky-base absolute inset-0" />
      <div className="storm-sky-veil absolute inset-0" />
      <div className="storm-cloudbank storm-cloudbank-1" />
      <div className="storm-cloudbank storm-cloudbank-2" />
      <div className="storm-cloudbank storm-cloudbank-3" />
      <div className="storm-cloudbank storm-cloudbank-4" />
      <div className="storm-mist storm-mist-1" />
      <div className="storm-mist storm-mist-2" />
      <div className="storm-noise absolute inset-0" />
      <div className="storm-webgl-lightning-viewport absolute inset-0">
        <div className="storm-webgl-lightning-track" style={lightningTrackStyle}>
          <div className="storm-webgl-lightning absolute inset-0">
            <Lightning hue={260} xOffset={0.3} speed={0.525} intensity={0.3} size={3} />
          </div>
          <div className="storm-lightning-soft-blur absolute inset-0" />
        </div>
      </div>
      <div className="storm-global-tint absolute inset-0" />
    </div>
  )
}
