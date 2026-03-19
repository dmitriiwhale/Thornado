export default function SolidBlock({ children, className = '' }) {
  return (
    <div
      className={`solid-block relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,45,0.82)_0%,rgba(7,10,24,0.74)_100%)] backdrop-blur-[18px] ${className}`}
      style={{
        boxShadow: '0 20px 60px rgba(3,5,16,0.32), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(99,102,241,0.08)',
      }}
    >
      {/* Top glare line */}
      <div className="solid-block-decor pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/40 to-transparent" />
      {/* Corner ambient glow */}
      <div className="solid-block-decor pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-indigo-400/[0.14] blur-[58px]" />
      <div className="solid-block-decor pointer-events-none absolute right-[-10%] top-[18%] h-24 w-24 rounded-full bg-fuchsia-200/[0.08] blur-[42px]" />
      <div className="solid-block-decor pointer-events-none absolute -right-14 -bottom-14 h-36 w-36 rounded-full bg-violet-400/[0.1] blur-[56px]" />
      <div className="solid-block-decor pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_28%,transparent_72%,rgba(96,165,250,0.04))]" />
      <div className="solid-block-content relative z-10 h-full">{children}</div>
    </div>
  )
}
