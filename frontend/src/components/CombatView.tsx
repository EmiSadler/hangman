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
  const [combatOver, setCombatOver] = useState(false)
  const wrongCountRef = useRef(0)
  const pendingRunRef = useRef<RunState | null>(null)

  function handleGuessResult(_letter: string, correct: boolean, _occurrences: number) {
    if (!correct) {
      wrongCountRef.current += 1
      const newHp = Math.max(0, displayRun.hp - DAMAGE_PER_WRONG)
      setDisplayRun(prev => ({ ...prev, hp: newHp }))
    }
  }

  function handleWordSolved() {
    const coinsEarned = room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY
    const updated: RunState = {
      ...run,
      hp: displayRun.hp,
      coins: run.coins + coinsEarned,
    }
    pendingRunRef.current = updated
    setDisplayRun(updated)
    setCombatOver(true)
  }

  function handleWordLost() {
    const damage = wrongCountRef.current * DAMAGE_PER_WRONG
    const newHp = Math.max(0, run.hp - damage)
    const updated: RunState = {
      ...run,
      hp: newHp,
      coins: run.coins,
      status: newHp <= 0 ? 'lost' : run.status,
    }
    pendingRunRef.current = updated
    setDisplayRun(updated)
    setCombatOver(true)
  }

  function handlePlayAgain() {
    onCombatEnd(pendingRunRef.current ?? run)
  }

  const playAgainLabel = displayRun.hp <= 0 ? 'Play Again' : 'Continue'

  return (
    <div className="combat-view">
      <div className="combat-view__stats">
        <span className="combat-view__hp">HP: {displayRun.hp} / {displayRun.maxHp}</span>
        <span className="combat-view__coins">Coins: {displayRun.coins}</span>
      </div>
      <p className="combat-view__floor">Floor {floor}</p>
      <GameBoard
        initialState={initialState}
        onGuessResult={handleGuessResult}
        onWordSolved={handleWordSolved}
        onWordLost={handleWordLost}
        onPlayAgain={handlePlayAgain}
        playAgainLabel={playAgainLabel}
        combatOver={combatOver}
      />
    </div>
  )
}
