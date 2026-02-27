interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

export default function Keyboard({ guessedLetters, correctLetters, onGuess, disabled }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '400px' }}>
      {LETTERS.map((letter) => {
        const wasGuessed = guessedLetters.includes(letter)
        const wasCorrect = correctLetters.includes(letter)
        return (
          <button
            key={letter}
            onClick={() => onGuess(letter)}
            disabled={disabled || wasGuessed}
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: wasGuessed ? (wasCorrect ? '#4caf50' : '#f44336') : '#e0e0e0',
              color: wasGuessed ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: wasGuessed || disabled ? 'default' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {letter.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
