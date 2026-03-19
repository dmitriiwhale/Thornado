import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const CLICKABLE = 'button, a, [role="button"], input, select, textarea, label, [tabindex], [onClick]'

export default function LightningCursor() {
  const [pos, setPos] = useState({ x: -200, y: -200 })
  const [isHovering, setIsHovering] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsDesktop(false)
      return
    }

    const move = (e) => {
      setPos({ x: e.clientX, y: e.clientY })
      setIsVisible(true)
    }
    const over = (e) => setIsHovering(!!e.target.closest(CLICKABLE))
    const down = () => setIsClicking(true)
    const up = () => setIsClicking(false)
    const leaveWindow = () => {
      setIsVisible(false)
      setIsHovering(false)
      setIsClicking(false)
    }
    const enterWindow = () => setIsVisible(true)
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
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 1800, damping: 42, mass: 0.05 }}
    >
      <motion.svg
        width="9"
        height="15"
        viewBox="0 0 16 26"
        className="absolute"
        style={{ left: 10, top: -14, overflow: 'visible' }}
        animate={{
          opacity: isVisible ? (isClicking ? 0.75 : 0.9) : 0,
          scale: isHovering ? 1.08 : 0.9,
          y: isHovering ? -2 : 0,
          rotate: isHovering ? -2 : 0,
        }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
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
      </motion.svg>
    </motion.div>
  )
}
