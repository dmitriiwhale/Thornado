export default function SolidBlock({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] bg-[#0d1525] ${className}`}
      style={{
        border: '1px solid rgba(56,189,248,0.22)',
        boxShadow: '0 0 0 0 transparent, inset 0 1px 0 rgba(125,211,252,0.08)',
      }}
    >
      {/* Top glare line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
      {/* Corner ambient glow */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-sky-500/[0.12] blur-[48px]" />
      <div className="pointer-events-none absolute -right-12 -bottom-12 h-28 w-28 rounded-full bg-cyan-500/[0.07] blur-[40px]" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
