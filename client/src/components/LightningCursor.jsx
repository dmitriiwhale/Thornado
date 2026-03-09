import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Selector — everything a user can meaningfully click
const CLICKABLE = 'button, a, [role="button"], input, select, textarea, label, [tabindex], [onClick]';

export default function LightningCursor() {
  const [pos, setPos]               = useState({ x: -200, y: -200 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isDesktop, setIsDesktop]   = useState(true);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsDesktop(false);
      return;
    }
    const move = (e) => setPos({ x: e.clientX, y: e.clientY });
    const over = (e) => setIsHovering(!!e.target.closest(CLICKABLE));
    const down = () => setIsClicking(true);
    const up   = () => setIsClicking(false);

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', over);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup',   up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', over);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup',   up);
    };
  }, []);

  if (!isDesktop) return null;

  const dotSize   = isClicking ? 4 : isHovering ? 9 : 5;
  const dotOffset = dotSize / 2;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 2500, damping: 55, mass: 0.04 }}
    >
      {/* Dot */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          width:  dotSize,
          height: dotSize,
          x: -dotOffset,
          y: -dotOffset,
          backgroundColor: '#38bdf8',
          boxShadow: isHovering
            ? '0 0 14px 4px rgba(56,189,248,0.85)'
            : '0 0 6px 1px rgba(56,189,248,0.55)',
          opacity: isClicking ? 0.55 : 1,
        }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
      />

      {/* Lightning bolt — appears on hover of any clickable */}
      <AnimatePresence>
        {isHovering && (
          <motion.svg
            key="bolt"
            initial={{ opacity: 0, scale: 0.4, x: 7, y: -22 }}
            animate={{ opacity: 1, scale: 1,   x: 7, y: -22 }}
            exit={{    opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
            width="11"
            height="19"
            viewBox="0 0 11 19"
            className="absolute"
            style={{ left: 0, top: 0, overflow: 'visible' }}
          >
            <defs>
              <filter id="zap-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* glow copy */}
            <polygon points="8,0 2,10 6,10 2,19 10,8 5,8" fill="rgba(125,211,252,0.5)" filter="url(#zap-glow)" />
            {/* crisp bolt */}
            <polygon points="8,0 2,10 6,10 2,19 10,8 5,8" fill="#7dd3fc" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
