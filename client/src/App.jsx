import React, { useRef, useState } from 'react';
import LightningCursor from './components/LightningCursor';
import Navbar from './components/Navbar';
import StormBackdrop from './components/StormBackdrop';
import Landing from './pages/Landing';
import Terminal from './pages/Terminal';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'terminal'
  const pageContentRef = useRef(null)

  const isTerminal = activeTab === 'terminal';

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
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
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
          {isTerminal ? (
            <Terminal />
          ) : (
            <Landing
              onLaunch={() => setActiveTab('terminal')}
              scrollContainerRef={pageContentRef}
            />
          )}
        </div>
      </div>
    </>
  );
}
