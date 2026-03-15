import { useState } from 'react'
import type { ArtifactId } from '../types'
import { ARTIFACTS } from '../artifacts'

interface Props {
  artifacts: ArtifactId[]
  vertical?: boolean
  onRemove?: (id: ArtifactId) => void
}

export default function ArtifactShelf({ artifacts, vertical = false, onRemove }: Props) {
  const [tooltip, setTooltip] = useState<ArtifactId | null>(null)

  if (artifacts.length === 0) return null

  return (
    <div className={`artifact-shelf${vertical ? ' artifact-shelf--vertical' : ''}${vertical && artifacts.length > 3 ? ' artifact-shelf--two-col' : ''}`}>
      {artifacts.map(id => {
        const art = ARTIFACTS[id]
        return (
          <div
            key={id}
            className="artifact-shelf__item"
            role="img"
            aria-label={art.name}
            tabIndex={0}
            onMouseEnter={() => setTooltip(id)}
            onMouseLeave={() => setTooltip(null)}
            onFocus={() => setTooltip(id)}
            onBlur={() => setTooltip(null)}
          >
            <span className="artifact-shelf__emoji">{art.emoji}</span>
            {tooltip === id && (
              <div className="artifact-shelf__tooltip">
                <strong>{art.name}</strong>
                <p>{art.description}</p>
              </div>
            )}
            {onRemove && (
              <button
                className="artifact-shelf__remove"
                onClick={() => onRemove(id)}
                aria-label={`Remove ${art.name}`}
              >
                Remove
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
