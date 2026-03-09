import React, { useState } from 'react';
import LightningCursor from './components/LightningCursor';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Terminal from './pages/Terminal';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'terminal'

  const isTerminal = activeTab === 'terminal';

  return (
    <>
      <LightningCursor />
      <div
        className="text-white"
        style={{
          background: '#07101c',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Navbar */}
        <div className="shrink-0 px-5 py-3">
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Page content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: isTerminal ? 'hidden' : 'auto',
            minHeight: 0,
          }}
        >
          {isTerminal ? <Terminal /> : <Landing onLaunch={() => setActiveTab('terminal')} />}
        </div>
      </div>
    </>
  );
}
