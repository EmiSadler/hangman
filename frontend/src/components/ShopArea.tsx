import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact, ARTIFACTS } from '../artifacts'
import { MAX_INVENTORY } from '../runState'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function ShopArea({ run, onLeave }: Props) {
  const [localRun, setLocalRun] = useState<RunState>(run)
  const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))
  const [pendingSwap, setPendingSwap] = useState<Artifact | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ArtifactId | null>(null)

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
    if (pendingSwap.id === 'chainmail') updated = { ...updated, maxHp: updated.maxHp + 5, hp: updated.hp + 5 }
    setLocalRun(updated)
    setPendingSwap(null)
    setPendingRemove(null)
  }

  return (
    <div className="shop-area">
      <h2>Shop</h2>
      <p className="shop-area__coins">Coins: {localRun.coins}</p>

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
              Buy ({art.price} coins)
            </button>
          </div>
        ))}
      </div>
      <button className="btn-leave" onClick={() => onLeave(localRun)}>Leave</button>
      <ArtifactShelf
        artifacts={localRun.artifacts}
        onRemove={pendingSwap ? (id) => setPendingRemove(id) : undefined}
      />
    </div>
  )
}
