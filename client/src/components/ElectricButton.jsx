import React, { useRef, useState } from 'react';

export default function ElectricButton({
  children,
  className = '',
  primary = false,
  onClick,
}) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const onMove = (e) => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const base = [
    'group relative inline-flex items-center justify-center overflow-hidden',
    'rounded-[14px] select-none transition-all duration-200 active:scale-95 backdrop-blur-md',
    className,
  ].join(' ');

  const themed = primary
    ? 'border border-indigo-200/20 bg-[linear-gradient(180deg,rgba(88,96,216,0.26),rgba(31,39,88,0.82))] shadow-[0_12px_30px_rgba(20,26,64,0.3)] hover:border-violet-100/35 hover:shadow-[0_16px_40px_rgba(167,139,250,0.2)]'
    : 'border border-white/10 bg-[linear-gradient(180deg,rgba(22,24,48,0.72),rgba(10,12,28,0.84))] hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(28,31,58,0.82),rgba(12,15,32,0.9))]';

  return (
    <button
      ref={btnRef}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className={`${base} ${themed}`}
    >
      {/* Plasma follow-cursor radial */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(90px circle at ${pos.x}px ${pos.y}px, ${
            primary
              ? 'rgba(165,180,252,0.3)'
              : 'rgba(148,163,184,0.12)'
          }, transparent 100%)`,
        }}
      />

      {/* Thunder flash overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-indigo-200/12 mix-blend-screen opacity-0 group-hover:animate-[thunder-pulse_2.8s_infinite]" />

      {/* Electric sweep lines — primary only (all four edges) */}
      {primary && (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px] w-[200%] -translate-x-full bg-gradient-to-r from-transparent via-indigo-100 to-transparent opacity-0 shadow-[0_0_12px_rgba(196,181,253,0.85)] group-hover:animate-[electric-sweep_1.8s_infinite] group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 h-[2px] w-[200%] translate-x-full bg-gradient-to-l from-transparent via-violet-100 to-transparent opacity-0 shadow-[0_0_12px_rgba(221,214,254,0.8)] group-hover:animate-[electric-sweep-reverse_1.8s_infinite] group-hover:opacity-100" />
          <div className="absolute left-0 inset-y-0 w-[2px] h-[200%] -translate-y-full bg-gradient-to-b from-transparent via-indigo-100 to-transparent opacity-0 shadow-[0_0_12px_rgba(196,181,253,0.85)] group-hover:animate-[electric-sweep-vertical_1.8s_infinite] group-hover:opacity-100" />
          <div className="absolute right-0 inset-y-0 w-[2px] h-[200%] translate-y-full bg-gradient-to-t from-transparent via-violet-100 to-transparent opacity-0 shadow-[0_0_12px_rgba(221,214,254,0.8)] group-hover:animate-[electric-sweep-vertical-reverse_1.8s_infinite] group-hover:opacity-100" />
        </>
      )}

      {/* Label */}
      <span
        className={`relative z-10 transition-all duration-200 ${
          primary
            ? 'text-indigo-50 group-hover:text-white group-hover:animate-[neon-flicker_3s_infinite]'
            : 'text-slate-300 group-hover:text-white'
        }`}
      >
        {children}
      </span>
    </button>
  );
}
