import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'

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
  start = 'top 94%',
  end = 'bottom 25%',
  toggleActions = 'play none none reverse',
  once = false,
  scrub = false,
  textAlign = 'left',
  tag = 'p',
  scrollContainerRef,
  onLetterAnimationComplete,
}) {
  const ref = useRef(null)
  const onCompleteRef = useRef(onLetterAnimationComplete)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const Tag = tag || 'p'
  const isInlineTag = ['span', 'a', 'strong', 'em', 'small', 'label'].includes(
    String(Tag).toLowerCase(),
  )

  const fromKey = useMemo(() => JSON.stringify(from), [from])
  const toKey = useMemo(() => JSON.stringify(to), [to])

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) {
      setFontsLoaded(true)
      return
    }
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true)
      return
    }
    document.fonts.ready.then(() => setFontsLoaded(true))
  }, [])

  useEffect(() => {
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

    const scroller =
      scrollContainerRef?.current && scrollContainerRef.current !== window
        ? scrollContainerRef.current
        : undefined

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
        scrollTrigger: {
          trigger: el,
          scroller,
          start,
          end,
          toggleActions,
          once,
          scrub,
          invalidateOnRefresh: true,
          fastScrollEnd: true,
          anticipatePin: 0.4,
        },
        onComplete: () => {
          onCompleteRef.current?.()
        },
        willChange: 'transform, opacity',
        force3D: true,
      },
    )

    el._rbsplitInstance = splitInstance

    return () => {
      tween?.kill()
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === el) st.kill()
      })
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
    end,
    toggleActions,
    once,
    scrub,
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
