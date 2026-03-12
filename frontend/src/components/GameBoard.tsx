import { useState, useEffect, useCallback } from 'react'
import type { GameState, GameStatus } from '../types'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGuessResult: (letter: string, correct: boolean, occurrences: number) => void
  onWordSolved: () => void
  onPlayAgain: () => void
  playAgainLabel?: string
  combatOver?: boolean
  blockedLetters?: string[]
  voidLetters?: string[]
  mudLetters?: string[]
  vinedLetters?: string[]
  onWrongSolve?: () => void
}

export default function GameBoard({ initialState, onGuessResult, onWordSolved, onPlayAgain, playAgainLabel, combatOver, blockedLetters = [], voidLetters = [], mudLetters = [], vinedLetters = [], onWrongSolve }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctLetters, setCorrectLetters] = useState<string[]>([])
  const [solveInput, setSolveInput] = useState('')

  const isWordSolved = game.status === 'won'
  const isOver = isWordSolved || !!combatOver

  const displayMasked = combatOver
    ? initialState.word.split('').join(' ')
    : game.maskedWord

  const handleGuess = useCallback(async (letter: string) => {
    if (isOver || loading) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${initialState.gameId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      const updated: GameState = {
        ...game,
        maskedWord: data.masked_word,
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
      }
      if (data.correct) {
        setCorrectLetters(prev => [...prev, letter])
      }
      setGame(updated)
      onGuessResult(letter, data.correct, data.occurrences)
      if (updated.status === 'won') {
        onWordSolved()
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }, [initialState, game, isOver, loading, onGuessResult, onWordSolved])

  const handleSolve = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (isOver || loading || !solveInput.trim()) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${initialState.gameId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: solveInput.trim().toLowerCase() }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      if (data.status === 'won') {
        setGame(prev => ({ ...prev, status: 'won', maskedWord: data.masked_word }))
        onWordSolved()
      } else {
        setSolveInput('')
        onWrongSolve?.()
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }, [initialState, isOver, loading, solveInput, onWordSolved, onWrongSolve])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOver || loading) return
      // Don't intercept keystrokes when typing in the solve input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const letter = e.key.toLowerCase()
      if (letter.length !== 1 || !/^[a-z]$/.test(letter)) return
      if (game.guessedLetters.includes(letter)) return
      if (blockedLetters.includes(letter)) return
      if (voidLetters.includes(letter)) return
      if (vinedLetters.includes(letter)) return
      handleGuess(letter)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOver, loading, game.guessedLetters, blockedLetters, voidLetters, vinedLetters, handleGuess])

  return (
    <div className="game-board">
      <WordDisplay maskedWord={displayMasked} />
      {error && <p className="app__error">{error}</p>}
      {!isOver && (
        <>
          <Keyboard
            guessedLetters={game.guessedLetters}
            correctLetters={correctLetters}
            onGuess={handleGuess}
            disabled={loading}
            blockedLetters={blockedLetters}
            voidLetters={voidLetters}
            mudLetters={mudLetters}
            vinedLetters={vinedLetters}
          />
          <form className="game-board__solve-form" onSubmit={handleSolve}>
            <input
              className="game-board__solve-input"
              type="text"
              value={solveInput}
              onChange={e => setSolveInput(e.target.value)}
              placeholder="Type the word…"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              className="game-board__solve-btn"
              disabled={loading || !solveInput.trim()}
            >
              Solve
            </button>
          </form>
        </>
      )}
      {(isWordSolved || !!combatOver) && (
        <GameResult
          status="won"
          word={initialState.word}
          onPlayAgain={onPlayAgain}
          buttonLabel={playAgainLabel}
        />
      )}
    </div>
  )
}
