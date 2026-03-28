import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { fmt, tradeSideClass } from '../../lib/portfolioAdapters.js'

/** Plot height in SVG user units; width follows container (ResizeObserver). */
const CHART_H = 168
const PAD = { t: 12, r: 14, b: 30, l: 54 }
/** Estimated tooltip box (width fixed; height conservative for clamping). */
const TIP = { w: 216, h: 168, gap: 12 }

function axisLabel(v) {
  const s = fmt.signedCurrency(v)
  return s.length > 12 ? `$${fmt.compact(v)}` : s
}

function formatDateTime(ms) {
  if (ms == null) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(ms) {
  if (ms == null) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function nearestPointIndex(pts, x) {
  if (!pts?.length) return 0
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < pts.length; i += 1) {
    const d = Math.abs(pts[i].x - x)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/** Fixed viewport position: near cursor, flip when close to edges. */
function tooltipFixedPosition(clientX, clientY) {
  const pad = 8
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  let left = clientX + TIP.gap
  let top = clientY + TIP.gap
  if (left + TIP.w > vw - pad) left = clientX - TIP.w - TIP.gap
  if (top + TIP.h > vh - pad) top = clientY - TIP.h - TIP.gap
  left = clamp(left, pad, vw - TIP.w - pad)
  top = clamp(top, pad, vh - TIP.h - pad)
  return { left, top }
}

function PnlTooltipBody({ row }) {
  if (!row) return null
  return (
    <>
      <div className="border-b border-white/[0.1] pb-2 text-[11px] font-medium leading-snug text-slate-100">
        {formatDateTime(row.time)}
      </div>
      <dl className="mt-2 space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Cumulative</dt>
          <dd
            className={`text-right font-mono tabular-nums ${
              row.cumulative >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {fmt.signedCurrency(row.cumulative)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">This fill</dt>
          <dd
            className={`text-right font-mono tabular-nums ${
              (row.fillPnl ?? 0) >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
            }`}
          >
            {fmt.signedCurrency(row.fillPnl ?? 0)}
          </dd>
        </div>
        {row.market ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">Market</dt>
            <dd className="max-w-[120px] truncate text-right font-medium text-slate-200">
              {row.market}
            </dd>
          </div>
        ) : null}
        {row.side ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">Side</dt>
            <dd className={`text-right ${tradeSideClass(row.side)}`}>{row.side}</dd>
          </div>
        ) : null}
      </dl>
      {row.fillCount != null && row.fillIndex != null ? (
        <div className="mt-2 border-t border-white/[0.08] pt-2 text-[10px] text-slate-500">
          Fill {row.fillIndex} of {row.fillCount}
        </div>
      ) : null}
    </>
  )
}

export default function PnlCurveChart({ series, isLoading }) {
  const uid = useId().replace(/:/g, '')
  const fillGradId = `pnl-fill-${uid}`
  const lineGradId = `pnl-line-${uid}`
  const glowId = `pnl-glow-${uid}`

  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(360)
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tipClient, setTipClient] = useState(null)

  const resize = useCallback(() => {
    if (containerRef.current) {
      setWidth(Math.max(220, containerRef.current.getBoundingClientRect().width))
    }
  }, [])

  useLayoutEffect(() => {
    resize()
  }, [resize])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resize])

  const geom = useMemo(() => {
    if (!series?.length) return null
    const n = series.length
    const vs = series.map((p) => p.cumulative)
    let vmin = Math.min(...vs, 0)
    let vmax = Math.max(...vs, 0)
    if (Math.abs(vmax - vmin) < 1e-12) {
      vmin -= 1
      vmax += 1
    }
    const plotW = width - PAD.l - PAD.r
    const plotH = CHART_H - PAD.t - PAD.b
    const yAt = (v) => PAD.t + ((vmax - v) / (vmax - vmin)) * plotH
    const t0 = series[0]?.time
    const t1 = series[n - 1]?.time
    const xAt = (i) => {
      if (n === 1) return PAD.l + plotW / 2
      if (t0 != null && t1 != null && t1 !== t0) {
        const ti = series[i]?.time
        const ratio =
          ti != null ? (ti - t0) / (t1 - t0) : i / (n - 1)
        return PAD.l + Math.max(0, Math.min(1, ratio)) * plotW
      }
      return PAD.l + (i / (n - 1)) * plotW
    }
    const pts = series.map((_, i) => ({ x: xAt(i), y: yAt(series[i].cumulative) }))
    const lineD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ')
    const last = pts[n - 1]
    const bottom = PAD.t + plotH
    const areaD = `${lineD} L ${last.x.toFixed(2)} ${bottom} L ${pts[0].x.toFixed(2)} ${bottom} Z`
    const zeroInRange = vmin <= 0 && vmax >= 0
    const y0 = zeroInRange ? yAt(0) : null
    const midV = (vmin + vmax) / 2
    const yMid = yAt(midV)
    return {
      pts,
      lineD,
      areaD,
      last,
      y0,
      yMid,
      zeroInRange,
      vmin,
      vmax,
      midV,
      plotW,
      plotH,
      t0,
      t1,
    }
  }, [series, width])

  const positive = series?.length
    ? series[series.length - 1].cumulative >= 0
    : true
  const strokeA = positive ? 'rgb(52, 211, 153)' : 'rgb(251, 113, 133)'
  const strokeB = positive ? 'rgb(16, 185, 129)' : 'rgb(244, 63, 94)'
  const fillTop = positive ? 'rgba(52, 211, 153, 0.28)' : 'rgba(251, 113, 133, 0.24)'
  const fillBot = positive ? 'rgba(52, 211, 153, 0.02)' : 'rgba(251, 113, 133, 0.02)'

  const handleOverlayMove = useCallback(
    (e) => {
      if (!geom) return
      const svg = svgRef.current
      if (!svg) return
      const r = svg.getBoundingClientRect()
      const scaleX = width / r.width
      const x = (e.clientX - r.left) * scaleX
      if (x < PAD.l - 4 || x > width - PAD.r + 4) {
        setHoverIdx(null)
        setTipClient(null)
        return
      }
      const cx = clamp(x, PAD.l, width - PAD.r)
      setHoverIdx(nearestPointIndex(geom.pts, cx))
      setTipClient({ x: e.clientX, y: e.clientY })
    },
    [geom, width],
  )

  const handleOverlayLeave = useCallback(() => {
    setHoverIdx(null)
    setTipClient(null)
  }, [])

  const hoverPoint = hoverIdx != null && geom ? geom.pts[hoverIdx] : null
  const hoverRow = hoverIdx != null ? series[hoverIdx] : null

  const tipStyle = useMemo(() => {
    if (!tipClient) return null
    return tooltipFixedPosition(tipClient.x, tipClient.y)
  }, [tipClient])

  const tooltipPortal =
    tipStyle &&
    hoverRow &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="pointer-events-none fixed z-[200] w-[216px] rounded-xl border border-white/[0.14] bg-[rgba(9,11,26,0.96)] px-3 py-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] backdrop-blur-md"
        style={{ left: tipStyle.left, top: tipStyle.top }}
        role="tooltip"
      >
        <PnlTooltipBody row={hoverRow} />
      </div>,
      document.body,
    )

  if (isLoading) {
    return (
      <div
        className="flex w-full min-w-0 flex-col items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-white/[0.04] to-transparent px-4"
        style={{ minHeight: CHART_H }}
        aria-busy="true"
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-violet-500/20 ring-2 ring-violet-400/20" />
        <p className="text-xs text-slate-500">Loading PnL curve…</p>
      </div>
    )
  }

  if (!geom) {
    return (
      <div
        className="flex w-full min-w-0 items-center justify-center rounded-lg bg-gradient-to-b from-white/[0.03] to-transparent px-4 text-center text-xs leading-relaxed text-slate-500"
        style={{ minHeight: CHART_H }}
      >
        No fills with realized PnL yet — the curve appears after trades on Nado.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {tooltipPortal}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${Math.max(1, width)} ${CHART_H}`}
        width="100%"
        className="block h-auto w-full max-w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cumulative realized profit and loss from recent fills; hover for details"
      >
        <defs>
          <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="55%" stopColor={fillBot} />
            <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
          </linearGradient>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={strokeB} stopOpacity="0.85" />
            <stop offset="50%" stopColor={strokeA} stopOpacity="1" />
            <stop offset="100%" stopColor={strokeB} stopOpacity="0.9" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={PAD.l}
            y1={PAD.t + r * geom.plotH}
            x2={width - PAD.r}
            y2={PAD.t + r * geom.plotH}
            stroke="rgba(148,163,184,0.07)"
            strokeWidth="1"
          />
        ))}

        <text
          x={6}
          y={PAD.t + 11}
          fill="rgb(148, 163, 184)"
          style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
        >
          {axisLabel(geom.vmax)}
        </text>
        <text
          x={6}
          y={PAD.t + geom.plotH / 2 + 4}
          fill="rgb(100, 116, 139)"
          style={{ fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
        >
          {axisLabel(geom.midV)}
        </text>
        <text
          x={6}
          y={PAD.t + geom.plotH}
          fill="rgb(148, 163, 184)"
          style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
        >
          {axisLabel(geom.vmin)}
        </text>

        <text
          x={PAD.l}
          y={CHART_H - 8}
          fill="rgb(100, 116, 139)"
          style={{ fontSize: 9 }}
        >
          {formatDateShort(geom.t0)}
        </text>
        <text
          x={width - PAD.r}
          y={CHART_H - 8}
          textAnchor="end"
          fill="rgb(100, 116, 139)"
          style={{ fontSize: 9 }}
        >
          {formatDateShort(geom.t1)}
        </text>

        {geom.zeroInRange && geom.y0 != null ? (
          <line
            x1={PAD.l}
            y1={geom.y0}
            x2={width - PAD.r}
            y2={geom.y0}
            stroke="rgba(251, 191, 36, 0.25)"
            strokeDasharray="5 4"
          />
        ) : null}

        <path d={geom.areaD} fill={`url(#${fillGradId})`} />
        <path
          d={geom.lineD}
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {hoverPoint ? (
          <>
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r="11"
              fill="rgba(139, 92, 246, 0.14)"
            />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r="5"
              fill="rgb(15, 23, 42)"
              stroke={strokeA}
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <circle cx={geom.last.x} cy={geom.last.y} r="4.5" fill={strokeA} />
            <circle
              cx={geom.last.x}
              cy={geom.last.y}
              r="11"
              fill={strokeA}
              fillOpacity="0.12"
            />
          </>
        )}

        <rect
          x={PAD.l}
          y={PAD.t}
          width={geom.plotW}
          height={geom.plotH}
          fill="transparent"
          className="cursor-default"
          onMouseMove={handleOverlayMove}
          onMouseLeave={handleOverlayLeave}
        />
      </svg>
    </div>
  )
}
