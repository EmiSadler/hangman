interface Props {
  wrongCount: number
}

// Body parts in order: head=1, body=2, left-arm=3, right-arm=4, left-leg=5, right-leg=6
export default function HangmanSvg({ wrongCount }: Props) {
  return (
    <svg viewBox="0 0 200 250" width="200" height="250" aria-label="hangman figure">
      {/* Gallows - always visible */}
      <line x1="20" y1="230" x2="180" y2="230" stroke="black" strokeWidth="4" />
      <line x1="60" y1="230" x2="60" y2="20" stroke="black" strokeWidth="4" />
      <line x1="60" y1="20" x2="130" y2="20" stroke="black" strokeWidth="4" />
      <line x1="130" y1="20" x2="130" y2="50" stroke="black" strokeWidth="4" />

      {wrongCount >= 1 && (
        <circle data-part="head" cx="130" cy="70" r="20" stroke="black" strokeWidth="3" fill="none" />
      )}
      {wrongCount >= 2 && (
        <line data-part="body" x1="130" y1="90" x2="130" y2="150" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 3 && (
        <line data-part="left-arm" x1="130" y1="110" x2="100" y2="140" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 4 && (
        <line data-part="right-arm" x1="130" y1="110" x2="160" y2="140" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 5 && (
        <line data-part="left-leg" x1="130" y1="150" x2="100" y2="190" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 6 && (
        <line data-part="right-leg" x1="130" y1="150" x2="160" y2="190" stroke="black" strokeWidth="3" />
      )}
    </svg>
  )
}
