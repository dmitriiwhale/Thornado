import { useEffect, useMemo, useRef, useState } from 'react'

const COLOR_PALETTE = {
  1: '#ddd6fe',
  2: '#c4b5fd',
  3: '#a78bfa',
  4: '#818cf8',
}

function resolveColor(value) {
  if (typeof value === 'number') return COLOR_PALETTE[value] || COLOR_PALETTE[1]
  if (typeof value === 'string' && value.length > 0) return value
  return COLOR_PALETTE[1]
}

export default function GooeyNav({
  items = [],
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  initialActiveIndex = 0,
  activeIndex,
  onActiveChange,
  onItemClick,
  animationTime = 600,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
}) {
  const navRef = useRef(null)
  const itemRefs = useRef([])
  const [internalActive, setInternalActive] = useState(initialActiveIndex)
  const [anchor, setAnchor] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const currentActive = typeof activeIndex === 'number' ? activeIndex : internalActive

  const particles = useMemo(() => {
    const maxDistance = particleDistances[0] ?? 90
    const minDistance = particleDistances[1] ?? 10
    return Array.from({ length: particleCount }, (_, index) => {
      const angle = (Math.PI * 2 * index) / particleCount + (Math.random() - 0.5) * 0.45
      const radius = minDistance + Math.random() * Math.max(maxDistance - minDistance, 1)
      const tx = `${Math.cos(angle) * radius}px`
      const ty = `${Math.sin(angle) * radius}px`
      const size = 5 + Math.random() * 9
      const duration = (animationTime + Math.random() * timeVariance) / 1000
      const delay = Math.random() * -duration
      return {
        id: `${index}-${currentActive}`,
        tx,
        ty,
        size,
        duration,
        delay,
        color: resolveColor(colors[index % colors.length]),
      }
    })
  }, [particleCount, particleDistances, animationTime, timeVariance, colors, currentActive])

  useEffect(() => {
    const nav = navRef.current
    const activeEl = itemRefs.current[currentActive]
    if (!nav || !activeEl) return

    const updateAnchor = () => {
      setAnchor({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
      })
    }

    updateAnchor()
    const ro = new ResizeObserver(updateAnchor)
    ro.observe(nav)
    ro.observe(activeEl)
    window.addEventListener('resize', updateAnchor)

    return () => {
      window.removeEventListener('resize', updateAnchor)
      ro.disconnect()
    }
  }, [currentActive, items.length])

  const handleItemClick = (item, index, event) => {
    if (item.disabled) return
    if (typeof activeIndex !== 'number') setInternalActive(index)
    onActiveChange?.(index, item)
    onItemClick?.(item, index, event)
  }

  return (
    <div ref={navRef} className="relative inline-flex items-center rounded-2xl border border-white/10 bg-[rgba(10,12,28,0.58)] px-2 py-1.5 backdrop-blur-md">
      <svg className="absolute pointer-events-none h-0 w-0">
        <defs>
          <filter id="gooey-nav-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className="pointer-events-none absolute z-0 transition-all duration-300 ease-out"
        style={{
          left: `${anchor.left}px`,
          top: `${anchor.top}px`,
          width: `${anchor.width}px`,
          height: `${anchor.height}px`,
        }}
      >
        <div className="h-full w-full rounded-xl bg-violet-300/15 shadow-[0_0_20px_rgba(167,139,250,0.26)]" />
      </div>

      <div
        className="pointer-events-none absolute z-0"
        style={{
          left: `${anchor.left + anchor.width / 2}px`,
          top: `${anchor.top + anchor.height / 2}px`,
          width: `${particleR * 2}px`,
          height: `${particleR * 2}px`,
          transform: 'translate(-50%, -50%)',
          filter: 'url(#gooey-nav-filter)',
          opacity: 0.88,
        }}
      >
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="absolute rounded-full gooey-particle"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: '50%',
              top: '50%',
              marginLeft: `${-particle.size / 2}px`,
              marginTop: `${-particle.size / 2}px`,
              background: particle.color,
              boxShadow: `0 0 10px ${particle.color}`,
              '--tx': particle.tx,
              '--ty': particle.ty,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-1">
        {items.map((item, index) => {
          const isActive = index === currentActive
          return (
            <button
              key={`${item.label}-${index}`}
              ref={(el) => { itemRefs.current[index] = el }}
              onClick={(event) => handleItemClick(item, index, event)}
              disabled={item.disabled}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                item.disabled
                  ? 'cursor-default text-slate-500'
                  : isActive
                  ? 'text-violet-50'
                  : 'text-slate-300 hover:text-violet-100'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
