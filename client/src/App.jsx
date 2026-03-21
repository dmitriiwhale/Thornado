import React, { useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LightningCursor from './components/LightningCursor';
import Navbar from './components/Navbar';
import StormBackdrop from './components/StormBackdrop';
import Landing from './pages/Landing';
import Terminal from './pages/Terminal';

export default function App() {
  const pageContentRef = useRef(null)
  const location = useLocation()
  const isTerminal = location.pathname === '/terminal'

  return (
    <>
      <LightningCursor />
      <div
        className="storm-theme relative isolate text-white"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <StormBackdrop scrollContainerRef={pageContentRef} isLanding={!isTerminal} />

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
          <Routes>
            <Route path="/" element={<Landing scrollContainerRef={pageContentRef} />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </>
  );
}
