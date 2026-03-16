# Combat Rewards & Shop Potion Randomisation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace guaranteed post-fight coins with probabilistic rewards (gold, potion, artifact) shown on a new `CombatRewardScreen`, and randomise which potions appear in the shop each visit.

**Architecture:** A new `combat_reward` AppPhase sits between `combat` and the next room. `handleCombatEnd` rolls dice, applies gold immediately, then passes pending potion/artifact to a `CombatRewardScreen` component. The reward screen handles swap-or-skip UI for full-inventory cases. `handleRewardLeave` receives the final run and advances the game. The shop always shows `health_potion` plus 2 randomly sampled extras, seeded on mount.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react

---

### Task 1: Update reward constants and remove base coins from CombatView

**Files:**
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`
- Modify: `frontend/src/__tests__/runState.test.ts`

**Context:** `COINS_PER_ENEMY=5` and `COINS_PER_BOSS=20` live in `runState.ts` and are imported by `CombatView.tsx:4-7`. `CombatView.finishCombat` (line ~419) currently computes `coinsEarned` from these constants. We're moving base coin logic to App.tsx (Task 4), so CombatView will only handle the `gold_tooth` artifact bonus (+5 coins on win).

**Step 1: Write two failing tests**

In `frontend/src/__tests__/runState.test.ts`, add a new `describe` block:

```ts
import {
  // existing imports …
  COINS_ENEMY_REWARD, COINS_BOSS_REWARD,
  REWARD_GOLD_ENEMY_CHANCE, REWARD_POTION_ENEMY_CHANCE, REWARD_ARTIFACT_ENEMY_CHANCE,
  REWARD_POTION_BOSS_CHANCE, REWARD_ARTIFACT_BOSS_CHANCE,
} from '../runState'

// Add inside the existing describe or as a new one:
describe('reward constants', () => {
  it('exports correct enemy reward values', () => {
    expect(COINS_ENEMY_REWARD).toBe(10)
    expect(REWARD_GOLD_ENEMY_CHANCE).toBe(0.75)
    expect(REWARD_POTION_ENEMY_CHANCE).toBe(0.10)
    expect(REWARD_ARTIFACT_ENEMY_CHANCE).toBe(0.01)
  })
  it('exports correct boss reward values', () => {
    expect(COINS_BOSS_REWARD).toBe(30)
    expect(REWARD_POTION_BOSS_CHANCE).toBe(0.50)
    expect(REWARD_ARTIFACT_BOSS_CHANCE).toBe(0.20)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A 3 "reward constants"
```
Expected: FAIL — module does not export those names.

**Step 3: Update runState.ts**

In `frontend/src/runState.ts`, replace:
```ts
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
```
With:
```ts
export const COINS_ENEMY_REWARD = 10
export const COINS_BOSS_REWARD = 30
export const REWARD_GOLD_ENEMY_CHANCE = 0.75
export const REWARD_POTION_ENEMY_CHANCE = 0.10
export const REWARD_ARTIFACT_ENEMY_CHANCE = 0.01
export const REWARD_POTION_BOSS_CHANCE = 0.50
export const REWARD_ARTIFACT_BOSS_CHANCE = 0.20
```

**Step 4: Update CombatView.tsx**

In `frontend/src/components/CombatView.tsx`:

1. Change the import (lines 3-7) — remove `COINS_PER_ENEMY, COINS_PER_BOSS`:
```tsx
import {
  DAMAGE_PER_WRONG, BASE_DAMAGE_PER_HIT,
  enemyHp,
  POTION_HEAL_AMOUNT, POTION_STRENGTH_BONUS, POTION_SHIELD_AMOUNT, WRONG_SOLVE_PENALTY,
} from '../runState'
```

2. Replace `finishCombat` (~line 419):

Before:
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

After:
```tsx
function finishCombat(won: boolean, hpOverride?: number) {
  let effectiveHp = hpOverride ?? displayRun.hp
  let bonusCoins = 0

  if (won) {
    if (run.artifacts.includes('healing_salve')) {
      effectiveHp = Math.min(displayRun.maxHp, effectiveHp + 3)
    }
    if (run.artifacts.includes('gold_tooth')) {
      bonusCoins = 5
    }
  }

  const updated: RunState = {
    ...displayRun,
    hp: effectiveHp,
    coins: displayRun.coins + bonusCoins,
    status: effectiveHp <= 0 ? 'lost' : run.status,
  }
  setPendingRun(updated)
  setDisplayRun(updated)
  setCombatDone(true)
}
```

**Step 5: Update CombatView tests**

In `frontend/src/components/__tests__/CombatView.test.tsx`, find the test `'calls onCombatEnd with updated run when Continue clicked after win'`. Change:
```ts
expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }), undefined)
```
To:
```ts
expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 0 }), undefined)
```
(Gold Tooth test stays at `coins: 5` — that's still the gold_tooth bonus.)

**Step 6: Run all tests**
```bash
cd frontend && npm test
```
Expected: all pass.

**Step 7: Commit**
```bash
git add frontend/src/runState.ts frontend/src/components/CombatView.tsx \
        frontend/src/components/__tests__/CombatView.test.tsx \
        frontend/src/__tests__/runState.test.ts
git commit -m "feat: replace COINS_PER_ENEMY/BOSS with reward constants; move base coins to App"
```

---

### Task 2: Randomise shop potion stock

**Files:**
- Modify: `frontend/src/components/ShopArea.tsx`
- Modify: `frontend/src/components/__tests__/ShopArea.test.tsx`

**Context:** `ShopArea.tsx:100` currently renders `Object.values(POTIONS)` — all four potions every time. We want `health_potion` always, plus 2 randomly sampled from the other three, fixed for the shop visit.

**Step 1: Write failing tests**

In `frontend/src/components/__tests__/ShopArea.test.tsx`, add:

```tsx
it('always shows health potion in shop', () => {
  render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
  expect(screen.getByRole('button', { name: /buy.*health potion/i })).toBeInTheDocument()
})

it('shows exactly 3 potions in shop (health + 2 random)', () => {
  render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
  const potionSection = document.querySelector('.shop-area__potions')!
  const buyButtons = potionSection.querySelectorAll('button[aria-label^="Buy"]')
  expect(buyButtons).toHaveLength(3)
})
```

**Step 2: Run tests to verify they fail**
```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A 3 "3 potions"
```
Expected: FAIL — currently shows 4 potions.

**Step 3: Update ShopArea.tsx**

Add `PotionId` to the type import at the top of `frontend/src/components/ShopArea.tsx`:
```tsx
import type { RunState, ArtifactId, PotionId } from '../types'
```

Add a `potionStock` state inside the component (after the existing `useState` lines):
```tsx
const [potionStock] = useState<Potion[]>(() => {
  const extras: PotionId[] = ['strength_potion', 'shielding_potion', 'archivists_brew']
  const shuffled = [...extras].sort(() => Math.random() - 0.5)
  return [POTIONS['health_potion'], ...shuffled.slice(0, 2).map(id => POTIONS[id])]
})
```

Change the potion render loop from `Object.values(POTIONS)` to `potionStock`:
```tsx
{potionStock.map(potion => (
```

**Step 4: Run all tests**
```bash
cd frontend && npm test
```
Expected: all pass.

**Step 5: Commit**
```bash
git add frontend/src/components/ShopArea.tsx \
        frontend/src/components/__tests__/ShopArea.test.tsx
git commit -m "feat: randomise shop potion stock (health potion always + 2 random)"
```

---

### Task 3: Create CombatRewardScreen component

**Files:**
- Create: `frontend/src/components/CombatRewardScreen.tsx`
- Create: `frontend/src/components/__tests__/CombatRewardScreen.test.tsx`

**Context:** This component shows what the player earned after a fight. It auto-adds rewards when there's space. When a slot is full it shows a swap UI (same pattern as ShopArea). `ArtifactShelf` already accepts an `onRemove` prop for the swap flow. `coinsEarned` is display-only — gold is already applied to `run.coins` before this component mounts.

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/CombatRewardScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CombatRewardScreen from '../CombatRewardScreen'
import { buildRun } from '../../runState'
import type { RunState, PotionId, ArtifactId } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('CombatRewardScreen', () => {
  it('shows coins earned when > 0', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/\+10 coins/i)).toBeInTheDocument()
  })

  it('shows no coins line when coinsEarned is 0', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={0} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.queryByText(/coins/i)).not.toBeInTheDocument()
  })

  it('shows Continue button immediately when no potion or artifact', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('calls onLeave with run when Continue clicked', () => {
    const onLeave = vi.fn()
    const run = makeRun({ coins: 10 })
    render(<CombatRewardScreen run={run} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={onLeave} />)
    userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ coins: 10 }))
  })

  it('auto-adds potion to pouch when space available', () => {
    const run = makeRun({ potions: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'health_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/health potion added to pouch/i)).toBeInTheDocument()
  })

  it('shows potion swap UI when pouch is full', () => {
    const run = makeRun({ potions: ['health_potion', 'health_potion', 'health_potion', 'health_potion'] as PotionId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'strength_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/pouch full/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('can skip a potion when pouch is full', async () => {
    const run = makeRun({ potions: ['health_potion', 'health_potion', 'health_potion', 'health_potion'] as PotionId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'strength_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('auto-adds artifact when inventory has space', () => {
    const run = makeRun({ artifacts: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'crystal_ball' as ArtifactId} onLeave={vi.fn()} />)
    expect(screen.getByText(/crystal ball added to inventory/i)).toBeInTheDocument()
  })

  it('shows artifact swap UI when inventory is full', () => {
    const run = makeRun({ artifacts: ['vowel_seeker','crystal_ball','category_scroll','short_sword','blood_dagger','iron_shield','thick_skin','healing_salve'] as ArtifactId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'gold_tooth' as ArtifactId} onLeave={vi.fn()} />)
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('can skip an artifact when inventory is full', async () => {
    const run = makeRun({ artifacts: ['vowel_seeker','crystal_ball','category_scroll','short_sword','blood_dagger','iron_shield','thick_skin','healing_salve'] as ArtifactId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'gold_tooth' as ArtifactId} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('onLeave receives run with auto-added potion', async () => {
    const onLeave = vi.fn()
    const run = makeRun({ potions: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'health_potion' as PotionId} pendingArtifact={null} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ potions: ['health_potion'] }))
  })
})
```

**Step 2: Run tests to verify they fail**
```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep "CombatRewardScreen"
```
Expected: FAIL — module not found.

**Step 3: Create CombatRewardScreen.tsx**

Create `frontend/src/components/CombatRewardScreen.tsx`:

```tsx
import { useState } from 'react'
import type { RunState, ArtifactId, PotionId } from '../types'
import { MAX_INVENTORY, MAX_POTION_SLOTS } from '../runState'
import { POTIONS } from '../potions'
import { ARTIFACTS } from '../artifacts'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  coinsEarned: number
  pendingPotion: PotionId | null
  pendingArtifact: ArtifactId | null
  onLeave: (updatedRun: RunState) => void
}

export default function CombatRewardScreen({ run, coinsEarned, pendingPotion, pendingArtifact, onLeave }: Props) {
  const potionFull = run.potions.length >= MAX_POTION_SLOTS
  const artifactFull = run.artifacts.length >= MAX_INVENTORY

  const [localRun, setLocalRun] = useState<RunState>(() => {
    let r = run
    if (pendingPotion && !potionFull) {
      r = { ...r, potions: [...r.potions, pendingPotion] }
    }
    if (pendingArtifact && !artifactFull) {
      r = { ...r, artifacts: [...r.artifacts, pendingArtifact] }
    }
    return r
  })

  const [potionSwapMode, setPotionSwapMode] = useState(!!pendingPotion && potionFull)
  const [potionSkipped, setPotionSkipped] = useState(false)
  const [artifactSwapMode, setArtifactSwapMode] = useState(!!pendingArtifact && artifactFull)
  const [artifactSkipped, setArtifactSkipped] = useState(false)
  const [removingArtifact, setRemovingArtifact] = useState<ArtifactId | null>(null)

  function handleSwapPotion(removeId: PotionId) {
    setLocalRun(prev => ({
      ...prev,
      potions: [...prev.potions.filter(id => id !== removeId), pendingPotion!],
    }))
    setPotionSwapMode(false)
  }

  function handleSwapArtifact(removeId: ArtifactId) {
    setLocalRun(prev => ({
      ...prev,
      artifacts: [...prev.artifacts.filter(id => id !== removeId), pendingArtifact!],
    }))
    setArtifactSwapMode(false)
    setRemovingArtifact(null)
  }

  const canContinue = !potionSwapMode && !artifactSwapMode

  return (
    <div className="combat-reward">
      <h2 className="combat-reward__title">Rewards</h2>

      {coinsEarned > 0 && (
        <p className="combat-reward__coins">💰 +{coinsEarned} coins</p>
      )}

      {pendingPotion && (
        <div className="combat-reward__item">
          {potionSwapMode ? (
            <>
              <p>Found {POTIONS[pendingPotion].emoji} <strong>{POTIONS[pendingPotion].name}</strong>! Pouch full — replace one or skip:</p>
              <div className="combat-reward__swap-options">
                {run.potions.map((id, i) => (
                  <button key={i} className="btn-swap-potion" onClick={() => handleSwapPotion(id)}>
                    Replace {POTIONS[id].emoji} {POTIONS[id].name}
                  </button>
                ))}
                <button className="btn-skip" onClick={() => { setPotionSwapMode(false); setPotionSkipped(true) }}>
                  Skip
                </button>
              </div>
            </>
          ) : (
            <p className="combat-reward__found">
              {potionSkipped
                ? `Skipped ${POTIONS[pendingPotion].emoji} ${POTIONS[pendingPotion].name}`
                : `${POTIONS[pendingPotion].emoji} ${POTIONS[pendingPotion].name} added to pouch!`}
            </p>
          )}
        </div>
      )}

      {pendingArtifact && (
        <div className="combat-reward__item">
          {artifactSwapMode && !removingArtifact ? (
            <>
              <p>Found {ARTIFACTS[pendingArtifact].emoji} <strong>{ARTIFACTS[pendingArtifact].name}</strong>! Inventory full — replace one or skip:</p>
              <button className="btn-skip" onClick={() => { setArtifactSwapMode(false); setArtifactSkipped(true) }}>
                Skip
              </button>
              <ArtifactShelf artifacts={localRun.artifacts} onRemove={id => setRemovingArtifact(id)} />
            </>
          ) : artifactSwapMode && removingArtifact ? (
            <div className="combat-reward__confirm">
              <p>
                Replace {ARTIFACTS[removingArtifact].emoji} <strong>{ARTIFACTS[removingArtifact].name}</strong> with{' '}
                {ARTIFACTS[pendingArtifact].emoji} <strong>{ARTIFACTS[pendingArtifact].name}</strong>?
              </p>
              <button className="btn-confirm-swap" onClick={() => handleSwapArtifact(removingArtifact)}>Confirm</button>
              <button className="btn-cancel-swap" onClick={() => setRemovingArtifact(null)}>Cancel</button>
            </div>
          ) : (
            <p className="combat-reward__found">
              {artifactSkipped
                ? `Skipped ${ARTIFACTS[pendingArtifact].emoji} ${ARTIFACTS[pendingArtifact].name}`
                : `${ARTIFACTS[pendingArtifact].emoji} ${ARTIFACTS[pendingArtifact].name} added to inventory!`}
            </p>
          )}
        </div>
      )}

      {canContinue && (
        <button className="btn-leave" onClick={() => onLeave(localRun)}>Continue</button>
      )}
    </div>
  )
}
```

**Step 4: Run tests**
```bash
cd frontend && npm test
```
Expected: all pass.

**Step 5: Commit**
```bash
git add frontend/src/components/CombatRewardScreen.tsx \
        frontend/src/components/__tests__/CombatRewardScreen.test.tsx
git commit -m "feat: add CombatRewardScreen component with swap/skip UI"
```

---

### Task 4: Wire CombatRewardScreen into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`

**Context:** App.tsx currently advances directly from combat to the next room in `handleCombatEnd` (lines ~134-199). We insert a `combat_reward` phase between them. `handleCombatEnd` rolls dice and transitions to `combat_reward`. A new `handleRewardLeave` does what the tail of `handleCombatEnd` used to do (advance to next room/floor/run_won). The defeated boss name must survive across the reward screen for floor transitions.

**Step 1: Write failing tests**

In `frontend/src/__tests__/App.test.tsx`, add:

```tsx
it('transitions to combat_reward phase after winning a fight', async () => {
  // This test requires mocking the reward roll to be deterministic.
  // Mock Math.random to always return 0 (no gold, no potion, no artifact)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  // ... set up App in combat phase, trigger onCombatEnd with alive run
  // check that combat_reward screen is rendered (look for "Rewards" heading)
})
```

> Note: App.test.tsx may already test `handleCombatEnd` indirectly. Review existing tests first and add/update as needed to cover:
> 1. Winning a fight transitions to `combat_reward` (not directly to next room)
> 2. Clicking Continue on reward screen advances to the next room

**Step 2: Update App.tsx**

**2a. Add `PotionId` and `ArtifactId` imports:**
```tsx
import type { GameState, GameStatus, RunState, RunScore, Room, ClassName, PotionId, ArtifactId } from './types'
```

**2b. Add new constants and component import:**
```tsx
import {
  buildRun, buildRooms, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, computeRoomsCleared,
  pickFloorThemes,
  SCORE_KEY,
  COINS_ENEMY_REWARD, COINS_BOSS_REWARD,
  REWARD_GOLD_ENEMY_CHANCE,
  REWARD_POTION_ENEMY_CHANCE, REWARD_ARTIFACT_ENEMY_CHANCE,
  REWARD_POTION_BOSS_CHANCE, REWARD_ARTIFACT_BOSS_CHANCE,
} from './runState'
import CombatRewardScreen from './components/CombatRewardScreen'
```

**2c. Update `AppPhase` type:**
```tsx
type AppPhase = 'how_to_play' | 'idle' | 'floor_intro' | 'combat' | 'combat_reward' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'
```

**2d. Add new state after existing state declarations (~line 31):**
```tsx
const [pendingRewards, setPendingRewards] = useState<{
  coinsEarned: number
  potion: PotionId | null
  artifact: ArtifactId | null
} | null>(null)
```

**2e. Add helper to sample rewards (add as a top-level helper inside the component or just inline):**

Add this import at the top of App.tsx:
```tsx
import { sampleArtifacts } from './artifacts'
import { POTIONS } from './potions'
```

Add a helper inside the component for sampling a random potion:
```tsx
function sampleRandomPotion(): PotionId {
  const ids = Object.keys(POTIONS) as PotionId[]
  return ids[Math.floor(Math.random() * ids.length)]
}
```

**2f. Replace `handleCombatEnd` with split version:**

Replace the entire existing `handleCombatEnd` with:

```tsx
async function handleCombatEnd(updatedRun: RunState, bossName?: string) {
  const word = currentGame?.word
  if (word) {
    updatedRun = { ...updatedRun, usedWords: [...updatedRun.usedWords, word] }
  }
  const roomIndex = updatedRun.roomIndex
  const updatedRooms = updatedRun.rooms.map((r, i) =>
    i === roomIndex ? { ...r, completed: true } : r,
  )
  const runWithRooms: RunState = { ...updatedRun, rooms: updatedRooms }

  if (updatedRun.hp <= 0) {
    const finalRun: RunState = { ...runWithRooms, status: 'lost' }
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

  // Roll rewards
  const isBoss = updatedRun.rooms[roomIndex].type === 'boss'
  const coinsEarned = isBoss || Math.random() < REWARD_GOLD_ENEMY_CHANCE
    ? (isBoss ? COINS_BOSS_REWARD : COINS_ENEMY_REWARD)
    : 0
  const potionChance = isBoss ? REWARD_POTION_BOSS_CHANCE : REWARD_POTION_ENEMY_CHANCE
  const artifactChance = isBoss ? REWARD_ARTIFACT_BOSS_CHANCE : REWARD_ARTIFACT_ENEMY_CHANCE
  const pendingPotion: PotionId | null = Math.random() < potionChance ? sampleRandomPotion() : null
  const artifactPool = sampleArtifacts(runWithRooms.artifacts, 1)
  const pendingArtifact: ArtifactId | null = artifactPool.length > 0 && Math.random() < artifactChance
    ? artifactPool[0].id
    : null

  const runWithCoins: RunState = { ...runWithRooms, coins: runWithRooms.coins + coinsEarned }
  saveRun(runWithCoins)
  setRun(runWithCoins)
  setDefeatedBossName(bossName ?? null)
  setPendingRewards({ coinsEarned, potion: pendingPotion, artifact: pendingArtifact })
  setPhase('combat_reward')
}
```

**2g. Add `handleRewardLeave` (new function, after `handleCombatEnd`):**

```tsx
async function handleRewardLeave(updatedRun: RunState) {
  const roomIndex = updatedRun.roomIndex

  if (roomIndex === 11) {
    if (updatedRun.floor === 3) {
      const finalRun: RunState = { ...updatedRun, status: 'won' }
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
      setPhase('floor_intro')
      return
    }
  }

  const nextRun: RunState = { ...updatedRun, roomIndex: roomIndex + 1 }
  saveRun(nextRun)
  setRun(nextRun)
  await enterRoom(nextRun, nextRun.rooms[nextRun.roomIndex])
}
```

**2h. Update `showProgress` to exclude `combat_reward`:**
```tsx
const showProgress = phase !== 'how_to_play' && phase !== 'idle' && phase !== 'floor_intro'
  && phase !== 'combat_reward' && phase !== 'run_won' && phase !== 'run_lost'
```

**2i. Add `CombatRewardScreen` to the JSX render block (after the `combat` block):**
```tsx
{phase === 'combat_reward' && run && pendingRewards && (
  <CombatRewardScreen
    run={run}
    coinsEarned={pendingRewards.coinsEarned}
    pendingPotion={pendingRewards.potion}
    pendingArtifact={pendingRewards.artifact}
    onLeave={handleRewardLeave}
  />
)}
```

**2j. The Give Up button:** ensure it is not shown during `combat_reward`. Find the Give Up button in App.tsx JSX (it checks the phase). Add `phase !== 'combat_reward'` to its condition — same as you'd do for `floor_intro`.

**Step 3: Run all tests**
```bash
cd frontend && npm test
```
Expected: all pass. If App.test.tsx has tests checking that `handleCombatEnd` immediately advances to the next room, update them to expect `combat_reward` phase or mock Math.random and click through the reward screen.

**Step 4: Commit**
```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat: wire CombatRewardScreen into App — probabilistic post-fight rewards"
```

---

### Task 5: Add CSS for CombatRewardScreen

**Files:**
- Modify: `frontend/src/index.css`

**Context:** The component uses class names `combat-reward`, `combat-reward__title`, `combat-reward__coins`, `combat-reward__item`, `combat-reward__found`, `combat-reward__swap-options`, `combat-reward__confirm`. Buttons reuse existing classes `btn-leave`, `btn-skip`, `btn-confirm-swap`, `btn-cancel-swap`, `btn-swap-potion`. Check `index.css` for existing `btn-cancel-swap`, `btn-confirm-swap` definitions — they may already exist from ShopArea.

**Step 1: No failing test needed for CSS** — visual check only.

**Step 2: Add CSS to `frontend/src/index.css`:**

Append at the end:
```css
/* ── Combat Reward Screen ─────────────────────── */
.combat-reward {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  padding: 2rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.combat-reward__title {
  font-size: 1.6rem;
  color: var(--color-accent);
  margin: 0;
}

.combat-reward__coins {
  font-size: 1.3rem;
  color: var(--color-gold, #f0c040);
  font-weight: 700;
  margin: 0;
}

.combat-reward__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
}

.combat-reward__found {
  font-size: 1.1rem;
  margin: 0;
}

.combat-reward__swap-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.combat-reward__confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.btn-swap-potion {
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-swap-potion:hover {
  background: var(--color-surface-hover, #333);
}

.btn-skip {
  padding: 0.4rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--color-muted);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-skip:hover {
  color: var(--color-text);
  border-color: var(--color-text);
}
```

**Step 3: Run tests**
```bash
cd frontend && npm test
```
Expected: all pass (CSS doesn't affect tests).

**Step 4: Commit**
```bash
git add frontend/src/index.css
git commit -m "feat: add CombatRewardScreen CSS"
```
