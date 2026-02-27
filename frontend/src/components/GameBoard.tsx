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

  const isOver = game.status !== 'in_progress'

  return (
    <div>
      <HangmanSvg wrongCount={wrongCount} />
      <WordDisplay maskedWord={game.maskedWord} />
      <p>Wrong guesses left: {game.wrongGuessesLeft}</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Keyboard
        guessedLetters={game.guessedLetters}
        correctLetters={correctLetters}
        onGuess={handleGuess}
        disabled={loading || isOver}
      />
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
