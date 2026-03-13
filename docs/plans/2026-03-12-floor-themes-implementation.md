# Floor Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add four floor themes (Space, Swamp, Desert, Jungle) — each with a unique letter mechanic and visual palette — randomly assigned to the three floors each run.

**Architecture:** `floorThemes: [ThemeId, ThemeId, ThemeId]` stored in `RunState` (assigned in `buildRun`, migrated in `loadRun`). `CombatView` reads `run.floorThemes[floor - 1]` and handles all four mechanics. Theme CSS is scoped with `data-theme` attribute on `.combat-view`. Letter state props flow `CombatView → GameBoard → Keyboard`.

**Tech Stack:** React 19, TypeScript, Vite 7, vitest + @testing-library/react. Run tests: `cd frontend && npm test -- --run`. Currently 187 tests passing.

---

### Task 1: ThemeId type + RunState + buildRun + loadRun migration

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/__tests__/runState.test.ts`

**Background:** `RunState` needs a `floorThemes` tuple so every component knows which theme is active per floor. `pickFloorThemes()` shuffles the 4 themes and picks 3 (no repeats). `loadRun` gets a migration fallback so existing saves don't crash.

---

**Step 1: Write failing tests**

Add to `frontend/src/__tests__/runState.test.ts`:

```typescript
import { ..., pickFloorThemes } from '../runState'
import type { ..., ThemeId } from '../types'
```

Add after the `buildRun with className` describe block:

```typescript
describe('pickFloorThemes', () => {
  it('returns exactly 3 themes', () => {
    expect(pickFloorThemes().length).toBe(3)
  })
  it('returns no duplicate themes', () => {
    const themes = pickFloorThemes()
    expect(new Set(themes).size).toBe(3)
  })
  it('all themes are valid ThemeIds', () => {
    const valid = new Set<string>(['space', 'swamp', 'desert', 'jungle'])
    pickFloorThemes().forEach(t => expect(valid.has(t)).toBe(true))
  })
})

describe('buildRun floorThemes', () => {
  it('includes floorThemes with 3 entries', () => {
    const run = buildRun('berserker')
    expect(run.floorThemes.length).toBe(3)
  })
  it('all entries are valid ThemeIds', () => {
    const valid = new Set<string>(['space', 'swamp', 'desert', 'jungle'])
    buildRun('berserker').floorThemes.forEach(t => expect(valid.has(t)).toBe(true))
  })
})
```

Also add inside the `localStorage helpers` describe block:

```typescript
it('loadRun generates floorThemes when missing from saved data', () => {
  const run = buildRun('berserker')
  const legacy = { ...run } as Record<string, unknown>
  delete legacy.floorThemes
  localStorage.setItem('hangman_run', JSON.stringify(legacy))
  const loaded = loadRun()
  expect(loaded?.floorThemes.length).toBe(3)
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts 2>&1 | tail -15
```

Expected: new tests FAIL with "pickFloorThemes is not a function" / "floorThemes" not found.

**Step 3: Implement**

In `frontend/src/types.ts`, add after the `ArtifactId` type:

```typescript
export type ThemeId = 'space' | 'swamp' | 'desert' | 'jungle'
```

Add `floorThemes` to `RunState`:

```typescript
export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number
  roomIndex: number
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
  className: ClassName
  shield: number
  artifacts: ArtifactId[]
  sessionId: string | null
  bonusDamage: number
  floorThemes: [ThemeId, ThemeId, ThemeId]
}
```

In `frontend/src/runState.ts`, add the import and the new function. Change the import line at the top:

```typescript
import type { Room, RunState, RunScore, RoomType, ClassName, ThemeId } from './types'
```

Add `pickFloorThemes` after the `RUN_KEY`/`SCORE_KEY` constants and before `LAYOUT_A`:

```typescript
export function pickFloorThemes(): [ThemeId, ThemeId, ThemeId] {
  const all: ThemeId[] = ['space', 'swamp', 'desert', 'jungle']
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }
  return [all[0], all[1], all[2]]
}
```

Update `buildRun` to include `floorThemes`:

```typescript
export function buildRun(className: ClassName): RunState {
  const maxHp = CLASS_MAX_HP[className]
  return {
    hp: maxHp,
    maxHp,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
    artifacts: [],
    sessionId: null,
    bonusDamage: 0,
    floorThemes: pickFloorThemes(),
  }
}
```

Update `loadRun` — add the migration line after `bonusDamage`:

```typescript
if (parsed.bonusDamage === undefined) parsed.bonusDamage = 0
if (!parsed.floorThemes) parsed.floorThemes = pickFloorThemes()
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts 2>&1 | tail -10
```

Expected: all runState tests pass.

**Step 5: Run full suite**

```bash
cd frontend && npm test -- --run 2>&1 | tail -8
```

Expected: 187 + ~6 new = ~193 tests passing. Note: some CombatView tests that call `buildRun` will now get a `floorThemes` field — TypeScript will be satisfied since `RunState` now requires it.

**Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/runState.test.ts
git commit -m "feat: add ThemeId type, floorThemes to RunState, pickFloorThemes"
```

---

### Task 2: Keyboard + GameBoard new props + key CSS classes

**Files:**
- Modify: `frontend/src/components/Keyboard.tsx`
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/__tests__/Keyboard.test.tsx` (or create it if it doesn't exist — check with `ls frontend/src/components/__tests__/`)

**Background:** Three new letter-state props flow from CombatView → GameBoard → Keyboard. Void and vined letters are disabled (unplayable). Mud letters are NOT disabled — they can be guessed but deal double damage on wrong guesses (CombatView handles the damage, Keyboard just shows the visual). Desert blown-away letters use the existing `blockedLetters` prop. The keyboard's `useEffect` keyboard listener in GameBoard also needs to skip void and vined letters.

---

**Step 1: Write failing tests**

Check if `frontend/src/components/__tests__/Keyboard.test.tsx` exists. If not, create it. Add these tests:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Keyboard from '../Keyboard'

const allLetters = 'abcdefghijklmnopqrstuvwxyz'.split('')

describe('Keyboard', () => {
  it('disables void letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} voidLetters={['a', 'b']} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })

  it('does not disable mud letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} mudLetters={['a', 'b']} />)
    expect(screen.getByRole('button', { name: 'A' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).not.toBeDisabled()
  })

  it('disables vined letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} vinedLetters={['z', 'x']} />)
    expect(screen.getByRole('button', { name: 'Z' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/Keyboard.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `voidLetters`, `mudLetters`, `vinedLetters` not recognized as props.

**Step 3: Implement Keyboard.tsx**

Replace the entire `frontend/src/components/Keyboard.tsx` with:

```typescript
interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
  blockedLetters?: string[]
  voidLetters?: string[]
  mudLetters?: string[]
  vinedLetters?: string[]
}

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
]

export default function Keyboard({
  guessedLetters, correctLetters, onGuess, disabled,
  blockedLetters = [], voidLetters = [], mudLetters = [], vinedLetters = [],
}: Props) {
  return (
    <div className="keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard__row">
          {row.map((letter) => {
            const wasGuessed = guessedLetters.includes(letter)
            const wasCorrect = correctLetters.includes(letter)
            const isBlocked = blockedLetters.includes(letter)
            const isVoid = voidLetters.includes(letter)
            const isMud = mudLetters.includes(letter)
            const isVined = vinedLetters.includes(letter)
            const keyClass = [
              'key',
              wasGuessed ? (wasCorrect ? 'key--correct' : 'key--wrong') : '',
              isBlocked ? 'key--blocked' : '',
              isVoid ? 'key--void' : '',
              isMud ? 'key--mud' : '',
              isVined ? 'key--vined' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={keyClass}
                onClick={() => onGuess(letter)}
                disabled={disabled || wasGuessed || isBlocked || isVoid || isVined}
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

**Step 4: Implement GameBoard.tsx changes**

Open `frontend/src/components/GameBoard.tsx`. The Props interface currently has:

```typescript
interface Props {
  initialState: GameState
  onGuessResult: (letter: string, correct: boolean, occurrences: number) => void
  onWordSolved: () => void
  onPlayAgain: () => void
  playAgainLabel: string
  combatOver: boolean
  blockedLetters?: string[]
  onWrongSolve: () => void
}
```

Add the three new props:

```typescript
interface Props {
  initialState: GameState
  onGuessResult: (letter: string, correct: boolean, occurrences: number) => void
  onWordSolved: () => void
  onPlayAgain: () => void
  playAgainLabel: string
  combatOver: boolean
  blockedLetters?: string[]
  voidLetters?: string[]
  mudLetters?: string[]
  vinedLetters?: string[]
  onWrongSolve: () => void
}
```

Update the function signature to destructure the new props (with defaults):

```typescript
export default function GameBoard({
  initialState, onGuessResult, onWordSolved, onPlayAgain, playAgainLabel,
  combatOver, blockedLetters = [], voidLetters = [], mudLetters = [], vinedLetters = [],
  onWrongSolve
}: Props) {
```

In the keyboard `useEffect` (around line 106), add void and vined checks alongside blocked:

```typescript
if (blockedLetters.includes(letter)) return
if (voidLetters.includes(letter)) return
if (vinedLetters.includes(letter)) return
```

In the `<Keyboard>` JSX (around line 124), pass the new props:

```typescript
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
```

**Step 5: Add CSS key classes**

Append to `frontend/src/index.css` (after the `.key--blocked` styles):

```css
.key--void {
  opacity: 0.2;
  background: #1a1a1a;
  border-color: #4a4a6a;
  color: transparent;
  cursor: not-allowed;
}

.key--mud {
  background: #5c3d1a;
  border-color: #8b6c3a;
  color: #e8d4a8;
}

.key--vined {
  opacity: 0.35;
  background: #1a4a1a;
  border-color: #2a6a2a;
  color: #6aaa6a;
  text-decoration: line-through;
  cursor: not-allowed;
}
```

**Step 6: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/Keyboard.test.tsx 2>&1 | tail -10
```

Expected: all Keyboard tests pass.

**Step 7: Run full suite**

```bash
cd frontend && npm test -- --run 2>&1 | tail -8
```

Expected: all tests pass (no regressions — new props have defaults so existing callers are unaffected).

**Step 8: Commit**

```bash
git add frontend/src/components/Keyboard.tsx frontend/src/components/GameBoard.tsx frontend/src/index.css frontend/src/components/__tests__/Keyboard.test.tsx
git commit -m "feat: add voidLetters/mudLetters/vinedLetters props to Keyboard and GameBoard"
```

---

### Task 3: CombatView theme mechanics

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Background:** This is the core task. CombatView reads the floor's theme and:
- Tracks a `guessCountRef` (incremented each guess) for timer-based abilities (Space every 3, Swamp every 2)
- Shows a `castMessage` after ability triggers (cleared at next guess)
- Space: warns on count%3===2, fires black hole on count%3===0 (3 letters → `voidLetters`)
- Swamp: warns on count%2===1, throws mud on count%2===0 (2 letters → `mudLetters`); wrong guess on mud letter doubles player damage
- Desert: each wrong guess → 1 letter → `blockedLetters` (existing mechanism) with a cast message
- Jungle: initializes 2 letters in bottom row as vined; each correct guess 50% chance to grow vines to lowest available row
- Enemy name selected from theme-specific pool
- `data-theme` attribute on `.combat-view` div for CSS scoping

---

**Step 1: Write failing tests**

Add the import for `ThemeId` to the test file's imports:

```typescript
import type { GameState, RunState, ThemeId } from '../../types'
```

Add these tests inside the existing `describe('CombatView', ...)` block in `frontend/src/components/__tests__/CombatView.test.tsx`:

```typescript
// ── Space theme ──────────────────────────────────────────────────────
it('shows void warning after 2nd guess with space theme', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await userEvent.click(screen.getByRole('button', { name: 'X' }))
  await waitFor(() => expect(screen.getByText(/gathering void energy/i)).toBeInTheDocument())
})

it('casts black hole after 3rd guess with space theme', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await userEvent.click(screen.getByRole('button', { name: 'X' }))
  await userEvent.click(screen.getByRole('button', { name: 'V' }))
  await waitFor(() => expect(screen.getByText(/black hole/i)).toBeInTheDocument())
})

// ── Swamp theme ───────────────────────────────────────────────────────
it('shows mud warning after 1st guess with swamp theme', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => expect(screen.getByText(/winding up/i)).toBeInTheDocument())
})

it('throws mud after 2nd guess with swamp theme', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await userEvent.click(screen.getByRole('button', { name: 'X' }))
  await waitFor(() => expect(screen.getByText(/hurls mud/i)).toBeInTheDocument())
})

it('doubles player damage on wrong guess for mud-stuck letter', async () => {
  // Math.random = 0.1: enemy name picks index 0, mud sort keeps original order → mud goes to 'a','b'
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  // berserker, 50 HP, no artifacts, no shield. Wrong guess = 2 HP damage each
  const run = { ...buildRun('berserker'), hp: 50, floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // guess 1 (Z wrong): count=1 → warning. HP 50→48
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => expect(screen.getByText(/48 \/ 50/)).toBeInTheDocument())
  // guess 2 (X wrong): count=2 → mud thrown (picks 'a','b'). HP 48→46
  await userEvent.click(screen.getByRole('button', { name: 'X' }))
  await waitFor(() => expect(screen.getByText(/46 \/ 50/)).toBeInTheDocument())
  // guess 3 (B wrong, mud-stuck): normal dmg=2, mud doubles → 4 HP lost. HP 46→42
  await userEvent.click(screen.getByRole('button', { name: 'B' }))
  await waitFor(() => expect(screen.getByText(/42 \/ 50/)).toBeInTheDocument())
})

// ── Desert theme ──────────────────────────────────────────────────────
it('blows away a letter on wrong guess with desert theme', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['desert', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => expect(screen.getByText(/stirs the sands/i)).toBeInTheDocument())
})

// ── Jungle theme ──────────────────────────────────────────────────────
it('starts with 2 disabled letters on bottom keyboard row for jungle theme', () => {
  const run = { ...buildRun('berserker'), floorThemes: ['jungle', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  const bottomRow = ['Z','X','C','V','B','N','M']
  const disabledCount = bottomRow.filter(
    letter => screen.getByRole('button', { name: letter }).hasAttribute('disabled')
  ).length
  expect(disabledCount).toBe(2)
})

it('shows vine message on correct guess with jungle theme when vine grows', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.1) // always < 0.5 → vine always grows
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], occurrences: 1 }),
  }))
  const run = { ...buildRun('berserker'), floorThemes: ['jungle', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText(/spreads the jungle/i)).toBeInTheDocument())
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx 2>&1 | tail -20
```

Expected: 8 new tests FAIL (no theme mechanics yet). Existing 44 pass.

**Step 3: Implement CombatView.tsx**

Open `frontend/src/components/CombatView.tsx`.

**3a. Update imports** — add `ThemeId` to the type import:

```typescript
import type { GameState, Room, RunState, ClassName, ArtifactId, ThemeId } from '../types'
```

**3b. Add themed enemy/boss name pools** — replace the existing `ENEMY_NAMES` and `BOSS_NAMES` exports with the themed versions (keep the old exports for backward-compat with any tests that import them directly):

```typescript
export const ENEMY_NAMES = [
  'Swamp Monster', 'Skeleton Archer', 'Mutated Bee', 'Cave Troll',
  'Plague Rat', 'Stone Golem', 'Shadow Wraith', 'Bog Witch',
  'Dire Wolf', 'Fungal Horror', 'Cursed Scarecrow', 'Sand Shark',
]

export const BOSS_NAMES = [
  'Death Knight', 'Ancient Vampire', 'The Hollow King',
  'Bone Colossus', 'Plague Bringer', 'Void Serpent',
  'The Undying', 'Abyssal Tyrant',
]

const THEME_ENEMY_NAMES: Record<ThemeId, string[]> = {
  space:  ['Void Stalker', 'Nebula Wraith', 'Star Devourer', 'Cosmic Horror',
           'Event Horizon', 'Dark Matter', 'Gravity Well', 'Stellar Parasite'],
  swamp:  ['Bog Witch', 'Mud Golem', 'Fetid Lurker', 'Spore Shambler',
           'Swamp Troll', 'Plague Mosquito', 'Mire Beast', 'Toxic Salamander'],
  desert: ['Sand Wraith', 'Dune Scorpion', 'Heat Mirage', 'Dust Devil',
           'Bone Collector', 'Desert Sphinx', 'Sand Leech', 'Cactus Demon'],
  jungle: ['Vine Strangler', 'Poison Dart Frog', 'Canopy Serpent', 'Thorn Lizard',
           'Feral Hunter', 'Moss Titan', 'Jungle Witch', 'Spore Creeper'],
}

const THEME_BOSS_NAMES: Record<ThemeId, string[]> = {
  space:  ['The Singularity', 'Void Emperor', 'Entropy Lord', 'The Event Horizon'],
  swamp:  ['The Bog Queen', 'Ancient Ooze', 'The Pestilence', 'Swamp Colossus'],
  desert: ['The Sand King', 'The Buried God', 'Eternal Dune', 'The Bone Sovereign'],
  jungle: ['The Canopy Sovereign', 'Apex Predator', 'The Ancient Tree', 'The Green God'],
}

const KEYBOARD_ROWS = [
  ['z','x','c','v','b','n','m'],
  ['a','s','d','f','g','h','j','k','l'],
  ['q','w','e','r','t','y','u','i','o','p'],
]
```

**3c. Derive theme at top of component** — add right after the `Props` destructure line (line ~119):

```typescript
const theme: ThemeId = run.floorThemes[floor - 1]
```

**3d. Add new state variables** — add after the existing `const [guessedLetters, ...]` and `const enemyHpRef` lines:

```typescript
const guessCountRef = useRef(0)
const [voidLetters, setVoidLetters] = useState<string[]>([])
const [mudLetters, setMudLetters] = useState<string[]>([])
const [vinedLetters, setVinedLetters] = useState<string[]>([])
const [castMessage, setCastMessage] = useState<string | null>(null)
```

**3e. Update enemy name selection** — find the existing `const [enemyName] = useState(...)` block and replace it:

```typescript
const [enemyName] = useState(() => {
  const pool = room.type === 'boss' ? THEME_BOSS_NAMES[theme] : THEME_ENEMY_NAMES[theme]
  return pool[Math.floor(Math.random() * pool.length)]
})
```

**3f. Add jungle initialization useEffect** — add after the existing `useEffect` for `currentEnemyHp`:

```typescript
useEffect(() => {
  if (theme !== 'jungle') return
  const bottomRow = KEYBOARD_ROWS[0]
  const shuffled = [...bottomRow].sort(() => Math.random() - 0.5)
  setVinedLetters([shuffled[0], shuffled[1]])
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**3g. Add theme helper functions** — add after `handleWrongSolve`:

```typescript
function pickRandom(arr: string[], n: number): string[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

function getAvailable(): string[] {
  return ALPHABET.filter(l =>
    !guessedLetters.includes(l) &&
    !blockedLetters.includes(l) &&
    !voidLetters.includes(l) &&
    !vinedLetters.includes(l)
  )
}

function fireBlackHole() {
  const targets = pickRandom(getAvailable().filter(l => !mudLetters.includes(l)), 3)
  if (targets.length > 0) setVoidLetters(prev => [...prev, ...targets])
  setCastMessage(`${enemyName} casts Black Hole! ${targets.length} letter${targets.length !== 1 ? 's are' : ' is'} sucked into the void!`)
}

function throwMud() {
  const targets = pickRandom(getAvailable().filter(l => !mudLetters.includes(l)), 2)
  if (targets.length > 0) setMudLetters(prev => [...prev, ...targets])
  setCastMessage(`${enemyName} hurls mud! ${targets.length} letter${targets.length !== 1 ? 's are' : ' is'} stuck!`)
}

function blowLetterAway() {
  const available = getAvailable()
  if (available.length === 0) return
  const blown = available[Math.floor(Math.random() * available.length)]
  setBlockedLetters(prev => [...prev, blown])
  setCastMessage(`${enemyName} stirs the sands! '${blown.toUpperCase()}' blows away!`)
}

function growVines() {
  if (Math.random() >= 0.5) return
  for (const row of KEYBOARD_ROWS) {
    const available = row.filter(l => !vinedLetters.includes(l) && !guessedLetters.includes(l))
    if (available.length > 0) {
      const target = available[Math.floor(Math.random() * available.length)]
      setVinedLetters(prev => [...prev, target])
      setCastMessage(`${enemyName} spreads the jungle! Vines creep higher!`)
      return
    }
  }
}
```

**3h. Update handleGuessResult** — at the VERY START of `handleGuessResult`, clear the cast message:

```typescript
function handleGuessResult(letter: string, correct: boolean, occurrences: number) {
  setCastMessage(null)
  // ... rest of existing function ...
```

For mud damage doubling, in the `else` (wrong guess) branch, find:

```typescript
const { playerDmg, shieldLeft } = calcDamageTaken(
  letter, run.className, isAbilityMiss, displayRun.shield, run.artifacts,
)
const newHp = Math.max(0, displayRun.hp - playerDmg)
```

Replace with:

```typescript
const { playerDmg: rawPlayerDmg, shieldLeft } = calcDamageTaken(
  letter, run.className, isAbilityMiss, displayRun.shield, run.artifacts,
)
const playerDmg = (theme === 'swamp' && mudLetters.includes(letter))
  ? rawPlayerDmg * 2
  : rawPlayerDmg
const newHp = Math.max(0, displayRun.hp - playerDmg)
```

At the END of `handleGuessResult`, after `if (!wasAbilityMode) setCooldown(prev => Math.max(0, prev - 1))`, add:

```typescript
  // Theme mechanics
  guessCountRef.current += 1
  const count = guessCountRef.current

  if (theme === 'space') {
    if (count % 3 === 2) {
      setCastMessage(`${enemyName} is gathering void energy...`)
    } else if (count % 3 === 0) {
      fireBlackHole()
    }
  } else if (theme === 'swamp') {
    if (count % 2 === 1) {
      setCastMessage(`${enemyName} is winding up...`)
    } else if (count % 2 === 0) {
      throwMud()
    }
  } else if (theme === 'desert' && !correct) {
    blowLetterAway()
  } else if (theme === 'jungle' && correct) {
    growVines()
  }
```

Note: the theme mechanics block goes at the very end, after the cooldown update and AFTER any early returns (the player-death `return` happens earlier in the function). This ensures theme mechanics don't fire when the player dies.

**3i. Add data-theme and castMessage to JSX** — find the opening div of the component:

```tsx
<div className="combat-view">
```

Change to:

```tsx
<div className="combat-view" data-theme={theme}>
```

Add the cast message display after the archivist info section and before the artifact info section (or before the GameBoard conditional):

```tsx
{castMessage && (
  <div className="combat-view__cast-message">{castMessage}</div>
)}
```

**3j. Pass new props to GameBoard** — find the `<GameBoard>` JSX and add the three new props:

```tsx
<GameBoard
  key={currentGame.gameId}
  initialState={currentGame}
  onGuessResult={handleGuessResult}
  onWordSolved={handleWordSolved}
  onPlayAgain={handleContinue}
  playAgainLabel={playAgainLabel}
  combatOver={combatDone || enemyDead}
  blockedLetters={blockedLetters}
  voidLetters={voidLetters}
  mudLetters={mudLetters}
  vinedLetters={vinedLetters}
  onWrongSolve={handleWrongSolve}
/>
```

**Step 4: Run CombatView tests**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx 2>&1 | tail -20
```

Expected: all 44 + 8 = 52 CombatView tests pass.

**Step 5: Run full suite**

```bash
cd frontend && npm test -- --run 2>&1 | tail -8
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: implement floor theme mechanics (space/swamp/desert/jungle)"
```

---

### Task 4: Per-theme CSS palette overrides

**Files:**
- Modify: `frontend/src/index.css`

**Background:** Each theme redefines the CSS custom properties scoped to `[data-theme="..."]` on `.combat-view`. The rest of the app (RunSetup, RestArea, Shop, etc.) is unaffected. No tests needed — visual only, covered by existing tests rendering with themes.

---

**Step 1: No test needed**

The summoning/theme tests in Task 3 already render CombatView with `data-theme` attributes. Visual correctness is a manual check.

**Step 2: Append CSS palette overrides**

Append to the END of `frontend/src/index.css`:

```css
/* ── Floor Theme Palettes ───────────────────────────────── */

[data-theme="space"] {
  --bg:        #0d0d2b;
  --surface:   #1a1a3e;
  --accent:    #7c3aed;
  --accent-hover: #6d28d9;
  --text:      #e0e0ff;
  --text-muted: #9d8fc0;
  --border:    #3d2d6e;
  --correct:   #4a7c59;
  --wrong:     #8b2e2e;
}

[data-theme="swamp"] {
  --bg:        #1a2a1a;
  --surface:   #243324;
  --accent:    #6b8e23;
  --accent-hover: #556b18;
  --text:      #c8d8b0;
  --text-muted: #8aaa70;
  --border:    #3a5a2a;
  --correct:   #4a7c59;
  --wrong:     #8b2e2e;
}

[data-theme="desert"] {
  --bg:        #f5e6c8;
  --surface:   #fdf2da;
  --accent:    #c17f24;
  --accent-hover: #a06818;
  --text:      #4a2f0a;
  --text-muted: #8a6a40;
  --border:    #d4b896;
  --correct:   #4a7c59;
  --wrong:     #8b2e2e;
}

[data-theme="jungle"] {
  --bg:        #0d2010;
  --surface:   #1a3a1a;
  --accent:    #22c55e;
  --accent-hover: #16a34a;
  --text:      #d0f0c0;
  --text-muted: #70b080;
  --border:    #2a5a2a;
  --correct:   #4a7c59;
  --wrong:     #8b2e2e;
}
```

Also add the cast message style:

```css
/* ── Cast Message ───────────────────────────────────────── */

.combat-view__cast-message {
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  margin: 0.5rem 0;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Step 3: Run full suite to confirm no regressions**

```bash
cd frontend && npm test -- --run 2>&1 | tail -8
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add per-theme CSS palette overrides and cast message style"
```

---

## Final Verification

```bash
cd frontend && npm test -- --run
```

Expected: ~205 tests (187 + ~18 new), all passing.

Manual spot-check:
1. Start a new run — open DevTools, check `data-theme` on `.combat-view` changes per floor
2. Floor with Space theme: make 3 guesses, watch 3 keys go dark, see "Black Hole" message
3. Floor with Swamp theme: make 2 guesses, see mud message, guess a mud key wrong and check extra HP lost
4. Floor with Desert theme: make a wrong guess, see a key disappear with sandy style
5. Floor with Jungle theme: 2 bottom-row keys start disabled; make correct guesses and watch vines spread upward
