import type { RunState } from '../types'
import { HEAL_COST, HEAL_AMOUNT } from '../runState'

interface Props {
  run: RunState
  onHeal: (updatedRun: RunState) => void
  onLeave: () => void
}

export default function RestArea({ run, onHeal, onLeave }: Props) {
  const canHeal = run.coins >= HEAL_COST && run.hp < run.maxHp

  function handleHeal() {
    if (!canHeal) return
    onHeal({
      ...run,
      hp: Math.min(run.maxHp, run.hp + HEAL_AMOUNT),
      coins: run.coins - HEAL_COST,
    })
  }

  return (
    <div className="rest-area">
      <h2>Rest Area</h2>
      <p className="rest-area__hp">HP: {run.hp} / {run.maxHp}</p>
      <p className="rest-area__coins">Coins: {run.coins}</p>
      <button className="btn-heal" onClick={handleHeal} disabled={!canHeal}>
        Heal +{HEAL_AMOUNT} HP ({HEAL_COST} coins)
      </button>
      <button className="btn-leave" onClick={onLeave}>Leave</button>
    </div>
  )
}
