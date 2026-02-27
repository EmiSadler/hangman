import { useState } from 'react'
import type { GameState, GameStatus } from '../types'
import HangmanSvg from './HangmanSvg'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGameEnd: (result: 'won' | 'lost') => void
  onPlayAgain: () => void
}

export default function GameBoard({ initialState, onGameEnd, onPlayAgain }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctLetters, setCorrectLetters] = useState<string[]>([])
  const [solvingMode, setSolvingMode] = useState(false)
  const [solveInput, setSolveInput] = useState('')

  const wrongCount = game.maxWrong - game.wrongGuessesLeft

  async function handleGuess(letter: string) {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${game.gameId}/guess`, {
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
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
        word: data.word ?? undefined,
      }
      if (data.correct) {
        setCorrectLetters((prev) => [...prev, letter])
      }
      setGame(updated)
      if (updated.status === 'won' || updated.status === 'lost') {
        onGameEnd(updated.status)
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleSolve() {
    const word = solveInput.trim()
    if (!word) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${game.gameId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      const updated: GameState = {
        ...game,
        maskedWord: data.masked_word,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
        word: data.word ?? undefined,
      }
      setGame(updated)
      setSolvingMode(false)
      setSolveInput('')
      if (updated.status === 'won' || updated.status === 'lost') {
        onGameEnd(updated.status)
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }

  const isOver = game.status !== 'in_progress'

  return (
    <div className="game-board">
      <HangmanSvg wrongCount={wrongCount} />
      <WordDisplay maskedWord={game.maskedWord} />
      <p className="wrong-count">
        {game.wrongGuessesLeft} guess{game.wrongGuessesLeft !== 1 ? 'es' : ''} remaining
      </p>
      {error && <p className="app__error">{error}</p>}
      {!isOver && (
        solvingMode ? (
          <div className="solve-form">
            <input
              autoFocus
              type="text"
              className="solve-input"
              value={solveInput}
              onChange={(e) => setSolveInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSolve()}
              placeholder="Type the word..."
              disabled={loading}
            />
            <div className="solve-form__actions">
              <button
                className="btn-difficulty"
                onClick={handleSolve}
                disabled={loading || !solveInput.trim()}
              >
                Submit
              </button>
              <button
                className="btn-cancel"
                onClick={() => { setSolvingMode(false); setSolveInput('') }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <Keyboard
              guessedLetters={game.guessedLetters}
              correctLetters={correctLetters}
              onGuess={handleGuess}
              disabled={loading}
            />
            <button className="btn-solve" onClick={() => setSolvingMode(true)}>
              Solve Puzzle
            </button>
          </>
        )
      )}
      {isOver && (
        <GameResult
          status={game.status}
          word={game.word ?? game.maskedWord.replace(/ /g, '')}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  )
}
