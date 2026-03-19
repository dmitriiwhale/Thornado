import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function SplitTextMessage({
  text,
  className = '',
  delay = 0.018,
  duration = 0.82,
  ease = 'power3.out',
  from = { opacity: 0, y: 22 },
  to = { opacity: 1, y: 0 },
  tag = 'p',
  onLetterAnimationComplete,
}) {
  const ref = useRef(null)
  const Tag = tag

  useEffect(() => {
    const el = ref.current
    if (!el || !text) return undefined

    const splitInstance = new SplitText(el, {
      type: 'chars',
      smartWrap: true,
      charsClass: 'split-char inline-block will-change-transform',
      wordsClass: 'split-word',
    })

    const targets = splitInstance.chars?.length ? splitInstance.chars : [el]
    const tween = gsap.fromTo(
      targets,
      { ...from },
      {
        ...to,
        duration,
        ease,
        stagger: delay,
        force3D: true,
        onComplete: () => onLetterAnimationComplete?.(),
      },
    )

    return () => {
      tween.kill()
      splitInstance.revert()
    }
  }, [text, delay, duration, ease, from, to, onLetterAnimationComplete])

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  )
}
