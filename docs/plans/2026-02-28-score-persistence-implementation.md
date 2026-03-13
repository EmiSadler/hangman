# Score Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist the win/loss score across page refreshes using `localStorage`, and add a "Forget me" button to reset it.

**Architecture:** `App` initialises score state from `localStorage` (falling back to 0/0 on missing/malformed data), writes to `localStorage` on every score change via `useEffect`, and exposes a reset function wired to a "Forget me" button. No backend changes, no new files, no new types.

**Tech Stack:** React 19, TypeScript, vitest, @testing-library/react, @testing-library/user-event

---

## Task 1: Score persistence and reset in App

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

---

**Step 1: Add `localStorage.clear()` to the existing `beforeEach`**

In `frontend/src/components/__tests__/App.test.tsx`, update the `beforeEach` on line 15 from:

```tsx
  beforeEach(() => {
    vi.restoreAllMocks()
  })
```

to:

```tsx
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })
```

This prevents leftover localStorage state from leaking between tests.

---

**Step 2: Add three failing tests**

Append these three tests inside the `describe('App', ...)` block, after the last existing test:

```tsx
  it('loads persisted score from localStorage on mount', () => {
    localStorage.setItem('hangman_score', JSON.stringify({ wins: 3, losses: 2 }))
    render(<App />)
    expect(screen.getByText(/3 wins/i)).toBeInTheDocument()
    expect(screen.getByText(/2 losses/i)).toBeInTheDocument()
  })

  it('forget me button resets score to zero and removes it from localStorage', async () => {
    localStorage.setItem('hangman_score', JSON.stringify({ wins: 3, losses: 2 }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(screen.getByText(/0 wins/i)).toBeInTheDocument()
    expect(localStorage.getItem('hangman_score')).toBeNull()
  })

  it('falls back to zero score when localStorage contains invalid JSON', () => {
    localStorage.setItem('hangman_score', 'not-valid-json')
    render(<App />)
    expect(screen.getByText(/0 wins/i)).toBeInTheDocument()
  })
```

---

**Step 3: Run new tests to verify they fail**

```bash
cd /Users/emily/Code/hangman/frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "localStorage\|forget me\|invalid"
```

Expected: all three new tests FAIL (localStorage not read yet, no "Forget me" button yet).

---

**Step 4: Implement**

Replace the entire contents of `frontend/src/App.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import type { Difficulty, GameState, Score } from './types'
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

  useEffect(() => {
    localStorage.setItem(SCORE_KEY, JSON.stringify(score))
  }, [score])

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
```

---

**Step 5: Add CSS for the new elements**

In `frontend/src/index.css`, find the existing `.score-pill` rule and replace it with:

```css
/* ── Score row ─────────────────────────────────────────── */
.score-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.score-pill {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.3rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
}

.btn-forget {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.btn-forget:hover {
  color: var(--accent);
}
```

> **Note:** You need to see the existing `.score-pill` rule in `index.css` to find and replace it. Run `grep -n "score-pill" frontend/src/index.css` to locate the line number first.

---

**Step 6: Run ALL frontend tests**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **38 passed** (35 existing + 3 new). If the existing "shows score starting at 0 wins / 0 losses" test fails, check that `localStorage.clear()` was added to `beforeEach`.

---

**Step 7: Commit**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/App.tsx \
        frontend/src/index.css \
        frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: persist score in localStorage with forget me reset"
```

---

## Final check

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **38 passed**.

Manual smoke test:
1. Start and finish a game — score increments
2. Refresh the page — score is still there
3. Click "Forget me" — score resets to 0 wins / 0 losses
4. Refresh again — score stays at 0
