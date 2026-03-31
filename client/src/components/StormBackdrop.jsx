import Lightning from './Lightning'

export default function StormBackdrop({ scrollContainerRef, isLanding, mode = 'full' }) {
  const isAnimated = mode === 'full'

  if (mode === 'none') return null

  return (
    <div className="storm-backdrop fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="storm-sky-base absolute inset-0" />
      <div className="storm-sky-veil absolute inset-0" />
      <div className="storm-cloudbank storm-cloudbank-1" />
      <div className="storm-cloudbank storm-cloudbank-2" />
      <div className="storm-cloudbank storm-cloudbank-3" />
      <div className="storm-cloudbank storm-cloudbank-4" />
      <div className="storm-mist storm-mist-1" />
      <div className="storm-mist storm-mist-2" />
      <div className="storm-noise absolute inset-0" />
      {isAnimated && isLanding ? (
        <div className="storm-webgl-lightning-viewport storm-webgl-lightning-viewport-hero absolute inset-x-0 top-0">
          <div className="storm-webgl-lightning-track">
            <div className="storm-webgl-lightning absolute inset-0">
              <Lightning hue={260} xOffset={0.3} speed={0.525} intensity={0.3} size={3} />
            </div>
            <div className="storm-lightning-soft-blur absolute inset-0" />
          </div>
        </div>
      ) : null}
      <div className="storm-global-tint absolute inset-0" />
    </div>
  )
}
