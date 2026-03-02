# Combat UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Reposition the artifact shelf as a vertical column beside the player sprite, and give enemies named identities (regular enemies: random pool; bosses: scarier pool).

**Architecture:** Two self-contained tasks. Task 1 adds a `vertical` prop to `ArtifactShelf`. Task 2 modifies `CombatView` to add enemy name state, restructure the player sprite area to include a vertical shelf, and display the enemy name above the enemy sprite.

**Tech Stack:** React 19 + TypeScript, Vite 7, vitest + @testing-library/react

---

### Task 1: `ArtifactShelf` — add `vertical` prop

**Files:**
- Modify: `frontend/src/components/ArtifactShelf.tsx`
- Modify: `frontend/src/components/__tests__/ArtifactShelf.test.tsx`
- Modify: `frontend/src/index.css`

**Context:** `ArtifactShelf` currently always renders as a horizontal flex row. Adding `vertical?: boolean` lets `CombatView` render it as a narrow vertical column beside the player sprite. The modifier class `artifact-shelf--vertical` drives the CSS change — no logic changes elsewhere.

---

**Step 1: Write failing tests**

Add these two tests inside the existing `describe('ArtifactShelf', ...)` in `frontend/src/components/__tests__/ArtifactShelf.test.tsx`:

```tsx
it('applies vertical modifier class when vertical prop is true', () => {
  const { container } = render(<ArtifactShelf artifacts={['short_sword']} vertical />)
  expect(container.firstChild).toHaveClass('artifact-shelf--vertical')
})

it('does not apply vertical modifier class by default', () => {
  const { container } = render(<ArtifactShelf artifacts={['short_sword']} />)
  expect(container.firstChild).not.toHaveClass('artifact-shelf--vertical')
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/ArtifactShelf.test.tsx
```

Expected: 2 new tests fail — `toHaveClass` will not find the class.

**Step 3: Update `ArtifactShelf.tsx`**

Replace the entire file contents:

```tsx
import { useState } from 'react'
import type { ArtifactId } from '../types'
import { ARTIFACTS } from '../artifacts'

interface Props {
  artifacts: ArtifactId[]
  vertical?: boolean
}

export default function ArtifactShelf({ artifacts, vertical = false }: Props) {
  const [tooltip, setTooltip] = useState<ArtifactId | null>(null)

  if (artifacts.length === 0) return null

  return (
    <div className={`artifact-shelf${vertical ? ' artifact-shelf--vertical' : ''}`}>
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

**Step 4: Add CSS to `frontend/src/index.css`**

Find the existing `.artifact-shelf` rule block and add the modifier immediately after it:

```css
.artifact-shelf--vertical {
  flex-direction: column;
  flex-wrap: nowrap;
  padding: 0;
  gap: 0.3rem;
  justify-content: center;
}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/ArtifactShelf.test.tsx
```

Expected: all 6 tests pass.

**Step 6: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 149 passed (147 existing + 2 new).

**Step 7: Commit**

```bash
git add frontend/src/components/ArtifactShelf.tsx \
        frontend/src/components/__tests__/ArtifactShelf.test.tsx \
        frontend/src/index.css
git commit -m "feat: ArtifactShelf vertical prop for side-panel placement"
```

---

### Task 2: `CombatView` — enemy names + arena restructure

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`
- Modify: `frontend/src/index.css`

**Context:** Two changes happen together in this task because they both touch `CombatView`:

1. **Enemy names** — two constant arrays at the top of the file; a `useState` initialiser picks one on mount based on `room.type`; the name renders above the enemy sprite.

2. **Artifact shelf repositioning** — the standalone `<ArtifactShelf artifacts={run.artifacts} />` below the arena is removed; instead, the player sprite placeholder is wrapped in a `combat-view__player-sprite-row` flex-row that also contains `<ArtifactShelf artifacts={run.artifacts} vertical />`.

---

**Step 1: Write failing tests**

Add these tests inside the existing `describe('CombatView', ...)` in `frontend/src/components/__tests__/CombatView.test.tsx`.

The `mockGame` and `enemyRoom()` helper are already defined in the test file. Add a `bossRoom()` helper too:

```tsx
function bossRoom() {
  return { type: 'boss' as const, completed: false, gameId: null }
}
```

Then add the tests:

```tsx
it('displays an enemy name for a regular room', () => {
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  // The enemy name element exists and has non-empty text
  const nameEl = document.querySelector('.combat-view__enemy-name')
  expect(nameEl).not.toBeNull()
  expect(nameEl!.textContent!.trim().length).toBeGreaterThan(0)
})

it('displays a boss name for a boss room', () => {
  render(<CombatView run={buildRun('berserker')} room={bossRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  const nameEl = document.querySelector('.combat-view__enemy-name')
  expect(nameEl).not.toBeNull()
  expect(nameEl!.textContent!.trim().length).toBeGreaterThan(0)
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: 2 new tests fail — `.combat-view__enemy-name` does not exist yet.

**Step 3: Add name arrays to `CombatView.tsx`**

Add these two constant arrays at the top of `CombatView.tsx`, right after the existing `ABILITY_COOLDOWNS` constant and before `const VOWELS`:

```tsx
const ENEMY_NAMES = [
  'Swamp Monster', 'Skeleton Archer', 'Mutated Bee', 'Cave Troll',
  'Plague Rat', 'Stone Golem', 'Shadow Wraith', 'Bog Witch',
  'Dire Wolf', 'Fungal Horror', 'Cursed Scarecrow', 'Sand Shark',
]

const BOSS_NAMES = [
  'Death Knight', 'Ancient Vampire', 'The Hollow King',
  'Bone Colossus', 'Plague Bringer', 'Void Serpent',
  'The Undying', 'Abyssal Tyrant',
]
```

**Step 4: Add `enemyName` state to the component**

Inside `CombatView`, after the existing `useState` declarations, add:

```tsx
const [enemyName] = useState(() => {
  const pool = room.type === 'boss' ? BOSS_NAMES : ENEMY_NAMES
  return pool[Math.floor(Math.random() * pool.length)]
})
```

**Step 5: Update the enemy JSX to show the name**

Find the `combat-view__enemy` div in the JSX (currently starts with `<div className="combat-view__enemy">`). Add the name element as the first child, before the sprite placeholder:

```tsx
<div className="combat-view__enemy">
  <div className="combat-view__enemy-name">{enemyName}</div>
  <div className="combat-view__enemy-sprite-placeholder" aria-hidden="true" />
  <div className="combat-view__enemy-hp-label">
    Enemy HP: {Math.max(0, currentEnemyHp)} / {maxEnemyHp}
  </div>
  <div className="combat-view__enemy-hp-bar">
    <div
      className="combat-view__enemy-hp-fill"
      style={{ width: `${Math.max(0, (currentEnemyHp / maxEnemyHp) * 100)}%` }}
    />
  </div>
</div>
```

**Step 6: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```

Expected: all tests pass.

**Step 7: Restructure the player sprite area**

Find the `combat-view__player-sprite-placeholder` div and wrap it together with the `ArtifactShelf`:

Replace:
```tsx
<div className="combat-view__player-sprite-placeholder" aria-hidden="true" />
```

With:
```tsx
<div className="combat-view__player-sprite-row">
  <ArtifactShelf artifacts={run.artifacts} vertical />
  <div className="combat-view__player-sprite-placeholder" aria-hidden="true" />
</div>
```

Then remove the standalone `<ArtifactShelf artifacts={run.artifacts} />` line that currently sits below the artifact-info bar (just before `<GameBoard`).

**Step 8: Add CSS to `frontend/src/index.css`**

Add two new rules. The first goes near the other `.combat-view__player` rules:

```css
.combat-view__player-sprite-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
```

The second goes near `.combat-view__class-label`:

```css
.combat-view__enemy-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--wrong);
}
```

**Step 9: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: 151 passed (149 + 2 new).

**Step 10: Verify TypeScript**

```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

**Step 11: Commit**

```bash
git add frontend/src/components/CombatView.tsx \
        frontend/src/components/__tests__/CombatView.test.tsx \
        frontend/src/index.css
git commit -m "feat: enemy names + artifact shelf repositioned beside player sprite"
```

---

### Final check

```bash
cd frontend && npm test -- --run
```

Expected: 151 tests, 15 test files, all passing.
