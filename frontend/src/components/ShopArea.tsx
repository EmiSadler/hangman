import { useState } from 'react'
import type { RunState, ArtifactId, PotionId } from '../types'
import { sampleArtifacts, type Artifact, ARTIFACTS } from '../artifacts'
import { POTIONS, type Potion } from '../potions'
import { MAX_INVENTORY, MAX_POTION_SLOTS } from '../runState'
import ArtifactShelf from './ArtifactShelf'
import PlayerStats from './PlayerStats'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function ShopArea({ run, onLeave }: Props) {
  const [localRun, setLocalRun] = useState<RunState>(run)
  const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))
  const [pendingSwap, setPendingSwap] = useState<Artifact | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ArtifactId | null>(null)
  const [potionStock] = useState<Potion[]>(() => {
    const extras: PotionId[] = ['strength_potion', 'shielding_potion', 'archivists_brew']
    for (let i = extras.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[extras[i], extras[j]] = [extras[j], extras[i]]
    }
    return [POTIONS['health_potion'], ...extras.slice(0, 2).map(id => POTIONS[id])]
  })

  const displayStock = stock.filter(art => !localRun.artifacts.includes(art.id))

  function handleBuy(art: Artifact) {
    if (localRun.artifacts.length >= MAX_INVENTORY) {
      setPendingSwap(art)
      setPendingRemove(null)
      return
    }
    let updated: RunState = {
      ...localRun,
      coins: localRun.coins - art.price,
      artifacts: [...localRun.artifacts, art.id],
    }
    if (art.id === 'chainmail') updated = { ...updated, maxHp: updated.maxHp + 5, hp: updated.hp + 5 }
    setLocalRun(updated)
  }

  function handleConfirmSwap() {
    if (!pendingSwap || !pendingRemove) return
    let updated: RunState = {
      ...localRun,
      coins: localRun.coins - pendingSwap.price,
      artifacts: [...localRun.artifacts.filter(id => id !== pendingRemove), pendingSwap.id],
    }
    // chainmail's +5 maxHp is permanent — swapping it out does not reverse the bonus
    if (pendingSwap.id === 'chainmail') updated = { ...updated, maxHp: updated.maxHp + 5, hp: updated.hp + 5 }
    setLocalRun(updated)
    setPendingSwap(null)
    setPendingRemove(null)
  }

  function handleBuyPotion(potion: Potion) {
    setLocalRun(prev => ({
      ...prev,
      coins: prev.coins - potion.price,
      potions: [...prev.potions, potion.id],
    }))
  }

  return (
    <div className="shop-area">
      <h2>Shop</h2>
      <PlayerStats run={localRun} />

      {pendingSwap && pendingRemove ? (
        <div className="shop-area__confirm-banner">
          <p>
            Remove {ARTIFACTS[pendingRemove].emoji} <strong>{ARTIFACTS[pendingRemove].name}</strong>{' '}
            to get {pendingSwap.emoji} <strong>{pendingSwap.name}</strong>? This cannot be undone.
          </p>
          <div className="shop-area__confirm-buttons">
            <button className="btn-confirm-swap" onClick={handleConfirmSwap}>Confirm</button>
            <button className="btn-cancel-swap" onClick={() => setPendingRemove(null)}>Cancel</button>
          </div>
        </div>
      ) : pendingSwap ? (
        <div className="shop-area__swap-banner">
          <p>Inventory full ({MAX_INVENTORY}/{MAX_INVENTORY}). Choose an item to remove:</p>
          <button className="btn-cancel-swap" onClick={() => { setPendingSwap(null); setPendingRemove(null) }}>Cancel</button>
        </div>
      ) : null}

      <div className="shop-area__stock">
        {displayStock.map(art => (
          <div key={art.id} className="shop-area__item">
            <span className="shop-area__item-info">
              {art.emoji} <strong>{art.name}</strong> — {art.description}
            </span>
            <button
              className="btn-buy"
              onClick={() => handleBuy(art)}
              disabled={localRun.coins < art.price}
            >
              {localRun.artifacts.length >= MAX_INVENTORY ? 'Swap' : 'Buy'} ({art.price} coins)
            </button>
          </div>
        ))}
      </div>
      <div className="shop-area__potions">
        <h3>Potions</h3>
        {potionStock.map(potion => (
          <div key={potion.id} className="shop-area__potion-item">
            <span className="shop-area__item-info">
              {potion.emoji} <strong>{potion.name}</strong> — {potion.description}
            </span>
            <button
              className="btn-buy-potion"
              aria-label={`Buy ${potion.name}`}
              onClick={() => handleBuyPotion(potion)}
              disabled={localRun.coins < potion.price || localRun.potions.length >= MAX_POTION_SLOTS}
            >
              Buy ({potion.price} coins)
            </button>
          </div>
        ))}
        {localRun.potions.length > 0 && (
          <p className="shop-area__potion-count">
            Pouch: {localRun.potions.length}/{MAX_POTION_SLOTS}
          </p>
        )}
      </div>
      <button className="btn-leave" onClick={() => onLeave(localRun)}>Leave</button>
      <ArtifactShelf
        artifacts={localRun.artifacts}
        onRemove={pendingSwap ? (id) => setPendingRemove(id) : undefined}
      />
    </div>
  )
}
