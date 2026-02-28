import { useRef, useState } from 'react'
import type { GameState, Room, RunState } from '../types'
import { DAMAGE_PER_WRONG, COINS_PER_ENEMY, COINS_PER_BOSS } from '../runState'
import GameBoard from './GameBoard'

interface Props {
  run: RunState
  room: Room
  initialState: GameState
  floor: number
  onCombatEnd: (updatedRun: RunState) => void
}

export default function CombatView({ run, room, initialState, floor, onCombatEnd }: Props) {
  const [displayRun, setDisplayRun] = useState<RunState>(run)
  const pendingRunRef = useRef<RunState | null>(null)

  function handleGameEnd(result: 'won' | 'lost', wrongGuessesMade: number) {
    const damage = wrongGuessesMade * DAMAGE_PER_WRONG
    const newHp = Math.max(0, run.hp - damage)
    const coinsEarned = result === 'won'
      ? (room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY)
      : 0
    const updated: RunState = {
      ...run,
      hp: newHp,
      coins: run.coins + coinsEarned,
      status: newHp <= 0 ? 'lost' : run.status,
    }
    pendingRunRef.current = updated
    setDisplayRun(updated)
  }

  function handlePlayAgain() {
    onCombatEnd(pendingRunRef.current ?? run)
  }

  return (
    <div className="combat-view">
      <div className="combat-view__stats">
        <span className="combat-view__hp">HP: {displayRun.hp} / {displayRun.maxHp}</span>
        <span className="combat-view__coins">Coins: {displayRun.coins}</span>
      </div>
      <p className="combat-view__floor">Floor {floor}</p>
      <GameBoard
        initialState={initialState}
        onGameEnd={handleGameEnd}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  )
}
