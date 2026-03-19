import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'
import getScrollContainer from '../utils/getScrollContainer'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText)

export default function SplitTextScroll({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0,
  rootMargin = '0px',
  textAlign = 'left',
  tag = 'p',
  scrollContainerRef,
  onLetterAnimationComplete,
}) {
  const ref = useRef(null)
  const onCompleteRef = useRef(onLetterAnimationComplete)
  const shouldWaitForFonts = useMemo(() => splitType.includes('lines'), [splitType])
  const [fontsLoaded, setFontsLoaded] = useState(!shouldWaitForFonts)
  const Tag = tag || 'p'
  const isInlineTag = ['span', 'a', 'strong', 'em', 'small', 'label'].includes(
    String(Tag).toLowerCase(),
  )

  const fromKey = useMemo(() => JSON.stringify(from), [from])
  const toKey = useMemo(() => JSON.stringify(to), [to])
  const start = useMemo(() => {
    const startPct = (1 - threshold) * 100
    const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
    const marginValue = marginMatch ? Number.parseFloat(marginMatch[1]) : 0
    const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px'
    const sign =
      marginValue === 0
        ? ''
        : marginValue < 0
          ? `-=${Math.abs(marginValue)}${marginUnit}`
          : `+=${marginValue}${marginUnit}`
    return `top ${startPct}%${sign}`
  }, [rootMargin, threshold])

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useEffect(() => {
    if (!shouldWaitForFonts) {
      setFontsLoaded(true)
      return undefined
    }
    if (typeof document === 'undefined' || !document.fonts) {
      setFontsLoaded(true)
      return undefined
    }
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true)
      return undefined
    }
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [shouldWaitForFonts])

  useLayoutEffect(() => {
    if (!ref.current || !text || !fontsLoaded) return undefined

    const el = ref.current
    const existing = el._rbsplitInstance
    if (existing) {
      try {
        existing.revert()
      } catch {
        // ignore
      }
      el._rbsplitInstance = null
    }

    const scroller = getScrollContainer(scrollContainerRef)

    let targets = null
    const assignTargets = (splitResult) => {
      if (splitType.includes('chars') && splitResult.chars.length) targets = splitResult.chars
      if (!targets && splitType.includes('words') && splitResult.words.length) targets = splitResult.words
      if (!targets && splitType.includes('lines') && splitResult.lines.length) targets = splitResult.lines
      if (!targets) targets = splitResult.chars.length ? splitResult.chars : splitResult.words
    }

    const splitInstance = new GSAPSplitText(el, {
      type: splitType,
      smartWrap: true,
      autoSplit: splitType === 'lines',
      linesClass: 'split-line',
      wordsClass: 'split-word',
      charsClass: 'split-char inline-block will-change-transform',
      reduceWhiteSpace: false,
    })

    assignTargets(splitInstance)

    const tween = gsap.fromTo(
      targets,
      { ...from },
      {
        ...to,
        duration,
        ease,
        stagger: delay / 1000,
        paused: true,
        immediateRender: true,
        onComplete: () => {
          onCompleteRef.current?.()
        },
        willChange: 'transform, opacity',
        force3D: true,
      },
    )

    const trigger = ScrollTrigger.create({
      trigger: el,
      scroller,
      start,
      end: 'bottom top',
      onEnter: () => tween.play(0),
      onEnterBack: () => tween.play(0),
      onLeave: () => tween.reverse(),
      onLeaveBack: () => tween.reverse(),
      invalidateOnRefresh: true,
      fastScrollEnd: true,
      anticipatePin: 0.4,
    })

    el._rbsplitInstance = splitInstance

    return () => {
      trigger.kill()
      tween.kill()
      try {
        splitInstance.revert()
      } catch {
        // ignore
      }
      el._rbsplitInstance = null
    }
  }, [
    text,
    delay,
    duration,
    ease,
    splitType,
    fromKey,
    toKey,
    start,
    threshold,
    rootMargin,
    fontsLoaded,
    scrollContainerRef,
  ])

  return (
    <Tag
      ref={ref}
      style={{ textAlign, wordWrap: 'break-word', willChange: 'transform, opacity' }}
      className={`split-parent ${isInlineTag ? 'inline-block' : 'block'} overflow-hidden whitespace-normal ${className}`}
    >
      {text}
    </Tag>
  )
}
