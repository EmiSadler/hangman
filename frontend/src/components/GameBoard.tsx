import { useState, useEffect, useCallback } from 'react'
import type { GameState, GameStatus } from '../types'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGuessResult: (letter: string, correct: boolean, occurrences: number) => void
  onWordSolved: () => void
  onWordLost?: () => void
  onPlayAgain: () => void
  playAgainLabel?: string
  combatOver?: boolean
}

export default function GameBoard({ initialState, onGuessResult, onWordSolved, onWordLost, onPlayAgain, playAgainLabel, combatOver }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctLetters, setCorrectLetters] = useState<string[]>([])

  const isWordSolved = game.status === 'won'
  const isWordLost = game.status === 'lost'
  const isOver = isWordSolved || isWordLost || !!combatOver

  // When combatOver, show fully revealed word
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
      } else if (updated.status === 'lost') {
        onWordLost?.()
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }, [initialState, game, isOver, loading, onGuessResult, onWordSolved, onWordLost])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOver || loading) return
      const letter = e.key.toLowerCase()
      if (letter.length !== 1 || !/^[a-z]$/.test(letter)) return
      if (game.guessedLetters.includes(letter)) return
      handleGuess(letter)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOver, loading, game.guessedLetters, handleGuess])

  return (
    <div className="game-board">
      <WordDisplay maskedWord={displayMasked} />
      {error && <p className="app__error">{error}</p>}
      {!isOver && (
        <Keyboard
          guessedLetters={game.guessedLetters}
          correctLetters={correctLetters}
          onGuess={handleGuess}
          disabled={loading}
        />
      )}
      {(isWordSolved || !!combatOver) && (
        <GameResult
          status={isWordSolved ? 'won' : 'won'}
          word={initialState.word}
          onPlayAgain={onPlayAgain}
          buttonLabel={playAgainLabel}
        />
      )}
    </div>
  )
}
