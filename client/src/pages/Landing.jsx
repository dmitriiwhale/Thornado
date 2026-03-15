import { motion } from 'framer-motion'
import {
  Activity, Bolt, Brain, CandlestickChart, ChevronRight,
  Clock3, LayoutGrid, Search, Shield, Sparkles, TrendingUp,
  Wallet, Zap,
} from 'lucide-react'
import SolidBlock from '../components/SolidBlock'
import ElectricButton from '../components/ElectricButton'
import TinyChart from '../components/TinyChart'
import logo from '../assets/thornado-hammer.png'

const stats = [
  { label: 'Latency',        value: '12ms'   },
  { label: 'AI Confidence',  value: '91%'    },
  { label: 'Active Markets', value: '128'    },
  { label: 'Risk Envelope',  value: 'Stable' },
]

const watchlist = [
  { pair: 'BTC-USD', price: '$108,442', change: '+2.81%', up: true  },
  { pair: 'ETH-USD', price: '$4,182',   change: '+1.42%', up: true  },
  { pair: 'SOL-USD', price: '$242',     change: '-0.38%', up: false },
  { pair: 'NVDA',    price: '$184.22',  change: '+0.91%', up: true  },
  { pair: 'GOLD',    price: '$2,944',   change: '+0.18%', up: true  },
]

const aiCards = [
  {
    title: 'Momentum setup detected',
    text: 'Liquidity sweep above local highs. Retest probability increased. Wait for reclaim and enter on confirmation.',
    tag: 'Bullish bias',
  },
  {
    title: 'Risk compression',
    text: 'Volatility corridor narrowing into key macro level. Reduce size until expansion confirms direction.',
    tag: 'Risk note',
  },
  {
    title: 'Execution idea',
    text: 'Scale in with 3 staged bids. Invalidates under the prior structure shelf. RR profile remains acceptable.',
    tag: 'Plan ready',
  },
]

// ─── Shared small components ──────────────────────────────────────────────────
function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-1.5 text-xs font-medium text-sky-300">
      <Icon className="h-3.5 w-3.5 shrink-0 text-sky-400" />
      {children}
    </div>
  )
}

function ColLabel({ children }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-400/60">
      {children}
    </div>
  )
}

function ColTitle({ children }) {
  return (
    <div className="mt-1 text-lg font-semibold tracking-tight text-white">
      {children}
    </div>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────
export default function Landing({ onLaunch }) {
  return (
    <div className="w-full text-white">

      {/* ── Fixed background ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_20%,rgba(56,189,248,0.18),transparent),radial-gradient(ellipse_40%_40%_at_85%_15%,rgba(129,140,248,0.12),transparent),radial-gradient(ellipse_50%_40%_at_50%_85%,rgba(34,211,238,0.08),transparent)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(56,189,248,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.04)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute -left-20 top-20  h-96 w-96 rounded-full bg-sky-600/20  blur-[140px]" />
        <div className="absolute right-0  top-10  h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute left-1/2 bottom-0 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/8 blur-[110px]" />
      </div>

      {/* ── Page content ── */}
      <div className="relative mx-auto max-w-[1920px] px-6 pb-20 pt-6 md:px-10">

        {/* ════ HERO ════ */}
        <section className="grid grid-cols-1 gap-8 pt-10 lg:grid-cols-1 lg:pt-14 items-start">

          {/* Left: copy */}
          <div className="flex flex-col justify-center">
            <SectionLabel icon={Zap}>storm-powered execution</SectionLabel>

            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-[4.5rem]">
              Trade the storm<br />with
              <span className="bg-gradient-to-r from-sky-200 via-white to-violet-300 bg-clip-text text-transparent">
                {' '}AI precision.
              </span>
            </h1>

            <p className="mt-5 max-w-[520px] text-base leading-7 text-slate-400">
              THORNado is a high-voltage trading workspace built around real-time
              charting, decisive execution, and an embedded AI co-pilot.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ElectricButton primary onClick={onLaunch} className="h-12 px-7 text-sm font-semibold">
                Launch Terminal
              </ElectricButton>
              <ElectricButton className="h-12 px-7 text-sm font-medium">
                View demo
              </ElectricButton>
            </div>

            {/* Stats — equal 4-col grid, no wrapping */}
            <div className="mt-10 grid grid-cols-4 gap-3">
              {stats.map((item) => (
                <SolidBlock key={item.label} className="px-4 py-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-400/60 leading-none">
                    {item.label}
                  </div>
                  <div className="mt-2.5 font-mono text-2xl font-semibold tracking-tight text-white">
                    {item.value}
                  </div>
                </SolidBlock>
              ))}
            </div>
          </div>

 
        </section>

        {/* ════ FEATURES ════ */}
        <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Brain,            title: 'AI co-trader',       text: 'Embedded market reasoning with structured response cards and execution-aware insights.' },
            { icon: CandlestickChart, title: 'Signal overlays',    text: 'Luminous chart annotations for volatility corridors, structure shifts and momentum continuation.' },
            { icon: Shield,           title: 'Risk controls',      text: 'Execution zones feel forged and heavier, separating analysis from commitment.' },
            { icon: Sparkles,         title: 'Adaptive workspace', text: 'Drag-and-drop terminal widgets. Build your perfect layout and save it across sessions.' },
          ].map((item) => (
            <SolidBlock key={item.title} className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/10">
                <item.icon className="h-4 w-4 text-sky-300" />
              </div>
              <div className="mt-4 text-base font-semibold tracking-tight text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
            </SolidBlock>
          ))}
        </section>

        {/* ════ BRAND MOTIF ════ */}
        <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Left */}
          <SolidBlock className="p-6">
            <SectionLabel icon={TrendingUp}>brand motif</SectionLabel>
            <div className="mt-5 text-2xl font-semibold tracking-tight text-white">
              Lightning for insight.<br />Hammer for execution.
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              THORNado uses electric traces, fractured highlights and pulse-based
              transitions. Execution zones become denser, steadier and more decisive.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {[
                [Activity, 'Signal animation',  'Quick edge shimmer for incoming insights'],
                [Wallet,   'Execution weight',   'Stronger geometry for confirm states'],
                [Clock3,   'Time rhythm',        'Micro-motion keeps the UI alive without noise'],
              ].map(([Icon, title, text]) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl border border-sky-400/12 bg-[#0d1a2e] px-4 py-3 hover:border-sky-400/25 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-sky-300" />
                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="text-[11px] text-slate-500">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </SolidBlock>

          {/* Right */}
          <SolidBlock className="p-6">
            <div className="grid h-full grid-cols-2 gap-6 items-center">
              <div className="flex flex-col justify-center">
                <ColLabel>Logo direction</ColLabel>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Hammer icon as the core mark
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Your hammer artwork is wired into navigation and the logo area —
                  preview the identity in context right away.
                </p>
                <button className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-300 hover:bg-sky-400/15 transition-colors">
                  Ready for next iteration
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="rounded-2xl border border-sky-400/12 bg-[#0d1a2e] p-4">
                <div className="aspect-square rounded-xl border border-slate-700/40 bg-[#080e1a] p-4">
                  <div className="relative flex h-full items-center justify-center overflow-hidden rounded-lg border border-slate-300/25 bg-slate-100 p-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_65%)] pointer-events-none" />
                    <img
                      src={logo}
                      alt="THORNado hammer logo"
                      className="relative z-10 max-h-full max-w-full object-contain drop-shadow-xl"
                      style={{ transform: 'scale(3)', filter: 'invert(1)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </SolidBlock>

        </section>
      </div>
    </div>
  )
}
