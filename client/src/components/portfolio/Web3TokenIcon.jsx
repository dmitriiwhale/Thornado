import React, { useEffect, useMemo, useState } from 'react'
import { nadoTokenIconUrl } from '../../lib/nadoTokenMedia.js'

function hashString(seed) {
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

function TokenAvatarFallback({ seed, symbol, size = 21 }) {
  const rawHash = hashString(seed)
  const hue = rawHash % 360
  const clean = String(symbol ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const label = clean.slice(0, 2) || '?'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`g-${rawHash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 90% 55%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 90% 45%)`} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.2" fill={`url(#g-${rawHash})`} />
      <circle
        cx="12"
        cy="12"
        r="10.2"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1"
      />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize={size >= 21 ? 12 : size >= 18 ? 10 : 9}
        fill="white"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
        style={{ fontWeight: 800 }}
      >
        {label}
      </text>
    </svg>
  )
}

/**
 * Nado app (Next.js) `/_next/static/media/*.svg` when mapped in `nadoTokenMedia.js`, else
 * generated initials — same approach as Nado’s market list (Spot + perps).
 *
 * @param {{ symbol?: string|null, seed?: string|null, size?: number, className?: string, nadoAppOrigin?: string|null }} props
 */
export default function Web3TokenIcon({
  symbol,
  seed,
  size = 21,
  className = '',
  nadoAppOrigin = null,
}) {
  const nadoUrl = useMemo(
    () => nadoTokenIconUrl(nadoAppOrigin, symbol),
    [nadoAppOrigin, symbol],
  )
  const [nadoFailed, setNadoFailed] = useState(false)
  useEffect(() => {
    setNadoFailed(false)
  }, [nadoUrl, symbol])

  const fb = <TokenAvatarFallback seed={seed ?? symbol} symbol={symbol} size={size} />
  const cls = `shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`.trim()

  if (nadoUrl && !nadoFailed) {
    return (
      <img
        src={nadoUrl}
        alt=""
        width={size}
        height={size}
        className={cls}
        style={{ width: size, height: size }}
        onError={() => setNadoFailed(true)}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return fb
}
