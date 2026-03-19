import { useMemo, useRef, useState } from 'react'

function normalizeHexColor(value) {
  if (!value) return '#060010'
  const cleaned = value.startsWith('#') ? value : `#${value}`
  return cleaned.length === 7 ? cleaned : '#060010'
}

export default function BorderGlow({
  children,
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '060010',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['c084fc', 'f472b6', '38bdf8'],
  className = '',
}) {
  const containerRef = useRef(null)
  const [pointer, setPointer] = useState({ x: 0, y: 0, nearEdge: false })

  const borderGradient = useMemo(() => {
    const parsed = colors.map((item) => normalizeHexColor(item)).join(', ')
    return `linear-gradient(115deg, ${parsed})`
  }, [colors])

  const bgColor = normalizeHexColor(backgroundColor)

  const handleMove = (event) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const nearEdge =
      x <= edgeSensitivity ||
      y <= edgeSensitivity ||
      x >= rect.width - edgeSensitivity ||
      y >= rect.height - edgeSensitivity

    setPointer({ x, y, nearEdge })
  }

  const handleLeave = () => {
    setPointer((prev) => ({ ...prev, nearEdge: false }))
  }

  return (
    <div
      ref={containerRef}
      className={`border-glow-shell relative p-[1px] ${className}`}
      style={{ borderRadius: `${borderRadius}px` }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div
        className={`border-glow-border absolute inset-0 ${animated ? 'border-glow-spin' : ''}`}
        style={{
          borderRadius: `${borderRadius}px`,
          background: borderGradient,
          opacity: 0.85,
        }}
      />

      <div
        className="border-glow-edge absolute inset-0 pointer-events-none transition-opacity duration-200"
        style={{
          borderRadius: `${borderRadius}px`,
          opacity: pointer.nearEdge ? 1 : 0,
          background: `radial-gradient(${coneSpread}% ${coneSpread}% at ${pointer.x}px ${pointer.y}px, rgb(${glowColor} / ${0.45 * glowIntensity}), transparent ${glowRadius}%)`,
          filter: `blur(${Math.max(glowRadius * 0.18, 2)}px)`,
        }}
      />

      <div
        className="border-glow-inner relative"
        style={{
          borderRadius: `${Math.max(borderRadius - 1, 0)}px`,
          background: bgColor,
        }}
      >
        {children}
      </div>
    </div>
  )
}
