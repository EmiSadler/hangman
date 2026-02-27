interface Props {
  wrongCount: number
}

const STROKE = '#5c3d2e'

export default function HangmanSvg({ wrongCount }: Props) {
  return (
    <div className="hangman-card">
      <svg viewBox="0 0 200 250" width="200" height="250" aria-label="hangman figure">
        {/* Gallows */}
        <line x1="20" y1="230" x2="180" y2="230" stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1="230" x2="60" y2="20"   stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1="20"  x2="130" y2="20"  stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="130" y1="20" x2="130" y2="50"  stroke={STROKE} strokeWidth="5" strokeLinecap="round" />

        {wrongCount >= 1 && (
          <circle data-part="head" cx="130" cy="70" r="20" stroke={STROKE} strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
        {wrongCount >= 2 && (
          <line data-part="body" x1="130" y1="90" x2="130" y2="150" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 3 && (
          <line data-part="left-arm" x1="130" y1="110" x2="100" y2="140" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 4 && (
          <line data-part="right-arm" x1="130" y1="110" x2="160" y2="140" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 5 && (
          <line data-part="left-leg" x1="130" y1="150" x2="100" y2="190" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 6 && (
          <line data-part="right-leg" x1="130" y1="150" x2="160" y2="190" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
      </svg>
    </div>
  )
}
