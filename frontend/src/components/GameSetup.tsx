import type { Difficulty } from '../types'

interface Props {
  onStart: (difficulty: Difficulty) => void
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

export default function GameSetup({ onStart }: Props) {
  return (
    <div className="game-setup">
      <h1>Hangman</h1>
      <p className="game-setup__subtitle">Choose a difficulty to begin</p>
      <div className="game-setup__buttons">
        {difficulties.map((d) => (
          <button key={d} className="btn-difficulty" onClick={() => onStart(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
