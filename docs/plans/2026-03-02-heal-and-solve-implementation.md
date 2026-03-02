# Heal Action & Solve Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a per-turn Heal action that costs a random blocked letter, and a solve-the-word text input as an escape hatch when blocked letters pile up.

**Architecture:** Three tasks in dependency order: Keyboard gains `blockedLetters` prop first, then GameBoard gains the solve input and wires up `blockedLetters`, then CombatView adds heal state and the `handleWrongSolve` callback. No new files, no backend changes.

**Tech Stack:** React 19 + TypeScript, Vite 7, vitest + @testing-library/react

---

### Task 1: `Keyboard` — `blockedLetters` prop + CSS

**Files:**
- Modify: `frontend/src/components/Keyboard.tsx`
- Modify: `frontend/src/components/__tests__/Keyboard.test.tsx`
- Modify: `frontend/src/index.css`

**Context:** `Keyboard` currently takes `guessedLetters`, `correctLetters`, `onGuess`, `disabled`. We add `blockedLetters?: string[]`. Blocked keys get the `key--blocked` CSS class and `disabled={true}`, visually distinct from wrong-guess keys.

---

**Step 1: Write failing tests**

Add these two tests inside `describe('Keyboard', ...)` in `frontend/src/components/__tests__/Keyboard.test.tsx`:

```tsx
it('renders blocked letters as disabled with key--blocked class', () => {
  render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} blockedLetters={['a', 'b']} />)
  const aBtn = screen.getByRole('button', { name: 'A' })
  expect(aBtn).toBeDisabled()
  expect(aBtn).toHaveClass('key--blocked')
  expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
})

it('does not apply key--blocked class when blockedLetters is empty', () => {
  render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} />)
  screen.getAllByRole('button').forEach(btn => expect(btn).not.toHaveClass('key--blocked'))
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/Keyboard.test.tsx
```

Expected: 2 new tests fail — `key--blocked` class not found.

**Step 3: Update `Keyboard.tsx`**

Replace the entire file:

```tsx
interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
  blockedLetters?: string[]
}

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
]

export default function Keyboard({ guessedLetters, correctLetters, onGuess, disabled, blockedLetters = [] }: Props) {
  return (
    <div className="keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard__row">
          {row.map((letter) => {
            const wasGuessed = guessedLetters.includes(letter)
            const wasCorrect = correctLetters.includes(letter)
            const isBlocked = blockedLetters.includes(letter)
            const keyClass = [
              'key',
              wasGuessed ? (wasCorrect ? 'key--correct' : 'key--wrong') : '',
              isBlocked ? 'key--blocked' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={keyClass}
                onClick={() => onGuess(letter)}
                disabled={disabled || wasGuessed || isBlocked}
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

**Step 4: Add CSS to `frontend/src/index.css`**

Find the `.key--wrong` rule and add the blocked modifier immediately after it:

```css
.key--blocked {
  opacity: 0.35;
  text-decoration: line-through;
  border-color: var(--wrong);
  color: var(--text-muted);
  cursor: not-allowed;
}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/Keyboard.test.tsx
```

Expected: all 6 Keyboard tests pass.

**Step 6: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 153 passed (151 + 2 new).

**Step 7: Commit**

```bash
git add frontend/src/components/Keyboard.tsx \
        frontend/src/components/__tests__/Keyboard.test.tsx \
        frontend/src/index.css
git commit -m "feat: Keyboard blockedLetters prop with key--blocked style"
```

---

### Task 2: `GameBoard` — solve input + `blockedLetters` + `onWrongSolve`

**Files:**
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/components/__tests__/GameBoard.test.tsx`
- Modify: `frontend/src/index.css`

**Context:** GameBoard needs three additions: (1) accept `blockedLetters?: string[]` and pass it to Keyboard (also skip blocked letters in the keydown listener), (2) accept `onWrongSolve?: () => void` called when a solve attempt is wrong, (3) add a text input + "Solve" button that calls `POST /api/game/<id>/solve` and routes the result to `onWordSolved` or `onWrongSolve`.

The existing test `'does NOT render a Solve Puzzle button'` must be updated — we are adding the solve input back.

---

**Step 1: Update the existing test and write new failing tests**

In `frontend/src/components/__tests__/GameBoard.test.tsx`:

**Replace** the existing test:
```tsx
it('does NOT render a Solve Puzzle button', () => {
  render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /solve puzzle/i })).not.toBeInTheDocument()
})
```

**With** this updated test + three new tests:
```tsx
it('renders a solve input when game is in progress', () => {
  render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
  expect(screen.getByPlaceholderText(/type the word/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^solve$/i })).toBeInTheDocument()
})

it('calls onWordSolved on a correct solve attempt', async () => {
  const solveResponse = { status: 'won', masked_word: 'c a t' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => solveResponse }))
  const onWordSolved = vi.fn()
  render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={onWordSolved} onPlayAgain={vi.fn()} />)
  await userEvent.type(screen.getByPlaceholderText(/type the word/i), 'cat')
  await userEvent.click(screen.getByRole('button', { name: /^solve$/i }))
  expect(onWordSolved).toHaveBeenCalledOnce()
})

it('calls onWrongSolve on an incorrect solve attempt', async () => {
  const wrongResponse = { status: 'in_progress', masked_word: '_ _ _' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wrongResponse }))
  const onWrongSolve = vi.fn()
  render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} onWrongSolve={onWrongSolve} />)
  await userEvent.type(screen.getByPlaceholderText(/type the word/i), 'dog')
  await userEvent.click(screen.getByRole('button', { name: /^solve$/i }))
  expect(onWrongSolve).toHaveBeenCalledOnce()
})

it('passes blockedLetters to Keyboard, disabling those keys', () => {
  render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} blockedLetters={['a']} />)
  expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'B' })).not.toBeDisabled()
})
```

**Step 2: Run tests to verify the new ones fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/GameBoard.test.tsx
```

Expected: the 3 new tests fail; the updated existing test also fails (solve input doesn't exist yet).

**Step 3: Update `GameBoard.tsx`**

Replace the entire file:

```tsx
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
  onWrongSolve?: () => void
}

export default function GameBoard({ initialState, onGuessResult, onWordSolved, onPlayAgain, playAgainLabel, combatOver, blockedLetters = [], onWrongSolve }: Props) {
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
      const letter = e.key.toLowerCase()
      if (letter.length !== 1 || !/^[a-z]$/.test(letter)) return
      if (game.guessedLetters.includes(letter)) return
      if (blockedLetters.includes(letter)) return
      handleGuess(letter)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOver, loading, game.guessedLetters, blockedLetters, handleGuess])

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
```

**Step 4: Add CSS to `frontend/src/index.css`**

Add these rules near the `.game-board` section:

```css
.game-board__solve-form {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.75rem;
}

.game-board__solve-input {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.9rem;
  width: 140px;
}

.game-board__solve-btn {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
}

.game-board__solve-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.game-board__solve-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/GameBoard.test.tsx
```

Expected: all GameBoard tests pass.

**Step 6: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 156 passed (153 + 3 new; the replaced test counts the same).

**Step 7: Commit**

```bash
git add frontend/src/components/GameBoard.tsx \
        frontend/src/components/__tests__/GameBoard.test.tsx \
        frontend/src/index.css
git commit -m "feat: GameBoard solve input + blockedLetters prop + onWrongSolve callback"
```

---

### Task 3: `CombatView` — heal state + heal button + `handleWrongSolve`

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`
- Modify: `frontend/src/index.css`

**Context:** CombatView owns the heal mechanic. It tracks `blockedLetters` state and a local `guessedLetters` state (derived from `initialState.guessedLetters`, updated on each `handleGuessResult` call so we never block already-guessed letters). `handleHeal` picks a random letter from the available pool and increments HP. `handleWrongSolve` deducts 5 HP and calls `finishCombat` if HP hits 0. Both `blockedLetters` and `handleWrongSolve` are passed down to `GameBoard`.

---

**Step 1: Write failing tests**

Add these tests inside `describe('CombatView', ...)` in `frontend/src/components/__tests__/CombatView.test.tsx`.

First, add this helper at the top of the file near `enemyRoom` and `bossRoom`:

```tsx
function lowHpRun() {
  return { ...buildRun('berserker'), hp: 20 }
}
```

Then add:

```tsx
it('heal button increases player HP by 5', async () => {
  render(<CombatView run={lowHpRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByText(/HP: 20/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /heal/i }))
  expect(screen.getByText(/HP: 25/)).toBeInTheDocument()
})

it('heal button is disabled when HP is full', () => {
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByRole('button', { name: /heal/i })).toBeDisabled()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: 2 new tests fail — heal button does not exist yet.

**Step 3: Add `ALPHABET` constant to `CombatView.tsx`**

After the `BOSS_NAMES` array (around line 51), add:

```tsx
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')
```

**Step 4: Add heal state to `CombatView`**

Inside the `CombatView` component, after the existing `useState` declarations, add:

```tsx
const [blockedLetters, setBlockedLetters] = useState<string[]>([])
const [guessedLetters, setGuessedLetters] = useState<string[]>(initialState.guessedLetters)
```

**Step 5: Update `handleGuessResult` to track guessed letters**

At the very top of `handleGuessResult`, after the existing `const isAbilityHit / isAbilityMiss / wasAbilityMode` lines, add:

```tsx
setGuessedLetters(prev => [...prev, letter])
```

**Step 6: Add `handleHeal` and `handleWrongSolve` functions**

Add these two functions inside `CombatView`, after `handleAbility`:

```tsx
function handleHeal() {
  const available = ALPHABET.filter(l => !guessedLetters.includes(l) && !blockedLetters.includes(l))
  if (available.length === 0) return
  const blocked = available[Math.floor(Math.random() * available.length)]
  setBlockedLetters(prev => [...prev, blocked])
  setDisplayRun(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 5) }))
}

function handleWrongSolve() {
  const newHp = Math.max(0, displayRun.hp - 5)
  setDisplayRun(prev => ({ ...prev, hp: newHp }))
  if (newHp <= 0) finishCombat(false, newHp)
}
```

**Step 7: Add the heal button to the JSX**

Find the ability button block:
```tsx
{!combatDone && !enemyDead && (
  <button
    className="btn-ability"
    onClick={handleAbility}
    disabled={abilityDisabled}
  >
    {abilityLabel}
  </button>
)}
```

Add the heal button immediately after it (still inside the player `div`):
```tsx
{!combatDone && !enemyDead && (
  <button
    className="btn-heal"
    onClick={handleHeal}
    disabled={displayRun.hp >= displayRun.maxHp || ALPHABET.every(l => guessedLetters.includes(l) || blockedLetters.includes(l))}
  >
    🩹 Heal (+5 HP)
  </button>
)}
```

**Step 8: Pass `blockedLetters` and `onWrongSolve` to `GameBoard`**

Find the `<GameBoard` element and add two new props:

```tsx
<GameBoard
  initialState={initialState}
  onGuessResult={handleGuessResult}
  onWordSolved={handleWordSolved}
  onPlayAgain={handleContinue}
  playAgainLabel={playAgainLabel}
  combatOver={combatDone || enemyDead}
  blockedLetters={blockedLetters}
  onWrongSolve={handleWrongSolve}
/>
```

**Step 9: Add CSS to `frontend/src/index.css`**

Add near the `.btn-ability` rules:

```css
.btn-heal {
  display: block;
  margin: 0.4rem auto 0;
  padding: 0.35rem 1rem;
  border: 1px solid #4caf50;
  border-radius: 4px;
  background: transparent;
  color: #4caf50;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-heal:hover:not(:disabled) {
  background: #4caf50;
  color: #fff;
}

.btn-heal:disabled {
  opacity: 0.4;
  border-color: var(--border);
  color: var(--text-muted);
  cursor: not-allowed;
}
```

**Step 10: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: all CombatView tests pass.

**Step 11: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 158 passed (156 + 2 new).

**Step 12: Verify TypeScript**

```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

**Step 13: Commit**

```bash
git add frontend/src/components/CombatView.tsx \
        frontend/src/components/__tests__/CombatView.test.tsx \
        frontend/src/index.css
git commit -m "feat: heal action + solve input wired into CombatView"
```

---

### Final check

```bash
cd frontend && npm test -- --run
```

Expected: 158 tests, 14 test files, all passing.
