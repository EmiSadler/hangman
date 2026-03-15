import type { RunState } from '../types'
import ArtifactShelf from './ArtifactShelf'
import PlayerStats from './PlayerStats'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function RestArea({ run, onLeave }: Props) {
  return (
    <div className="rest-area">
      <h2>Rest Area</h2>
      <PlayerStats run={run} />
      <button
        className="btn-rest-option"
        onClick={() => onLeave({ ...run, hp: run.maxHp })}
      >
        Rest fully — heal to {run.maxHp} HP
      </button>
      <button
        className="btn-rest-option"
        onClick={() => onLeave({ ...run, bonusDamage: run.bonusDamage + 1 })}
      >
        Power up — +1 permanent damage
      </button>
      <ArtifactShelf artifacts={run.artifacts} />
    </div>
  )
}
