import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, BarChart3, Bolt, BookOpen, Brain, CandlestickChart, ChevronRight,
  Clock3, ExternalLink, Keyboard, LayoutGrid, MessageCircle, Percent,
  Target, TrendingUp, Users, Wallet, Zap,
} from 'lucide-react'
import SolidBlock from '../components/SolidBlock'
import ElectricButton from '../components/ElectricButton'
import LiveBtcChart from '../components/LiveBtcChart'
import logo from '../assets/thornado-hammer.png'
import nadoLogo from '../assets/nado-logo.png'
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

const aiTrendMessagesFallback = [
  { text: 'Bullish above 108,200. Watch for retest of support.', tag: 'bias' },
  { text: 'Momentum building. Consider scaling in on pullbacks.', tag: 'plan' },
  { text: 'Volatility compressing — expansion likely next session.', tag: 'risk' },
]

function getBotTagColor(tag) {
  switch (tag) {
    case 'risk':
      return 'text-rose-700 font-medium'
    case 'bias':
      return 'text-sky-400'
    case 'plan':
      return 'text-amber-400'
    case 'target':
      return 'text-emerald-400'
    default:
      return 'text-sky-400/70'
  }
}

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
  const [botMessages, setBotMessages] = useState([])

  const handleBotMessage = useCallback((msg) => {
    setBotMessages(prev => [{ ...msg, id: Date.now() }, ...prev].slice(0, 3))
  }, [])

  const messagesToShow = botMessages.length > 0 ? botMessages : aiTrendMessagesFallback
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
        <motion.section
          className="grid grid-cols-1 gap-8 pt-10 lg:grid-cols-2 lg:pt-14 items-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Left: copy */}
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <SectionLabel icon={Zap}>Trading Terminal for DEX Nado</SectionLabel>
              <a
                href="https://thornado.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/5 px-3 py-1.5 text-[11px] font-medium text-sky-300 hover:border-sky-400/50 hover:bg-sky-400/10 transition-colors"
              >
                thornado.xyz
              </a>
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-[4.5rem]">
              Trade the storm<br />with
              <span className="bg-gradient-to-r from-sky-200 via-white to-violet-300 bg-clip-text text-transparent">
                {' '}AI precision.
              </span>
            </h1>

            <p className="mt-5 max-w-[540px] text-base leading-7 text-slate-400">
              Professional-grade, web-based trading terminal for Nado DEX — deeper market
              visibility, advanced analytics, and productivity-first execution.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ElectricButton primary onClick={onLaunch} className="h-12 px-7 text-sm font-semibold">
                Launch Terminal
              </ElectricButton>
              <ElectricButton className="h-12 px-7 text-sm font-medium">
                View demo
              </ElectricButton>
              <span
                className="inline-flex h-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-7 text-sm font-medium text-emerald-300"
                aria-label="Free during MVP"
              >
                Free during MVP
              </span>
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

          {/* Right: SOMETOKEN-USDT live chart + AI trend chat */}
          <div className="hidden lg:block">
            <SolidBlock className="flex flex-col p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-400/60">
                SOMETOKEN-USDT
              </div>
              <div className="mt-2 w-full min-w-0 flex-1">
                <LiveBtcChart onBotMessage={handleBotMessage} />
              </div>
              <div className="mt-4 border-t border-sky-400/12 pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-sky-400/30 bg-sky-400/10">
                    <Brain className="h-3 w-3 text-sky-300" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-sky-400/60">
                    AI trend
                  </span>
                </div>
                <div className="space-y-2 rounded-lg border border-sky-400/10 bg-[#0d1a2e]/80 p-2.5">
                  {messagesToShow.map((msg, i) => (
                    <div
                      key={msg.id ?? i}
                      className="flex gap-2 text-left text-xs leading-snug"
                    >
                      <span className={`shrink-0 font-mono ${getBotTagColor(msg.tag)}`}>
                        [{msg.tag}]
                      </span>
                      <span className="text-slate-300">{msg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SolidBlock>
          </div>
        </motion.section>

        {/* ════ CORE VALUE PROPOSITIONS (from roadmap) ════ */}
        <motion.section
          className="mt-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <SectionLabel icon={Target}>Core value propositions</SectionLabel>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: BarChart3, title: 'Advanced Analytics', text: 'Standard + custom indicators (RSI, Bollinger Bands, MACD, EMA) with ML-assisted trend signals.' },
              { icon: CandlestickChart, title: 'Market Intelligence', text: 'Live order books, top-account tracking, funding-rate monitoring, and volatility context.' },
              { icon: Users, title: 'Copy Trading', text: 'Leaderboard of consistently profitable traders with transparent stats and follower controls.' },
              { icon: Keyboard, title: 'Trading UX', text: 'Hotkeys, order presets, and a configurable layout optimized for speed.' },
            ].map((item) => (
              <SolidBlock key={item.title} className="p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/10">
                  <item.icon className="h-4 w-4 text-sky-300" />
                </div>
                <div className="mt-4 text-base font-semibold tracking-tight text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </SolidBlock>
            ))}
          </div>

          {/* Market data collection engine — flow from Nado to 5 data types */}
          <motion.div
            className="mt-10"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4 }}
          >
            <SolidBlock className="overflow-visible p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-sky-400/80">
                  Market data collection engine
                </span>
              </div>
              <p className="mb-6 text-sm text-slate-400">
                High-frequency aggregation from Nado DEX — real-time and historical, normalized for the terminal.
              </p>
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-4">
                <div className="flex shrink-0 items-center gap-3 rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3">
                  <img src={nadoLogo} alt="" className="h-8 w-8 object-contain opacity-90" />
                  <span className="font-semibold text-white">Nado DEX</span>
                </div>
                <div className="flex shrink-0 items-center text-sky-400/50">
                  <span className="hidden h-px w-8 bg-gradient-to-r from-sky-400/40 to-transparent md:block" />
                  <ChevronRight className="h-6 w-6 md:mx-1" />
                  <span className="hidden h-px w-8 flex-1 bg-gradient-to-l from-sky-400/40 to-transparent md:block" />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    [Activity, 'Market state', 'Price, volatility, conditions'],
                    [BarChart3, 'Indicators', 'Built-in + custom formulas'],
                    [BookOpen, 'Order books', 'Level-2 depth, bids/asks'],
                    [Users, 'Trader accounts', 'Top performers, positions'],
                    [Percent, 'Funding rates', 'Real-time and history'],
                  ].map(([Icon, title, desc]) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 rounded-xl border border-sky-400/15 bg-[#0d1a2e] px-4 py-3.5 transition-colors hover:border-sky-400/30"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-sky-400" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{title}</div>
                        <div className="text-xs text-slate-500">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SolidBlock>
          </motion.div>
        </motion.section>

        {/* ════ AI AT A GLANCE ════ */}
        <motion.section
          className="mt-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <SectionLabel icon={Brain}>AI at a glance</SectionLabel>
          <p className="mt-2 max-w-[520px] text-sm text-slate-400">
            Sample insights the terminal can surface — momentum, risk context, and execution ideas.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {aiCards.map((card) => (
              <SolidBlock key={card.title} className="p-5">
                <span className="inline-block rounded-lg border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sky-300">
                  {card.tag}
                </span>
                <div className="mt-3 text-base font-semibold tracking-tight text-white">
                  {card.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {card.text}
                </p>
              </SolidBlock>
            ))}
          </div>

          {/* Chat thread: user message + THOR AI reply (appear on scroll with delay) */}
          <div className="mt-14 flex justify-center">
            <SolidBlock className="w-full max-w-4xl p-7">
              <div className="mb-5 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-sky-400" />
                <span className="text-sm font-medium uppercase tracking-wider text-sky-400/80">
                  Try THOR AI
                </span>
              </div>
              <div className="space-y-6">
                <motion.div
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-600/80 text-sm font-medium text-slate-300">
                    You
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-slate-500/30 bg-slate-700/40 px-5 py-3.5">
                    <p className="text-base text-slate-200">
                      Can you help with entries and risk?
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10">
                    <Brain className="h-5 w-5 text-sky-300" />
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-sky-400/25 bg-sky-400/10 px-5 py-3.5">
                    <p className="text-sm font-medium text-sky-200/90">THOR AI</p>
                    <p className="mt-1 text-base leading-6 text-slate-200">
                      Yes. I can highlight momentum shifts, suggest levels, and flag risk. Launch the terminal and ask me anything — I’ll keep it short and actionable.
                    </p>
                  </div>
                </motion.div>
              </div>
            </SolidBlock>
          </div>
        </motion.section>

        {/* ════ VISION & GOALS ════ */}
        <motion.section
          className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <SolidBlock className="p-6">
            <SectionLabel icon={Bolt}>Vision</SectionLabel>
            <p className="mt-4 text-lg leading-7 text-slate-200">
              Thornado upgrades the core trading experience with deeper market visibility,
              advanced analytics, and productivity-first execution tooling.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-400">
              {[
                'Increase trader effectiveness with real-time intelligence and decision support.',
                'Reduce friction in execution with a fast, configurable terminal UX.',
                'Enable social alpha via copy trading and transparent performance analytics.',
                'Build a scalable foundation for low-latency data and microservice APIs.',
              ].map((goal) => (
                <li key={goal} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  {goal}
                </li>
              ))}
            </ul>
          </SolidBlock>
          <SolidBlock className="p-6">
            <SectionLabel icon={LayoutGrid}>What&apos;s coming</SectionLabel>
            <p className="mt-2 text-sm text-slate-400">
              User-facing features we&apos;re building next.
            </p>
            <div className="mt-4 space-y-3">
              {[
                [CandlestickChart, 'TradingView charts', 'Pro charts with custom overlays and indicators.'],
                [Users, 'Copy trading', 'Follow top performers with transparent stats and risk controls.'],
                [Brain, 'ML signals', 'Trend and confidence signals powered by the analysis engine.'],
                [Keyboard, 'Hotkeys & presets', 'Fast execution with shortcuts and order presets.'],
              ].map(([Icon, name, desc]) => (
                <div
                  key={name}
                  className="flex items-start gap-4 rounded-xl border border-sky-400/12 bg-[#0d1a2e] px-4 py-3 hover:border-sky-400/25 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-400/25 bg-sky-400/10">
                    <Icon className="h-4 w-4 text-sky-300" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{name}</div>
                    <div className="text-[11px] text-slate-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </SolidBlock>
        </motion.section>

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

          {/* Right: Designed for speed */}
          <SolidBlock className="p-6">
            <SectionLabel icon={Keyboard}>Designed for speed</SectionLabel>
            <div className="mt-4 text-lg font-semibold tracking-tight text-white">
              Hotkeys and presets
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Place, cancel, and flip orders without leaving the chart. Power users get the edge.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ['Place', 'Enter'],
                ['Cancel', 'Esc'],
                ['Flip side', 'F'],
                ['ADD HOTKEYS HERE, PLS', 'P'],
              ].map(([label, key]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-sky-400/20 bg-[#0d1a2e] px-3 py-2 font-mono text-xs"
                >
                  <span className="text-slate-400">{label}</span>
                  <kbd className="rounded border border-slate-500/50 bg-slate-800/80 px-1.5 py-0.5 text-sky-300">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </SolidBlock>

        </section>

        {/* ════ BUILT FOR NADO + COMMUNITY ════ */}
        <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SolidBlock className="p-6 overflow-hidden">
            <SectionLabel icon={Zap}>Built for Nado</SectionLabel>
            <div className="mt-5 flex flex-col gap-5">
              <div className="relative flex items-center gap-5 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-cyan-400/5 p-4 transition-colors hover:border-transparent">
                <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(56,189,248,0.08),transparent)] pointer-events-none" />
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 p-2.5 shadow-[0_0_20px_rgba(56,189,248,0.12)] transition-colors hover:border-transparent">
                <img 
                    src={nadoLogo} 
                    alt="Nado" 
                    className="h-full w-full object-contain" 
                    style={{ 
                      transform: 'scale(2)',
                      borderRadius: '8px'  // или любое другое значение
                    }} 
                  />
                  </div>
                <div className="relative min-w-0">
                  <div className="text-xl font-semibold tracking-tight text-white">
                    Native to Nado DEX
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Thornado is built for the Nado ecosystem — fast execution and full compatibility.
                  </p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {[
                  ['Full DEX compatibility', 'Direct integration with Nado order book and execution'],
                  ['Low latency', 'Optimized for speed and real-time data'],
                  ['Real-time data', 'Live prices, order flow and funding rates from Nado'],
                  ['Non-custodial', 'Your keys, your funds — connect wallet and trade directly'],
                ].map(([title, desc]) => (
                  <li
                    key={title}
                    className="flex items-start gap-3 rounded-xl border border-sky-400/12 bg-[#0d1a2e] px-3 py-2.5 transition-colors hover:border-transparent"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    <div>
                      <span className="text-sm font-medium text-white">{title}</span>
                      <span className="block text-[11px] text-slate-500">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href="https://nado.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex w-fit items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-400/10 px-5 py-3 text-sm font-medium text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.1)] transition-all hover:border-transparent hover:bg-sky-400/15 hover:shadow-[0_0_24px_rgba(56,189,248,0.18)]"
              >
                nado.xyz
                <ExternalLink className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </SolidBlock>
          <SolidBlock className="p-6">
            <SectionLabel icon={MessageCircle}>Join the community</SectionLabel>
            <div className="mt-4 text-lg font-semibold tracking-tight text-white">
              Get help and share feedback
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Connect with other traders and the Thornado team. Updates, support, and early access.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-300 hover:bg-sky-400/15 transition-colors"
              >
                Telegram
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-300 hover:bg-sky-400/15 transition-colors"
              >
                Discord
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </SolidBlock>
        </section>

        {/* ════ FINAL CTA ════ */}
        <motion.section
          className="mt-16"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <div
            className="relative overflow-hidden rounded-[20px] px-8 py-12 text-center md:px-12"
            style={{
              background: 'linear-gradient(180deg, rgba(56,189,248,0.06) 0%, rgba(56,189,248,0.1) 50%, rgba(56,189,248,0.06) 100%)',
              border: '1px solid rgba(56,189,248,0.22)',
              boxShadow: '0 0 0 0 transparent, inset 0 1px 0 rgba(125,211,252,0.08)',
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/25 to-transparent" />
            <h2 className="relative text-2xl font-bold tracking-tight text-white md:text-3xl">
              Start trading on Nado — free during MVP
            </h2>
            <p className="relative mt-2 text-sm text-slate-400">
              Launch the terminal and get deeper market visibility with no commitment.
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
              <ElectricButton primary onClick={onLaunch} className="h-12 px-8 text-sm font-semibold">
                Launch Terminal
              </ElectricButton>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                Free during MVP
              </span>
            </div>
          </div>
        </motion.section>

        {/* ════ FOOTER ════ */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-sky-400/15 pt-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-8 w-8 object-contain opacity-90" style={{ filter: 'invert(1)', transform: 'scale(1.5)' }} />
            <span className="text-sm text-slate-400">
              Thornado — Trading Terminal for DEX Nado
            </span>
          </div>
          <a
            href="https://thornado.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-sky-300 hover:text-sky-200 transition-colors"
          >
            thornado.xyz
          </a>
          <span className="text-[11px] uppercase tracking-widest text-slate-500">
            THORnado v1.0
          </span>
        </footer>
      </div>
    </div>
  )
}
