import type { Difficulty } from '../types'

interface Props {
  onStart: (difficulty: Difficulty) => void
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

export default function GameSetup({ onStart }: Props) {
  return (
    <div>
      <h1>Hangman</h1>
      <p>Choose a difficulty to start:</p>
      <div>
        {difficulties.map((d) => (
          <button key={d} onClick={() => onStart(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
