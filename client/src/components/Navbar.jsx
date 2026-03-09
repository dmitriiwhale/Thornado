import React from 'react';
import ElectricButton from './ElectricButton';
import logo from '../assets/thornado-hammer.png';

const NAV_LINKS = [
  { label: 'Home',         tab: 'landing'  },
  { label: 'Terminal',     tab: 'terminal' },
  { label: 'AI Signals',   tab: null       },
  { label: 'Strategy Lab', tab: null       },
  { label: 'Docs',         tab: null       },
];

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <div
      className="w-full px-5"
      style={{
        background: '#0c1829',
        border: '1px solid rgba(56,189,248,0.18)',
        borderRadius: 16,
        height: 56,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="flex w-full items-center justify-between gap-6">

        {/* Logo + wordmark */}
        <button
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 shrink-0"
        >
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-sky-400/20 bg-[#0d1a2e] p-1.5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3),transparent_65%)]" />
            <img
              src={logo}
              alt="THORNado logo"
              className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            />
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-white">THORNado</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-sky-400/70 font-medium leading-none mt-0.5">
              AI trading terminal
            </div>
          </div>
        </button>

        {/* Nav links — centered */}
        <nav className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map(({ label, tab }) => {
            const isActive = tab && activeTab === tab;
            return (
              <button
                key={label}
                onClick={() => tab && setActiveTab(tab)}
                className={`text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-sky-300'
                    : tab
                    ? 'text-slate-400 hover:text-slate-100'
                    : 'text-slate-600 cursor-default'
                }`}
                style={isActive ? { textShadow: '0 0 10px rgba(56,189,248,0.8)' } : undefined}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* CTA buttons — equal size */}
        <div className="flex items-center gap-2 shrink-0">
          <ElectricButton className="h-8 px-4 text-sm font-medium">
            Sign in
          </ElectricButton>
          <ElectricButton primary onClick={() => setActiveTab('terminal')} className="h-8 px-4 text-sm font-medium">
            Launch app
          </ElectricButton>
        </div>

      </div>
    </div>
  );
}
