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
    'rounded-xl select-none transition-all duration-200 active:scale-95',
    className,
  ].join(' ');

  const themed = primary
    ? 'border border-sky-400/50 bg-[#0d1a2e] shadow-[0_0_18px_rgba(56,189,248,0.18)] hover:shadow-[0_0_28px_rgba(56,189,248,0.35)] hover:border-sky-400/80'
    : 'border border-slate-500/35 bg-[#111e35] hover:border-slate-400/60 hover:bg-[#152035]';

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
              ? 'rgba(56,189,248,0.28)'
              : 'rgba(148,163,184,0.14)'
          }, transparent 100%)`,
        }}
      />

      {/* Thunder flash overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-sky-400/20 mix-blend-overlay opacity-0 group-hover:animate-[thunder-pulse_2.5s_infinite]" />

      {/* Electric sweep lines — primary only */}
      {primary && (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px] w-[200%] -translate-x-full bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-0 shadow-[0_0_12px_rgba(125,211,252,1)] group-hover:animate-[electric-sweep_1.8s_infinite] group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 h-[2px] w-[200%] translate-x-full bg-gradient-to-l from-transparent via-cyan-300 to-transparent opacity-0 shadow-[0_0_12px_rgba(103,232,249,1)] group-hover:animate-[electric-sweep-reverse_1.8s_infinite] group-hover:opacity-100" />
        </>
      )}

      {/* Label */}
      <span
        className={`relative z-10 transition-all duration-200 ${
          primary
            ? 'text-sky-200 group-hover:text-white group-hover:animate-[neon-flicker_3s_infinite]'
            : 'text-slate-300 group-hover:text-white'
        }`}
      >
        {children}
      </span>
    </button>
  );
}
