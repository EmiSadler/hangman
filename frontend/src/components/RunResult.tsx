import type { RunScore } from '../types'

interface Props {
  won: boolean
  roomsCleared: number
  score: RunScore
  onNewRun: () => void
}

export default function RunResult({ won, roomsCleared, score, onNewRun }: Props) {
  return (
    <div className="run-result">
      <h2 className={won ? 'run-result__title--won' : 'run-result__title--lost'}>
        {won ? 'Dungeon Cleared!' : 'You Died'}
      </h2>
      <p className="run-result__rooms">Rooms cleared: {roomsCleared}</p>
      <p className="run-result__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>
      <button className="btn-new-run" onClick={onNewRun}>Start New Run</button>
    </div>
  )
}
