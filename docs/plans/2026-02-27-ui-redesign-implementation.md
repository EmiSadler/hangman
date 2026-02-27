# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the hangman frontend with a warm/earthy palette, Lora serif font, sketchy SVG, and QWERTY keyboard using CSS custom properties and class names.

**Architecture:** All styling moves from scattered inline `style` props into CSS class names defined in `index.css`. No new dependencies — Google Fonts loaded via `@import`. No logic, backend, or type changes. Existing 28 tests must pass after every task.

**Tech Stack:** React 19, TypeScript, plain CSS (custom properties + class names), Google Fonts (Lora)

---

## Testing note

This is a pure styling task. There are no new tests to write — the verification step for every task is:

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**. If any test breaks, the styling change broke a structural assumption — fix it before committing.

---

## Task 1: Global theme — index.css and App.css

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`

**Step 1: Replace `frontend/src/index.css` entirely with:**

```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap');

:root {
  --bg:           #fdf6e3;
  --surface:      #fffbf0;
  --accent:       #8b4513;
  --accent-hover: #6b3410;
  --text:         #2c1810;
  --text-muted:   #7a5c4a;
  --correct:      #4a7c59;
  --wrong:        #8b2e2e;
  --border:       #d4b896;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Lora', Georgia, serif;
  -webkit-font-smoothing: antialiased;
}

h1, h2 {
  font-family: 'Lora', Georgia, serif;
  color: var(--accent);
  margin: 0 0 0.5rem;
}

button {
  font-family: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: default;
}
```

**Step 2: Replace `frontend/src/App.css` entirely with:**

```css
/* App.css — intentionally empty; all styles live in index.css */
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/index.css frontend/src/App.css
git commit -m "style: add warm/earthy theme tokens and Lora font"
```

---

## Task 2: GameSetup styling

**Files:**
- Modify: `frontend/src/components/GameSetup.tsx`
- Modify: `frontend/src/index.css` (append classes)

**Step 1: Replace `frontend/src/components/GameSetup.tsx` with:**

```tsx
import type { Difficulty } from '../types'

interface Props {
  onStart: (difficulty: Difficulty) => void
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

export default function GameSetup({ onStart }: Props) {
  return (
    <div className="game-setup">
      <h1>Hangman</h1>
      <p className="game-setup__subtitle">Choose a difficulty to begin</p>
      <div className="game-setup__buttons">
        {difficulties.map((d) => (
          <button key={d} className="btn-difficulty" onClick={() => onStart(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Append to `frontend/src/index.css`:**

```css
/* ── GameSetup ─────────────────────────────────────────── */

.game-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 0;
}

.game-setup__subtitle {
  color: var(--text-muted);
  margin: 0;
  font-size: 1.1rem;
}

.game-setup__buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-difficulty {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.8rem;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: background 0.15s, transform 0.1s;
}

.btn-difficulty:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
}

.btn-difficulty:active {
  transform: translateY(0);
}
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/GameSetup.tsx frontend/src/index.css
git commit -m "style: GameSetup pill buttons and serif heading"
```

---

## Task 3: HangmanSvg styling

**Files:**
- Modify: `frontend/src/components/HangmanSvg.tsx`
- Modify: `frontend/src/index.css` (append)

**Step 1: Replace `frontend/src/components/HangmanSvg.tsx` with:**

```tsx
interface Props {
  wrongCount: number
}

const STROKE = '#5c3d2e'

export default function HangmanSvg({ wrongCount }: Props) {
  return (
    <div className="hangman-card">
      <svg viewBox="0 0 200 250" width="200" height="250" aria-label="hangman figure">
        {/* Gallows */}
        <line x1="20" y1="230" x2="180" y2="230" stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1="230" x2="60" y2="20"   stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1="20"  x2="130" y2="20"  stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
        <line x1="130" y1="20" x2="130" y2="50"  stroke={STROKE} strokeWidth="5" strokeLinecap="round" />

        {wrongCount >= 1 && (
          <circle data-part="head" cx="130" cy="70" r="20" stroke={STROKE} strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
        {wrongCount >= 2 && (
          <line data-part="body" x1="130" y1="90" x2="130" y2="150" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 3 && (
          <line data-part="left-arm" x1="130" y1="110" x2="100" y2="140" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 4 && (
          <line data-part="right-arm" x1="130" y1="110" x2="160" y2="140" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 5 && (
          <line data-part="left-leg" x1="130" y1="150" x2="100" y2="190" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
        {wrongCount >= 6 && (
          <line data-part="right-leg" x1="130" y1="150" x2="160" y2="190" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        )}
      </svg>
    </div>
  )
}
```

**Step 2: Append to `frontend/src/index.css`:**

```css
/* ── HangmanSvg ────────────────────────────────────────── */

.hangman-card {
  display: inline-block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/HangmanSvg.tsx frontend/src/index.css
git commit -m "style: HangmanSvg sketchy brown strokes and card wrapper"
```

---

## Task 4: WordDisplay styling

**Files:**
- Modify: `frontend/src/components/WordDisplay.tsx`
- Modify: `frontend/src/index.css` (append)

**Step 1: Replace `frontend/src/components/WordDisplay.tsx` with:**

```tsx
interface Props {
  maskedWord: string
}

export default function WordDisplay({ maskedWord }: Props) {
  const letters = maskedWord.split(' ')
  return (
    <div className="word-display">
      {letters.map((letter, i) => (
        <span key={i} className={`letter-tile${letter === '_' ? ' letter-tile--blank' : ''}`}>
          {letter}
        </span>
      ))}
    </div>
  )
}
```

**Step 2: Append to `frontend/src/index.css`:**

```css
/* ── WordDisplay ───────────────────────────────────────── */

.word-display {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin: 1.5rem 0;
}

.letter-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2.5rem;
  font-family: 'Courier New', Courier, monospace;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--accent);
  border-bottom: 3px solid var(--accent);
}

.letter-tile--blank {
  color: var(--border);
  border-bottom-color: var(--border);
}
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/WordDisplay.tsx frontend/src/index.css
git commit -m "style: WordDisplay tile styling with monospace font"
```

---

## Task 5: Keyboard — QWERTY layout

**Files:**
- Modify: `frontend/src/components/Keyboard.tsx`
- Modify: `frontend/src/index.css` (append)

**Step 1: Replace `frontend/src/components/Keyboard.tsx` with:**

```tsx
interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
}

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
]

export default function Keyboard({ guessedLetters, correctLetters, onGuess, disabled }: Props) {
  return (
    <div className="keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard__row">
          {row.map((letter) => {
            const wasGuessed = guessedLetters.includes(letter)
            const wasCorrect = correctLetters.includes(letter)
            const keyClass = [
              'key',
              wasGuessed ? (wasCorrect ? 'key--correct' : 'key--wrong') : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={keyClass}
                onClick={() => onGuess(letter)}
                disabled={disabled || wasGuessed}
              >
                {letter.toUpperCase()}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Append to `frontend/src/index.css`:**

```css
/* ── Keyboard ──────────────────────────────────────────── */

.keyboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  margin: 1rem 0;
}

.keyboard__row {
  display: flex;
  gap: 0.3rem;
}

.key {
  width: 2.2rem;
  height: 2.4rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 2px 0 var(--border);
  font-size: 0.85rem;
  font-weight: 700;
  transition: background 0.1s, transform 0.1s;
}

.key:not(:disabled):hover {
  background: var(--border);
  transform: translateY(-1px);
}

.key:disabled {
  opacity: 0.5;
}

.key--correct {
  background: var(--correct);
  color: #fff;
  border-color: var(--correct);
  box-shadow: none;
}

.key--wrong {
  background: var(--wrong);
  color: #fff;
  border-color: var(--wrong);
  box-shadow: none;
}
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

Note: the existing Keyboard tests check for buttons by their uppercase letter labels (`{ name: 'A' }`) which still works — only the layout structure changes from a flat list to QWERTY rows.

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/Keyboard.tsx frontend/src/index.css
git commit -m "style: Keyboard QWERTY layout with physical key styling"
```

---

## Task 6: GameResult styling

**Files:**
- Modify: `frontend/src/components/GameResult.tsx`
- Modify: `frontend/src/index.css` (append)

**Step 1: Replace `frontend/src/components/GameResult.tsx` with:**

```tsx
import type { GameStatus } from '../types'

interface Props {
  status: GameStatus
  word: string
  onPlayAgain: () => void
}

export default function GameResult({ status, word, onPlayAgain }: Props) {
  return (
    <div className="game-result">
      <h2 className={status === 'won' ? 'game-result__title--won' : 'game-result__title--lost'}>
        {status === 'won' ? 'You Won! 🎉' : 'Game Over!'}
      </h2>
      <p className="game-result__word">
        The word was: <strong>{word}</strong>
      </p>
      <button className="btn-difficulty" onClick={onPlayAgain}>Play Again</button>
    </div>
  )
}
```

**Step 2: Append to `frontend/src/index.css`:**

```css
/* ── GameResult ────────────────────────────────────────── */

.game-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.game-result__title--won {
  color: var(--correct);
}

.game-result__title--lost {
  color: var(--wrong);
}

.game-result__word {
  font-size: 1.1rem;
  margin: 0;
  color: var(--text-muted);
}

.game-result__word strong {
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

**Step 3: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 4: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/GameResult.tsx frontend/src/index.css
git commit -m "style: GameResult coloured headings and card layout"
```

---

## Task 7: App and GameBoard layout

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/index.css` (append)

**Step 1: Replace `frontend/src/App.tsx` with:**

```tsx
import { useState } from 'react'
import type { Difficulty, GameState, Score } from './types'
import GameSetup from './components/GameSetup'
import GameBoard from './components/GameBoard'
import './App.css'

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [score, setScore] = useState<Score>({ wins: 0, losses: 0 })
  const [error, setError] = useState<string | null>(null)

  async function handleStart(difficulty: Difficulty) {
    setError(null)
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
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
    setScore((prev) => ({
      wins: result === 'won' ? prev.wins + 1 : prev.wins,
      losses: result === 'lost' ? prev.losses + 1 : prev.losses,
    }))
  }

  function handlePlayAgain() {
    setGame(null)
  }

  return (
    <div className="app">
      <div className="score-pill">
        {score.wins} win{score.wins !== 1 ? 's' : ''} / {score.losses} loss{score.losses !== 1 ? 'es' : ''}
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
```

**Step 2: Replace `frontend/src/components/GameBoard.tsx` with:**

```tsx
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
    <div className="game-board">
      <HangmanSvg wrongCount={wrongCount} />
      <WordDisplay maskedWord={game.maskedWord} />
      <p className="wrong-count">
        {game.wrongGuessesLeft} guess{game.wrongGuessesLeft !== 1 ? 'es' : ''} remaining
      </p>
      {error && <p className="app__error">{error}</p>}
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
```

**Step 3: Append to `frontend/src/index.css`:**

```css
/* ── App layout ────────────────────────────────────────── */

.app {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  text-align: center;
}

.score-pill {
  position: absolute;
  top: 1.5rem;
  right: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.app__error {
  color: var(--wrong);
  font-size: 0.95rem;
}

/* ── GameBoard layout ──────────────────────────────────── */

.game-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.wrong-count {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0;
}
```

**Step 4: Run tests:**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **28 passed**

**Step 5: Commit:**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/App.tsx frontend/src/components/GameBoard.tsx frontend/src/index.css
git commit -m "style: App and GameBoard layout, score pill, wrong-count label"
```

---

## Final check

Run the full test suite one more time to confirm all 28 tests pass:

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Then start both servers and visually verify:

```bash
# Terminal 1
cd /Users/emily/Code/hangman/backend && source venv/bin/activate && python app.py

# Terminal 2
cd /Users/emily/Code/hangman/frontend && npm run dev
```

Open http://localhost:5173 and check:
- [ ] Parchment background, Lora serif font throughout
- [ ] Score pill visible in top-right
- [ ] Three saddle-brown pill buttons on the setup screen
- [ ] Hangman SVG has round brown strokes inside a bordered card
- [ ] Word tiles have accent-coloured underlines, monospace font
- [ ] QWERTY keyboard renders in 3 rows; correct=green, wrong=red
- [ ] Game result card appears with coloured heading and Play Again button
