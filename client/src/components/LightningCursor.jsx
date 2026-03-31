import { useEffect, useRef, useState } from 'react'

const CLICKABLE = 'button, a, [role="button"], input, select, textarea, label, [tabindex], [onClick]'

export default function LightningCursor() {
  const [isHovering, setIsHovering] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const cursorRef = useRef(null)
  const frameRef = useRef(0)
  const targetPosRef = useRef({ x: -200, y: -200 })
  const hoverRef = useRef(false)
  const clickRef = useRef(false)
  const visibleRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsDesktop(false)
      return
    }

    const flushPosition = () => {
      frameRef.current = 0
      const node = cursorRef.current
      if (!node) return
      const { x, y } = targetPosRef.current
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }

    const move = (e) => {
      targetPosRef.current = { x: e.clientX, y: e.clientY }
      if (!visibleRef.current) {
        visibleRef.current = true
        setIsVisible(true)
      }
      if (!frameRef.current) {
        frameRef.current = window.requestAnimationFrame(flushPosition)
      }
    }
    const over = (e) => {
      const next = !!e.target.closest(CLICKABLE)
      if (hoverRef.current !== next) {
        hoverRef.current = next
        setIsHovering(next)
      }
    }
    const down = () => {
      if (!clickRef.current) {
        clickRef.current = true
        setIsClicking(true)
      }
    }
    const up = () => {
      if (clickRef.current) {
        clickRef.current = false
        setIsClicking(false)
      }
    }
    const leaveWindow = () => {
      visibleRef.current = false
      hoverRef.current = false
      clickRef.current = false
      setIsVisible(false)
      setIsHovering(false)
      setIsClicking(false)
    }
    const enterWindow = () => {
      visibleRef.current = true
      setIsVisible(true)
    }
    const handleMouseOut = (e) => {
      if (!e.relatedTarget) leaveWindow()
    }
    const handleVisibility = () => {
      if (document.hidden) leaveWindow()
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', over)
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    window.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('mouseenter', enterWindow)
    window.addEventListener('blur', leaveWindow)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('mouseenter', enterWindow)
      window.removeEventListener('blur', leaveWindow)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  if (!isDesktop) return null

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ transform: 'translate3d(-200px, -200px, 0)', willChange: 'transform' }}
    >
      <svg
        width="9"
        height="15"
        viewBox="0 0 16 26"
        className="absolute"
        style={{
          left: 10,
          top: -14,
          overflow: 'visible',
          opacity: isVisible ? (isClicking ? 0.75 : 0.9) : 0,
          transform: `translate3d(0, ${isHovering ? -2 : 0}px, 0) scale(${isHovering ? 1.08 : 0.9}) rotate(${isHovering ? -2 : 0}deg)`,
          transition: 'opacity 140ms ease-out, transform 140ms ease-out',
        }}
      >
        <defs>
          <filter id="cursor-zap-glow" x="-180%" y="-180%" width="460%" height="460%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.72  0 1 0 0 0.58  0 0 1 0 1  0 0 0 1 0"
              result="tint"
            />
            <feMerge>
              <feMergeNode in="tint" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <polygon
          points="11,0 4,11 8,11 3,26 14,10 9,10"
          fill="rgba(196,181,253,0.58)"
          filter="url(#cursor-zap-glow)"
        />
        <polygon
          points="11,0 4,11 8,11 3,26 14,10 9,10"
          fill={isHovering ? '#f5f3ff' : '#ddd6fe'}
        />
      </svg>
    </div>
  )
}
