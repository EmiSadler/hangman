# Inventory Limit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cap the player's artifact inventory at 8 items, allow multiple purchases per shop visit, and let a full-inventory player swap a new item in for an old one with an inline confirmation step.

**Architecture:** Three focused tasks: (1) add the `MAX_INVENTORY` constant and an optional `onRemove` prop to `ArtifactShelf`; (2) restructure `ShopArea` to keep local run state so the shop stays open after each purchase; (3) add swap mode and confirmation to `ShopArea` for full-inventory players.

**Tech Stack:** React 19 + TypeScript, vitest + @testing-library/react. Frontend only — no backend changes.

---

## Context

### Key files

- `frontend/src/runState.ts` — constants like `MAX_HP`, `DAMAGE_PER_WRONG`, etc. live here
- `frontend/src/components/ArtifactShelf.tsx` — renders the player's artifact icons with tooltips; used in `ShopArea` and `CombatView`
- `frontend/src/components/ShopArea.tsx` — the shop UI; currently exits immediately on first buy (`handleBuy` calls `onLeave`)
- `frontend/src/artifacts.ts` — `ARTIFACTS` record (14 entries) and `sampleArtifacts(owned, count)` helper
- `frontend/src/components/__tests__/ArtifactShelf.test.tsx` — existing tests for ArtifactShelf
- `frontend/src/components/__tests__/ShopArea.test.tsx` — existing tests for ShopArea; one test will need updating in Task 2

### How ShopArea currently works

```tsx
const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))

function handleBuy(art: Artifact) {
  let updated = { ...run, coins: run.coins - art.price, artifacts: [...run.artifacts, art.id] }
  if (art.id === 'chainmail') updated = { ...updated, maxHp: run.maxHp + 5, hp: run.hp + 5 }
  onLeave(updated)   // ← exits the shop immediately
}
```

After Task 2, `handleBuy` will update local state instead of calling `onLeave`. Only the Leave button calls `onLeave`.

### Test commands

```bash
cd frontend && npm test -- --run            # run all tests once
cd frontend && npm test -- --run ShopArea   # run only ShopArea tests
cd frontend && npm test -- --run ArtifactShelf
```

Expected baseline: 241 tests passing.

---

## Task 1: MAX_INVENTORY constant + ArtifactShelf `onRemove` prop

**Files:**
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/components/ArtifactShelf.tsx`
- Modify: `frontend/src/components/__tests__/ArtifactShelf.test.tsx`

---

### Step 1: Write the failing tests

Add these three tests to the **bottom** of the `describe('ArtifactShelf', ...)` block in `frontend/src/components/__tests__/ArtifactShelf.test.tsx`.

First, add `vi` to the vitest import at the top of the file:

```tsx
import { describe, it, expect, vi } from 'vitest'
```

Then add the tests:

```tsx
  it('does not render remove buttons when onRemove is not provided', () => {
    render(<ArtifactShelf artifacts={['short_sword', 'iron_shield']} />)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('renders a remove button for each artifact when onRemove is provided', () => {
    render(<ArtifactShelf artifacts={['short_sword', 'iron_shield']} onRemove={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
  })

  it('calls onRemove with the artifact id when remove button is clicked', async () => {
    const onRemove = vi.fn()
    render(<ArtifactShelf artifacts={['short_sword']} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: /remove short sword/i }))
    expect(onRemove).toHaveBeenCalledWith('short_sword')
  })
```

### Step 2: Run tests — verify they fail

```bash
cd frontend && npm test -- --run ArtifactShelf
```

Expected: 3 new tests FAIL (the existing 8 should still pass).

### Step 3: Add the `MAX_INVENTORY` constant

In `frontend/src/runState.ts`, add this line after `WRONG_SOLVE_PENALTY` (line 16):

```ts
export const MAX_INVENTORY = 8
```

The constants block should then look like:

```ts
export const DAMAGE_PER_WRONG = 2
export const BASE_DAMAGE_PER_HIT = 2
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
export const HEAL_AMOUNT = 5
export const WRONG_SOLVE_PENALTY = 5
export const MAX_INVENTORY = 8
```

### Step 4: Add `onRemove` prop to ArtifactShelf

Replace the entire `frontend/src/components/ArtifactShelf.tsx` with:

```tsx
import { useState } from 'react'
import type { ArtifactId } from '../types'
import { ARTIFACTS } from '../artifacts'

interface Props {
  artifacts: ArtifactId[]
  vertical?: boolean
  onRemove?: (id: ArtifactId) => void
}

export default function ArtifactShelf({ artifacts, vertical = false, onRemove }: Props) {
  const [tooltip, setTooltip] = useState<ArtifactId | null>(null)

  if (artifacts.length === 0) return null

  return (
    <div className={`artifact-shelf${vertical ? ' artifact-shelf--vertical' : ''}${vertical && artifacts.length > 3 ? ' artifact-shelf--two-col' : ''}`}>
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
            {onRemove && (
              <button
                className="artifact-shelf__remove"
                onClick={() => onRemove(id)}
                aria-label={`Remove ${art.name}`}
              >
                Remove
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### Step 5: Run tests — verify they pass

```bash
cd frontend && npm test -- --run ArtifactShelf
```

Expected: all 11 ArtifactShelf tests pass.

### Step 6: Run the full suite

```bash
cd frontend && npm test -- --run
```

Expected: all 241 tests pass.

### Step 7: Add CSS for the remove button

Append to `frontend/src/index.css`:

```css
/* Artifact shelf remove button (swap mode) */
.artifact-shelf__remove {
  display: block;
  margin: 0.2rem auto 0;
  padding: 0.1rem 0.4rem;
  font-size: 0.65rem;
  background: transparent;
  color: var(--wrong);
  border: 1px solid var(--wrong);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.8;
}
.artifact-shelf__remove:hover {
  opacity: 1;
}
```

### Step 8: Commit

```bash
git add frontend/src/runState.ts frontend/src/components/ArtifactShelf.tsx frontend/src/components/__tests__/ArtifactShelf.test.tsx frontend/src/index.css
git commit -m "feat: add MAX_INVENTORY constant and ArtifactShelf onRemove prop"
```

---

## Task 2: ShopArea multi-buy (shop stays open)

**Files:**
- Modify: `frontend/src/components/ShopArea.tsx`
- Modify: `frontend/src/components/__tests__/ShopArea.test.tsx`

---

### Step 1: Update the existing breaking test + write new failing tests

Open `frontend/src/components/__tests__/ShopArea.test.tsx`.

**Update** the existing `'buying an artifact deducts its price and adds it to artifacts'` test. The current test expects `onLeave` to be called immediately after clicking Buy — after Task 2, buying no longer exits the shop, so it expects Leave to be clicked first:

```tsx
  it('buying an artifact deducts its price and adds it to artifacts', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    // Buy no longer exits the shop — click Leave to commit
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.coins).toBeLessThan(99)
    expect(updatedRun.artifacts.length).toBe(1)
  })
```

**Add** these two new tests at the bottom of the `describe('ShopArea', ...)` block:

```tsx
  it('buying an artifact does not call onLeave (shop stays open)', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('bought artifact disappears from stock and leave calls onLeave with updated run', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtonsBefore = screen.getAllByRole('button', { name: /buy/i })
    const countBefore = buyButtonsBefore.length
    await userEvent.click(buyButtonsBefore[0])
    // One fewer buy button in stock now
    expect(screen.getAllByRole('button', { name: /buy/i })).toHaveLength(countBefore - 1)
    // Leave commits the purchase
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.artifacts.length).toBe(1)
  })
```

### Step 2: Run tests — verify they fail

```bash
cd frontend && npm test -- --run ShopArea
```

Expected: the updated existing test + the two new tests FAIL. The other 4 ShopArea tests should still pass.

### Step 3: Rewrite ShopArea

Replace the entire `frontend/src/components/ShopArea.tsx` with:

```tsx
import { useState } from 'react'
import type { RunState, ArtifactId } from '../types'
import { sampleArtifacts, type Artifact, ARTIFACTS } from '../artifacts'
import { MAX_INVENTORY } from '../runState'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  onLeave: (updatedRun: RunState) => void
}

export default function ShopArea({ run, onLeave }: Props) {
  const [localRun, setLocalRun] = useState<RunState>(run)
  const [stock] = useState<Artifact[]>(() => sampleArtifacts(run.artifacts, 4))
  const [pendingSwap, setPendingSwap] = useState<Artifact | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ArtifactId | null>(null)

  const displayStock = stock.filter(art => !localRun.artifacts.includes(art.id))

  function handleBuy(art: Artifact) {
    if (localRun.artifacts.length >= MAX_INVENTORY) {
      setPendingSwap(art)
      setPendingRemove(null)
      return
    }
    let updated: RunState = {
      ...localRun,
      coins: localRun.coins - art.price,
      artifacts: [...localRun.artifacts, art.id],
    }
    if (art.id === 'chainmail') updated = { ...updated, maxHp: updated.maxHp + 5, hp: updated.hp + 5 }
    setLocalRun(updated)
  }

  function handleConfirmSwap() {
    if (!pendingSwap || !pendingRemove) return
    let updated: RunState = {
      ...localRun,
      coins: localRun.coins - pendingSwap.price,
      artifacts: [...localRun.artifacts.filter(id => id !== pendingRemove), pendingSwap.id],
    }
    if (pendingSwap.id === 'chainmail') updated = { ...updated, maxHp: updated.maxHp + 5, hp: updated.hp + 5 }
    setLocalRun(updated)
    setPendingSwap(null)
    setPendingRemove(null)
  }

  return (
    <div className="shop-area">
      <h2>Shop</h2>
      <p className="shop-area__coins">Coins: {localRun.coins}</p>

      {pendingSwap && pendingRemove ? (
        <div className="shop-area__confirm-banner">
          <p>
            Remove {ARTIFACTS[pendingRemove].emoji} <strong>{ARTIFACTS[pendingRemove].name}</strong>{' '}
            to get {pendingSwap.emoji} <strong>{pendingSwap.name}</strong>? This cannot be undone.
          </p>
          <div className="shop-area__confirm-buttons">
            <button className="btn-confirm-swap" onClick={handleConfirmSwap}>Confirm</button>
            <button className="btn-cancel-swap" onClick={() => setPendingRemove(null)}>Cancel</button>
          </div>
        </div>
      ) : pendingSwap ? (
        <div className="shop-area__swap-banner">
          <p>Inventory full ({MAX_INVENTORY}/{MAX_INVENTORY}). Choose an item to remove:</p>
          <button className="btn-cancel-swap" onClick={() => { setPendingSwap(null); setPendingRemove(null) }}>Cancel</button>
        </div>
      ) : null}

      <div className="shop-area__stock">
        {displayStock.map(art => (
          <div key={art.id} className="shop-area__item">
            <span className="shop-area__item-info">
              {art.emoji} <strong>{art.name}</strong> — {art.description}
            </span>
            <button
              className="btn-buy"
              onClick={() => handleBuy(art)}
              disabled={localRun.coins < art.price}
            >
              Buy ({art.price} coins)
            </button>
          </div>
        ))}
      </div>
      <button className="btn-leave" onClick={() => onLeave(localRun)}>Leave</button>
      <ArtifactShelf
        artifacts={localRun.artifacts}
        onRemove={pendingSwap ? (id) => setPendingRemove(id) : undefined}
      />
    </div>
  )
}
```

**Note:** This file already includes the swap mode UI (Task 3's JSX). Write it in full now — Tasks 2 and 3 share the same component, so it's cleaner to write the complete implementation rather than adding to it again in Task 3. Task 3 only adds tests for the swap/confirmation paths.

### Step 4: Run tests — verify they pass

```bash
cd frontend && npm test -- --run ShopArea
```

Expected: all ShopArea tests pass.

### Step 5: Run the full suite

```bash
cd frontend && npm test -- --run
```

Expected: all 241 tests pass (no regressions).

### Step 6: Commit

```bash
git add frontend/src/components/ShopArea.tsx frontend/src/components/__tests__/ShopArea.test.tsx
git commit -m "feat: shop stays open after purchase, stock updates reactively"
```

---

## Task 3: ShopArea swap mode + confirmation tests

**Files:**
- Modify: `frontend/src/components/__tests__/ShopArea.test.tsx`

The swap UI is already implemented in Task 2's `ShopArea.tsx`. This task adds tests to cover the swap/confirmation paths.

---

### Step 1: Write the failing tests

Add these constants and tests to `frontend/src/components/__tests__/ShopArea.test.tsx`.

Add a constant near the top of the file (below the `makeRun` helper):

```tsx
// 8 artifacts that fill the inventory limit
const FULL_INVENTORY: ArtifactId[] = [
  'vowel_seeker', 'crystal_ball', 'category_scroll', 'short_sword',
  'blood_dagger', 'iron_shield', 'thick_skin', 'healing_salve',
]
```

Add these tests to the bottom of the `describe('ShopArea', ...)` block:

```tsx
  it('shows swap banner when buying with a full inventory', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
  })

  it('cancel in swap mode hides the swap banner', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /buy/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/inventory full/i)).not.toBeInTheDocument()
  })

  it('clicking remove in swap mode shows confirmation banner', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    // Enter swap mode
    await userEvent.click(screen.getAllByRole('button', { name: /buy/i })[0])
    // Click the first Remove button in the artifact shelf
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('cancel in confirmation returns to swap mode', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /buy/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    // Cancel confirmation — should go back to swap banner, not all the way out
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
    expect(screen.queryByText(/this cannot be undone/i)).not.toBeInTheDocument()
  })

  it('confirming swap replaces item, deducts coins, and stays in shop', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={onLeave} />)
    await userEvent.click(screen.getAllByRole('button', { name: /buy/i })[0])
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    // Record which artifact name appears first in remove buttons
    await userEvent.click(removeButtons[0])
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    // Shop still open — Leave to commit
    expect(onLeave).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    // Inventory still 8 (one swapped)
    expect(updatedRun.artifacts).toHaveLength(8)
    // Coins decreased
    expect(updatedRun.coins).toBeLessThan(99)
  })
```

### Step 2: Run tests — verify they fail

```bash
cd frontend && npm test -- --run ShopArea
```

Expected: the 5 new tests FAIL (all existing tests should still pass).

### Step 3: Verify the implementation already handles these cases

The complete `ShopArea.tsx` was written in Task 2. Re-run the tests — they should now pass without any code changes needed.

```bash
cd frontend && npm test -- --run ShopArea
```

Expected: all ShopArea tests pass.

If any test fails, re-read `ShopArea.tsx` and compare against the implementation in Task 2. Common issues:
- `pendingRemove` not cleared when `pendingSwap` is set via a new Buy click
- Confirmation "Cancel" clearing `pendingSwap` instead of only `pendingRemove`

### Step 4: Run the full suite

```bash
cd frontend && npm test -- --run
```

Expected: all tests pass (241 + 8 new = 249 total).

### Step 5: Add CSS for swap and confirmation UI

Append to `frontend/src/index.css`:

```css
/* Shop swap mode */
.shop-area__swap-banner,
.shop-area__confirm-banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
  color: var(--text-muted);
}

.shop-area__confirm-banner p {
  color: var(--fg);
  margin-bottom: 0.5rem;
}

.shop-area__confirm-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.btn-confirm-swap {
  padding: 0.35rem 0.9rem;
  background: var(--wrong);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-confirm-swap:hover {
  filter: brightness(1.15);
}

.btn-cancel-swap {
  padding: 0.35rem 0.9rem;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel-swap:hover {
  color: var(--fg);
  border-color: var(--fg);
}
```

### Step 6: Run the full suite one final time

```bash
cd frontend && npm test -- --run
```

Expected: all 249 tests pass.

### Step 7: Commit

```bash
git add frontend/src/components/__tests__/ShopArea.test.tsx frontend/src/index.css
git commit -m "feat: inventory limit of 8, swap mode with confirmation in shop"
```
