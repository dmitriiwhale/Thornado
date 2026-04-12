export default function SolidBlock({ children, className = '' }) {
  return (
    <div
      className={`solid-block relative overflow-hidden rounded-[16px] border border-[var(--term-border)] bg-[var(--term-card-bg)] backdrop-blur-[12px] ${className}`}
      style={{
        boxShadow: '0 12px 34px rgba(2,4,12,0.30), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(99,102,241,0.06)',
      }}
    >
      {/* Top glare line */}
      <div className="solid-block-decor pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/30 to-transparent" />
      {/* Corner ambient glow */}
      <div className="solid-block-decor pointer-events-none absolute -left-10 -top-12 h-28 w-28 rounded-full bg-indigo-300/[0.10] blur-[36px]" />
      <div className="solid-block-decor pointer-events-none absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-violet-300/[0.08] blur-[32px]" />
      <div className="solid-block-decor pointer-events-none absolute inset-0 bg-[linear-gradient(132deg,rgba(255,255,255,0.03),transparent_32%,transparent_70%,rgba(99,102,241,0.04))]" />
      <div className="solid-block-content relative z-10 h-full">{children}</div>
    </div>
  )
}
