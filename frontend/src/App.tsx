import { useState, useEffect } from 'react'
import type { GameState, GameStatus, RunState, RunScore, Room, ClassName } from './types'
import {
  buildRun, buildRooms, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, computeRoomsCleared,
  pickFloorThemes,
  SCORE_KEY,
} from './runState'
import RunSetup from './components/RunSetup'
import FloorProgress from './components/FloorProgress'
import CombatView from './components/CombatView'
import RestArea from './components/RestArea'
import TreasureArea from './components/TreasureArea'
import ShopArea from './components/ShopArea'
import RunResult from './components/RunResult'
import './App.css'

type AppPhase = 'idle' | 'combat' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle')
  const [run, setRun] = useState<RunState | null>(null)
  const [score, setScore] = useState<RunScore>(loadRunScore)
  const [currentGame, setCurrentGame] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Resume saved run on mount
  useEffect(() => {
    const saved = loadRun()
    if (saved && saved.status === 'in_progress') {
      setRun(saved)
      const room = saved.rooms[saved.roomIndex]
      if (room.type === 'enemy' || room.type === 'boss') {
        const hint = room.type === 'enemy' ? saved.pendingReveal : false
        fetchAndEnterCombat(saved, room.type, hint)
      } else if (room.type === 'rest') {
        setPhase('rest')
      } else if (room.type === 'treasure') {
        setPhase('treasure')
      } else if (room.type === 'shop') {
        setPhase('shop')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function createSession(): Promise<string | null> {
    try {
      const resp = await fetch('/api/session', { method: 'POST' })
      if (!resp.ok) return null
      const data = await resp.json()
      return (data.session_id as string) ?? null
    } catch {
      return null
    }
  }

  async function fetchAndEnterCombat(
    currentRun: RunState,
    roomType: 'enemy' | 'boss',
    hint: boolean,
  ) {
    setError(null)
    try {
      const body: Record<string, unknown> = { room_type: roomType }
      if (hint) body.hint = true
      if (currentRun.sessionId) body.session_id = currentRun.sessionId
      const resp = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Failed to start game')
        return
      }
      const game: GameState = {
        gameId: data.game_id,
        maskedWord: data.masked_word,
        word: data.word,
        category: data.category,
        firstLetter: data.first_letter,
        guessedLetters: data.guessed_letters,
        status: 'in_progress' as GameStatus,
      }
      if (hint) {
        const withRevealCleared = { ...currentRun, pendingReveal: false }
        setRun(withRevealCleared)
        saveRun(withRevealCleared)
      }
      setCurrentGame(game)
      setPhase('combat')
    } catch {
      setError('Could not reach server — is the backend running?')
    }
  }

  async function handleStartRun(className: ClassName) {
    const newRun = buildRun(className, pickFloorThemes())
    const sessionId = await createSession()
    const runWithSession: RunState = { ...newRun, sessionId }
    saveRun(runWithSession)
    setRun(runWithSession)
    await fetchAndEnterCombat(runWithSession, 'enemy', false)
  }

  async function handleCombatEnd(updatedRun: RunState) {
    const roomIndex = updatedRun.roomIndex
    const updatedRooms = updatedRun.rooms.map((r, i) =>
      i === roomIndex ? { ...r, completed: true } : r,
    )

    if (updatedRun.hp <= 0) {
      const finalRun: RunState = { ...updatedRun, rooms: updatedRooms, status: 'lost' }
      clearRun()
      setRun(finalRun)
      setScore(prev => {
        const next: RunScore = {
          runsCleared: prev.runsCleared,
          runsFailed: prev.runsFailed + 1,
          bestRooms: Math.max(prev.bestRooms, computeRoomsCleared(finalRun)),
        }
        saveRunScore(next)
        return next
      })
      setPhase('run_lost')
      return
    }

    if (roomIndex === 11) {
      if (updatedRun.floor === 3) {
        const finalRun: RunState = { ...updatedRun, rooms: updatedRooms, status: 'won' }
        clearRun()
        setRun(finalRun)
        setScore(prev => {
          const next: RunScore = {
            runsCleared: prev.runsCleared + 1,
            runsFailed: prev.runsFailed,
            bestRooms: Math.max(prev.bestRooms, 33),
          }
          saveRunScore(next)
          return next
        })
        setPhase('run_won')
        return
      } else {
        const nextFloor = updatedRun.floor + 1
        const nextFloorRun: RunState = {
          ...updatedRun,
          floor: nextFloor,
          roomIndex: 0,
          rooms: buildRooms(nextFloor),
          pendingReveal: false,
        }
        saveRun(nextFloorRun)
        setRun(nextFloorRun)
        await fetchAndEnterCombat(nextFloorRun, 'enemy', false)
        return
      }
    }

    const nextRun: RunState = { ...updatedRun, rooms: updatedRooms, roomIndex: roomIndex + 1 }
    saveRun(nextRun)
    setRun(nextRun)
    await enterRoom(nextRun, nextRun.rooms[nextRun.roomIndex])
  }

  async function enterRoom(currentRun: RunState, room: Room) {
    if (room.type === 'enemy') {
      await fetchAndEnterCombat(currentRun, 'enemy', currentRun.pendingReveal)
    } else if (room.type === 'boss') {
      await fetchAndEnterCombat(currentRun, 'boss', false)
    } else if (room.type === 'rest') {
      setPhase('rest')
    } else if (room.type === 'treasure') {
      setPhase('treasure')
    } else if (room.type === 'shop') {
      setPhase('shop')
    }
  }

  async function handleRestChoose(updatedRun: RunState) {
    await advanceFromNonCombatRoom(updatedRun)
  }

  async function handleShopLeave(updatedRun: RunState) {
    await advanceFromNonCombatRoom(updatedRun)
  }

  async function handleTreasureChoose(updatedRun: RunState) {
    await advanceFromNonCombatRoom(updatedRun)
  }

  async function advanceFromNonCombatRoom(currentRun: RunState) {
    const roomIndex = currentRun.roomIndex
    const updatedRooms = currentRun.rooms.map((r, i) =>
      i === roomIndex ? { ...r, completed: true } : r,
    )
    const nextRun: RunState = { ...currentRun, rooms: updatedRooms, roomIndex: roomIndex + 1 }
    saveRun(nextRun)
    setRun(nextRun)
    await enterRoom(nextRun, nextRun.rooms[nextRun.roomIndex])
  }

  function handleReset() {
    clearRun()
    localStorage.removeItem(SCORE_KEY)
    setRun(null)
    setCurrentGame(null)
    setPhase('idle')
    const zero: RunScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
    setScore(zero)
  }

  function handleGiveUp() {
    if (!run) return
    clearRun()
    setScore(prev => {
      const next: RunScore = {
        runsCleared: prev.runsCleared,
        runsFailed: prev.runsFailed + 1,
        bestRooms: Math.max(prev.bestRooms, computeRoomsCleared(run)),
      }
      saveRunScore(next)
      return next
    })
    setRun({ ...run, status: 'lost' })
    setPhase('run_lost')
  }

  function handleNewRun() {
    clearRun()
    setRun(null)
    setCurrentGame(null)
    setError(null)
    setPhase('idle')
  }

  const showProgress = phase !== 'idle' && phase !== 'run_won' && phase !== 'run_lost'

  return (
    <div className="app">
      {error && <p className="app__error">{error}</p>}

      {phase === 'idle' && (
        <RunSetup onStart={handleStartRun} score={score} onReset={handleReset} />
      )}

      {showProgress && run && (
        <FloorProgress rooms={run.rooms} currentIndex={run.roomIndex} floor={run.floor} />
      )}

      {showProgress && (
        <button className="btn-give-up" onClick={handleGiveUp}>Give Up</button>
      )}

      {phase === 'combat' && currentGame && run && (
        <CombatView
          key={currentGame.gameId}
          run={run}
          room={run.rooms[run.roomIndex]}
          initialState={currentGame}
          floor={run.floor}
          onCombatEnd={handleCombatEnd}
        />
      )}

      {phase === 'rest' && run && (
        <RestArea run={run} onLeave={handleRestChoose} />
      )}

      {phase === 'treasure' && run && (
        <TreasureArea run={run} onChoose={handleTreasureChoose} />
      )}

      {phase === 'shop' && run && (
        <ShopArea run={run} onLeave={handleShopLeave} />
      )}

      {(phase === 'run_won' || phase === 'run_lost') && run && (
        <RunResult
          won={phase === 'run_won'}
          roomsCleared={computeRoomsCleared(run)}
          score={score}
          onNewRun={handleNewRun}
        />
      )}
    </div>
  )
}
