interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
}

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
]

export default function Keyboard({ guessedLetters, correctLetters, onGuess, disabled }: Props) {
  return (
    <div className="keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard__row">
          {row.map((letter) => {
            const wasGuessed = guessedLetters.includes(letter)
            const wasCorrect = correctLetters.includes(letter)
            const keyClass = [
              'key',
              wasGuessed ? (wasCorrect ? 'key--correct' : 'key--wrong') : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={keyClass}
                onClick={() => onGuess(letter)}
                disabled={disabled || wasGuessed}
              >
                {letter.toUpperCase()}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
