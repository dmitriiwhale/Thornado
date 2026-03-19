import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Activity,
  BarChart3,
  Brain,
  Clock3,
  ExternalLink,
  MessageCircle,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import ElectricButton from '../components/ElectricButton'
import LiveBtcChart from '../components/LiveBtcChart'
import ScrollReveal from '../components/ScrollReveal'
import SplitTextScroll from '../components/SplitTextScroll'
import nadoLogo from '../assets/nado.png'

gsap.registerPlugin(ScrollTrigger)

const stats = [
  { label: 'Latency', value: '12ms' },
  { label: 'AI Confidence', value: '91%' },
  { label: 'Active Markets', value: '128' },
  { label: 'Risk Envelope', value: 'Stable' },
]

const watchlist = [
  { pair: 'BTC-USDT', price: '$108,442', change: '+2.81%', up: true },
  { pair: 'ETH-USDT', price: '$4,182', change: '+1.42%', up: true },
  { pair: 'SOL-USDT', price: '$242', change: '-0.38%', up: false },
]

const aiTrendMessagesFallback = [
  { text: 'Bullish above 108,200. Watch for retest of support.', tag: 'bias' },
  { text: 'Momentum building. Consider scaling in on pullbacks.', tag: 'plan' },
  { text: 'Volatility compressing. Expansion likely next session.', tag: 'risk' },
]

const valueRows = [
  {
    icon: BarChart3,
    title: 'Clarity before entry',
    text: 'Signals, structure and volatility context are aligned in one place, so decisions happen faster.',
  },
  {
    icon: Brain,
    title: 'AI that stays actionable',
    text: 'No noisy essays. You get concise prompts for setup, invalidation and next best action.',
  },
  {
    icon: Users,
    title: 'Team-grade workflow',
    text: 'Shared context and repeatable process make execution consistent across sessions.',
  },
]

const executionSteps = [
  {
    icon: Target,
    title: 'Find setup',
    text: 'Read structure, momentum and liquidity zones before taking risk.',
  },
  {
    icon: Activity,
    title: 'Validate risk',
    text: 'Lock invalidation and size first, then confirm execution conditions.',
  },
  {
    icon: Clock3,
    title: 'Execute clean',
    text: 'Enter by plan, manage by levels, and adjust without breaking process.',
  },
]

const nadoPoints = [
  'Native integration with Nado order flow and market data.',
  'Low-latency updates built for active intraday execution.',
  'Non-custodial flow: connect wallet and trade directly.',
  'A foundation for strategy testing and repeatable routines.',
]

const thorChatScenario = [
  {
    role: 'you',
    text: 'Can you help with entries and risk?',
  },
  {
    role: 'ai',
    text: 'Yes. I can flag setup quality, define invalidation, and suggest a risk-first execution path in plain language.',
  },
]

const footerTickerText =
  'Trading Terminal for DEX Nado // THORNADO // All Rights Reserved // thornado.xyz'
const footerTickerItems = Array.from({ length: 4 }, () => footerTickerText)

function getBotTagColor(tag) {
  switch (tag) {
    case 'risk':
      return 'text-rose-300'
    case 'bias':
      return 'text-violet-200'
    case 'plan':
      return 'text-amber-300'
    default:
      return 'text-violet-200/70'
  }
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="section-label inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-violet-200/85">
      <Icon className="h-3.5 w-3.5 shrink-0 text-violet-200" />
      {children}
    </div>
  )
}

export default function Landing({ onLaunch, scrollContainerRef }) {
  const [botMessages, setBotMessages] = useState([])
  const [thorStarted, setThorStarted] = useState(false)
  const [visibleThorCount, setVisibleThorCount] = useState(0)
  const whySectionRef = useRef(null)
  const thorPanelRef = useRef(null)

  const handleBotMessage = useCallback((msg) => {
    setBotMessages((prev) => [{ ...msg, id: Date.now() }, ...prev].slice(0, 3))
  }, [])
  const handleFakeContactNav = useCallback((event) => {
    event.preventDefault()
  }, [])

  const messagesToShow =
    botMessages.length > 0 ? botMessages : aiTrendMessagesFallback
  const visibleThorMessages = thorChatScenario.slice(0, visibleThorCount)
  const executionTitleAnimation = {
    scrollContainerRef,
    splitType: 'chars',
    delay: 16,
    duration: 1.05,
    threshold: 0,
    rootMargin: '0px',
    from: { opacity: 0, y: 24, filter: 'blur(6px)' },
    to: { opacity: 1, y: 0, filter: 'blur(0px)' },
  }
  const executionLineAnimation = {
    scrollContainerRef,
    splitType: 'words,chars',
    delay: 10,
    duration: 0.95,
    threshold: 0,
    rootMargin: '0px',
    from: { opacity: 0, y: 18, filter: 'blur(5px)' },
    to: { opacity: 1, y: 0, filter: 'blur(0px)' },
  }

  useEffect(() => {
    const sectionEl = whySectionRef.current
    if (!sectionEl) return undefined

    const scroller =
      scrollContainerRef?.current && scrollContainerRef.current !== window
        ? scrollContainerRef.current
        : window

    const rows = sectionEl.querySelectorAll('.value-row-card')
    if (!rows.length) return undefined

    const ctx = gsap.context(() => {
      rows.forEach((row) => {
        gsap.fromTo(
          row,
          {
            opacity: 0.18,
            y: 20,
            filter: 'blur(4px)',
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: {
              trigger: row,
              scroller,
              start: 'top bottom-=8%',
              end: 'top center+=18%',
              scrub: true,
            },
          },
        )
      })
    }, sectionEl)

    return () => ctx.revert()
  }, [scrollContainerRef])

  useEffect(() => {
    if (thorStarted) return undefined
    const panelEl = thorPanelRef.current
    if (!panelEl) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setThorStarted(true)
        observer.disconnect()
      },
      {
        threshold: 0.28,
        root: scrollContainerRef?.current ?? null,
      },
    )

    observer.observe(panelEl)
    return () => observer.disconnect()
  }, [scrollContainerRef, thorStarted])

  useEffect(() => {
    if (!thorStarted) return undefined
    setVisibleThorCount(0)

    const timers = thorChatScenario.map((_, index) =>
      setTimeout(() => {
        setVisibleThorCount(index + 1)
      }, index * 1200),
    )

    return () => timers.forEach((id) => clearTimeout(id))
  }, [thorStarted])

  return (
    <div className="landing-soft-copy w-full text-white">
      <div className="relative z-10 w-full px-6 pb-20 pt-6 md:px-10 lg:px-12">
        <motion.section
          className="grid min-h-[74vh] grid-cols-1 items-start gap-8 pt-10 lg:min-h-[78vh] lg:grid-cols-2 lg:pt-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex h-full flex-col justify-start lg:pr-8 lg:pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel icon={Zap}>Trading terminal for Nado DEX</SectionLabel>
            </div>

            <h1 className="hero-title mt-6 max-w-[800px] whitespace-pre-line text-violet-100">
              {'Trade the storm\nwith AI precision'}
            </h1>

            <p className="hero-lead mt-4 max-w-[560px] text-base leading-7 text-slate-300">
              Professional-grade, web-based trading terminal for Nado DEX - deeper
              market visibility, advanced analytics, and productivity-first execution.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ElectricButton
                primary
                onClick={onLaunch}
                className="h-12 px-7 text-sm font-semibold"
              >
                Launch Terminal
              </ElectricButton>
              <ElectricButton className="h-12 px-7 text-sm font-medium">
                View demo
              </ElectricButton>
              <span className="mvp-pill text-sm font-medium">
                Free during MVP
              </span>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-x-8 gap-y-5 pt-10 sm:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="hero-stat">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200/60">
                    {item.label}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-white">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="terminal-preview-shell">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-medium uppercase tracking-[0.16em] text-violet-200/60">
                    Live terminal preview
                  </div>
                </div>
                <div className="pillless inline-flex items-center gap-2 text-[14px] font-medium uppercase tracking-[0.15em] text-[#58ffc0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#58ffc0]" />
                  Live
                </div>
              </div>

              <div className="mt-3 w-full min-w-0">
                <LiveBtcChart onBotMessage={handleBotMessage} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-x-5">
                {watchlist.map((item) => (
                  <div key={item.pair} className="terminal-market-row">
                    <div className="text-[14px] font-medium uppercase tracking-[0.14em] text-violet-200/55">
                      {item.pair}
                    </div>
                    <div className="mt-1 text-[18px] font-semibold text-white">
                      {item.price}
                    </div>
                    <div
                      className={`text-[14px] font-semibold ${
                        item.up
                          ? 'text-[#38ffb3] drop-shadow-[0_0_10px_rgba(56,255,179,0.48)]'
                          : 'text-[#ff5c7a] drop-shadow-[0_0_10px_rgba(255,92,122,0.42)]'
                      }`}
                    >
                      {item.change}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[14px] font-medium uppercase tracking-[0.16em] text-violet-200/60">
                  AI trend snapshot
                </div>
                <div className="space-y-2">
                  {messagesToShow.map((msg, i) => (
                    <div key={msg.id ?? i} className="flex gap-2 text-[15px] leading-snug">
                      <span className="shrink-0 font-mono text-violet-100">
                        [{msg.tag}]
                      </span>
                      <span className="text-slate-300">{msg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          ref={whySectionRef}
          className="mt-20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <SectionLabel icon={Target}>Why traders switch</SectionLabel>
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <ScrollReveal
                scrollContainerRef={scrollContainerRef}
                enableBlur
                baseOpacity={0.16}
                baseRotation={3.2}
                blurStrength={6}
                rotationStart="top 92%"
                wordAnimationStart="top 86%"
                containerClassName="!my-0"
                textClassName="text-[clamp(1.95rem,3.8vw,2.35rem)] leading-tight font-semibold tracking-tight text-white"
                rotationEnd="bottom center"
                wordAnimationEnd="bottom center"
              >
                Read faster. Decide cleaner. Execute without friction.
              </ScrollReveal>
              <ScrollReveal
                as="div"
                scrollContainerRef={scrollContainerRef}
                enableBlur
                baseOpacity={0.08}
                baseRotation={2}
                blurStrength={4}
                rotationStart="top 90%"
                wordAnimationStart="top 84%"
                containerClassName="!my-0 mt-3 max-w-[62ch]"
                textClassName="text-base leading-8 text-slate-300 font-normal"
                rotationEnd="bottom center"
                wordAnimationEnd="bottom center"
              >
                Thornado is designed for focus. You keep context in one screen,
                get concise AI guidance, and move from signal to position with less
                hesitation and less interface noise.
              </ScrollReveal>
            </div>
            <div className="value-rows-column lg:col-span-5">
              {valueRows.map((item) => (
                <div key={item.title} className="marketing-row value-row-card">
                  <div className="flex h-full items-start gap-3">
                    <item.icon className="value-row-icon mt-0.5 h-[18px] w-[18px] shrink-0 text-violet-100" />
                    <div>
                      <div className="value-row-title text-sm font-semibold text-white">{item.title}</div>
                      <p className="value-row-text mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="mt-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <SectionLabel icon={TrendingUp}>Execution flow</SectionLabel>
          <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-6">
              <SplitTextScroll
                text="Simple flow from setup to execution"
                tag="h3"
                className="execution-section-title text-white"
                {...executionTitleAnimation}
              />
              <div className="execution-steps-list mt-6 space-y-5">
                {executionSteps.map((step, idx) => (
                  <div key={step.title} className="marketing-step">
                    <div className="flex items-start gap-4">
                      <div className="execution-step-index mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200/30 text-[12px] font-semibold text-violet-200">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <step.icon className="h-4 w-4 text-violet-200/80" />
                          <SplitTextScroll
                            text={step.title}
                            tag="span"
                            className="text-base font-semibold text-white"
                            {...executionTitleAnimation}
                          />
                        </div>
                        <SplitTextScroll
                          text={step.text}
                          tag="p"
                          className="mt-1 text-sm leading-6 text-slate-400"
                          {...executionLineAnimation}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="outcome-column lg:col-span-6">
              <SplitTextScroll
                text="Outcome snapshot"
                tag="h3"
                className="execution-section-title text-white"
                {...executionTitleAnimation}
              />
              <ul className="outcome-list mt-6 text-base text-slate-200">
                <li className="marketing-note">
                  <SplitTextScroll
                    text="Faster decisions with less interface noise."
                    tag="span"
                    className=""
                    {...executionLineAnimation}
                  />
                </li>
                <li className="marketing-note">
                  <SplitTextScroll
                    text="Clear invalidation before every entry."
                    tag="span"
                    className=""
                    {...executionLineAnimation}
                  />
                </li>
                <li className="marketing-note">
                  <SplitTextScroll
                    text="Consistent routine across every session."
                    tag="span"
                    className=""
                    {...executionLineAnimation}
                  />
                </li>
                <li className="marketing-note">
                  <SplitTextScroll
                    text="More focus on execution, less on switching tabs."
                    tag="span"
                    className=""
                    {...executionLineAnimation}
                  />
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <div className="lg:col-span-7">
            <SectionLabel icon={Zap}>Built for Nado</SectionLabel>
            <div className="nado-focus mt-5">
              <div className="flex items-center gap-4">
                <div className="nado-logo-corners">
                  <img src={nadoLogo} alt="Nado" className="h-12 w-12 object-contain" />
                  <span className="nado-corner nado-corner-tl" />
                  <span className="nado-corner nado-corner-tr" />
                  <span className="nado-corner nado-corner-bl" />
                  <span className="nado-corner nado-corner-br" />
                </div>
                <div>
                  <div className="nado-title text-xl font-semibold tracking-tight text-white">
                    Native to the Nado ecosystem
                  </div>
                  <div className="nado-subtitle text-sm text-slate-400">
                    Infrastructure and UX tuned for Nado-first execution.
                  </div>
                </div>
              </div>
              <ul className="nado-points-list mt-5 space-y-2.5 text-sm text-slate-300">
                {nadoPoints.map((point) => (
                  <li key={point} className="marketing-note">
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href="https://nado.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="nado-link-stick mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-200 hover:text-violet-100"
              >
                nado.xyz
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <SectionLabel icon={MessageCircle}>Try THOR AI</SectionLabel>
            <div ref={thorPanelRef} className="thor-ai-panel thor-chat-shell mt-5 space-y-4">
              {visibleThorMessages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={`chat-line chat-line-entry ${
                    msg.role === 'you' ? 'chat-line-you' : 'chat-line-ai'
                  }`}
                >
                  <div
                    className={`text-[12px] uppercase tracking-[0.14em] ${
                      msg.role === 'you' ? 'text-slate-300' : 'text-violet-200/90'
                    }`}
                  >
                    {msg.role === 'you' ? 'You' : 'THOR AI'}
                  </div>
                  <div className="chat-bubble">
                    <p className="chat-bubble-text">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="mt-16"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <div className="cta-shell px-0 py-8 text-left">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Trade with clearer intent - free during MVP
            </h2>
            <p className="mt-2 max-w-[58ch] text-sm leading-7 text-slate-300">
              Start with the terminal preview, ask THOR AI for context, and execute with a
              cleaner decision process from the first session.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ElectricButton primary onClick={onLaunch} className="h-12 px-8 text-sm font-semibold">
                Launch Terminal
              </ElectricButton>
              <span className="mvp-pill text-xs font-medium">Free during MVP</span>
            </div>
          </div>
        </motion.section>

        <section className="contact-links-shell mt-14">
          <div className="contact-links-title">Connect with us</div>
          <div className="contact-links-row">
            <a href="#twitter" onClick={handleFakeContactNav} className="contact-link-chip">
              Twitter
            </a>
            <a href="#telegram" onClick={handleFakeContactNav} className="contact-link-chip">
              Telegram
            </a>
          </div>
        </section>

        <footer className="landing-footer-marquee mt-3">
          <div className="footer-marquee-mask">
            <div className="footer-marquee-track" aria-label={footerTickerText}>
              <div className="footer-marquee-group">
                {footerTickerItems.map((item, idx) => (
                  <span key={`footer-group-a-${idx}`} className="footer-marquee-item">
                    {item}
                  </span>
                ))}
              </div>
              <div className="footer-marquee-group" aria-hidden="true">
                {footerTickerItems.map((item, idx) => (
                  <span key={`footer-group-b-${idx}`} className="footer-marquee-item">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
