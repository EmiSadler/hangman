# Dungeon Roguelike Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Hangman game into a dungeon roguelike: 3 floors × 11 rooms each, with HP/coins, rest/treasure rooms, and per-floor bosses.

**Architecture:** Backend gains an optional `room_type` + `hint` param on `POST /api/game`. All run state (HP, coins, floor progress) lives in `localStorage` under `hangman_run`. A new state machine in `App.tsx` drives five phases: `idle → combat → rest → treasure → run_won/run_lost`.

**Tech Stack:** Python/Flask (backend), React 19 + TypeScript + Vitest (frontend), localStorage (run persistence).

---

## Task 1: Backend — boss word selection + hint

**Files:**
- Modify: `backend/game.py`
- Modify: `backend/app.py`
- Modify: `backend/tests/test_game.py`
- Modify: `backend/tests/test_routes.py`

### Step 1: Write failing tests for `select_word(room_type)`

Append to `backend/tests/test_game.py`:

```python
# --- select_word room_type ---

def test_select_word_enemy_returns_any_word():
    word = select_word(room_type='enemy')
    assert word in load_words()

def test_select_word_boss_returns_word_length_gte_8():
    for _ in range(20):
        word = select_word(room_type='boss')
        assert len(word) >= 8, f"boss word '{word}' is shorter than 8 letters"

def test_select_word_boss_word_in_word_list():
    word = select_word(room_type='boss')
    assert word in load_words()

def test_select_word_invalid_room_type_raises():
    with pytest.raises(ValueError, match="room_type"):
        select_word(room_type='invalid')

# --- new_game room_type + hint ---

def test_new_game_boss_word_length_gte_8():
    for _ in range(10):
        game = new_game(room_type='boss')
        assert len(game["word"]) >= 8

def test_new_game_hint_true_has_one_guessed_letter():
    game = new_game(hint=True)
    assert len(game["guessed_letters"]) == 1
    assert game["guessed_letters"][0] in game["word"]

def test_new_game_hint_false_has_no_guessed_letters():
    game = new_game(hint=False)
    assert game["guessed_letters"] == []

def test_new_game_hint_default_is_false():
    game = new_game()
    assert game["guessed_letters"] == []
```

### Step 2: Run tests to verify they fail

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -k "boss or hint" -v
```

Expected: 8 failures — `select_word() takes 0 positional arguments` / `new_game() takes 0 positional arguments`.

### Step 3: Implement `select_word` and `new_game` changes in `game.py`

Replace the two functions:

```python
def select_word(room_type: str = 'enemy') -> str:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    words = load_words()
    if room_type == 'boss':
        words = [w for w in words if len(w) >= 8]
    return random.choice(words)


def new_game(room_type: str = 'enemy', hint: bool = False) -> dict:
    word = select_word(room_type)
    guessed: list[str] = []
    if hint:
        guessed = [random.choice(list(word))]
    return {
        "word": word,
        "guessed_letters": guessed,
        "max_wrong": 6,
        "wrong_count": 0,
        "status": "in_progress",
    }
```

### Step 4: Run game tests and verify they pass

```bash
pytest tests/test_game.py -v
```

Expected: all tests pass (was 20, now 28).

### Step 5: Write failing route tests for `room_type` and `hint`

Append to `backend/tests/test_routes.py`:

```python
# --- POST /api/game room_type + hint ---

def test_new_game_boss_room_type_returns_long_word(client):
    for _ in range(5):
        resp = client.post("/api/game", json={"room_type": "boss"})
        assert resp.status_code == 200
        data = resp.get_json()
        # masked_word is "_ _ _ _ _ _ _ _" for 8-letter word
        underscores = data["masked_word"].replace(" ", "")
        assert len(underscores) >= 8

def test_new_game_invalid_room_type_returns_400(client):
    resp = client.post("/api/game", json={"room_type": "dragon"})
    assert resp.status_code == 400
    assert "room_type" in resp.get_json().get("error", "")

def test_new_game_hint_true_has_guessed_letter(client):
    resp = client.post("/api/game", json={"hint": True})
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["guessed_letters"]) == 1
    assert "_" not in data["masked_word"].replace(" ", "").replace(data["guessed_letters"][0], "")

def test_new_game_omitting_room_type_defaults_to_enemy(client):
    resp = client.post("/api/game")
    assert resp.status_code == 200
```

### Step 6: Run to verify route tests fail

```bash
pytest tests/test_routes.py -k "room_type or hint or boss" -v
```

Expected: 4 failures.

### Step 7: Update `create_game` route in `app.py`

Replace the `create_game` function:

```python
@app.route("/api/game", methods=["POST"])
def create_game():
    data = request.get_json(silent=True) or {}
    room_type = data.get("room_type", "enemy")
    hint = bool(data.get("hint", False))
    try:
        game = new_game(room_type=room_type, hint=hint)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    game_id = str(uuid.uuid4())
    games[game_id] = game
    return jsonify({
        "game_id": game_id,
        "masked_word": mask_word(game["word"], game["guessed_letters"]),
        "max_wrong": game["max_wrong"],
        "wrong_guesses_left": game["max_wrong"] - game["wrong_count"],
        "guessed_letters": list(game["guessed_letters"]),
    })
```

### Step 8: Run all backend tests and verify they pass

```bash
pytest tests/ -v
```

Expected: all 40 tests pass.

### Step 9: Commit

```bash
git add backend/game.py backend/app.py backend/tests/test_game.py backend/tests/test_routes.py
git commit -m "feat: backend boss word selection and hint support"
```

---

## Task 2: Frontend types + runState module

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/runState.ts`
- Create: `frontend/src/__tests__/runState.test.ts`

### Step 1: Write failing tests for `runState.ts`

Create `frontend/src/__tests__/runState.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFloorLayout, buildRooms, buildRun, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, enemyHp, computeRoomsCleared,
  MAX_HP, DAMAGE_PER_WRONG, COINS_PER_ENEMY, COINS_PER_BOSS, HEAL_COST, HEAL_AMOUNT,
} from '../runState'

describe('constants', () => {
  it('MAX_HP is 20', () => expect(MAX_HP).toBe(20))
  it('DAMAGE_PER_WRONG is 2', () => expect(DAMAGE_PER_WRONG).toBe(2))
  it('COINS_PER_ENEMY is 5', () => expect(COINS_PER_ENEMY).toBe(5))
  it('COINS_PER_BOSS is 20', () => expect(COINS_PER_BOSS).toBe(20))
  it('HEAL_COST is 10', () => expect(HEAL_COST).toBe(10))
  it('HEAL_AMOUNT is 5', () => expect(HEAL_AMOUNT).toBe(5))
})

describe('getFloorLayout', () => {
  it('floor 1 has rest at index 4, treasure at index 6, boss at index 10', () => {
    const layout = getFloorLayout(1)
    expect(layout[4]).toBe('rest')
    expect(layout[6]).toBe('treasure')
    expect(layout[10]).toBe('boss')
  })
  it('floor 2 has treasure at index 4, rest at index 6, boss at index 10', () => {
    const layout = getFloorLayout(2)
    expect(layout[4]).toBe('treasure')
    expect(layout[6]).toBe('rest')
    expect(layout[10]).toBe('boss')
  })
  it('floor 3 layout matches floor 1', () => {
    expect(getFloorLayout(3)).toEqual(getFloorLayout(1))
  })
  it('all layouts have exactly 11 rooms', () => {
    expect(getFloorLayout(1).length).toBe(11)
    expect(getFloorLayout(2).length).toBe(11)
    expect(getFloorLayout(3).length).toBe(11)
  })
})

describe('buildRooms', () => {
  it('creates 11 rooms, all incomplete with null gameId', () => {
    const rooms = buildRooms(1)
    expect(rooms.length).toBe(11)
    expect(rooms.every(r => !r.completed)).toBe(true)
    expect(rooms.every(r => r.gameId === null)).toBe(true)
  })
  it('room types match floor layout', () => {
    const rooms = buildRooms(2)
    expect(rooms[4].type).toBe('treasure')
    expect(rooms[6].type).toBe('rest')
  })
})

describe('buildRun', () => {
  it('starts with correct defaults', () => {
    const run = buildRun()
    expect(run.hp).toBe(MAX_HP)
    expect(run.maxHp).toBe(MAX_HP)
    expect(run.coins).toBe(0)
    expect(run.floor).toBe(1)
    expect(run.roomIndex).toBe(0)
    expect(run.status).toBe('in_progress')
    expect(run.pendingReveal).toBe(false)
    expect(run.rooms.length).toBe(11)
  })
})

describe('enemyHp', () => {
  it('returns wordLength * floor', () => {
    expect(enemyHp(5, 1)).toBe(5)
    expect(enemyHp(8, 2)).toBe(16)
    expect(enemyHp(10, 3)).toBe(30)
  })
})

describe('computeRoomsCleared', () => {
  it('returns completed room count plus previous floors', () => {
    const run = buildRun()
    run.rooms[0] = { ...run.rooms[0], completed: true }
    run.rooms[1] = { ...run.rooms[1], completed: true }
    expect(computeRoomsCleared(run)).toBe(2)
  })
  it('accounts for floor offset', () => {
    const run = buildRun()
    run.floor = 2
    run.rooms[0] = { ...run.rooms[0], completed: true }
    expect(computeRoomsCleared(run)).toBe(12) // 11 from floor 1 + 1 from floor 2
  })
})

describe('localStorage helpers', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('loadRun returns null when nothing stored', () => {
    expect(loadRun()).toBeNull()
  })
  it('saveRun and loadRun round-trip', () => {
    const run = buildRun()
    saveRun(run)
    expect(loadRun()).toEqual(run)
  })
  it('clearRun removes saved run', () => {
    saveRun(buildRun())
    clearRun()
    expect(loadRun()).toBeNull()
  })
  it('loadRun returns null on invalid JSON', () => {
    localStorage.setItem('hangman_run', 'not-json')
    expect(loadRun()).toBeNull()
  })
  it('loadRunScore returns zeros when nothing stored', () => {
    expect(loadRunScore()).toEqual({ runsCleared: 0, runsFailed: 0, bestRooms: 0 })
  })
  it('saveRunScore and loadRunScore round-trip', () => {
    const score = { runsCleared: 2, runsFailed: 5, bestRooms: 18 }
    saveRunScore(score)
    expect(loadRunScore()).toEqual(score)
  })
  it('loadRunScore returns zeros on invalid JSON', () => {
    localStorage.setItem('hangman_score', 'bad')
    expect(loadRunScore()).toEqual({ runsCleared: 0, runsFailed: 0, bestRooms: 0 })
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts
```

Expected: `Cannot find module '../runState'`.

### Step 3: Update `frontend/src/types.ts`

Replace the entire file:

```ts
export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface GameState {
  gameId: string
  maskedWord: string
  maxWrong: number
  wrongGuessesLeft: number
  guessedLetters: string[]
  status: GameStatus
  word?: string
}

export type RoomType = 'enemy' | 'boss' | 'rest' | 'treasure'

export interface Room {
  type: RoomType
  completed: boolean
  gameId: string | null
}

export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number        // 1–3
  roomIndex: number    // 0–10
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
```

### Step 4: Create `frontend/src/runState.ts`

```ts
import type { Room, RunState, RunScore, RoomType } from './types'

export const MAX_HP = 20
export const DAMAGE_PER_WRONG = 2
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
export const HEAL_COST = 10
export const HEAL_AMOUNT = 5

export const RUN_KEY = 'hangman_run'
export const SCORE_KEY = 'hangman_score'

const LAYOUT_A: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'rest',
  'enemy', 'treasure', 'enemy', 'enemy', 'enemy', 'boss',
]
const LAYOUT_B: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'treasure',
  'enemy', 'rest', 'enemy', 'enemy', 'enemy', 'boss',
]

export function getFloorLayout(floor: number): RoomType[] {
  return floor === 2 ? LAYOUT_B : LAYOUT_A
}

export function buildRooms(floor: number): Room[] {
  return getFloorLayout(floor).map(type => ({ type, completed: false, gameId: null }))
}

export function buildRun(): RunState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
  }
}

export function enemyHp(wordLength: number, floor: number): number {
  return wordLength * floor
}

export function computeRoomsCleared(run: RunState): number {
  return (run.floor - 1) * 11 + run.rooms.filter(r => r.completed).length
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RunState
  } catch {
    return null
  }
}

export function saveRun(run: RunState): void {
  localStorage.setItem(RUN_KEY, JSON.stringify(run))
}

export function clearRun(): void {
  localStorage.removeItem(RUN_KEY)
}

export function loadRunScore(): RunScore {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
    return JSON.parse(raw) as RunScore
  } catch {
    return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
  }
}

export function saveRunScore(score: RunScore): void {
  localStorage.setItem(SCORE_KEY, JSON.stringify(score))
}
```

### Step 5: Run tests and verify they pass

```bash
npm test -- --run src/__tests__/runState.test.ts
```

Expected: all 22 tests pass.

### Step 6: Verify existing tests still pass

```bash
npm test -- --run
```

Expected: existing 28 tests still pass (types.ts change is backwards-compatible since we kept `GameState`; `Score` type is removed but only used in App.tsx which we'll rewrite in Task 10 — TypeScript errors in App.tsx are acceptable until Task 10).

### Step 7: Commit

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/runState.test.ts
git commit -m "feat: add RunState/RunScore types and runState helpers"
```

---

## Task 3: GameBoard — extend `onGameEnd` with `wrongGuessesMade`

**Files:**
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/components/__tests__/GameBoard.test.tsx`

### Step 1: Update the two `onGameEnd` call assertions in `GameBoard.test.tsx`

In `GameBoard.test.tsx`, find the test `'calls onGameEnd with won when game is won'` and update:

```ts
// old:
expect(onGameEnd).toHaveBeenCalledWith('won')
// new:
expect(onGameEnd).toHaveBeenCalledWith('won', 0)  // 0 wrong guesses made (6-6)
```

Also update `'calls /solve endpoint and transitions to won on correct guess'`:

```ts
// old:
expect(onGameEnd).toHaveBeenCalledWith('won')
// new:
expect(onGameEnd).toHaveBeenCalledWith('won', 0)
```

### Step 2: Run tests to verify these two tests now fail

```bash
npm test -- --run src/components/__tests__/GameBoard.test.tsx
```

Expected: 2 failures — `Expected: "won" / Received: "won", 0`.

### Step 3: Update `GameBoard.tsx`

Change the Props interface:

```ts
interface Props {
  initialState: GameState
  onGameEnd: (result: 'won' | 'lost', wrongGuessesMade: number) => void
  onPlayAgain: () => void
}
```

In `handleGuess`, replace the `onGameEnd` call:

```ts
// old:
if (updated.status === 'won' || updated.status === 'lost') {
  onGameEnd(updated.status)
}
// new:
if (updated.status === 'won' || updated.status === 'lost') {
  const wrongGuessesMade = initialState.maxWrong - updated.wrongGuessesLeft
  onGameEnd(updated.status, wrongGuessesMade)
}
```

In `handleSolve`, replace the `onGameEnd` call:

```ts
// old:
if (updated.status === 'won' || updated.status === 'lost') {
  onGameEnd(updated.status)
}
// new:
if (updated.status === 'won' || updated.status === 'lost') {
  const wrongGuessesMade = initialState.maxWrong - updated.wrongGuessesLeft
  onGameEnd(updated.status, wrongGuessesMade)
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/GameBoard.test.tsx
```

Expected: all 11 tests pass.

Note: `App.tsx` still passes `handleGameEnd(result: 'won' | 'lost')` (one-arg function) where two args are now expected. TypeScript allows this: a function accepting fewer parameters is assignable to a type requiring more parameters. No App.tsx change needed yet.

### Step 5: Run full test suite

```bash
npm test -- --run
```

Expected: all 50 tests pass (28 existing + 22 new runState tests).

### Step 6: Commit

```bash
git add frontend/src/components/GameBoard.tsx frontend/src/components/__tests__/GameBoard.test.tsx
git commit -m "feat: extend GameBoard onGameEnd with wrongGuessesMade"
```

---

## Task 4: RunSetup component

**Files:**
- Create: `frontend/src/components/RunSetup.tsx`
- Create: `frontend/src/components/__tests__/RunSetup.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/RunSetup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunSetup from '../RunSetup'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
const someScore = { runsCleared: 2, runsFailed: 5, bestRooms: 18 }

describe('RunSetup', () => {
  it('renders title', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /dungeon hangman/i })).toBeInTheDocument()
  })

  it('renders Start Run button', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument()
  })

  it('renders Forget me button', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /forget me/i })).toBeInTheDocument()
  })

  it('shows zero score correctly', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/0 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 0 rooms/i)).toBeInTheDocument()
  })

  it('shows non-zero score correctly', () => {
    render(<RunSetup onStart={vi.fn()} score={someScore} onReset={vi.fn()} />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/5 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 18 rooms/i)).toBeInTheDocument()
  })

  it('calls onStart when Start Run is clicked', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onReset when Forget me is clicked', async () => {
    const onReset = vi.fn()
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={onReset} />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('uses singular "run" when runsCleared is 1', () => {
    render(<RunSetup onStart={vi.fn()} score={{ runsCleared: 1, runsFailed: 0, bestRooms: 5 }} onReset={vi.fn()} />)
    expect(screen.getByText(/1 run cleared/i)).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/RunSetup.test.tsx
```

Expected: `Cannot find module '../RunSetup'`.

### Step 3: Create `RunSetup.tsx`

```tsx
import type { RunScore } from '../types'

interface Props {
  onStart: () => void
  score: RunScore
  onReset: () => void
}

export default function RunSetup({ onStart, score, onReset }: Props) {
  return (
    <div className="run-setup">
      <h1>Dungeon Hangman</h1>
      <p className="run-setup__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>
      <button className="btn-start-run" onClick={onStart}>Start Run</button>
      <button className="btn-forget" onClick={onReset}>Forget me</button>
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/RunSetup.test.tsx
```

Expected: all 8 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── RunSetup ───────────────────────────────────────────── */

.run-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 0;
}

.run-setup__score {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin: 0;
}

.btn-start-run {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.btn-start-run:hover {
  background: var(--accent-hover);
}
```

### Step 6: Commit

```bash
git add frontend/src/components/RunSetup.tsx frontend/src/components/__tests__/RunSetup.test.tsx frontend/src/index.css
git commit -m "feat: add RunSetup component"
```

---

## Task 5: FloorProgress component

**Files:**
- Create: `frontend/src/components/FloorProgress.tsx`
- Create: `frontend/src/components/__tests__/FloorProgress.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/FloorProgress.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FloorProgress from '../FloorProgress'
import { buildRooms } from '../../runState'

describe('FloorProgress', () => {
  it('renders 11 room cells', () => {
    const rooms = buildRooms(1)
    render(<FloorProgress rooms={rooms} currentIndex={0} floor={1} />)
    // Each room renders a div with a single letter label
    expect(screen.getAllByText(/^[ERTB]$/).length).toBe(11)
  })

  it('has accessible label with floor number', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={2} />)
    expect(screen.getByLabelText(/floor 2/i)).toBeInTheDocument()
  })

  it('marks current room with current modifier class', () => {
    const rooms = buildRooms(1)
    const { container } = render(<FloorProgress rooms={rooms} currentIndex={3} floor={1} />)
    const cells = container.querySelectorAll('.floor-progress__room')
    expect(cells[3].classList.contains('floor-progress__room--current')).toBe(true)
    expect(cells[2].classList.contains('floor-progress__room--current')).toBe(false)
  })

  it('marks completed rooms with completed modifier class', () => {
    const rooms = buildRooms(1)
    rooms[0] = { ...rooms[0], completed: true }
    rooms[1] = { ...rooms[1], completed: true }
    const { container } = render(<FloorProgress rooms={rooms} currentIndex={2} floor={1} />)
    const cells = container.querySelectorAll('.floor-progress__room')
    expect(cells[0].classList.contains('floor-progress__room--completed')).toBe(true)
    expect(cells[1].classList.contains('floor-progress__room--completed')).toBe(true)
    expect(cells[2].classList.contains('floor-progress__room--completed')).toBe(false)
  })

  it('boss room shows "B"', () => {
    const rooms = buildRooms(1)  // index 10 is boss
    render(<FloorProgress rooms={rooms} currentIndex={0} floor={1} />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('rest room shows "R"', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={1} />)
    expect(screen.getByText('R')).toBeInTheDocument()
  })

  it('treasure room shows "T"', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={1} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/FloorProgress.test.tsx
```

Expected: `Cannot find module '../FloorProgress'`.

### Step 3: Create `FloorProgress.tsx`

```tsx
import type { Room } from '../types'

interface Props {
  rooms: Room[]
  currentIndex: number
  floor: number
}

const ROOM_LABEL: Record<string, string> = {
  enemy: 'E',
  boss: 'B',
  rest: 'R',
  treasure: 'T',
}

export default function FloorProgress({ rooms, currentIndex, floor }: Props) {
  return (
    <div className="floor-progress" aria-label={`Floor ${floor} progress`}>
      {rooms.map((room, i) => {
        let cls = 'floor-progress__room'
        if (room.completed) cls += ' floor-progress__room--completed'
        else if (i === currentIndex) cls += ' floor-progress__room--current'
        return (
          <div key={i} className={cls} title={room.type}>
            {ROOM_LABEL[room.type]}
          </div>
        )
      })}
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/FloorProgress.test.tsx
```

Expected: all 7 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── FloorProgress ──────────────────────────────────────── */

.floor-progress {
  display: flex;
  gap: 4px;
  justify-content: center;
  padding: 0.75rem 0;
}

.floor-progress__room {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 2px solid var(--border);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
}

.floor-progress__room--completed {
  background: var(--correct);
  border-color: var(--correct);
  color: #fff;
}

.floor-progress__room--current {
  border-color: var(--accent);
  color: var(--accent);
}
```

### Step 6: Commit

```bash
git add frontend/src/components/FloorProgress.tsx frontend/src/components/__tests__/FloorProgress.test.tsx frontend/src/index.css
git commit -m "feat: add FloorProgress component"
```

---

## Task 6: RestArea component

**Files:**
- Create: `frontend/src/components/RestArea.tsx`
- Create: `frontend/src/components/__tests__/RestArea.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/RestArea.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RestArea from '../RestArea'
import type { RunState } from '../../types'
import { buildRun } from '../../runState'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun(), ...overrides }
}

describe('RestArea', () => {
  it('renders heading', () => {
    render(<RestArea run={makeRun()} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /rest area/i })).toBeInTheDocument()
  })

  it('displays current HP and coins', () => {
    render(<RestArea run={makeRun({ hp: 12, coins: 25 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByText(/12 \/ 20/)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })

  it('heal button is enabled when coins >= 10 and HP < max', () => {
    render(<RestArea run={makeRun({ hp: 15, coins: 10 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).not.toBeDisabled()
  })

  it('heal button is disabled when coins < 10', () => {
    render(<RestArea run={makeRun({ hp: 15, coins: 9 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).toBeDisabled()
  })

  it('heal button is disabled when HP is at max', () => {
    render(<RestArea run={makeRun({ hp: 20, coins: 20 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).toBeDisabled()
  })

  it('calls onHeal with +5 HP and -10 coins', async () => {
    const onHeal = vi.fn()
    render(<RestArea run={makeRun({ hp: 10, coins: 15 })} onHeal={onHeal} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /heal/i }))
    expect(onHeal).toHaveBeenCalledWith(expect.objectContaining({ hp: 15, coins: 5 }))
  })

  it('heal caps at maxHp', async () => {
    const onHeal = vi.fn()
    render(<RestArea run={makeRun({ hp: 18, maxHp: 20, coins: 20 })} onHeal={onHeal} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /heal/i }))
    expect(onHeal).toHaveBeenCalledWith(expect.objectContaining({ hp: 20 }))
  })

  it('calls onLeave when Leave is clicked', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun()} onHeal={vi.fn()} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/RestArea.test.tsx
```

Expected: `Cannot find module '../RestArea'`.

### Step 3: Create `RestArea.tsx`

```tsx
import type { RunState } from '../types'
import { HEAL_COST, HEAL_AMOUNT } from '../runState'

interface Props {
  run: RunState
  onHeal: (updatedRun: RunState) => void
  onLeave: () => void
}

export default function RestArea({ run, onHeal, onLeave }: Props) {
  const canHeal = run.coins >= HEAL_COST && run.hp < run.maxHp

  function handleHeal() {
    if (!canHeal) return
    onHeal({
      ...run,
      hp: Math.min(run.maxHp, run.hp + HEAL_AMOUNT),
      coins: run.coins - HEAL_COST,
    })
  }

  return (
    <div className="rest-area">
      <h2>Rest Area</h2>
      <p className="rest-area__hp">HP: {run.hp} / {run.maxHp}</p>
      <p className="rest-area__coins">Coins: {run.coins}</p>
      <button className="btn-heal" onClick={handleHeal} disabled={!canHeal}>
        Heal +{HEAL_AMOUNT} HP ({HEAL_COST} coins)
      </button>
      <button className="btn-leave" onClick={onLeave}>Leave</button>
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/RestArea.test.tsx
```

Expected: all 8 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── RestArea ───────────────────────────────────────────── */

.rest-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.rest-area__hp,
.rest-area__coins {
  margin: 0;
  font-size: 1.1rem;
}

.btn-heal {
  background: var(--correct);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.5rem;
  font-size: 1rem;
}

.btn-heal:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-heal:disabled {
  opacity: 0.4;
}

.btn-leave {
  background: transparent;
  border: 2px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  color: var(--text-muted);
}

.btn-leave:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

### Step 6: Commit

```bash
git add frontend/src/components/RestArea.tsx frontend/src/components/__tests__/RestArea.test.tsx frontend/src/index.css
git commit -m "feat: add RestArea component"
```

---

## Task 7: TreasureArea component

**Files:**
- Create: `frontend/src/components/TreasureArea.tsx`
- Create: `frontend/src/components/__tests__/TreasureArea.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/TreasureArea.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TreasureArea from '../TreasureArea'
import { buildRun } from '../../runState'

describe('TreasureArea', () => {
  it('renders heading', () => {
    render(<TreasureArea run={buildRun()} onChoose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /treasure/i })).toBeInTheDocument()
  })

  it('renders three bonus buttons', () => {
    render(<TreasureArea run={buildRun()} onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /reveal a letter/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+5 hp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+10 coins/i })).toBeInTheDocument()
  })

  it('reveal letter sets pendingReveal to true', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={buildRun()} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /reveal a letter/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ pendingReveal: true }))
  })

  it('+5 HP increases hp by 5', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun(), hp: 10 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+5 hp/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ hp: 15 }))
  })

  it('+5 HP caps at maxHp', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun(), hp: 18, maxHp: 20 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+5 hp/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ hp: 20 }))
  })

  it('+10 coins increases coins by 10', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun(), coins: 5 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+10 coins/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ coins: 15 }))
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/TreasureArea.test.tsx
```

Expected: `Cannot find module '../TreasureArea'`.

### Step 3: Create `TreasureArea.tsx`

```tsx
import type { RunState } from '../types'

interface Props {
  run: RunState
  onChoose: (updatedRun: RunState) => void
}

export default function TreasureArea({ run, onChoose }: Props) {
  return (
    <div className="treasure-area">
      <h2>Treasure Room</h2>
      <p>Choose one bonus:</p>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, pendingReveal: true })}>
        Reveal a letter in the next encounter
      </button>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, hp: Math.min(run.maxHp, run.hp + 5) })}>
        +5 HP (instant)
      </button>
      <button className="btn-treasure" onClick={() => onChoose({ ...run, coins: run.coins + 10 })}>
        +10 Coins (instant)
      </button>
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/TreasureArea.test.tsx
```

Expected: all 6 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── TreasureArea ───────────────────────────────────────── */

.treasure-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.treasure-area p {
  color: var(--text-muted);
  margin: 0;
}

.btn-treasure {
  width: 280px;
  background: var(--surface);
  border: 2px solid var(--accent);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  color: var(--accent);
}

.btn-treasure:hover {
  background: var(--accent);
  color: #fff;
}
```

### Step 6: Commit

```bash
git add frontend/src/components/TreasureArea.tsx frontend/src/components/__tests__/TreasureArea.test.tsx frontend/src/index.css
git commit -m "feat: add TreasureArea component"
```

---

## Task 8: CombatView component

**Files:**
- Create: `frontend/src/components/CombatView.tsx`
- Create: `frontend/src/components/__tests__/CombatView.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/CombatView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CombatView from '../CombatView'
import { buildRun } from '../../runState'
import type { GameState, RunState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  maskedWord: '_ _ _',
  maxWrong: 6,
  wrongGuessesLeft: 6,
  guessedLetters: [],
  status: 'in_progress',
}

function enemyRoom() {
  return { type: 'enemy' as const, completed: false, gameId: null }
}

describe('CombatView', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders HP and coins', () => {
    const run = { ...buildRun(), hp: 14, coins: 10 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/14 \/ 20/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('renders the GameBoard (hangman figure)', () => {
    render(<CombatView run={buildRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
  })

  it('calls onCombatEnd with reduced HP after lost word', async () => {
    // Simulate 3 wrong guesses: 6 wrong_guesses_left → 3 left, so 3 wrong guesses made → 6 damage
    const lostResponse = {
      masked_word: '_ _ _', correct: false,
      wrong_guesses_left: 3,
      guessed_letters: ['z', 'x', 'q'],
      status: 'lost',
      word: 'cat',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => lostResponse }))

    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun(), hp: 14, coins: 5 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))  // triggers guess → lost

    // Wait for GameResult to appear (game over), then click "Play Again" = Continue
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
    await userEvent.click(screen.getByRole('button', { name: /play again/i }))

    // 3 wrong guesses × 2 damage = 6 damage; 14 - 6 = 8 HP; lost word → 0 coins earned
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 8, coins: 5 }))
  })

  it('calls onCombatEnd with coins earned after won enemy', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      wrong_guesses_left: 6,  // 0 wrong guesses
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))

    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun(), hp: 20, coins: 0 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
    await userEvent.click(screen.getByRole('button', { name: /play again/i }))

    // 0 wrong guesses → 0 damage; enemy win → +5 coins
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 20, coins: 5 }))
  })

  it('boss win earns 20 coins', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      wrong_guesses_left: 6,
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))

    const onCombatEnd = vi.fn()
    const bossRoom = { type: 'boss' as const, completed: false, gameId: null }
    render(<CombatView run={buildRun()} room={bossRoom} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
    await userEvent.click(screen.getByRole('button', { name: /play again/i }))

    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 20 }))
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: `Cannot find module '../CombatView'`.

### Step 3: Create `CombatView.tsx`

```tsx
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
  const pendingRunRef = useRef<RunState | null>(null)

  function handleGameEnd(result: 'won' | 'lost', wrongGuessesMade: number) {
    const damage = wrongGuessesMade * DAMAGE_PER_WRONG
    const newHp = Math.max(0, run.hp - damage)
    const coinsEarned = result === 'won'
      ? (room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY)
      : 0
    const updated: RunState = {
      ...run,
      hp: newHp,
      coins: run.coins + coinsEarned,
      status: newHp <= 0 ? 'lost' : run.status,
    }
    pendingRunRef.current = updated
    setDisplayRun(updated)
  }

  function handlePlayAgain() {
    onCombatEnd(pendingRunRef.current ?? run)
  }

  return (
    <div className="combat-view">
      <div className="combat-view__stats">
        <span className="combat-view__hp">HP: {displayRun.hp} / {displayRun.maxHp}</span>
        <span className="combat-view__coins">Coins: {displayRun.coins}</span>
      </div>
      <p className="combat-view__floor">Floor {floor}</p>
      <GameBoard
        initialState={initialState}
        onGameEnd={handleGameEnd}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: all 5 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── CombatView ─────────────────────────────────────────── */

.combat-view__stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.combat-view__hp {
  color: var(--wrong);
}

.combat-view__coins {
  color: var(--accent);
}

.combat-view__floor {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}
```

### Step 6: Commit

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx frontend/src/index.css
git commit -m "feat: add CombatView component"
```

---

## Task 9: RunResult component

**Files:**
- Create: `frontend/src/components/RunResult.tsx`
- Create: `frontend/src/components/__tests__/RunResult.test.tsx`

### Step 1: Write failing tests

Create `frontend/src/components/__tests__/RunResult.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunResult from '../RunResult'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
const someScore = { runsCleared: 3, runsFailed: 2, bestRooms: 22 }

describe('RunResult', () => {
  it('shows "Dungeon Cleared!" when won', () => {
    render(<RunResult won={true} roomsCleared={33} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/dungeon cleared/i)).toBeInTheDocument()
  })

  it('shows "You Died" when lost', () => {
    render(<RunResult won={false} roomsCleared={7} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/you died/i)).toBeInTheDocument()
  })

  it('shows rooms cleared count', () => {
    render(<RunResult won={false} roomsCleared={12} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('shows updated score', () => {
    render(<RunResult won={true} roomsCleared={33} score={someScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/3 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/2 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 22 rooms/i)).toBeInTheDocument()
  })

  it('renders Start New Run button', () => {
    render(<RunResult won={false} roomsCleared={5} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start new run/i })).toBeInTheDocument()
  })

  it('calls onNewRun when button is clicked', async () => {
    const onNewRun = vi.fn()
    render(<RunResult won={false} roomsCleared={5} score={zeroScore} onNewRun={onNewRun} />)
    await userEvent.click(screen.getByRole('button', { name: /start new run/i }))
    expect(onNewRun).toHaveBeenCalledOnce()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/RunResult.test.tsx
```

Expected: `Cannot find module '../RunResult'`.

### Step 3: Create `RunResult.tsx`

```tsx
import type { RunScore } from '../types'

interface Props {
  won: boolean
  roomsCleared: number
  score: RunScore
  onNewRun: () => void
}

export default function RunResult({ won, roomsCleared, score, onNewRun }: Props) {
  return (
    <div className="run-result">
      <h2 className={won ? 'run-result__title--won' : 'run-result__title--lost'}>
        {won ? 'Dungeon Cleared!' : 'You Died'}
      </h2>
      <p className="run-result__rooms">Rooms cleared: {roomsCleared}</p>
      <p className="run-result__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>
      <button className="btn-new-run" onClick={onNewRun}>Start New Run</button>
    </div>
  )
}
```

### Step 4: Run tests and verify all pass

```bash
npm test -- --run src/components/__tests__/RunResult.test.tsx
```

Expected: all 6 tests pass.

### Step 5: Add CSS to `frontend/src/index.css`

Append:

```css
/* ── RunResult ──────────────────────────────────────────── */

.run-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.run-result__title--won {
  color: var(--correct);
}

.run-result__title--lost {
  color: var(--wrong);
}

.run-result__rooms,
.run-result__score {
  margin: 0;
  color: var(--text-muted);
}

.btn-new-run {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
}

.btn-new-run:hover {
  background: var(--accent-hover);
}
```

### Step 6: Commit

```bash
git add frontend/src/components/RunResult.tsx frontend/src/components/__tests__/RunResult.test.tsx frontend/src/index.css
git commit -m "feat: add RunResult component"
```

---

## Task 10: App.tsx rewrite + App.test.tsx rewrite

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`
- Delete: `frontend/src/components/GameSetup.tsx` (replaced by RunSetup)

### Step 1: Write new App tests

Replace the entire content of `frontend/src/components/__tests__/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

const mockGameResponse = {
  game_id: 'test-uuid',
  masked_word: '_ _ _ _ _ _ _ _',  // 8-letter boss-compatible word
  max_wrong: 6,
  wrong_guesses_left: 6,
  guessed_letters: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows RunSetup on initial render', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument()
  })

  it('shows zero score on initial render', () => {
    render(<App />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
  })

  it('switches to CombatView after starting a run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
    })
  })

  it('shows error when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })

  it('shows FloorProgress during combat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/floor 1 progress/i)).toBeInTheDocument()
    })
  })

  it('loads persisted score from localStorage on mount', () => {
    localStorage.setItem('hangman_score', JSON.stringify({ runsCleared: 2, runsFailed: 3, bestRooms: 15 }))
    render(<App />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
  })

  it('Forget me resets score to zero and clears localStorage', async () => {
    localStorage.setItem('hangman_score', JSON.stringify({ runsCleared: 2, runsFailed: 3, bestRooms: 15 }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
    expect(localStorage.getItem('hangman_score')).toBeNull()
  })

  it('falls back to zero score on invalid localStorage JSON', () => {
    localStorage.setItem('hangman_score', 'garbage')
    render(<App />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
  })

  it('resumes saved run from localStorage on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    // Saved run: in_progress on floor 1, room 0 (enemy)
    const { buildRun } = await import('../../runState')
    const savedRun = buildRun()
    localStorage.setItem('hangman_run', JSON.stringify(savedRun))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
    })
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: many failures — tests expect `Start Run` but App still renders old GameSetup.

### Step 3: Replace `frontend/src/App.tsx`

```tsx
import { useState, useEffect } from 'react'
import type { GameState, GameStatus, RunState, RunScore, Room } from './types'
import {
  buildRun, buildRooms, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, computeRoomsCleared,
  SCORE_KEY,
} from './runState'
import RunSetup from './components/RunSetup'
import FloorProgress from './components/FloorProgress'
import CombatView from './components/CombatView'
import RestArea from './components/RestArea'
import TreasureArea from './components/TreasureArea'
import RunResult from './components/RunResult'
import './App.css'

type AppPhase = 'idle' | 'combat' | 'rest' | 'treasure' | 'run_won' | 'run_lost'

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
        fetchAndEnterCombat(saved, room.type, saved.pendingReveal)
      } else if (room.type === 'rest') {
        setPhase('rest')
      } else if (room.type === 'treasure') {
        setPhase('treasure')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAndEnterCombat(
    currentRun: RunState,
    roomType: 'enemy' | 'boss',
    hint: boolean,
  ) {
    setError(null)
    try {
      const body: Record<string, unknown> = { room_type: roomType }
      if (hint) body.hint = true
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
        maxWrong: data.max_wrong,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: 'in_progress' as GameStatus,
      }
      // Clear pendingReveal now that we've consumed it
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

  async function handleStartRun() {
    const newRun = buildRun()
    saveRun(newRun)
    setRun(newRun)
    await fetchAndEnterCombat(newRun, 'enemy', false)
  }

  async function handleCombatEnd(updatedRun: RunState) {
    const roomIndex = updatedRun.roomIndex
    const updatedRooms = updatedRun.rooms.map((r, i) =>
      i === roomIndex ? { ...r, completed: true } : r,
    )

    // Check for death
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

    // Check for boss defeat (room index 10)
    if (roomIndex === 10) {
      if (updatedRun.floor === 3) {
        // Run won!
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
        // Advance to next floor
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

    // Advance to next room
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
    }
  }

  function handleRestHeal(updatedRun: RunState) {
    saveRun(updatedRun)
    setRun(updatedRun)
  }

  async function handleRestLeave() {
    if (!run) return
    await advanceFromNonCombatRoom(run)
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

      {phase === 'combat' && currentGame && run && (
        <CombatView
          run={run}
          room={run.rooms[run.roomIndex]}
          initialState={currentGame}
          floor={run.floor}
          onCombatEnd={handleCombatEnd}
        />
      )}

      {phase === 'rest' && run && (
        <RestArea run={run} onHeal={handleRestHeal} onLeave={handleRestLeave} />
      )}

      {phase === 'treasure' && run && (
        <TreasureArea run={run} onChoose={handleTreasureChoose} />
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
```

### Step 4: Delete `GameSetup.tsx`

```bash
rm frontend/src/components/GameSetup.tsx
```

Also delete `frontend/src/components/__tests__/GameSetup.test.tsx`:

```bash
rm frontend/src/components/__tests__/GameSetup.test.tsx
```

### Step 5: Run the App tests and verify they pass

```bash
npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: all 9 tests pass.

### Step 6: Run the full test suite

```bash
npm test -- --run
```

Expected: all tests pass (prior 50 - 3 deleted GameSetup tests + 9 new App tests = ~56 tests).

### Step 7: Commit

```bash
git add frontend/src/App.tsx frontend/src/components/__tests__/App.test.tsx
git rm frontend/src/components/GameSetup.tsx frontend/src/components/__tests__/GameSetup.test.tsx
git commit -m "feat: rewrite App as dungeon roguelike run state machine"
```

---

## Final verification

```bash
# Backend
cd backend && source venv/bin/activate && pytest tests/ -v
# Expected: 40 tests pass

# Frontend
cd frontend && npm test -- --run
# Expected: all tests pass

# Manual smoke test
# Terminal 1: cd backend && source venv/bin/activate && python app.py
# Terminal 2: cd frontend && npm run dev
# Open http://localhost:5173 — click Start Run, play through rooms
```
