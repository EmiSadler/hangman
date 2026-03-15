import type { RunState } from '../types'
import { BASE_DAMAGE_PER_HIT, MAX_POTION_SLOTS } from '../runState'
import { POTIONS } from '../potions'

interface Props {
  run: RunState
}

export default function PlayerStats({ run }: Props) {
  const atk = BASE_DAMAGE_PER_HIT + run.bonusDamage + (run.artifacts.includes('short_sword') ? 1 : 0)

  return (
    <div className="player-stats">
      <div className="player-stats__hp-bar">
        <div
          className="player-stats__hp-fill"
          style={{ width: `${Math.max(0, (run.hp / run.maxHp) * 100)}%` }}
        />
      </div>
      <div className="player-stats__row">
        <span>
          HP: {run.hp} / {run.maxHp}
          {run.shield > 0 && <span> 🛡 {run.shield}</span>}
        </span>
        <span>⚔ {atk}</span>
        <span>Coins: {run.coins}</span>
        {run.potions.length > 0 && (
          <span>{run.potions.map(id => POTIONS[id].emoji).join('')} {run.potions.length}/{MAX_POTION_SLOTS}</span>
        )}
      </div>
    </div>
  )
}
