import type { RunState, RunScore } from '../types'

interface VictoryScreenProps {
  run: RunState
  score: RunScore
  defeatedBossName: string | null
  onNewRun: () => void
}

export default function VictoryScreen({ run, score, defeatedBossName, onNewRun }: VictoryScreenProps) {
  return (
    <div className="victory-screen">
      <h1 className="victory-screen__heading">V I C T O R Y</h1>
      {defeatedBossName && (
        <p className="victory-screen__boss">You defeated {defeatedBossName}.</p>
      )}
      <p className="victory-screen__flavour">The dungeon falls silent.</p>
      <div className="victory-screen__stats">
        <div className="victory-screen__stat">
          <span>Floors cleared</span>
          <span>3 / 3</span>
        </div>
        <div className="victory-screen__stat">
          <span>Rooms cleared</span>
          <span>33 / 33</span>
        </div>
        <div className="victory-screen__stat">
          <span>Coins</span>
          <span>{run.coins}</span>
        </div>
      </div>
      <p className="victory-screen__score">Runs cleared: {score.runsCleared}</p>
      <button className="btn-primary" onClick={onNewRun}>Play Again</button>
    </div>
  )
}
