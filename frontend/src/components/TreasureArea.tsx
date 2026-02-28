import type { RunState } from '../types'

interface Props {
  run: RunState
  onChoose: (updatedRun: RunState) => void
}

export default function TreasureArea({ run, onChoose }: Props) {
  return (
    <div className="treasure-area">
      <h2>Treasure Room</h2>
      <p>Choose one bonus:</p>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, pendingReveal: true })}>
        Reveal a letter in the next encounter
      </button>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, hp: Math.min(run.maxHp, run.hp + 5) })}>
        +5 HP (instant)
      </button>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, coins: run.coins + 10 })}>
        +10 Coins (instant)
      </button>
    </div>
  )
}
