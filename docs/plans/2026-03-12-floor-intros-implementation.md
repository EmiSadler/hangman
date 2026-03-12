# Floor Intros & Victory Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add themed floor intro screens between levels, a dramatic victory screen, fix a desert palette, and correct two minor contrast issues.

**Architecture:** Five independent tasks. CSS-only changes go first (no tests). Then CombatView gets a minor signature change (pass boss name out). Then two new components are built TDD-first. Finally App.tsx is wired to use them and existing App tests are updated to account for the new `floor_intro` phase.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, CSS custom properties

---

## Context

Read these files before starting:
- `docs/plans/2026-03-12-floor-intros-design.md` — full design spec
- `frontend/src/App.tsx` — current phase state machine
- `frontend/src/components/CombatView.tsx` — current `onCombatEnd` prop (line 16), `handleContinue` (lines 364-366), `enemyName` state (line 201)
- `frontend/src/components/__tests__/App.test.tsx` — tests you will need to update in Task 5

**Current test count: 204. Final expected count: 215** (7 new FloorIntroScreen + 5 new VictoryScreen − 1 old App test + 0 others net change... actually let me be precise: +7 FloorIntroScreen +5 VictoryScreen, and App tests are updated not added to — so 204 + 7 + 5 = 216 minus any that are renamed/removed. Target ~216.)

**Test command:** `cd frontend && npm test -- --run`

---

## Task 1: CSS fixes — text-muted contrast + desert palette

**No tests needed** — visual-only changes. Run the full test suite after to confirm nothing broke.

**Files:**
- Modify: `frontend/src/index.css`

### Step 1: Fix global `--text-muted` contrast

In `frontend/src/index.css`, on line 9, change:
```css
--text-muted:   #8a7e6a;
```
to:
```css
--text-muted:   #9a8e78;  /* was #8a7e6a — bumped from 4.4:1 to 5.4:1 contrast */
```

### Step 2: Replace the desert theme palette

Find the `[data-theme="desert"]` block (around line 1086) and replace it entirely:

```css
[data-theme="desert"] {
  --bg:           #4e2808;  /* warm amber-brown — dusty sand in shadow */
  --surface:      #6e3e10;  /* sandy-brown surface */
  --accent:       #f0b030;  /* hot sun gold */
  --accent-hover: #cc9020;
  --text:         #f8e4b4;  /* bleached sand — 10.3:1 contrast */
  --text-muted:   #d4a050;  /* dusty gold — 5.5:1 contrast */
  --border:       #5c3208;
  --correct:      #4a7c59;
  --wrong:        #8b2e2e;
}
```

### Step 3: Run tests and verify all 204 still pass

```bash
cd frontend && npm test -- --run
```

Expected: 204 tests pass, 0 failures.

### Step 4: Commit

```bash
git add frontend/src/index.css
git commit -m "fix: improve desert palette readability and bump text-muted contrast"
```

---

## Task 2: CombatView — pass boss name through onCombatEnd

The `onCombatEnd` callback currently only passes the updated run. We need to also pass the enemy name when a boss fight is won, so App.tsx can display it on the floor intro / victory screen.

**Files:**
- Modify: `frontend/src/components/CombatView.tsx` (lines 16, 364–366)

**No new tests needed.** The existing CombatView tests mock `onCombatEnd` and will still pass since the new second parameter is optional.

### Step 1: Update the prop type (line 16)

Change:
```typescript
  onCombatEnd: (updatedRun: RunState) => void
```
to:
```typescript
  onCombatEnd: (updatedRun: RunState, bossName?: string) => void
```

### Step 2: Update `handleContinue` (lines 364–366)

Change:
```typescript
  function handleContinue() {
    onCombatEnd(pendingRun ?? displayRun)
  }
```
to:
```typescript
  function handleContinue() {
    const finalRun = pendingRun ?? displayRun
    const bossName = room.type === 'boss' && finalRun.hp > 0 ? enemyName : undefined
    onCombatEnd(finalRun, bossName)
  }
```

The condition `finalRun.hp > 0` ensures we only pass the boss name on a win (not on death-by-boss).

### Step 3: Run tests

```bash
cd frontend && npm test -- --run
```

Expected: 204 tests pass, 0 failures.

### Step 4: Commit

```bash
git add frontend/src/components/CombatView.tsx
git commit -m "feat: pass bossName from CombatView through onCombatEnd on boss win"
```

---

## Task 3: FloorIntroScreen component

**Files:**
- Create: `frontend/src/components/FloorIntroScreen.tsx`
- Create: `frontend/src/components/__tests__/FloorIntroScreen.test.tsx`

### Step 1: Write the failing tests

Create `frontend/src/components/__tests__/FloorIntroScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import FloorIntroScreen from '../FloorIntroScreen'
import { buildRun } from '../../runState'
import type { ThemeId } from '../../types'

function makeRun(floor: number, themes: [ThemeId, ThemeId, ThemeId]) {
  return { ...buildRun('berserker', themes), floor }
}

describe('FloorIntroScreen', () => {
  test('shows floor title for space theme', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText('The Void Depths')).toBeInTheDocument()
  })

  test('shows floor number label', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText('Floor 2')).toBeInTheDocument()
  })

  test('shows mechanic hint for swamp theme', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText(/mud is hurled/i)).toBeInTheDocument()
  })

  test('shows victory line when defeatedBossName is provided', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName="Void Emperor" onContinue={() => {}} />)
    expect(screen.getByText('You defeated Void Emperor!')).toBeInTheDocument()
  })

  test('does not show victory line when defeatedBossName is null', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.queryByText(/you defeated/i)).not.toBeInTheDocument()
  })

  test('calls onContinue when Enter Floor button is clicked', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    const onContinue = vi.fn()
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  test('applies data-theme attribute from the floor theme', () => {
    const run = makeRun(1, ['jungle', 'swamp', 'desert'])
    const { container } = render(
      <FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />
    )
    expect(container.firstChild).toHaveAttribute('data-theme', 'jungle')
  })
})
```

### Step 2: Run tests and verify they fail

```bash
cd frontend && npm test -- --run src/components/__tests__/FloorIntroScreen.test.tsx
```

Expected: 7 failures — "Cannot find module '../FloorIntroScreen'"

### Step 3: Implement FloorIntroScreen

Create `frontend/src/components/FloorIntroScreen.tsx`:

```tsx
import type { RunState } from '../types'
import type { ThemeId } from '../types'

interface FloorIntroScreenProps {
  run: RunState
  defeatedBossName: string | null
  onContinue: () => void
}

const FLOOR_INTRO_DATA: Record<ThemeId, { title: string; tagline: string; mechanicHint: string }> = {
  space: {
    title: 'The Void Depths',
    tagline: 'Stars die here. The silence between them is hungry.',
    mechanicHint: 'Every 3 guesses, your enemy tears letters into the void — unplayable, gone.',
  },
  swamp: {
    title: 'The Festering Mire',
    tagline: 'The water does not move. Neither do the things beneath it.',
    mechanicHint: 'Every 2 guesses, mud is hurled at your keyboard — wrong guesses on stuck letters deal double damage.',
  },
  desert: {
    title: 'The Endless Dune',
    tagline: 'The wind remembers every traveller who did not make it.',
    mechanicHint: 'Each wrong guess, the wind steals another letter from you.',
  },
  jungle: {
    title: 'The Canopy Dark',
    tagline: 'The light that reaches the floor has forgotten what it came from.',
    mechanicHint: 'Correct guesses invite vines — they creep up your keyboard with every letter you find.',
  },
}

export default function FloorIntroScreen({ run, defeatedBossName, onContinue }: FloorIntroScreenProps) {
  const theme = run.floorThemes[run.floor - 1]
  const data = FLOOR_INTRO_DATA[theme]

  return (
    <div className="floor-intro" data-theme={theme}>
      {defeatedBossName && (
        <p className="floor-intro__victory">You defeated {defeatedBossName}!</p>
      )}
      <p className="floor-intro__floor-label">Floor {run.floor}</p>
      <h1 className="floor-intro__title">{data.title}</h1>
      <p className="floor-intro__tagline">{data.tagline}</p>
      <p className="floor-intro__hint">{data.mechanicHint}</p>
      <button className="btn btn-primary floor-intro__btn" onClick={onContinue}>
        Enter Floor {run.floor}
      </button>
    </div>
  )
}
```

### Step 4: Add CSS for FloorIntroScreen

Append to `frontend/src/index.css` (after the cast message section):

```css
/* ── FloorIntroScreen ───────────────────────────────────── */

.floor-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
  gap: 1rem;
}

.floor-intro__victory {
  font-size: 0.95rem;
  color: #c9a227;
  margin: 0;
  letter-spacing: 0.04em;
}

.floor-intro__floor-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0;
}

.floor-intro__title {
  font-size: clamp(1.8rem, 5vw, 3rem);
  color: var(--accent);
  margin: 0;
  letter-spacing: 0.06em;
}

.floor-intro__tagline {
  font-size: 1.1rem;
  color: var(--text);
  max-width: 32rem;
  margin: 0.5rem 0 0;
  line-height: 1.6;
}

.floor-intro__hint {
  font-style: italic;
  font-size: 0.95rem;
  color: var(--text-muted);
  max-width: 30rem;
  margin: 0;
  line-height: 1.5;
}

.floor-intro__btn {
  margin-top: 1rem;
}
```

### Step 5: Run tests and verify they pass

```bash
cd frontend && npm test -- --run src/components/__tests__/FloorIntroScreen.test.tsx
```

Expected: 7 tests pass, 0 failures.

### Step 6: Run full suite

```bash
cd frontend && npm test -- --run
```

Expected: 211 tests pass (204 + 7).

### Step 7: Commit

```bash
git add frontend/src/components/FloorIntroScreen.tsx frontend/src/components/__tests__/FloorIntroScreen.test.tsx frontend/src/index.css
git commit -m "feat: add FloorIntroScreen component with per-theme content"
```

---

## Task 4: VictoryScreen component

**Files:**
- Create: `frontend/src/components/VictoryScreen.tsx`
- Create: `frontend/src/components/__tests__/VictoryScreen.test.tsx`

### Step 1: Write the failing tests

Create `frontend/src/components/__tests__/VictoryScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import VictoryScreen from '../VictoryScreen'
import { buildRun } from '../../runState'
import type { ThemeId } from '../../types'

const run = { ...buildRun('berserker', ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId]), coins: 45, floor: 3 }
const score = { runsCleared: 2, runsFailed: 1, bestRooms: 33 }

describe('VictoryScreen', () => {
  test('shows VICTORY heading', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText('V I C T O R Y')).toBeInTheDocument()
  })

  test('shows defeated boss name when provided', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName="The Singularity" onNewRun={() => {}} />)
    expect(screen.getByText('You defeated The Singularity.')).toBeInTheDocument()
  })

  test('shows coins from run', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  test('shows runs cleared from score', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText(/runs cleared: 2/i)).toBeInTheDocument()
  })

  test('calls onNewRun when Play Again is clicked', () => {
    const onNewRun = vi.fn()
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={onNewRun} />)
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onNewRun).toHaveBeenCalledTimes(1)
  })
})
```

### Step 2: Run tests and verify they fail

```bash
cd frontend && npm test -- --run src/components/__tests__/VictoryScreen.test.tsx
```

Expected: 5 failures — "Cannot find module '../VictoryScreen'"

### Step 3: Implement VictoryScreen

Create `frontend/src/components/VictoryScreen.tsx`:

```tsx
import type { RunState, RunScore } from '../types'

interface VictoryScreenProps {
  run: RunState
  score: RunScore
  defeatedBossName: string | null
  onNewRun: () => void
}

export default function VictoryScreen({ run, score, defeatedBossName, onNewRun }: VictoryScreenProps) {
  return (
    <div className="victory-screen">
      <h1 className="victory-screen__heading">V I C T O R Y</h1>
      {defeatedBossName && (
        <p className="victory-screen__boss">You defeated {defeatedBossName}.</p>
      )}
      <p className="victory-screen__flavour">The dungeon falls silent.</p>
      <div className="victory-screen__stats">
        <div className="victory-screen__stat">
          <span>Floors cleared</span>
          <span>3 / 3</span>
        </div>
        <div className="victory-screen__stat">
          <span>Rooms cleared</span>
          <span>33 / 33</span>
        </div>
        <div className="victory-screen__stat">
          <span>Coins</span>
          <span>{run.coins}</span>
        </div>
      </div>
      <p className="victory-screen__score">Runs cleared: {score.runsCleared}</p>
      <button className="btn btn-primary" onClick={onNewRun}>Play Again</button>
    </div>
  )
}
```

### Step 4: Add CSS for VictoryScreen

Append to `frontend/src/index.css` (after the floor-intro section):

```css
/* ── VictoryScreen ──────────────────────────────────────── */

.victory-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
  gap: 1rem;
  background: #0e0c08;
  color: #e8dcc8;
}

.victory-screen__heading {
  font-size: clamp(2.2rem, 6vw, 4rem);
  color: #c9a227;
  letter-spacing: 0.2em;
  margin: 0;
}

.victory-screen__boss {
  font-size: 1.1rem;
  color: #c9a227;
  margin: 0;
}

.victory-screen__flavour {
  font-style: italic;
  color: #9a8e78;
  margin: 0;
}

.victory-screen__stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #1a1610;
  border: 1px solid #3e3020;
  border-radius: 0.5rem;
  padding: 1.25rem 2.5rem;
  margin: 0.5rem 0;
  min-width: 16rem;
}

.victory-screen__stat {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  font-size: 1rem;
}

.victory-screen__stat span:last-child {
  color: #c9a227;
  font-weight: 600;
}

.victory-screen__score {
  font-size: 0.95rem;
  color: #9a8e78;
  margin: 0;
}
```

### Step 5: Run tests and verify they pass

```bash
cd frontend && npm test -- --run src/components/__tests__/VictoryScreen.test.tsx
```

Expected: 5 tests pass, 0 failures.

### Step 6: Run full suite

```bash
cd frontend && npm test -- --run
```

Expected: 216 tests pass (211 + 5).

### Step 7: Commit

```bash
git add frontend/src/components/VictoryScreen.tsx frontend/src/components/__tests__/VictoryScreen.test.tsx frontend/src/index.css
git commit -m "feat: add VictoryScreen component with gold dramatic treatment"
```

---

## Task 5: App.tsx wiring + update App tests

This task wires the new components into App.tsx and updates the App tests, which break because `handleStartRun` now goes to `floor_intro` instead of directly to combat.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

### Understanding the App test breakage

**Tests that will break after App.tsx changes:**

1. `'switches to CombatView after starting a run'` — currently waits for keyboard button `'A'` after clicking start. With the new flow, start run goes to `floor_intro`, not combat. Will timeout.

2. `'shows FloorProgress during combat'` — same issue; needs to go through floor_intro first.

3. `'shows error when server is unreachable'` — currently the error appears when `fetchAndEnterCombat` fails during `handleStartRun`. With the new flow, `createSession` catches its own errors silently, and the error only appears when clicking "Enter Floor" → `handleFloorIntroContinue` → `fetchAndEnterCombat`. The test needs an extra click step.

4. `'loads a fresh game board after clicking Continue following a won combat'` — needs an "Enter Floor 1" click before the keyboard appears.

Update these tests as shown below. Do NOT write the new App.tsx code before updating the tests — write the test changes first, watch them fail, then implement.

### Step 1: Update the failing App tests

Open `frontend/src/components/__tests__/App.test.tsx`. Make these four changes:

**Change 1 — rename and update "switches to CombatView" test (line 31):**

Replace the entire test:
```typescript
  it('switches to CombatView after starting a run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })
```

with:
```typescript
  it('shows FloorIntroScreen after starting a run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: 'test-session' }),
    }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enter floor 1/i })).toBeInTheDocument()
    })
  })

  it('switches to CombatView after clicking Enter Floor', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGameResponse }),
    )
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter floor 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })
```

**Change 2 — update "shows error when server is unreachable" test (line 44):**

Replace:
```typescript
  it('shows error when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })
```

with:
```typescript
  it('shows error when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockRejectedValueOnce(new Error('Network error')),
    )
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter floor 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })
```

**Change 3 — update "shows FloorProgress during combat" test (line 54):**

Replace:
```typescript
  it('shows FloorProgress during combat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/floor 1 progress/i)).toBeInTheDocument()
    })
  })
```

with:
```typescript
  it('shows FloorProgress during combat', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGameResponse }),
    )
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter floor 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/floor 1 progress/i)).toBeInTheDocument()
    })
  })
```

**Change 4 — update the "loads a fresh game board" test (line 87):**

This test currently mocks 4 fetch calls: session, game1, wonGuess, game2. With the new flow, the session call is first (same), then "Enter Floor 1" triggers game1. The sequence of clicks changes. Replace the entire test:

```typescript
  it('loads a fresh game board after clicking Continue following a won combat', async () => {
    const game1 = { game_id: 'game-1', masked_word: '_ _ _', word: 'cat', category: 'general', first_letter: 'c', guessed_letters: [] }
    const wonGuess = { correct: true, masked_word: 'c a t', guessed_letters: ['c'], status: 'won' }
    const game2 = { game_id: 'game-2', masked_word: '_ _ _ _ _', word: 'brave', category: 'general', first_letter: 'b', guessed_letters: [] }

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => game1 })
      .mockResolvedValueOnce({ ok: true, json: async () => wonGuess })
      .mockResolvedValueOnce({ ok: true, json: async () => game2 }),
    )

    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter floor 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    await waitFor(() => screen.getByRole('button', { name: 'A' }))

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))

    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
```

Then keep the rest of the test as-is (lines 109 onward — the assertions about the fresh game board). Read the current file to see exactly where the test ends.

### Step 2: Run tests and verify the 4 changed tests fail

```bash
cd frontend && npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: those 4 tests fail because `floor_intro` doesn't exist yet and App hasn't changed. The unchanged tests should still pass.

### Step 3: Update App.tsx

Make all changes to `frontend/src/App.tsx`:

**3a. Add imports** at the top (after existing imports):
```typescript
import FloorIntroScreen from './components/FloorIntroScreen'
import VictoryScreen from './components/VictoryScreen'
```

**3b. Update AppPhase type** (line 18):
```typescript
type AppPhase = 'idle' | 'floor_intro' | 'combat' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'
```

**3c. Add `defeatedBossName` state** (after `const [error, setError]` on line 25):
```typescript
const [defeatedBossName, setDefeatedBossName] = useState<string | null>(null)
```

**3d. Update `handleStartRun`** — go to `floor_intro` instead of combat:

Replace the current `handleStartRun` (lines 98–105):
```typescript
  async function handleStartRun(className: ClassName) {
    const newRun = buildRun(className, pickFloorThemes())
    const sessionId = await createSession()
    const runWithSession: RunState = { ...newRun, sessionId }
    saveRun(runWithSession)
    setRun(runWithSession)
    await fetchAndEnterCombat(runWithSession, 'enemy', false)
  }
```

with:
```typescript
  async function handleStartRun(className: ClassName) {
    const newRun = buildRun(className, pickFloorThemes())
    const sessionId = await createSession()
    const runWithSession: RunState = { ...newRun, sessionId }
    saveRun(runWithSession)
    setRun(runWithSession)
    setDefeatedBossName(null)
    setPhase('floor_intro')
  }
```

**3e. Add `handleFloorIntroContinue`** (after `handleStartRun`):
```typescript
  async function handleFloorIntroContinue() {
    if (!run) return
    await fetchAndEnterCombat(run, 'enemy', false)
  }
```

**3f. Update `handleCombatEnd` signature** — add optional `bossName` parameter:

Change:
```typescript
  async function handleCombatEnd(updatedRun: RunState) {
```
to:
```typescript
  async function handleCombatEnd(updatedRun: RunState, bossName?: string) {
```

**3g. Update `handleCombatEnd` — floor 3 win branch** — store boss name before run_won:

Find the run_won block (around line 131):
```typescript
        setPhase('run_won')
        return
```

Change to:
```typescript
        setDefeatedBossName(bossName ?? null)
        setPhase('run_won')
        return
```

**3h. Update `handleCombatEnd` — floor transition branch** — go to `floor_intro` instead of combat:

Replace the `else` branch (around lines 146–158):
```typescript
      } else {
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
```

with:
```typescript
      } else {
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
        setDefeatedBossName(bossName ?? null)
        setPhase('floor_intro')
        return
      }
```

**3i. Update `showProgress`** (line 239):

Change:
```typescript
  const showProgress = phase !== 'idle' && phase !== 'run_won' && phase !== 'run_lost'
```
to:
```typescript
  const showProgress = phase !== 'idle' && phase !== 'floor_intro' && phase !== 'run_won' && phase !== 'run_lost'
```

**3j. Add FloorIntroScreen to JSX** — add after the error `<p>` and before the `showProgress` block:
```tsx
      {phase === 'floor_intro' && run && (
        <FloorIntroScreen
          run={run}
          defeatedBossName={defeatedBossName}
          onContinue={handleFloorIntroContinue}
        />
      )}
```

**3k. Split run_won / run_lost rendering** — replace the combined block (lines 280–287):
```tsx
      {(phase === 'run_won' || phase === 'run_lost') && run && (
        <RunResult
          won={phase === 'run_won'}
          roomsCleared={computeRoomsCleared(run)}
          score={score}
          onNewRun={handleNewRun}
        />
      )}
```

with:
```tsx
      {phase === 'run_won' && run && (
        <VictoryScreen
          run={run}
          score={score}
          defeatedBossName={defeatedBossName}
          onNewRun={handleNewRun}
        />
      )}

      {phase === 'run_lost' && run && (
        <RunResult
          won={false}
          roomsCleared={computeRoomsCleared(run)}
          score={score}
          onNewRun={handleNewRun}
        />
      )}
```

### Step 4: Run App tests and verify all pass

```bash
cd frontend && npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: all App tests pass.

### Step 5: Run full suite

```bash
cd frontend && npm test -- --run
```

Expected: 216 tests pass, 0 failures.

(The count is 204 original + 7 FloorIntroScreen + 5 VictoryScreen = 216. The App tests were updated but the count stays the same — one old test was replaced with two new ones, so net +1; but we also lost 0 tests. Adjust expectation if the count differs slightly — what matters is 0 failures.)

### Step 6: Commit

```bash
git add frontend/src/App.tsx frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: wire floor intro screens and victory screen into app flow"
```

---

## Final check

After all 5 tasks are complete:

```bash
cd frontend && npm test -- --run
```

All tests pass. Then use `superpowers:finishing-a-development-branch` to complete the work.
