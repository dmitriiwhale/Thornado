import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LightningCursor from './components/LightningCursor';
import Navbar from './components/Navbar';
import StormBackdrop from './components/StormBackdrop';

const Landing = lazy(() => import('./pages/Landing'));
const Terminal = lazy(() => import('./pages/Terminal'));
const Account = lazy(() => import('./pages/Account'));

function detectHeavyEffectsSupport() {
  if (typeof window === 'undefined') return true;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const lowCoreCount =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;

  return !prefersReducedMotion && !lowCoreCount && !lowMemory;
}

export default function App() {
  const pageContentRef = useRef(null)
  const location = useLocation()
  const isTerminal = location.pathname === '/terminal'
  const isLanding = location.pathname === '/'
  const [allowHeavyEffects, setAllowHeavyEffects] = useState(() => detectHeavyEffectsSupport())

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const refresh = () => setAllowHeavyEffects(detectHeavyEffectsSupport())

    refresh()
    media.addEventListener?.('change', refresh)
    return () => media.removeEventListener?.('change', refresh)
  }, [])

  const backdropMode = useMemo(() => {
    if (!isLanding) return 'none'
    return allowHeavyEffects ? 'full' : 'static'
  }, [allowHeavyEffects, isLanding])

  return (
    <>
      {isLanding && allowHeavyEffects ? <LightningCursor /> : null}
      <div
        className="storm-theme relative isolate text-white"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          background:
            backdropMode === 'none'
              ? 'linear-gradient(180deg, #050610 0%, #09071a 24%, #110b2b 58%, #05070d 100%)'
              : undefined,
        }}
      >
        <StormBackdrop
          scrollContainerRef={pageContentRef}
          isLanding={isLanding}
          mode={backdropMode}
        />

        {/* Navbar */}
        <div className="relative z-10 shrink-0 px-5 py-3">
          <Navbar />
        </div>

        {/* Page content */}
        <div
          ref={pageContentRef}
          className="relative z-10"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: isTerminal ? 'hidden' : 'auto',
            minHeight: 0,
          }}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                Loading…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Landing scrollContainerRef={pageContentRef} />} />
              <Route path="/terminal" element={<Terminal />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </>
  );
}
