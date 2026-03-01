import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact } from '../artifacts'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onChoose: (updatedRun: RunState) => void
}

export default function TreasureArea({ run, onChoose }: Props) {
  const [artifactChoices, setArtifactChoices] = useState<Artifact[] | null>(null)

  function handleFindArtifact() {
    setArtifactChoices(sampleArtifacts(run.artifacts, 3))
  }

  function handlePickArtifact(id: ArtifactId) {
    let updated: RunState = { ...run, artifacts: [...run.artifacts, id] }
    if (id === 'chainmail') {
      updated = { ...updated, maxHp: run.maxHp + 5, hp: run.hp + 5 }
    }
    onChoose(updated)
  }

  if (artifactChoices !== null) {
    return (
      <div className="treasure-area">
        <h2>Find an Artifact</h2>
        <p>Choose one:</p>
        {artifactChoices.map(art => (
          <button key={art.id} className="btn-treasure" onClick={() => handlePickArtifact(art.id)}>
            {art.emoji} {art.name} — {art.description}
          </button>
        ))}
        <ArtifactShelf artifacts={run.artifacts} />
      </div>
    )
  }

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
      <button className="btn-treasure" onClick={handleFindArtifact}>
        Find an Artifact
      </button>
      <ArtifactShelf artifacts={run.artifacts} />
    </div>
  )
}
