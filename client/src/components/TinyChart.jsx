const points = [8, 12, 11, 16, 14, 18, 20, 19, 24, 22, 28, 31, 30, 34, 36, 39]
const path = points
  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 26 + 16} ${120 - p * 2.2}`)
  .join(' ')

export default function TinyChart() {
  return (
    <svg viewBox="0 0 430 130" className="h-full w-full">
      <defs>
        <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(59,130,246,0.5)" />
          <stop offset="50%" stopColor="rgba(96,165,250,1)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.9)" />
        </linearGradient>
        <linearGradient id="fillGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
          <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
        </linearGradient>
      </defs>
      {[...Array(6)].map((_, i) => (
        <line key={`h-${i}`} x1="0" y1={18 + i * 18} x2="430" y2={18 + i * 18} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {[...Array(9)].map((_, i) => (
        <line key={`v-${i}`} x1={24 + i * 46} y1="0" x2={24 + i * 46} y2="130" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path d={`${path} L 430 130 L 16 130 Z`} fill="url(#fillGlow)" />
      <path d={path} fill="none" stroke="url(#lineGlow)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="406" cy="34" r="5" fill="white" />
      <circle cx="406" cy="34" r="10" fill="rgba(135,230,255,0.25)" />
    </svg>
  )
}
