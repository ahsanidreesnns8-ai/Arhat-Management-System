/** Circular RTC mark — inlined so login never loads the old wheat crest. */
export default function RtcMark({ className = 'w-24 h-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" className={className} role="img" aria-label="RTC">
      <circle cx="36" cy="36" r="33" fill="#002D62" stroke="#C5A059" strokeWidth="3.5" />
      <circle cx="36" cy="36" r="27" fill="none" stroke="#C5A059" strokeWidth="0.8" opacity={0.55} />
      <text
        x="36"
        y="43"
        textAnchor="middle"
        fill="#C5A059"
        fontSize="16"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        letterSpacing="1"
      >
        RTC
      </text>
    </svg>
  )
}
