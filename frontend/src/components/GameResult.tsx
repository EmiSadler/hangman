import type { GameStatus } from '../types'

interface Props {
  status: GameStatus
  word: string
  onPlayAgain: () => void
  buttonLabel?: string
}

export default function GameResult({ status, word, onPlayAgain, buttonLabel = 'Play Again' }: Props) {
  return (
    <div className="game-result">
      <h2 className={status === 'won' ? 'game-result__title--won' : 'game-result__title--lost'}>
        {status === 'won' ? 'You Won! 🎉' : 'Game Over!'}
      </h2>
      <p className="game-result__word">
        The word was: <strong>{word}</strong>
      </p>
      <button className="btn-difficulty" onClick={onPlayAgain}>{buttonLabel}</button>
    </div>
  )
}
