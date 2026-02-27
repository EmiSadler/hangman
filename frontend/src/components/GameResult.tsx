import type { GameStatus } from '../types'

interface Props {
  status: GameStatus
  word: string
  onPlayAgain: () => void
}

export default function GameResult({ status, word, onPlayAgain }: Props) {
  return (
    <div>
      <h2>{status === 'won' ? 'You Won!' : 'Game Over!'}</h2>
      <p>The word was: <strong>{word}</strong></p>
      <button onClick={onPlayAgain}>Play Again</button>
    </div>
  )
}
