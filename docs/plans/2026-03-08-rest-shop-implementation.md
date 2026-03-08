# Rest Rework + Shop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the coin-based rest site with a free pick-one choice (full heal or +1 permanent damage), add artifact prices, and introduce a 12th shop room per floor where players spend coins on artifacts.

**Architecture:** Six sequential tasks — data layer first (types/runState/FloorProgress), then artifact prices, then RestArea rewrite, then new ShopArea component, then CombatView damage update, then App.tsx integration. Each task is independent enough to commit on its own.

**Tech Stack:** React 19, TypeScript, Vite 7, vitest + @testing-library/react. All tests run with `cd frontend && npm test`. Currently 169 frontend tests passing.

---

### Task 1: Types + RunState + FloorProgress (12 rooms, bonusDamage, shop RoomType)

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/__tests__/runState.test.ts`
- Modify: `frontend/src/components/FloorProgress.tsx`
- Modify: `frontend/src/components/__tests__/FloorProgress.test.tsx`

**Context:** The current layouts have 11 rooms per floor (`LAYOUT_A` and `LAYOUT_B` in `runState.ts`). We're expanding to 12 by inserting a `'shop'` room at index 9 (before the last enemy at 10 and boss at 11). `RunState` needs a new `bonusDamage: number` field (starts at 0). `FloorProgress.tsx` needs a shop emoji. Several tests check for 11 rooms and boss at index 10 — these all need updating.

**Step 1: Write the failing tests**

In `frontend/src/__tests__/runState.test.ts`, replace the `getFloorLayout` describe block and update `buildRooms` and `buildRun` and `computeRoomsCleared` tests. Here are the specific changes:

```typescript
// Replace existing getFloorLayout describe block entirely:
describe('getFloorLayout', () => {
  it('floor 1 has rest at index 4, treasure at index 6, shop at index 9, boss at index 11', () => {
    const layout = getFloorLayout(1)
    expect(layout[4]).toBe('rest')
    expect(layout[6]).toBe('treasure')
    expect(layout[9]).toBe('shop')
    expect(layout[11]).toBe('boss')
  })
  it('floor 2 has treasure at index 4, rest at index 6, shop at index 9, boss at index 11', () => {
    const layout = getFloorLayout(2)
    expect(layout[4]).toBe('treasure')
    expect(layout[6]).toBe('rest')
    expect(layout[9]).toBe('shop')
    expect(layout[11]).toBe('boss')
  })
  it('floor 3 layout matches floor 1', () => {
    expect(getFloorLayout(3)).toEqual(getFloorLayout(1))
  })
  it('all layouts have exactly 12 rooms', () => {
    expect(getFloorLayout(1).length).toBe(12)
    expect(getFloorLayout(2).length).toBe(12)
    expect(getFloorLayout(3).length).toBe(12)
  })
})

// In buildRooms describe, change 11 → 12:
it('creates 12 rooms, all incomplete with null gameId', () => {
  const rooms = buildRooms(1)
  expect(rooms.length).toBe(12)
  expect(rooms.every(r => !r.completed)).toBe(true)
  expect(rooms.every(r => r.gameId === null)).toBe(true)
})

// In computeRoomsCleared describe, change floor offset 11 → 12:
it('accounts for floor offset', () => {
  const run = buildRun('berserker')
  run.floor = 2
  run.rooms[0] = { ...run.rooms[0], completed: true }
  expect(computeRoomsCleared(run)).toBe(13) // 12 from floor 1 + 1 from floor 2
})

// In buildRun describe block, add:
it('initialises bonusDamage to 0', () => {
  const run = buildRun('berserker')
  expect(run.bonusDamage).toBe(0)
})

// In localStorage helpers describe, add:
it('loadRun sets bonusDamage to 0 when missing from saved data', () => {
  const run = buildRun('berserker')
  const legacy = { ...run } as Record<string, unknown>
  delete legacy.bonusDamage
  localStorage.setItem('hangman_run', JSON.stringify(legacy))
  const loaded = loadRun()
  expect(loaded?.bonusDamage).toBe(0)
})
```

In `frontend/src/components/__tests__/FloorProgress.test.tsx`, change 11 → 12 and add shop test:

```typescript
// Change existing "renders 11 room cells" test:
it('renders 12 room cells', () => {
  const rooms = buildRooms(1)
  const { container } = render(<FloorProgress rooms={rooms} currentIndex={0} floor={1} />)
  expect(container.querySelectorAll('.floor-progress__room').length).toBe(12)
})

// Add at end of describe block:
it('shop room shows 🛒', () => {
  render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={1} />)
  expect(screen.getByText('🛒')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- src/__tests__/runState.test.ts src/components/__tests__/FloorProgress.test.tsx
```

Expected: several failures — layout length 11 not 12, boss at 10 not 11, no shop, no bonusDamage.

**Step 3: Implement the changes**

In `frontend/src/types.ts`:
- Add `'shop'` to `RoomType` union
- Add `bonusDamage: number` to `RunState` interface

```typescript
export type RoomType = 'enemy' | 'boss' | 'rest' | 'treasure' | 'shop'

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
}
```

In `frontend/src/runState.ts`, update the layouts and `buildRun` and `loadRun` and `computeRoomsCleared`:

```typescript
const LAYOUT_A: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'rest',
  'enemy', 'treasure', 'enemy', 'enemy', 'shop', 'enemy', 'boss',
]
const LAYOUT_B: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'treasure',
  'enemy', 'rest', 'enemy', 'enemy', 'shop', 'enemy', 'boss',
]

// computeRoomsCleared: change 11 → 12
export function computeRoomsCleared(run: RunState): number {
  return (run.floor - 1) * 12 + run.rooms.filter(r => r.completed).length
}

// buildRun: add bonusDamage: 0 to the returned object
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
  }
}

// loadRun: add backwards-compat guard after the existing ones
if (!parsed.artifacts) parsed.artifacts = []
if (parsed.sessionId === undefined) parsed.sessionId = null
if (parsed.bonusDamage === undefined) parsed.bonusDamage = 0
```

In `frontend/src/components/FloorProgress.tsx`, add shop to ROOM_LABEL:

```typescript
const ROOM_LABEL: Record<string, string> = {
  enemy: '👺',
  boss: '☠️',
  rest: '😴',
  treasure: '👑',
  shop: '🛒',
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/__tests__/runState.test.ts src/components/__tests__/FloorProgress.test.tsx
```

Expected: all pass.

**Step 5: Run full suite and commit**

```bash
cd frontend && npm test
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/runState.test.ts frontend/src/components/FloorProgress.tsx frontend/src/components/__tests__/FloorProgress.test.tsx
git commit -m "feat: 12-room layouts with shop, bonusDamage field on RunState"
```

---

### Task 2: Artifact prices

**Files:**
- Modify: `frontend/src/artifacts.ts`
- Create: `frontend/src/__tests__/artifacts.test.ts`

**Context:** Each artifact needs a `price: number` field. The `Artifact` interface in `artifacts.ts` currently has `id`, `name`, `description`, `emoji`. Prices: 10 coins for info artifacts, 15 for moderate combat, 20 for strong/synergy. The `sampleArtifacts` function doesn't need changing.

**Step 1: Write the failing test**

Create `frontend/src/__tests__/artifacts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ARTIFACTS } from '../artifacts'

describe('ARTIFACTS', () => {
  it('every artifact has a price > 0', () => {
    for (const art of Object.values(ARTIFACTS)) {
      expect(art.price, `${art.name} should have price > 0`).toBeGreaterThan(0)
    }
  })

  it('info artifacts cost 10 coins', () => {
    expect(ARTIFACTS.vowel_seeker.price).toBe(10)
    expect(ARTIFACTS.crystal_ball.price).toBe(10)
    expect(ARTIFACTS.category_scroll.price).toBe(10)
  })

  it('combat artifacts cost 15 coins', () => {
    expect(ARTIFACTS.short_sword.price).toBe(15)
    expect(ARTIFACTS.blood_dagger.price).toBe(15)
    expect(ARTIFACTS.thick_skin.price).toBe(15)
    expect(ARTIFACTS.iron_shield.price).toBe(15)
    expect(ARTIFACTS.healing_salve.price).toBe(15)
    expect(ARTIFACTS.gold_tooth.price).toBe(15)
  })

  it('strong/synergy artifacts cost 20 coins', () => {
    expect(ARTIFACTS.chainmail.price).toBe(20)
    expect(ARTIFACTS.mana_crystal.price).toBe(20)
    expect(ARTIFACTS.battle_scar.price).toBe(20)
    expect(ARTIFACTS.shadow_cloak.price).toBe(20)
    expect(ARTIFACTS.ancient_codex.price).toBe(20)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- src/__tests__/artifacts.test.ts
```

Expected: FAIL — `price` is not a property of Artifact.

**Step 3: Implement the changes**

In `frontend/src/artifacts.ts`, add `price: number` to the `Artifact` interface and add `price` to every artifact definition:

```typescript
export interface Artifact {
  id: ArtifactId
  name: string
  description: string
  emoji: string
  price: number
}

export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  vowel_seeker: {
    id: 'vowel_seeker', name: 'Vowel Seeker', emoji: '🔍',
    description: 'At combat start, shows how many vowels are in the word.',
    price: 10,
  },
  crystal_ball: {
    id: 'crystal_ball', name: 'Crystal Ball', emoji: '🔮',
    description: 'At combat start, reveals a random letter that is in the word.',
    price: 10,
  },
  category_scroll: {
    id: 'category_scroll', name: 'Category Scroll', emoji: '📜',
    description: 'At combat start, shows the word\'s category.',
    price: 10,
  },
  short_sword: {
    id: 'short_sword', name: 'Short Sword', emoji: '⚔️',
    description: 'Each correct guess deals +1 bonus damage.',
    price: 15,
  },
  blood_dagger: {
    id: 'blood_dagger', name: 'Blood Dagger', emoji: '🗡️',
    description: 'After a wrong guess, your next correct hit deals +2 bonus damage.',
    price: 15,
  },
  iron_shield: {
    id: 'iron_shield', name: 'Iron Shield', emoji: '🛡️',
    description: 'Start each combat with +2 shield.',
    price: 15,
  },
  thick_skin: {
    id: 'thick_skin', name: 'Thick Skin', emoji: '🪨',
    description: 'Take 1 less damage per wrong guess (minimum 1).',
    price: 15,
  },
  chainmail: {
    id: 'chainmail', name: 'Chainmail', emoji: '🧲',
    description: 'Permanently gain +5 max HP when picked up.',
    price: 20,
  },
  healing_salve: {
    id: 'healing_salve', name: 'Healing Salve', emoji: '🧪',
    description: 'Restore +3 HP after each combat victory.',
    price: 15,
  },
  gold_tooth: {
    id: 'gold_tooth', name: 'Gold Tooth', emoji: '🪙',
    description: 'Earn +5 bonus coins after each combat victory.',
    price: 15,
  },
  battle_scar: {
    id: 'battle_scar', name: 'Battle Scar', emoji: '🩹',
    description: 'Start each combat with 1 rage already built up. (Berserker synergy)',
    price: 20,
  },
  shadow_cloak: {
    id: 'shadow_cloak', name: 'Shadow Cloak', emoji: '🌑',
    description: 'After a wrong guess, combo drops to 1 instead of 0. (Rogue synergy)',
    price: 20,
  },
  mana_crystal: {
    id: 'mana_crystal', name: 'Mana Crystal', emoji: '💎',
    description: 'Your ability cooldown is reduced by 1.',
    price: 20,
  },
  ancient_codex: {
    id: 'ancient_codex', name: 'Ancient Codex', emoji: '📖',
    description: 'Cross Reference can be used twice per encounter. (Archivist synergy)',
    price: 20,
  },
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/__tests__/artifacts.test.ts
```

Expected: 4 tests pass.

**Step 5: Run full suite and commit**

```bash
cd frontend && npm test
git add frontend/src/artifacts.ts frontend/src/__tests__/artifacts.test.ts
git commit -m "feat: add price field to all artifacts"
```

---

### Task 3: RestArea rework

**Files:**
- Modify: `frontend/src/components/RestArea.tsx`
- Modify: `frontend/src/components/__tests__/RestArea.test.tsx`

**Context:** The current `RestArea` has a coin-based heal (`HEAL_COST=10 coins → +5 HP`) and a `Leave` button. The new design replaces it with two free, mutually exclusive options: "Rest fully" (heal to max HP) and "Power up" (+1 permanent `bonusDamage`). The component API changes: `onHeal` prop is removed, `onLeave` signature changes from `() => void` to `(updatedRun: RunState) => void` — the component now passes back the updated run after a choice is made. There is no separate "Leave without choosing" button — the player must pick one.

**Step 1: Write the failing tests**

Replace all content in `frontend/src/components/__tests__/RestArea.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RestArea from '../RestArea'
import { buildRun } from '../../runState'
import type { RunState } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('RestArea', () => {
  it('renders heading', () => {
    render(<RestArea run={makeRun()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /rest area/i })).toBeInTheDocument()
  })

  it('displays current HP and coins', () => {
    render(<RestArea run={makeRun({ hp: 12, coins: 25 })} onLeave={vi.fn()} />)
    expect(screen.getByText(/12 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })

  it('Rest fully button calls onLeave with hp set to maxHp', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ hp: 20, maxHp: 50 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /rest fully/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
  })

  it('Rest fully works even when already at max HP', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ hp: 50, maxHp: 50 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /rest fully/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
  })

  it('Power up button calls onLeave with bonusDamage incremented by 1', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ bonusDamage: 0 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /power up/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ bonusDamage: 1 }))
  })

  it('Power up stacks: bonusDamage 2 becomes 3', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ bonusDamage: 2 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /power up/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ bonusDamage: 3 }))
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- src/components/__tests__/RestArea.test.tsx
```

Expected: multiple failures — no `onLeave(updatedRun)` API, no power up button.

**Step 3: Implement the new RestArea**

Replace all content in `frontend/src/components/RestArea.tsx`:

```typescript
import type { RunState } from '../types'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function RestArea({ run, onLeave }: Props) {
  return (
    <div className="rest-area">
      <h2>Rest Area 😴</h2>
      <p className="rest-area__hp">HP: {run.hp} / {run.maxHp}</p>
      <p className="rest-area__coins">Coins: {run.coins}</p>
      <button
        className="btn-rest-option"
        onClick={() => onLeave({ ...run, hp: run.maxHp })}
      >
        Rest fully — heal to {run.maxHp} HP
      </button>
      <button
        className="btn-rest-option"
        onClick={() => onLeave({ ...run, bonusDamage: run.bonusDamage + 1 })}
      >
        Power up — +1 permanent damage
      </button>
      <ArtifactShelf artifacts={run.artifacts} />
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/components/__tests__/RestArea.test.tsx
```

Expected: 6 tests pass.

**Step 5: Run full suite and commit**

The full suite will also have failures in App.test.tsx because App.tsx still passes `onHeal` to RestArea. That's expected — it will be fixed in Task 6. Run just RestArea tests for now, then commit.

```bash
cd frontend && npm test -- src/components/__tests__/RestArea.test.tsx
git add frontend/src/components/RestArea.tsx frontend/src/components/__tests__/RestArea.test.tsx
git commit -m "feat: rewrite RestArea with free rest/power-up choice"
```

---

### Task 4: ShopArea component

**Files:**
- Create: `frontend/src/components/ShopArea.tsx`
- Create: `frontend/src/components/__tests__/ShopArea.test.tsx`

**Context:** The shop shows 4 randomly sampled artifacts (not already owned). Players can buy one (coins deducted, artifact added) or leave without buying. Buying triggers `onLeave(updatedRun)` immediately — one purchase per visit. The `chainmail` artifact has a side effect (+5 maxHp and +5 hp), same as in `TreasureArea`. CSS classes follow existing patterns (`btn-buy`, `btn-leave`, `shop-area`).

**Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/ShopArea.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShopArea from '../ShopArea'
import { buildRun } from '../../runState'
import type { RunState } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('ShopArea', () => {
  it('renders shop heading', () => {
    render(<ShopArea run={makeRun()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /shop/i })).toBeInTheDocument()
  })

  it('displays current coin count', () => {
    render(<ShopArea run={makeRun({ coins: 30 })} onLeave={vi.fn()} />)
    expect(screen.getByText(/30/)).toBeInTheDocument()
  })

  it('renders 4 artifact options', () => {
    render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /buy/i }).length).toBe(4)
  })

  it('buy button is disabled when player cannot afford the artifact', () => {
    // With 0 coins, all buy buttons should be disabled
    render(<ShopArea run={makeRun({ coins: 0 })} onLeave={vi.fn()} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    expect(buyButtons.every(btn => (btn as HTMLButtonElement).disabled)).toBe(true)
  })

  it('leave button calls onLeave with unchanged run', async () => {
    const onLeave = vi.fn()
    const run = makeRun({ coins: 5 })
    render(<ShopArea run={run} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledWith(run)
  })

  it('buying an artifact deducts its price and adds it to artifacts', async () => {
    const onLeave = vi.fn()
    // Give enough coins to afford anything, own nothing
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.coins).toBeLessThan(99)
    expect(updatedRun.artifacts.length).toBe(1)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- src/components/__tests__/ShopArea.test.tsx
```

Expected: FAIL — ShopArea component doesn't exist yet.

**Step 3: Create ShopArea.tsx**

Create `frontend/src/components/ShopArea.tsx`:

```typescript
import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact } from '../artifacts'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function ShopArea({ run, onLeave }: Props) {
  const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))

  function handleBuy(art: Artifact) {
    let updated: RunState = {
      ...run,
      coins: run.coins - art.price,
      artifacts: [...run.artifacts, art.id as ArtifactId],
    }
    if (art.id === 'chainmail') {
      updated = { ...updated, maxHp: run.maxHp + 5, hp: run.hp + 5 }
    }
    onLeave(updated)
  }

  return (
    <div className="shop-area">
      <h2>Shop 🛒</h2>
      <p className="shop-area__coins">Coins: {run.coins}</p>
      <div className="shop-area__stock">
        {stock.map(art => (
          <div key={art.id} className="shop-area__item">
            <span className="shop-area__item-info">
              {art.emoji} <strong>{art.name}</strong> — {art.description}
            </span>
            <button
              className="btn-buy"
              onClick={() => handleBuy(art)}
              disabled={run.coins < art.price}
            >
              Buy ({art.price} coins)
            </button>
          </div>
        ))}
      </div>
      <button className="btn-leave" onClick={() => onLeave(run)}>Leave</button>
      <ArtifactShelf artifacts={run.artifacts} />
    </div>
  )
}
```

**Step 4: Add shop CSS**

Append to `frontend/src/index.css`:

```css
/* ── Shop ── */
.shop-area {
  max-width: 480px;
  margin: 2rem auto;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: center;
}

.shop-area__coins {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: var(--text-muted);
}

.shop-area__stock {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.shop-area__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: left;
}

.shop-area__item-info {
  font-size: 0.85rem;
  flex: 1;
}

.btn-buy {
  padding: 0.35rem 0.9rem;
  background: var(--surface);
  color: var(--accent);
  border: 2px solid var(--accent);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-buy:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.btn-buy:disabled {
  opacity: 0.4;
  border-color: var(--border);
  color: var(--text-muted);
  cursor: default;
}
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/components/__tests__/ShopArea.test.tsx
```

Expected: 6 tests pass.

**Step 6: Run full suite and commit**

```bash
cd frontend && npm test -- src/components/__tests__/ShopArea.test.tsx
git add frontend/src/components/ShopArea.tsx frontend/src/components/__tests__/ShopArea.test.tsx frontend/src/index.css
git commit -m "feat: add ShopArea component with buy/leave flow"
```

---

### Task 5: CombatView — bonusDamage in damage calculation

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Context:** `calcDamageDealt` at line 63 of `CombatView.tsx` computes damage per correct guess. `bonusDamage` from `RunState` should be added as a flat bonus to total damage per correct guess (same position as `short_sword`'s +1). The function signature gains a `bonusDamage: number` parameter, and the call site at line 189 passes `run.bonusDamage`.

**Step 1: Write the failing test**

Add to the `describe('CombatView', ...)` block in `frontend/src/components/__tests__/CombatView.test.tsx`:

```typescript
it('bonusDamage adds flat damage per correct guess', async () => {
  // word='catch' (5 letters), floor=1 → maxEnemyHp = 5*1*2 = 10
  // berserker: BASE_DAMAGE=2, rage=0, bonusDamage=2 → dmg per guess = 2 + 2 = 4
  // guess 'c' (2 occurrences, berserker): dmgPerOcc=2, total=2*2=4, +bonusDamage=2 → 6
  // enemy HP: 10 → 4 (base 2*2=4, no bonusDamage applied per occ, +bonusDamage flat = 6... wait
  // Actually: dmgPerOcc=2, total=4, then +bonusDamage=2 → total=6. HP: 10-6=4.
  const game: GameState = { ...mockGame, word: 'catch', maskedWord: '_ _ _ _ _', firstLetter: 'c' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => mockGuessResponse({ masked_word: 'c _ _ c _', correct: true, guessed_letters: ['c'], status: 'in_progress', occurrences: 2 }),
  }))
  render(<CombatView run={{ ...buildRun('berserker'), bonusDamage: 2 }} room={enemyRoom()} initialState={game} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'C' }))
  // dmgPerOcc=2, total=2*2=4, +bonusDamage 2 = 6. Enemy HP: 10-6=4
  await waitFor(() => expect(screen.getByText(/4 \/ 10/)).toBeInTheDocument())
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- src/components/__tests__/CombatView.test.tsx 2>&1 | grep "bonusDamage"
```

Expected: FAIL — bonusDamage has no effect yet.

**Step 3: Implement the change**

In `frontend/src/components/CombatView.tsx`:

Add `bonusDamage: number` as the last parameter of `calcDamageDealt` (after `artifacts`):

```typescript
function calcDamageDealt(
  letter: string,
  occurrences: number,
  className: ClassName,
  rage: number,
  combo: number,
  hiddenCount: number,
  isAbilityHit: boolean,
  artifacts: ArtifactId[],
  bonusDamage: number,
): number {
  // ... existing switch/total logic unchanged ...
  if (artifacts.includes('short_sword')) total += 1
  total += bonusDamage
  return total
}
```

Update the call site (around line 189):

```typescript
let dmg = calcDamageDealt(
  letter, occurrences, run.className, rage, currentCombo,
  currentHidden, isAbilityHit, run.artifacts, run.bonusDamage,
)
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/components/__tests__/CombatView.test.tsx
```

Expected: all pass including the new bonusDamage test.

**Step 5: Run full suite and commit**

```bash
cd frontend && npm test
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: apply bonusDamage from RunState in combat damage calculation"
```

---

### Task 6: App.tsx — shop phase, rest handler update, wire everything together

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`

**Context:** `App.tsx` currently has `handleRestHeal` (saves run, stays on page) and `handleRestLeave` (advances room with unchanged run). These are replaced by a single `handleRestChoose(updatedRun)` that calls `advanceFromNonCombatRoom`. A new `handleShopLeave(updatedRun)` does the same. The `AppPhase` union gains `'shop'`. `enterRoom` gains a shop branch. The JSX adds `<ShopArea>` rendering. `RestArea` JSX removes `onHeal` and updates `onLeave` signature.

**Step 1: Write failing tests**

In `frontend/src/__tests__/App.test.tsx`, add or update tests. Find the existing rest-related tests and update them, then add shop tests:

```typescript
// Update any test that checks onHeal/onLeave signatures for RestArea
// Add this new test:
it('rest area: choosing rest fully advances to next room', async () => {
  // This test verifies that RestArea's onLeave(updatedRun) is wired to advance the room.
  // Set up a run at a rest room (index 4 in layout A)
  // This is an integration-level test — check that after clicking "Rest fully",
  // the rest phase ends. Because fetchAndEnterCombat is async and hits fetch,
  // stub fetch for the next combat room.
  // NOTE: This may already be tested via existing rest tests — check first.
  // If existing tests already cover "rest advances room", update their assertions
  // to use "Rest fully" button text instead of "Leave".
})
```

**Important:** Before writing new tests, check the existing App.test.tsx for any tests that:
1. Reference `onHeal` prop on RestArea
2. Click a "Leave" button from the rest phase
3. Check rest phase behaviour

Update those tests to match the new API (`onLeave(updatedRun)`, button text "Rest fully" or "Power up").

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- src/__tests__/App.test.tsx
```

Expected: failures where RestArea API mismatches.

**Step 3: Implement App.tsx changes**

Make these targeted edits to `frontend/src/App.tsx`:

**3a. Add 'shop' to AppPhase:**
```typescript
type AppPhase = 'idle' | 'combat' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'
```

**3b. Add ShopArea import at top:**
```typescript
import ShopArea from './components/ShopArea'
```

**3c. Replace `handleRestHeal` and `handleRestLeave` with a single handler:**
```typescript
async function handleRestChoose(updatedRun: RunState) {
  await advanceFromNonCombatRoom(updatedRun)
}
```

**3d. Add `handleShopLeave`:**
```typescript
async function handleShopLeave(updatedRun: RunState) {
  await advanceFromNonCombatRoom(updatedRun)
}
```

**3e. Add shop branch to `enterRoom`:**
```typescript
async function enterRoom(currentRun: RunState, room: Room) {
  if (room.type === 'enemy') {
    await fetchAndEnterCombat(currentRun, 'enemy', currentRun.pendingReveal)
  } else if (room.type === 'boss') {
    await fetchAndEnterCombat(currentRun, 'boss', false)
  } else if (room.type === 'rest') {
    setPhase('rest')
  } else if (room.type === 'treasure') {
    setPhase('treasure')
  } else if (room.type === 'shop') {
    setPhase('shop')
  }
}
```

**3f. Update RestArea JSX (remove onHeal, update onLeave):**
```typescript
{phase === 'rest' && run && (
  <RestArea run={run} onLeave={handleRestChoose} />
)}
```

**3g. Add ShopArea JSX (after TreasureArea block):**
```typescript
{phase === 'shop' && run && (
  <ShopArea run={run} onLeave={handleShopLeave} />
)}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/__tests__/App.test.tsx
```

Fix any remaining test failures. The key change is that wherever tests passed `onHeal` to RestArea or clicked a "Leave" button in rest context expecting no run update, they should now either click "Rest fully" (which passes `{ ...run, hp: run.maxHp }`) or "Power up".

**Step 5: Run full suite**

```bash
cd frontend && npm test
```

All tests should pass. If any fail, investigate and fix before committing.

**Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat: wire shop and updated rest into App state machine"
```

---

## Final verification

```bash
cd frontend && npm test
```

Expected: all tests pass (169 existing + new tests from each task).

Check counts by task:
- Task 1: +4 runState tests, +1 FloorProgress test = +5
- Task 2: +4 artifact tests = +4
- Task 3: +6 RestArea tests (replaces 7 old ones) = net -1
- Task 4: +6 ShopArea tests = +6
- Task 5: +1 CombatView test = +1
- Task 6: net 0 or +1 depending on App.test.tsx changes

Target: ~185 tests passing.
