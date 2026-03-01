# Artifacts System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collectible artifact system — 14 unique items that grant persistent passive effects, obtainable from Treasure Rooms.

**Architecture:** `ArtifactId[]` stored on `RunState` (serialises cleanly). Lookup table in `artifacts.ts` holds names/emojis/descriptions. All effect logic lives in `CombatView` (combat-time) and `TreasureArea` (instant pickup). New `ArtifactShelf` component renders emoji icons with hover tooltips.

**Tech Stack:** React 19 + TypeScript, Vite 7, vitest + @testing-library/react + @testing-library/user-event

---

### Task 1: `ArtifactId` type + `artifacts.ts` lookup + `sampleArtifacts` helper

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/artifacts.ts`
- Create: `frontend/src/__tests__/artifacts.test.ts`

**Context:** This is pure data — no React, no side effects. `sampleArtifacts` draws N random artifacts not already owned.

---

**Step 1: Add `ArtifactId` to `types.ts`**

Open `frontend/src/types.ts` and add this after the `ClassName` type:

```typescript
export type ArtifactId =
  | 'vowel_seeker' | 'crystal_ball' | 'category_scroll'
  | 'short_sword' | 'blood_dagger'
  | 'iron_shield' | 'thick_skin' | 'chainmail'
  | 'healing_salve' | 'gold_tooth'
  | 'battle_scar' | 'shadow_cloak' | 'mana_crystal' | 'ancient_codex'
```

**Step 2: Write failing tests**

Create `frontend/src/__tests__/artifacts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ARTIFACTS, sampleArtifacts } from '../artifacts'
import type { ArtifactId } from '../types'

describe('ARTIFACTS', () => {
  it('has 14 entries', () => {
    expect(Object.keys(ARTIFACTS).length).toBe(14)
  })

  it('each artifact has id, name, emoji, and description', () => {
    for (const artifact of Object.values(ARTIFACTS)) {
      expect(artifact.id).toBeTruthy()
      expect(artifact.name).toBeTruthy()
      expect(artifact.emoji).toBeTruthy()
      expect(artifact.description).toBeTruthy()
    }
  })
})

describe('sampleArtifacts', () => {
  it('returns the requested count', () => {
    expect(sampleArtifacts([], 3).length).toBe(3)
  })

  it('excludes already-owned artifacts', () => {
    const owned: ArtifactId[] = ['short_sword', 'iron_shield', 'healing_salve']
    const result = sampleArtifacts(owned, 3)
    for (const artifact of result) {
      expect(owned).not.toContain(artifact.id)
    }
  })

  it('returns fewer than count when pool is smaller than count', () => {
    // Own 13 artifacts — only ancient_codex remains
    const owned: ArtifactId[] = [
      'vowel_seeker', 'crystal_ball', 'category_scroll',
      'short_sword', 'blood_dagger', 'iron_shield', 'thick_skin', 'chainmail',
      'healing_salve', 'gold_tooth', 'battle_scar', 'shadow_cloak', 'mana_crystal',
    ]
    expect(sampleArtifacts(owned, 3).length).toBe(1)
  })

  it('returns no duplicate artifacts', () => {
    const result = sampleArtifacts([], 5)
    const ids = result.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/__tests__/artifacts.test.ts
```

Expected: FAIL with "Cannot find module '../artifacts'"

**Step 4: Create `frontend/src/artifacts.ts`**

```typescript
import type { ArtifactId } from './types'

export interface Artifact {
  id: ArtifactId
  name: string
  description: string
  emoji: string
}

export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  vowel_seeker: {
    id: 'vowel_seeker', name: 'Vowel Seeker', emoji: '🔍',
    description: 'At combat start, shows how many vowels are in the word.',
  },
  crystal_ball: {
    id: 'crystal_ball', name: 'Crystal Ball', emoji: '🔮',
    description: 'At combat start, reveals a random letter that is in the word.',
  },
  category_scroll: {
    id: 'category_scroll', name: 'Category Scroll', emoji: '📜',
    description: 'At combat start, shows the word\'s category.',
  },
  short_sword: {
    id: 'short_sword', name: 'Short Sword', emoji: '⚔️',
    description: 'Each correct guess deals +1 bonus damage.',
  },
  blood_dagger: {
    id: 'blood_dagger', name: 'Blood Dagger', emoji: '🗡️',
    description: 'After a wrong guess, your next correct hit deals +2 bonus damage.',
  },
  iron_shield: {
    id: 'iron_shield', name: 'Iron Shield', emoji: '🛡️',
    description: 'Start each combat with +2 shield.',
  },
  thick_skin: {
    id: 'thick_skin', name: 'Thick Skin', emoji: '🪨',
    description: 'Take 1 less damage per wrong guess (minimum 1).',
  },
  chainmail: {
    id: 'chainmail', name: 'Chainmail', emoji: '🧲',
    description: 'Permanently gain +5 max HP when picked up.',
  },
  healing_salve: {
    id: 'healing_salve', name: 'Healing Salve', emoji: '🧪',
    description: 'Restore +3 HP after each combat victory.',
  },
  gold_tooth: {
    id: 'gold_tooth', name: 'Gold Tooth', emoji: '🪙',
    description: 'Earn +5 bonus coins after each combat victory.',
  },
  battle_scar: {
    id: 'battle_scar', name: 'Battle Scar', emoji: '🩹',
    description: 'Start each combat with 1 rage already built up. (Berserker synergy)',
  },
  shadow_cloak: {
    id: 'shadow_cloak', name: 'Shadow Cloak', emoji: '🌑',
    description: 'After a wrong guess, combo drops to 1 instead of 0. (Rogue synergy)',
  },
  mana_crystal: {
    id: 'mana_crystal', name: 'Mana Crystal', emoji: '💎',
    description: 'Your ability cooldown is reduced by 1.',
  },
  ancient_codex: {
    id: 'ancient_codex', name: 'Ancient Codex', emoji: '📖',
    description: 'Cross Reference can be used twice per encounter. (Archivist synergy)',
  },
}

export function sampleArtifacts(owned: ArtifactId[], count: number): Artifact[] {
  const pool = (Object.keys(ARTIFACTS) as ArtifactId[]).filter(id => !owned.includes(id))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(id => ARTIFACTS[id])
}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/__tests__/artifacts.test.ts
```

Expected: PASS (4 tests)

**Step 6: Run all tests to verify nothing broke**

```bash
cd frontend && npm test -- --run
```

Expected: 117 passed

**Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/artifacts.ts frontend/src/__tests__/artifacts.test.ts
git commit -m "feat: add ArtifactId type, ARTIFACTS lookup table, and sampleArtifacts helper"
```

---

### Task 2: Add `artifacts` to `RunState` + `buildRun` + localStorage migration

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/__tests__/runState.test.ts`

**Context:** `RunState` gains `artifacts: ArtifactId[]`. Older saved runs won't have this field, so `loadRun` must migrate them to avoid crashes when calling `.includes()`.

---

**Step 1: Write failing test**

Open `frontend/src/__tests__/runState.test.ts`. In the `describe('buildRun', ...)` block, add:

```typescript
it('starts with an empty artifacts array', () => {
  const run = buildRun('berserker')
  expect(run.artifacts).toEqual([])
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts
```

Expected: FAIL — `run.artifacts` is `undefined`

**Step 3: Add `artifacts` to `RunState` in `types.ts`**

In `frontend/src/types.ts`, add `artifacts: ArtifactId[]` to `RunState`:

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
}
```

**Step 4: Update `buildRun` in `runState.ts`**

Add `artifacts: []` to the returned object:

```typescript
export function buildRun(className: ClassName): RunState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
    artifacts: [],
  }
}
```

**Step 5: Add migration to `loadRun` in `runState.ts`**

Saved runs from before this feature won't have `artifacts`. Update `loadRun` to default it:

```typescript
export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunState
    if (!parsed.artifacts) parsed.artifacts = []
    return parsed
  } catch {
    return null
  }
}
```

**Step 6: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts
```

Expected: PASS (all existing + new test)

**Step 7: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 118 passed

**Step 8: Commit**

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/runState.test.ts
git commit -m "feat: add artifacts field to RunState, buildRun, and loadRun migration"
```

---

### Task 3: `ArtifactShelf` component

**Files:**
- Create: `frontend/src/components/ArtifactShelf.tsx`
- Create: `frontend/src/components/__tests__/ArtifactShelf.test.tsx`

**Context:** Renders a horizontal row of emoji icons. Hover/focus shows a tooltip with the artifact's name and description. Renders nothing if `artifacts` is empty.

---

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/ArtifactShelf.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ArtifactShelf from '../ArtifactShelf'

describe('ArtifactShelf', () => {
  it('renders nothing when artifacts is empty', () => {
    const { container } = render(<ArtifactShelf artifacts={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an icon for each artifact', () => {
    render(<ArtifactShelf artifacts={['short_sword', 'iron_shield']} />)
    expect(screen.getByRole('img', { name: /short sword/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /iron shield/i })).toBeInTheDocument()
  })

  it('shows tooltip with name and description on hover', async () => {
    render(<ArtifactShelf artifacts={['short_sword']} />)
    await userEvent.hover(screen.getByRole('img', { name: /short sword/i }))
    expect(screen.getByText('Short Sword')).toBeInTheDocument()
    expect(screen.getByText(/\+1 bonus damage/i)).toBeInTheDocument()
  })

  it('hides tooltip after mouse leaves', async () => {
    render(<ArtifactShelf artifacts={['short_sword']} />)
    const item = screen.getByRole('img', { name: /short sword/i })
    await userEvent.hover(item)
    await userEvent.unhover(item)
    expect(screen.queryByText(/\+1 bonus damage/i)).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/ArtifactShelf.test.tsx
```

Expected: FAIL — "Cannot find module '../ArtifactShelf'"

**Step 3: Create `frontend/src/components/ArtifactShelf.tsx`**

```tsx
import { useState } from 'react'
import type { ArtifactId } from '../types'
import { ARTIFACTS } from '../artifacts'

interface Props {
  artifacts: ArtifactId[]
}

export default function ArtifactShelf({ artifacts }: Props) {
  const [tooltip, setTooltip] = useState<ArtifactId | null>(null)

  if (artifacts.length === 0) return null

  return (
    <div className="artifact-shelf">
      {artifacts.map(id => {
        const art = ARTIFACTS[id]
        return (
          <div
            key={id}
            className="artifact-shelf__item"
            role="img"
            aria-label={art.name}
            tabIndex={0}
            onMouseEnter={() => setTooltip(id)}
            onMouseLeave={() => setTooltip(null)}
            onFocus={() => setTooltip(id)}
            onBlur={() => setTooltip(null)}
          >
            <span className="artifact-shelf__emoji">{art.emoji}</span>
            {tooltip === id && (
              <div className="artifact-shelf__tooltip">
                <strong>{art.name}</strong>
                <p>{art.description}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/ArtifactShelf.test.tsx
```

Expected: PASS (4 tests)

**Step 5: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 122 passed

**Step 6: Commit**

```bash
git add frontend/src/components/ArtifactShelf.tsx frontend/src/components/__tests__/ArtifactShelf.test.tsx
git commit -m "feat: ArtifactShelf component — emoji row with hover tooltips"
```

---

### Task 4: `TreasureArea` — "Find an Artifact" option

**Files:**
- Modify: `frontend/src/components/TreasureArea.tsx`
- Modify: `frontend/src/components/__tests__/TreasureArea.test.tsx`

**Context:** Add a 4th button "Find an Artifact". Clicking it replaces the button list with 3 artifact cards. Picking one adds the artifact to `run.artifacts`. Chainmail also increases `hp` and `maxHp` by 5 immediately.

---

**Step 1: Write failing tests**

Add these tests to the existing `describe('TreasureArea', ...)` in `TreasureArea.test.tsx`. Add the import at the top:

```tsx
import type { ArtifactId } from '../../types'
```

Then add these tests inside the describe block:

```tsx
it('renders a Find an Artifact button', () => {
  render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
  expect(screen.getByRole('button', { name: /find an artifact/i })).toBeInTheDocument()
})

it('clicking Find an Artifact shows 3 artifact cards', async () => {
  render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
  // Should show artifact picker heading
  expect(screen.getByRole('heading', { name: /find an artifact/i })).toBeInTheDocument()
  // Should show 3 artifact buttons
  const buttons = screen.getAllByRole('button')
  expect(buttons.length).toBe(3)
})

it('picking an artifact adds it to run.artifacts', async () => {
  const onChoose = vi.fn()
  render(<TreasureArea run={buildRun('berserker')} onChoose={onChoose} />)
  await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
  // Click the first artifact button shown
  const buttons = screen.getAllByRole('button')
  await userEvent.click(buttons[0])
  expect(onChoose).toHaveBeenCalledWith(
    expect.objectContaining({ artifacts: expect.arrayContaining([expect.any(String)]) })
  )
})

it('picking Chainmail increases maxHp and hp by 5', async () => {
  const onChoose = vi.fn()
  // Give a run that owns all artifacts except chainmail so it must appear
  const ownedAll: ArtifactId[] = [
    'vowel_seeker', 'crystal_ball', 'category_scroll',
    'short_sword', 'blood_dagger', 'iron_shield', 'thick_skin',
    'healing_salve', 'gold_tooth', 'battle_scar', 'shadow_cloak',
    'mana_crystal', 'ancient_codex',
  ]
  const run = { ...buildRun('berserker'), hp: 30, maxHp: 50, artifacts: ownedAll }
  render(<TreasureArea run={run} onChoose={onChoose} />)
  await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
  // Only chainmail remains — one button shown
  await userEvent.click(screen.getAllByRole('button')[0])
  expect(onChoose).toHaveBeenCalledWith(
    expect.objectContaining({ maxHp: 55, hp: 35, artifacts: expect.arrayContaining(['chainmail']) })
  )
})

it('artifact choices exclude already-owned artifacts', async () => {
  const ownedAll: ArtifactId[] = [
    'vowel_seeker', 'crystal_ball', 'category_scroll',
    'short_sword', 'blood_dagger', 'iron_shield', 'thick_skin', 'chainmail',
    'healing_salve', 'gold_tooth', 'battle_scar', 'shadow_cloak', 'mana_crystal',
  ]
  const run = { ...buildRun('berserker'), artifacts: ownedAll }
  render(<TreasureArea run={run} onChoose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
  // Only ancient_codex remains — exactly 1 button shown
  expect(screen.getAllByRole('button').length).toBe(1)
  expect(screen.getByRole('button', { name: /ancient codex/i })).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/TreasureArea.test.tsx
```

Expected: FAIL — 5 new tests fail

**Step 3: Rewrite `TreasureArea.tsx`**

```tsx
import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact } from '../artifacts'

interface Props {
  run: RunState
  onChoose: (updatedRun: RunState) => void
}

export default function TreasureArea({ run, onChoose }: Props) {
  const [artifactChoices, setArtifactChoices] = useState<Artifact[] | null>(null)

  function handleFindArtifact() {
    setArtifactChoices(sampleArtifacts(run.artifacts, 3))
  }

  function handlePickArtifact(id: ArtifactId) {
    let updated: RunState = { ...run, artifacts: [...run.artifacts, id] }
    if (id === 'chainmail') {
      updated = { ...updated, maxHp: run.maxHp + 5, hp: run.hp + 5 }
    }
    onChoose(updated)
  }

  if (artifactChoices !== null) {
    return (
      <div className="treasure-area">
        <h2>Find an Artifact</h2>
        <p>Choose one:</p>
        {artifactChoices.map(art => (
          <button key={art.id} className="btn-treasure" onClick={() => handlePickArtifact(art.id)}>
            {art.emoji} {art.name} — {art.description}
          </button>
        ))}
      </div>
    )
  }

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
      <button className="btn-treasure" onClick={handleFindArtifact}>
        Find an Artifact
      </button>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/TreasureArea.test.tsx
```

Expected: PASS (all 10 tests)

**Step 5: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 127 passed

**Step 6: Commit**

```bash
git add frontend/src/components/TreasureArea.tsx frontend/src/components/__tests__/TreasureArea.test.tsx
git commit -m "feat: TreasureArea — Find an Artifact option with 3-card picker"
```

---

### Task 5: `CombatView` — combat-start artifact effects

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Context:** Four artifacts fire at combat start:
- **Iron Shield** — `displayRun` initialised with `shield + 2`
- **Battle Scar** — `rage` initialised at `1` instead of `0`
- **Vowel Seeker** — display message: "🔍 N vowel(s) in this word"
- **Crystal Ball** — display message: "🔮 X is in this word" (random non-first letter from the word)
- **Category Scroll** — display message: "📜 Category: …" (non-Archivists only; Archivist already sees it)

Add the `ArtifactId` import at the top of `CombatView.tsx`.

---

**Step 1: Write failing tests**

In `CombatView.test.tsx`, add these tests inside the existing `describe('CombatView', ...)`:

```tsx
it('Iron Shield starts combat with 2 shield', () => {
  const run = { ...buildRun('berserker'), artifacts: ['iron_shield'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByText(/🛡 2/)).toBeInTheDocument()
})

it('Battle Scar gives Berserker 1 starting rage (increases first correct hit damage)', async () => {
  // word='cat', floor=1 → enemy HP=6
  // With rage=1: first correct 'a' (1 occ) → (2+1)×1 = 3. HP: 6→3
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }),
  }))
  const run = { ...buildRun('berserker'), artifacts: ['battle_scar'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
})

it('Vowel Seeker shows vowel count at combat start', () => {
  // word='cat' has 1 vowel ('a')
  const run = { ...buildRun('berserker'), artifacts: ['vowel_seeker'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByText(/1 vowel/i)).toBeInTheDocument()
})

it('Category Scroll shows category for non-Archivist', () => {
  const run = { ...buildRun('berserker'), artifacts: ['category_scroll'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByText(/📜.*animals/i)).toBeInTheDocument()
})

it('Category Scroll does NOT duplicate category info for Archivist', () => {
  const run = { ...buildRun('archivist'), artifacts: ['category_scroll'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // Archivist info bar shows category once; category_scroll should not show a second
  expect(screen.getAllByText(/animals/i).length).toBe(1)
})

it('Crystal Ball reveals a letter from the word at combat start', () => {
  const run = { ...buildRun('berserker'), artifacts: ['crystal_ball'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // word='cat', firstLetter='c' → crystal ball picks 'a' or 't'
  expect(screen.getByText(/🔮.*is in this word/i)).toBeInTheDocument()
})
```

Also add to the import at the top of `CombatView.test.tsx`:
```tsx
import type { ArtifactId } from '../../types'
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: 6 new tests fail

**Step 3: Modify `CombatView.tsx` — add import + update state initialisers**

At the top, add:
```tsx
import type { ArtifactId } from '../types'
```

Change `displayRun` initialiser to apply Iron Shield:
```tsx
const [displayRun, setDisplayRun] = useState<RunState>(() =>
  run.artifacts.includes('iron_shield')
    ? { ...run, shield: run.shield + 2 }
    : run
)
```

Change `rage` initialiser to apply Battle Scar:
```tsx
const [rage, setRage] = useState(() => run.artifacts.includes('battle_scar') ? 1 : 0)
```

**Step 4: Add info-display computed values + artifact info bar JSX**

After all the `useState` / `useEffect` declarations in `CombatView`, add these computed values (they derive from props that never change, so no hook needed):

```tsx
// --- Artifact info-display values (computed once from props) ---
const vowelCount = run.artifacts.includes('vowel_seeker')
  ? [...initialState.word].filter(l => VOWELS.has(l)).length
  : null

const showCategoryScroll =
  run.artifacts.includes('category_scroll') && run.className !== 'archivist'

const [crystalBallLetter] = useState<string | null>(() => {
  if (!run.artifacts.includes('crystal_ball')) return null
  const candidates = [...new Set(initialState.word.split(''))]
    .filter(l => !initialState.guessedLetters.includes(l) && l !== initialState.firstLetter)
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
})
```

In the JSX, add this block after the `{run.className === 'archivist' && ...}` Archivist info block and before `<GameBoard`:

```tsx
{(vowelCount !== null || crystalBallLetter !== null || showCategoryScroll) && (
  <div className="combat-view__artifact-info">
    {vowelCount !== null && (
      <span>🔍 {vowelCount} {vowelCount === 1 ? 'vowel' : 'vowels'} in this word</span>
    )}
    {crystalBallLetter !== null && (
      <span>🔮 {crystalBallLetter.toUpperCase()} is in this word</span>
    )}
    {showCategoryScroll && (
      <span>📜 Category: {initialState.category}</span>
    )}
  </div>
)}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: PASS (all tests)

**Step 6: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 133 passed

**Step 7: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: CombatView combat-start artifact effects — Iron Shield, Battle Scar, Vowel Seeker, Crystal Ball, Category Scroll"
```

---

### Task 6: `CombatView` — per-guess artifact effects

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Context:** Four artifacts fire during `handleGuessResult`:
- **Short Sword** — +1 to damage dealt on correct guess (added to `calcDamageDealt` output)
- **Blood Dagger** — after wrong guess, sets a `bloodDaggerReady` flag; next correct hit adds +2 damage and clears flag
- **Thick Skin** — reduces damage taken by 1 (min 1) on wrong guess (added to `calcDamageTaken`)
- **Shadow Cloak** — Rogue's combo drops to `max(1, combo)` instead of 0 on wrong guess
- **Mana Crystal** — ability cooldown set after use is reduced by 1

`calcDamageDealt` and `calcDamageTaken` are module-level functions in `CombatView.tsx`. They need a new `artifacts: ArtifactId[]` parameter.

---

**Step 1: Write failing tests**

Add to `CombatView.test.tsx`:

```tsx
it('Short Sword deals +1 bonus damage per correct guess', async () => {
  // word='cat', floor=1 → enemy HP=6. 'a' (1 occ): base 2 + short_sword 1 = 3. HP: 6→3
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }),
  }))
  const run = { ...buildRun('berserker'), artifacts: ['short_sword'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
})

it('Thick Skin reduces damage taken by 1', async () => {
  // DAMAGE_PER_WRONG=2, thick_skin → 1 dmg taken. HP: 50→49
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  const run = { ...buildRun('berserker'), hp: 50, artifacts: ['thick_skin'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => expect(screen.getByText(/49 \/ 50/)).toBeInTheDocument())
})

it('Blood Dagger gives +2 bonus on next correct hit after a wrong guess', async () => {
  // wrong guess first (bloodDaggerReady=true), then correct 'a' (1 occ):
  // dmg = base 2 + blood_dagger 2 = 4. HP: 6→2
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
      masked_word: '_ a _', correct: true, guessed_letters: ['z', 'a'], status: 'in_progress', occurrences: 1,
    }) })
  )
  const run = { ...buildRun('berserker'), artifacts: ['blood_dagger'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText(/2 \/ 6/)).toBeInTheDocument())
})

it('Shadow Cloak keeps Rogue combo at 1 after a wrong guess', async () => {
  // 'c' correct (combo 0→1, dmg (2+0)*1=2, HP 6→4)
  // 'z' wrong (shadow_cloak: combo stays max(1,1)=1)
  // 'a' correct (combo=1, dmg (2+1)*1=3, HP 4→1)
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
      masked_word: 'c _ _', correct: true, guessed_letters: ['c'], status: 'in_progress', occurrences: 1,
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
      masked_word: 'c a _', correct: true, guessed_letters: ['c', 'z', 'a'], status: 'in_progress', occurrences: 1,
    }) })
  )
  const run = { ...buildRun('rogue'), artifacts: ['shadow_cloak'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'C' }))
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
})

it('Mana Crystal reduces Berserker ability cooldown by 1 after use', async () => {
  // Berserker base cooldown = 4. With mana_crystal → 3
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  const run = { ...buildRun('berserker'), artifacts: ['mana_crystal'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /bloodletter$/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /bloodletter \(3\)/i })).toBeInTheDocument()
  )
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: 5 new tests fail

**Step 3: Update `calcDamageDealt` to accept `artifacts`**

In `CombatView.tsx`, update the function signature and body:

```tsx
function calcDamageDealt(
  letter: string,
  occurrences: number,
  className: ClassName,
  rage: number,
  combo: number,
  hiddenCount: number,
  isAbilityHit: boolean,
  artifacts: ArtifactId[],
): number {
  let dmgPerOcc = BASE_DAMAGE_PER_HIT

  switch (className) {
    case 'vowel_mage':
      if (VOWELS.has(letter)) dmgPerOcc += 1
      break
    case 'archivist':
      if (hiddenCount >= 5) dmgPerOcc += 1
      break
    case 'berserker':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + rage
      break
    case 'rogue':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + combo
      break
  }

  let total = dmgPerOcc * occurrences
  if (isAbilityHit && (className === 'berserker' || className === 'rogue')) {
    total *= 2
  }
  if (artifacts.includes('short_sword')) total += 1
  return total
}
```

**Step 4: Update `calcDamageTaken` to accept `artifacts`**

```tsx
function calcDamageTaken(
  letter: string,
  className: ClassName,
  isAbilityMiss: boolean,
  shield: number,
  artifacts: ArtifactId[],
): { playerDmg: number; shieldLeft: number } {
  const isConsonant = !VOWELS.has(letter)
  let dmg = DAMAGE_PER_WRONG

  if (className === 'vowel_mage' && isConsonant) dmg += 1
  if (className === 'rogue') dmg += 1
  if (className === 'berserker' && isAbilityMiss) dmg *= 2
  if (artifacts.includes('thick_skin')) dmg = Math.max(1, dmg - 1)

  const absorbed = Math.min(shield, dmg)
  return { playerDmg: dmg - absorbed, shieldLeft: shield - absorbed }
}
```

**Step 5: Add `bloodDaggerReady` state and update `handleGuessResult`**

Add the new state near the other per-encounter state declarations:
```tsx
const [bloodDaggerReady, setBloodDaggerReady] = useState(false)
```

Update the `handleGuessResult` function:

```tsx
function handleGuessResult(letter: string, correct: boolean, occurrences: number) {
  const isAbilityHit = abilityMode && correct
  const isAbilityMiss = abilityMode && !correct

  if (abilityMode) {
    setAbilityMode(false)
    if (run.className === 'vowel_mage' || run.className === 'berserker' || run.className === 'rogue') {
      const baseCooldown = ABILITY_COOLDOWNS[run.className]
      setCooldown(Math.max(0, baseCooldown - (run.artifacts.includes('mana_crystal') ? 1 : 0)))
    }
    if (run.className === 'archivist') setAbilityUsed(true)
  }

  if (correct) {
    const currentHidden = hiddenCount
    const currentCombo = combo
    let dmg = calcDamageDealt(
      letter, occurrences, run.className, rage, currentCombo,
      currentHidden, isAbilityHit, run.artifacts,
    )
    if (bloodDaggerReady && run.artifacts.includes('blood_dagger')) {
      dmg += 2
      setBloodDaggerReady(false)
    }
    setCurrentEnemyHp(prev => Math.max(0, prev - dmg))
    setHiddenCount(prev => Math.max(0, prev - occurrences))
    if (run.className === 'rogue') setCombo(prev => prev + 1)
    if (run.className === 'vowel_mage' && abilityMode && VOWELS.has(letter)) {
      setDisplayRun(prev => ({ ...prev, shield: prev.shield + occurrences }))
    }
  } else {
    if (run.className === 'rogue') {
      setCombo(run.artifacts.includes('shadow_cloak') ? Math.max(1, combo) : 0)
    }
    if (run.className === 'berserker') setRage(prev => prev + 1)
    if (run.artifacts.includes('blood_dagger')) setBloodDaggerReady(true)

    const { playerDmg, shieldLeft } = calcDamageTaken(
      letter, run.className, isAbilityMiss, displayRun.shield, run.artifacts,
    )
    const newHp = Math.max(0, displayRun.hp - playerDmg)
    setDisplayRun(prev => ({ ...prev, hp: newHp, shield: shieldLeft }))
    if (newHp <= 0) {
      finishCombat(false, newHp)
      return
    }
  }

  if (!abilityMode) setCooldown(prev => Math.max(0, prev - 1))
}
```

**Step 6: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: PASS (all tests)

**Step 7: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 138 passed

**Step 8: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: CombatView per-guess artifact effects — Short Sword, Thick Skin, Blood Dagger, Shadow Cloak, Mana Crystal"
```

---

### Task 7: `CombatView` — combat-end effects + Ancient Codex

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Context:**
- **Healing Salve** — adds +3 HP (capped at maxHp) in `finishCombat` when won
- **Gold Tooth** — adds +5 to coins earned in `finishCombat` when won
- **Ancient Codex** — Archivist can use ability twice. Replace `abilityUsed: boolean` with `abilityUsesLeft: number` (default 1, Ancient Codex → 2)

---

**Step 1: Write failing tests**

Add to `CombatView.test.tsx`. The Healing Salve and Gold Tooth tests need the word to be solved via `handleWordSolved`. Use `mockGame` (word='cat') and solve it:

```tsx
it('Healing Salve restores 3 HP after combat win', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
    }),
  }))
  const run = { ...buildRun('berserker'), hp: 40, artifacts: ['healing_salve'] as ArtifactId[] }
  const onCombatEnd = vi.fn()
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
  await userEvent.click(screen.getByRole('button', { name: 'T' }))
  await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  await userEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 43 }))
})

it('Healing Salve caps HP at maxHp', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
    }),
  }))
  const run = { ...buildRun('berserker'), hp: 49, maxHp: 50, artifacts: ['healing_salve'] as ArtifactId[] }
  const onCombatEnd = vi.fn()
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
  await userEvent.click(screen.getByRole('button', { name: 'T' }))
  await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  await userEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
})

it('Gold Tooth awards +5 bonus coins after combat win', async () => {
  // COINS_PER_ENEMY=5 + gold_tooth 5 = 10 total
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
    }),
  }))
  const run = { ...buildRun('berserker'), coins: 0, artifacts: ['gold_tooth'] as ArtifactId[] }
  const onCombatEnd = vi.fn()
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
  await userEvent.click(screen.getByRole('button', { name: 'T' }))
  await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  await userEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 10 }))
})

it('Ancient Codex allows Archivist to use Cross Reference a second time', async () => {
  // Use ability once → abilityUsesLeft goes to 1 → still available
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  const run = { ...buildRun('archivist'), artifacts: ['ancient_codex'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // Use ability (puts in abilityMode), then make a guess to fire it
  await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  // After first use, button should still be available (not show 'used')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /cross reference$/i })).not.toBeDisabled()
  )
})

it('Ancient Codex Archivist ability is disabled after two uses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  const run = { ...buildRun('archivist'), artifacts: ['ancient_codex'] as ArtifactId[] }
  render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // First use
  await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  // Second use
  await waitFor(() => screen.getByRole('button', { name: /cross reference$/i }))
  await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
  await userEvent.click(screen.getByRole('button', { name: 'X' }))
  // Now should show 'used' and be disabled
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /cross reference.*used/i })).toBeDisabled()
  )
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: 5 new tests fail

**Step 3: Update `finishCombat` in `CombatView.tsx`**

```tsx
function finishCombat(won: boolean, hpOverride?: number) {
  let coinsEarned = won ? (room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY) : 0
  let effectiveHp = hpOverride ?? displayRun.hp

  if (won) {
    if (run.artifacts.includes('healing_salve')) {
      effectiveHp = Math.min(displayRun.maxHp, effectiveHp + 3)
    }
    if (run.artifacts.includes('gold_tooth')) {
      coinsEarned += 5
    }
  }

  const updated: RunState = {
    ...displayRun,
    hp: effectiveHp,
    coins: displayRun.coins + coinsEarned,
    status: effectiveHp <= 0 ? 'lost' : run.status,
  }
  setPendingRun(updated)
  setDisplayRun(updated)
  setCombatDone(true)
}
```

**Step 4: Replace `abilityUsed` with `abilityUsesLeft` in `CombatView.tsx`**

Replace the state declaration:
```tsx
// OLD:
const [abilityUsed, setAbilityUsed] = useState(false)

// NEW:
const [abilityUsesLeft, setAbilityUsesLeft] = useState(() =>
  run.className === 'archivist' && run.artifacts.includes('ancient_codex') ? 2 : 1
)
```

In `handleGuessResult`, inside the `if (abilityMode)` block, replace:
```tsx
// OLD:
if (run.className === 'archivist') setAbilityUsed(true)

// NEW:
if (run.className === 'archivist') setAbilityUsesLeft(prev => Math.max(0, prev - 1))
```

Update the derived values:
```tsx
// OLD:
const abilityAvailable = run.className === 'archivist'
  ? !abilityUsed
  : cooldown === 0

// NEW:
const abilityAvailable = run.className === 'archivist'
  ? abilityUsesLeft > 0
  : cooldown === 0
```

```tsx
// OLD:
const abilityLabel = abilityMode
  ? `${abilityName} — choose a letter`
  : cooldown > 0
  ? `${abilityName} (${cooldown})`
  : abilityUsed && run.className === 'archivist'
  ? `${abilityName} (used)`
  : abilityName

// NEW:
const abilityLabel = abilityMode
  ? `${abilityName} — choose a letter`
  : cooldown > 0
  ? `${abilityName} (${cooldown})`
  : abilityUsesLeft === 0 && run.className === 'archivist'
  ? `${abilityName} (used)`
  : abilityName
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: PASS (all tests)

**Step 6: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 143 passed

**Step 7: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: CombatView combat-end effects and Ancient Codex — Healing Salve, Gold Tooth, abilityUsesLeft"
```

---

### Task 8: Integrate `ArtifactShelf` everywhere + CSS

**Files:**
- Modify: `frontend/src/components/RestArea.tsx`
- Modify: `frontend/src/components/TreasureArea.tsx`
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/index.css`

**Context:** Add the shelf to the three views where it's useful (RestArea, TreasureArea, CombatView). Add CSS for the shelf, emoji icons, and tooltips.

There are no new tests for this task — the `ArtifactShelf` component is already tested in Task 3, and we're just wiring it into existing components.

---

**Step 1: Add `ArtifactShelf` to `RestArea.tsx`**

Add the import at the top:
```tsx
import ArtifactShelf from './ArtifactShelf'
```

Add the shelf at the bottom of the returned JSX, after the Leave button:
```tsx
<ArtifactShelf artifacts={run.artifacts} />
```

**Step 2: Add `ArtifactShelf` to `TreasureArea.tsx`**

Add the import at the top:
```tsx
import ArtifactShelf from './ArtifactShelf'
```

Add `<ArtifactShelf artifacts={run.artifacts} />` at the bottom of **both** the picker view (`artifactChoices !== null`) and the main view. Example for the main view:

```tsx
return (
  <div className="treasure-area">
    <h2>Treasure Room</h2>
    <p>Choose one bonus:</p>
    ...existing buttons...
    <ArtifactShelf artifacts={run.artifacts} />
  </div>
)
```

**Step 3: Add `ArtifactShelf` to `CombatView.tsx`**

Add the import:
```tsx
import ArtifactShelf from './ArtifactShelf'
```

In the JSX, add the shelf after the `{run.className === 'archivist' && ...}` block and the artifact info bar, before `<GameBoard`:

```tsx
<ArtifactShelf artifacts={run.artifacts} />
```

**Step 4: Add CSS to `index.css`**

Append to `frontend/src/index.css`:

```css
/* ── Artifact Shelf ─────────────────────────────────────── */
.artifact-shelf {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
  padding: 0.4rem 0;
}

.artifact-shelf__item {
  position: relative;
  cursor: default;
  font-size: 1.6rem;
  line-height: 1;
  border-radius: 8px;
  padding: 0.15rem 0.3rem;
  background: var(--card-bg);
  border: 1px solid var(--border);
  transition: border-color 0.15s;
  user-select: none;
}

.artifact-shelf__item:hover,
.artifact-shelf__item:focus {
  border-color: var(--accent);
  outline: none;
}

.artifact-shelf__tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  min-width: 160px;
  max-width: 220px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  text-align: left;
}

.artifact-shelf__tooltip strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
}

.artifact-shelf__tooltip p {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted, #999);
  line-height: 1.4;
}

/* ── Combat artifact info bar ───────────────────────────── */
.combat-view__artifact-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--text-muted, #aaa);
  padding: 0.25rem 0 0.5rem;
}
```

**Step 5: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 143 passed (no regressions — we only added UI wiring)

**Step 6: Verify TypeScript**

```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors

**Step 7: Verify the build**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors

**Step 8: Commit**

```bash
git add frontend/src/components/RestArea.tsx frontend/src/components/TreasureArea.tsx \
        frontend/src/components/CombatView.tsx frontend/src/index.css
git commit -m "feat: add ArtifactShelf to RestArea, TreasureArea, CombatView + CSS"
```

---

### Final check

```bash
cd frontend && npm test -- --run
```

Expected: 143 tests across 13 test files, all passing.
