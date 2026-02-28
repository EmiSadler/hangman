import type { RunScore } from '../types'

interface Props {
  onStart: () => void
  score: RunScore
  onReset: () => void
}

export default function RunSetup({ onStart, score, onReset }: Props) {
  return (
    <div className="run-setup">
      <h1>Dungeon Hangman</h1>
      <p className="run-setup__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>
      <button className="btn-start-run" onClick={onStart}>Start Run</button>
      <button className="btn-forget" onClick={onReset}>Forget me</button>
    </div>
  )
}
