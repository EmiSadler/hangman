import { useState } from 'react'
import type { RunState, ArtifactId, PotionId } from '../types'
import { MAX_INVENTORY, MAX_POTION_SLOTS } from '../runState'
import { POTIONS } from '../potions'
import { ARTIFACTS } from '../artifacts'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  coinsEarned: number
  pendingPotion: PotionId | null
  pendingArtifact: ArtifactId | null
  onLeave: (updatedRun: RunState) => void
}

export default function CombatRewardScreen({ run, coinsEarned, pendingPotion, pendingArtifact, onLeave }: Props) {
  const potionFull = run.potions.length >= MAX_POTION_SLOTS
  const artifactFull = run.artifacts.length >= MAX_INVENTORY

  const [localRun, setLocalRun] = useState<RunState>(() => {
    let r = run
    if (pendingPotion && !potionFull) {
      r = { ...r, potions: [...r.potions, pendingPotion] }
    }
    if (pendingArtifact && !artifactFull) {
      r = { ...r, artifacts: [...r.artifacts, pendingArtifact] }
    }
    return r
  })

  const [potionSwapMode, setPotionSwapMode] = useState(!!pendingPotion && potionFull)
  const [potionSkipped, setPotionSkipped] = useState(false)
  const [artifactSwapMode, setArtifactSwapMode] = useState(!!pendingArtifact && artifactFull)
  const [artifactSkipped, setArtifactSkipped] = useState(false)
  const [removingArtifact, setRemovingArtifact] = useState<ArtifactId | null>(null)

  function handleSwapPotion(removeId: PotionId) {
    setLocalRun(prev => {
      const newPotions = [...prev.potions]
      const idx = newPotions.indexOf(removeId)
      if (idx !== -1) newPotions.splice(idx, 1)
      newPotions.push(pendingPotion!)
      return { ...prev, potions: newPotions }
    })
    setPotionSwapMode(false)
  }

  function handleSwapArtifact(removeId: ArtifactId) {
    setLocalRun(prev => ({
      ...prev,
      artifacts: [...prev.artifacts.filter(id => id !== removeId), pendingArtifact!],
    }))
    setArtifactSwapMode(false)
    setRemovingArtifact(null)
  }

  const canContinue = !potionSwapMode && !artifactSwapMode

  return (
    <div className="combat-reward">
      <h2 className="combat-reward__title">Rewards</h2>

      {coinsEarned > 0 && (
        <p className="combat-reward__coins">💰 +{coinsEarned} coins</p>
      )}

      {pendingPotion && (
        <div className="combat-reward__item">
          {potionSwapMode ? (
            <>
              <p>Found {POTIONS[pendingPotion].emoji} <strong>{POTIONS[pendingPotion].name}</strong>! Pouch full — replace one or skip:</p>
              <div className="combat-reward__swap-options">
                {run.potions.map((id, i) => (
                  <button key={i} className="btn-swap-potion" onClick={() => handleSwapPotion(id)}>
                    Replace {POTIONS[id].emoji} {POTIONS[id].name}
                  </button>
                ))}
                <button className="btn-skip" onClick={() => { setPotionSwapMode(false); setPotionSkipped(true) }}>
                  Skip
                </button>
              </div>
            </>
          ) : (
            <p className="combat-reward__found">
              {potionSkipped
                ? `Skipped ${POTIONS[pendingPotion].emoji} ${POTIONS[pendingPotion].name}`
                : `${POTIONS[pendingPotion].emoji} ${POTIONS[pendingPotion].name} added to pouch!`}
            </p>
          )}
        </div>
      )}

      {pendingArtifact && (
        <div className="combat-reward__item">
          {artifactSwapMode && !removingArtifact ? (
            <>
              <p>Found {ARTIFACTS[pendingArtifact].emoji} <strong>{ARTIFACTS[pendingArtifact].name}</strong>! Inventory full — replace one or skip:</p>
              <button className="btn-skip" onClick={() => { setArtifactSwapMode(false); setArtifactSkipped(true) }}>
                Skip
              </button>
              <ArtifactShelf artifacts={localRun.artifacts} onRemove={id => setRemovingArtifact(id)} />
            </>
          ) : artifactSwapMode && removingArtifact ? (
            <div className="combat-reward__confirm">
              <p>
                Replace {ARTIFACTS[removingArtifact].emoji} <strong>{ARTIFACTS[removingArtifact].name}</strong> with{' '}
                {ARTIFACTS[pendingArtifact].emoji} <strong>{ARTIFACTS[pendingArtifact].name}</strong>?
              </p>
              <button className="btn-confirm-swap" onClick={() => handleSwapArtifact(removingArtifact)}>Confirm</button>
              <button className="btn-cancel-swap" onClick={() => setRemovingArtifact(null)}>Cancel</button>
            </div>
          ) : (
            <p className="combat-reward__found">
              {artifactSkipped
                ? `Skipped ${ARTIFACTS[pendingArtifact].emoji} ${ARTIFACTS[pendingArtifact].name}`
                : `${ARTIFACTS[pendingArtifact].emoji} ${ARTIFACTS[pendingArtifact].name} added to inventory!`}
            </p>
          )}
        </div>
      )}

      {canContinue && (
        <button className="btn-leave" onClick={() => onLeave(localRun)}>Continue</button>
      )}
    </div>
  )
}
