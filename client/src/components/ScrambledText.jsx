import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(SplitText, ScrambleTextPlugin)

export default function ScrambledText({
  radius = 100,
  duration = 1.2,
  speed = 0.5,
  scrambleChars = '.:',
  className = '',
  style = undefined,
  as = 'span',
  children,
}) {
  const rootRef = useRef(null)
  const Tag = as

  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined

    const split = SplitText.create(el, {
      type: 'chars',
      charsClass: 'inline-block will-change-transform',
    })

    split.chars.forEach((charEl) => {
      gsap.set(charEl, {
        attr: { 'data-content': charEl.textContent ?? '' },
      })
    })

    const onMove = (event) => {
      split.chars.forEach((charEl) => {
        const rect = charEl.getBoundingClientRect()
        const dx = event.clientX - (rect.left + rect.width / 2)
        const dy = event.clientY - (rect.top + rect.height / 2)
        const dist = Math.hypot(dx, dy)

        if (dist > radius) return

        gsap.to(charEl, {
          overwrite: true,
          duration: duration * (1 - dist / radius),
          scrambleText: {
            text: charEl.dataset.content ?? '',
            chars: scrambleChars,
            speed,
          },
          ease: 'none',
        })
      })
    }

    el.addEventListener('pointermove', onMove)

    return () => {
      el.removeEventListener('pointermove', onMove)
      split.revert()
    }
  }, [radius, duration, speed, scrambleChars])

  return (
    <Tag ref={rootRef} className={className} style={style}>
      {children}
    </Tag>
  )
}
