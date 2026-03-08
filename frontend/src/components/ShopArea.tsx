import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact } from '../artifacts'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function ShopArea({ run, onLeave }: Props) {
  const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))

  function handleBuy(art: Artifact) {
    let updated: RunState = {
      ...run,
      coins: run.coins - art.price,
      artifacts: [...run.artifacts, art.id],
    }
    if (art.id === 'chainmail') {
      updated = { ...updated, maxHp: run.maxHp + 5, hp: run.hp + 5 }
    }
    onLeave(updated)
  }

  return (
    <div className="shop-area">
      <h2>Shop</h2>
      <p className="shop-area__coins">Coins: {run.coins}</p>
      <div className="shop-area__stock">
        {stock.map(art => (
          <div key={art.id} className="shop-area__item">
            <span className="shop-area__item-info">
              {art.emoji} <strong>{art.name}</strong> — {art.description}
            </span>
            <button
              className="btn-buy"
              onClick={() => handleBuy(art)}
              disabled={run.coins < art.price}
            >
              Buy ({art.price} coins)
            </button>
          </div>
        ))}
      </div>
      <button className="btn-leave" onClick={() => onLeave(run)}>Leave</button>
      <ArtifactShelf artifacts={run.artifacts} />
    </div>
  )
}
