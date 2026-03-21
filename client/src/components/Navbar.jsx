import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import ElectricButton from './ElectricButton';
import logo from '../assets/thornado-hammer.png';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Terminal', to: '/terminal' },
  { label: 'AI Signals', to: null },
  { label: 'Strategy Lab', to: null },
  { label: 'Docs', to: null },
];

const navLinkClass = ({ isActive }) =>
  `relative rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'text-indigo-100 shadow-[0_0_20px_rgba(167,139,250,0.16)]'
      : 'text-slate-400 hover:text-slate-100 hover:shadow-[0_0_18px_rgba(167,139,250,0.18)]'
  }`;

const navLinkStyle = ({ isActive }) =>
  isActive ? { textShadow: '0 0 16px rgba(196,181,253,0.55)' } : { textShadow: '0 0 0 rgba(0,0,0,0)' };

export default function Navbar() {
  return (
    <div
      className="w-full px-5"
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        height: 68,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="flex w-full items-center justify-between gap-6">

        {/* Logo + wordmark */}
        <Link
          to="/"
          className="flex items-center gap-3 shrink-0 pr-3"
        >
          <img
            src={logo}
            alt="THORNado logo"
            className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(224,210,255,0.35)]"
            style={{ transform: 'scale(1.3)' }}
          />
          <div>
            <div className="bg-gradient-to-r from-white via-indigo-100 to-violet-100 bg-clip-text text-sm font-bold uppercase tracking-[0.22em] text-transparent">THORNado</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300/65 font-medium leading-none">
              AI trading terminal
            </div>
          </div>
        </Link>

        {/* Nav links — centered */}
        <nav className="relative hidden lg:flex items-center gap-1 pb-2">
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-violet-300/0 via-violet-200/45 to-violet-300/0" />
          {NAV_LINKS.map(({ label, to }) => {
            if (to) {
              return (
                <NavLink
                  key={label}
                  to={to}
                  end={to === '/'}
                  className={navLinkClass}
                  style={navLinkStyle}
                >
                  {({ isActive }) => (
                    <>
                      {label}
                      <span
                        className={`pointer-events-none absolute -bottom-2 left-2 right-2 h-[2px] transition-opacity duration-200 ${
                          isActive ? 'opacity-100 bg-violet-200/90' : 'opacity-0'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              );
            }
            return (
              <span
                key={label}
                className="relative rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 cursor-default"
              >
                {label}
              </span>
            );
          })}
        </nav>

        {/* CTA buttons — equal size */}
        <div className="flex items-center gap-2 shrink-0">
          <ElectricButton primary className="h-8 px-4 text-sm font-medium">
            Sign in
          </ElectricButton>
        </div>

      </div>
    </div>
  );
}
