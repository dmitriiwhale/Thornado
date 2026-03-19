import { useCallback, useEffect, useRef, useState } from 'react'

const POINTS = 50
const TICK_MS = 1100
const BASE = 108
const VOLATILITY_NORMAL = 0.06
const VOLATILITY_BURST = 0.2
const BURST_PROB = 0.25
const HISTORY_SIZE = 6
const PREDICTION_INTERVAL_TICKS = 14
const TARGET_STEP = 0.035
const TARGET_CLOSE = 0.015

function generateSeed() {
  const arr = []
  let v = BASE
  for (let i = 0; i < POINTS; i++) {
    arr.push(v)
    v += (Math.random() - 0.48) * 0.4
  }
  return arr
}

function formatTime() {
  const d = new Date()
  return d.toTimeString().slice(0, 8)
}

function generateInitialPriceHistory() {
  const now = Date.now()
  const basePrice = (BASE + (Math.random() - 0.5) * 0.3) * 1000
  const entries = []
  let price = basePrice
  for (let i = 0; i < HISTORY_SIZE; i++) {
    const changePct = (Math.random() - 0.5) * 0.15
    const prevPrice = price
    price = prevPrice * (1 + changePct / 100)
    const up = changePct >= 0
    const t = new Date(now - (HISTORY_SIZE - 1 - i) * 1100)
    entries.push({
      price: Math.round(price),
      changePct,
      up,
      time: t.toTimeString().slice(0, 8),
    })
  }
  return entries.reverse()
}

export default function LiveBtcChart({ onBotMessage }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(400)
  const [points, setPoints] = useState(generateSeed)
  const [priceHistory, setPriceHistory] = useState(generateInitialPriceHistory)
  const [prediction, setPrediction] = useState(null)
  const predictionRef = useRef(null)
  const pointsRef = useRef(points)
  const tickCountRef = useRef(0)

  const resize = useCallback(() => {
    if (containerRef.current)
      setWidth(containerRef.current.getBoundingClientRect().width)
  })

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [resize])

  useEffect(() => {
    pointsRef.current = points
  }, [points])

  useEffect(() => {
    predictionRef.current = prediction
  }, [prediction])

  useEffect(() => {
    const id = setInterval(() => {
      const current = pointsRef.current
      const pred = predictionRef.current
      if (current.length !== POINTS) return
      const prev = current[current.length - 1]
      tickCountRef.current += 1
      const ticks = tickCountRef.current

      const volatility = Math.random() < BURST_PROB ? VOLATILITY_BURST : VOLATILITY_NORMAL
      let next

      if (pred !== null) {
        const target = pred.target
        const dist = Math.abs(target - prev)
        if (dist <= TARGET_CLOSE) {
          setPrediction(null)
          next = prev + (Math.random() - 0.5) * volatility
        } else {
          const step = TARGET_STEP * Math.sign(target - prev)
          next = prev + step + (Math.random() - 0.5) * volatility * 0.5
        }
      } else {
        next = prev + (Math.random() - 0.5) * volatility
      }

      if (pred === null && ticks % PREDICTION_INTERVAL_TICKS === 0 && ticks > 0) {
        const target = prev + (Math.random() - 0.5) * 0.5
        const targetPrice = Math.round(target * 1000)
        const up = target >= prev
        const msg = {
          target,
          text: `Target $${targetPrice.toLocaleString()} — ${up ? 'bias up' : 'bias down'}.`,
          tag: 'target',
        }
        setPrediction(msg)
        onBotMessage?.({ text: msg.text, tag: msg.tag })
      }

      const nextPoints = [...current.slice(1), next]

      const prevPriceUsd = prev * 1000
      const nextPriceUsd = next * 1000
      const changePct = prevPriceUsd !== 0
        ? ((nextPriceUsd - prevPriceUsd) / prevPriceUsd) * 100
        : 0
      const up = next >= prev

      setPoints(nextPoints)
      setPriceHistory(h => {
        const entry = {
          price: nextPriceUsd,
          changePct,
          up,
          time: formatTime(),
        }
        return [entry, ...h].slice(0, HISTORY_SIZE)
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [onBotMessage])

  const CHART_HEIGHT = 120
  const padY = 14
  const chartHeight = CHART_HEIGHT - 2 * padY
  const minY = Math.min(...points)
  const maxY = Math.max(...points)
  const range = Math.max(maxY - minY, 0.3)
  const mid = (minY + maxY) / 2
  const scaleY = chartHeight / range
  const baseY = CHART_HEIGHT / 2
  const rightMargin = Math.max(28, width * 0.08)
  const chartWidth = width - rightMargin

  const pathD = points
    .map((v, i) => {
      const x = (i / (POINTS - 1)) * chartWidth
      const y = baseY - (v - mid) * scaleY
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  const areaD = `${pathD} L ${chartWidth} ${baseY} L 0 ${baseY} Z`
  const lastPrice = points[points.length - 1]
  const lastX = chartWidth
  const lastY = baseY - (lastPrice - mid) * scaleY
  const displayPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(lastPrice * 1000)

  let targetLine = null
  if (prediction !== null) {
    const targetY = baseY - (prediction.target - mid) * scaleY
    if (targetY >= padY && targetY <= CHART_HEIGHT - padY) {
      targetLine = (
        <line
          x1={0}
          y1={targetY}
          x2={chartWidth}
          y2={targetY}
          stroke="rgba(34,197,94,0.6)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      )
    }
  }

  return (
    <div ref={containerRef} className="relative w-full rounded-xl">
      <div className="flex items-baseline justify-between">
        <span className="text-[18px] font-medium text-white">SOMETOKEN-USDT</span>
        <span className="font-mono text-[20px] tabular-nums text-violet-100">
          {displayPrice}
        </span>
      </div>
      <div
        className="relative mt-1 overflow-hidden rounded-lg"
        style={{ height: CHART_HEIGHT }}
      >
        <svg width={width} height={CHART_HEIGHT} className="block">
          <defs>
            <linearGradient id="liveLineGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(168,85,247,0.32)" />
              <stop offset="50%" stopColor="rgba(196,181,253,0.95)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0.7)" />
            </linearGradient>
            <linearGradient id="liveAreaGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.26)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#liveAreaGlow)" />
          {targetLine}
          <path
            d={pathD}
            fill="none"
            stroke="url(#liveLineGlow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={lastX} cy={lastY} r="4" fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>

      <div className="mt-3 border-t border-white/10 pt-2">
        <div className="mb-1.5 text-[14px] font-medium uppercase tracking-wider text-violet-200/60">
          Price history
        </div>
        <div className="space-y-1">
          {priceHistory.length === 0 ? (
            <div className="font-mono text-[15px] text-slate-500">
              — waiting for updates
            </div>
          ) : (
            priceHistory.map((entry, i) => (
              <div
                key={`${entry.time}-${i}`}
                className="flex items-center justify-between font-mono text-[15px]"
              >
                <span className="text-slate-500 tabular-nums">{entry.time}</span>
                <span className="text-slate-300 tabular-nums">
                  {entry.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span
                  className={`tabular-nums ${
                    entry.up
                      ? 'text-[#38ffb3] drop-shadow-[0_0_10px_rgba(56,255,179,0.48)]'
                      : 'text-[#ff5c7a] drop-shadow-[0_0_10px_rgba(255,92,122,0.42)]'
                  }`}
                >
                  {entry.up ? '+' : ''}
                  {entry.changePct.toFixed(2)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
