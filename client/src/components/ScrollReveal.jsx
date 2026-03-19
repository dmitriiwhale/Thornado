import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import getScrollContainer from '../utils/getScrollContainer'

gsap.registerPlugin(ScrollTrigger)

export default function ScrollReveal({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  rotationStart = 'top bottom',
  wordAnimationStart = 'top bottom-=20%',
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom',
  as = 'h2',
}) {
  const containerRef = useRef(null)
  const Tag = as

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : ''
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/\s+/)) return word
      return (
        <span className="word inline-block" key={index}>
          {word}
        </span>
      )
    })
  }, [children])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const scroller = getScrollContainer(scrollContainerRef)

    const ctx = gsap.context(() => {
      const rotationReveal = {
        duration: 0.9,
        ease: 'power2.out',
      }
      const wordReveal = {
        duration: 0.85,
        ease: 'power2.out',
        stagger: 0.05,
      }

      const buildTrigger = (start, end) => ({
        trigger: el,
        scroller,
        start,
        end,
        once: true,
        toggleActions: 'play none none none',
      })

      gsap.fromTo(
        el,
        { transformOrigin: '0% 50%', rotate: baseRotation },
        {
          ...rotationReveal,
          rotate: 0,
          scrollTrigger: buildTrigger(rotationStart, rotationEnd),
        },
      )

      const wordElements = el.querySelectorAll('.word')

      gsap.fromTo(
        wordElements,
        { opacity: baseOpacity, willChange: 'opacity' },
        {
          ...wordReveal,
          opacity: 1,
          scrollTrigger: buildTrigger(wordAnimationStart, wordAnimationEnd),
        },
      )

      if (enableBlur) {
        gsap.fromTo(
          wordElements,
          { filter: `blur(${blurStrength}px)` },
          {
            ...wordReveal,
            filter: 'blur(0px)',
            scrollTrigger: buildTrigger(wordAnimationStart, wordAnimationEnd),
          },
        )
      }
    }, el)

    return () => ctx.revert()
  }, [
    scrollContainerRef,
    enableBlur,
    baseRotation,
    baseOpacity,
    rotationEnd,
    wordAnimationEnd,
    rotationStart,
    wordAnimationStart,
    blurStrength,
  ])

  return (
    <Tag ref={containerRef} className={`my-5 ${containerClassName}`}>
      <p className={textClassName || 'text-[clamp(1.6rem,4vw,3rem)] leading-[1.08] font-semibold'}>
        {splitText}
      </p>
    </Tag>
  )
}
