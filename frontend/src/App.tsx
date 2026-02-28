import { useState } from 'react'
import type { GameState, Score } from './types'
import GameSetup from './components/GameSetup'
import GameBoard from './components/GameBoard'
import './App.css'

const SCORE_KEY = 'hangman_score'

function loadScore(): Score {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { wins: 0, losses: 0 }
    return JSON.parse(raw) as Score
  } catch {
    return { wins: 0, losses: 0 }
  }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [score, setScore] = useState<Score>(loadScore)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setError(null)
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Failed to start game')
        return
      }
      setGame({
        gameId: data.game_id,
        maskedWord: data.masked_word,
        maxWrong: data.max_wrong,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: 'in_progress',
      })
    } catch {
      setError('Could not reach server — is the backend running?')
    }
  }

  function handleGameEnd(result: 'won' | 'lost') {
    setScore((prev) => {
      const next = {
        wins: result === 'won' ? prev.wins + 1 : prev.wins,
        losses: result === 'lost' ? prev.losses + 1 : prev.losses,
      }
      localStorage.setItem(SCORE_KEY, JSON.stringify(next))
      return next
    })
  }

  function handlePlayAgain() {
    setGame(null)
  }

  function handleReset() {
    localStorage.removeItem(SCORE_KEY)
    setScore({ wins: 0, losses: 0 })
  }

  return (
    <div className="app">
      <div className="score-row">
        <div className="score-pill">
          {score.wins} win{score.wins !== 1 ? 's' : ''} / {score.losses} loss{score.losses !== 1 ? 'es' : ''}
        </div>
        <button className="btn-forget" onClick={handleReset}>Forget me</button>
      </div>
      {error && <p className="app__error">{error}</p>}
      {game === null ? (
        <GameSetup onStart={handleStart} />
      ) : (
        <GameBoard
          initialState={game}
          onGameEnd={handleGameEnd}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  )
}
