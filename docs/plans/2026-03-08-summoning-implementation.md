# Enemy Summoning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** When a word is solved but the enemy still has HP, show a dramatic summoning message then fetch a fresh word and continue the fight.

**Architecture:** All changes live in `CombatView.tsx`. A `currentGame` state variable replaces direct `initialState` references for the active word display, so it can swap to a new word mid-combat. A `summoningHp` state (null or number) drives the summoning screen. A `nextGame` state holds the prefetched word while the player reads the message. An `enemyHpRef` ref mirrors `currentEnemyHp` so `handleWordSolved` can read the latest value synchronously (avoiding stale closure). Two existing "win" tests need minor fixes because they simulate a word-won scenario where the enemy would now trigger summoning.

**Tech Stack:** React 19, TypeScript, Vite 7, vitest + @testing-library/react. Run tests: `cd frontend && npm test -- --run`. Currently 185 tests passing.

---

### Task 1: CombatView summoning mechanic + tests

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Background — what `initialState` is currently used for:**

| Line | Usage | Change? |
|------|-------|---------|
| 120 | `enemyHp(initialState.word.length, floor)` → `maxEnemyHp` | Keep `initialState` — set once |
| 139–141 | Initial `hiddenCount` from `initialState.maskedWord` | Keep `initialState` for init |
| 143 | Initial `guessedLetters` from `initialState.guessedLetters` | Keep `initialState` for init |
| 152–154 | `vowelCount` from `initialState.word` | Keep — one-time artifact reveal |
| 164–170 | `crystalBallLetter` from `initialState.word` | Keep — one-time artifact reveal |
| 352–356 | Archivist info display | → `currentGame` |
| 365 | Category Scroll display | → `currentGame` |
| 371 | `<GameBoard initialState={initialState}>` | → `currentGame` |

---

**Step 1: Write failing tests**

Add these tests to the existing `describe('CombatView', ...)` block in `frontend/src/components/__tests__/CombatView.test.tsx`.

Also update 5 existing tests where `occurrences: 1` would now trigger summoning (enemy survives). Change them from `occurrences: 1` to `occurrences: 3` so the 3-letter word deals 3×2=6 damage = kills the floor-1 enemy exactly. Affected tests:
- `'shows Continue button when word solved'`
- `'calls onCombatEnd with updated run when Continue clicked after win'`
- `'Healing Salve restores 3 HP after combat win'`
- `'Healing Salve caps HP at maxHp'`
- `'Gold Tooth awards +5 bonus coins after combat win'`

In each of those 5 tests, change the mock response from `occurrences: 1` to `occurrences: 3`. This means the letter appears 3 times, dealing 6 damage, exactly killing the enemy (floor 1, 3-letter word → 6 HP). No summoning.

New tests to add:

```typescript
it('shows summoning message with remaining HP when word solved but enemy alive', async () => {
  // floor=3, word='cat' (3 letters) → enemy HP = 3*3*2 = 18
  // Guess 't' (1 occ, 2 dmg → HP 18→16), backend returns status='won' → summoning
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockGuessResponse({
        masked_word: 'c a t', correct: true,
        guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        game_id: 'new-id', word: 'dog', masked_word: '_ _ _',
        category: 'animals', first_letter: 'd', guessed_letters: [], status: 'in_progress',
      }),
    })
  )
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'T' }))
  await waitFor(() => {
    expect(screen.getByText(/16/)).toBeInTheDocument()
    expect(screen.getByText(/summon/i)).toBeInTheDocument()
  })
})

it('Continue on summoning screen dismisses message and shows new word', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockGuessResponse({
        masked_word: 'c a t', correct: true,
        guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        game_id: 'new-id', word: 'dog', masked_word: '_ _ _',
        category: 'animals', first_letter: 'd', guessed_letters: [], status: 'in_progress',
      }),
    })
  )
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'T' }))
  // Wait for Continue button to be enabled (fetch complete)
  const continueBtn = await waitFor(() => {
    const btn = screen.getByRole('button', { name: /continue/i })
    expect(btn).not.toBeDisabled()
    return btn
  })
  await userEvent.click(continueBtn)
  // Summoning message gone, back to game board
  await waitFor(() => expect(screen.queryByText(/summon/i)).not.toBeInTheDocument())
  // 'E' key available (keyboard reset with new word)
  expect(screen.getByRole('button', { name: 'E' })).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx 2>&1 | tail -20
```

Expected: 2 new tests FAIL (no summoning logic yet). The 5 updated tests should still PASS after changing `occurrences: 1` → `occurrences: 3` (the enemy dies, no summoning, Continue shown as before).

Verify the failure messages for the 2 new tests say something about the summoning message not found, not a syntax error.

**Step 3: Implement the changes**

Open `frontend/src/components/CombatView.tsx` and make these changes:

**3a. Add `useRef` import** — change line 1 from:
```typescript
import { useState, useEffect } from 'react'
```
to:
```typescript
import { useState, useEffect, useRef } from 'react'
```

**3b. Add new state variables** — after the existing `const [guessedLetters, ...]` line (line 143), add:

```typescript
  const enemyHpRef = useRef(maxEnemyHp)
  const [currentGame, setCurrentGame] = useState<GameState>(initialState)
  const [summoningHp, setSummoningHp] = useState<number | null>(null)
  const [nextGame, setNextGame] = useState<GameState | null>(null)
```

**3c. Keep `enemyHpRef` in sync** — in `handleGuessResult`, find this line (around line 199):
```typescript
      setCurrentEnemyHp(prev => Math.max(0, prev - dmg))
```
Replace with:
```typescript
      const newEnemyHp = Math.max(0, enemyHpRef.current - dmg)
      enemyHpRef.current = newEnemyHp
      setCurrentEnemyHp(newEnemyHp)
```

**3d. Replace `handleWordSolved`** — find the existing:
```typescript
  function handleWordSolved() {
    finishCombat(true)
  }
```
Replace with:
```typescript
  async function handleWordSolved() {
    if (enemyHpRef.current > 0) {
      const hp = enemyHpRef.current
      setSummoningHp(hp)
      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_type: room.type }),
        })
        const data = await res.json()
        setNextGame({
          gameId: data.game_id,
          word: data.word,
          maskedWord: data.masked_word,
          category: data.category,
          firstLetter: data.first_letter,
          guessedLetters: data.guessed_letters ?? [],
          status: 'in_progress',
        })
      } catch {
        finishCombat(true)
      }
    } else {
      finishCombat(true)
    }
  }
```

**3e. Add `handleSummonContinue`** — after `handleWordSolved`, add:
```typescript
  function handleSummonContinue() {
    if (nextGame === null) return
    setCurrentGame(nextGame)
    setGuessedLetters([])
    setHiddenCount(nextGame.maskedWord.split(' ').filter(c => c === '_').length)
    setNextGame(null)
    setSummoningHp(null)
  }
```

**3f. Update Archivist info display** — find (around line 352):
```typescript
          <span>Category: {initialState.category}</span>
          <span>First letter: {initialState.firstLetter.toUpperCase()}</span>
          <span>{initialState.word.length} letters</span>
```
Replace with:
```typescript
          <span>Category: {currentGame.category}</span>
          <span>First letter: {currentGame.firstLetter.toUpperCase()}</span>
          <span>{currentGame.word.length} letters</span>
```

**3g. Update Category Scroll display** — find (around line 365):
```typescript
            <span>📜 Category: {initialState.category}</span>
```
Replace with:
```typescript
            <span>📜 Category: {currentGame.category}</span>
```

**3h. Update GameBoard and add summoning screen** — find the `<GameBoard>` JSX block (around line 370):
```typescript
      <GameBoard
        initialState={initialState}
        ...
      />
```
Replace the entire `<GameBoard ... />` block with:
```typescript
      {summoningHp !== null ? (
        <div className="summoning-screen">
          <p className="summoning-screen__message">
            The enemy survives with {summoningHp} HP!
          </p>
          <p className="summoning-screen__sub">They summon another word...</p>
          <button
            className="btn-leave"
            onClick={handleSummonContinue}
            disabled={nextGame === null}
          >
            Continue
          </button>
        </div>
      ) : (
        <GameBoard
          initialState={currentGame}
          onGuessResult={handleGuessResult}
          onWordSolved={handleWordSolved}
          onPlayAgain={handleContinue}
          playAgainLabel={playAgainLabel}
          combatOver={combatDone || enemyDead}
          blockedLetters={blockedLetters}
          onWrongSolve={handleWrongSolve}
        />
      )}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx 2>&1 | tail -20
```

Expected: all 44 CombatView tests pass (42 existing + 2 new).

**Step 5: Run full suite**

```bash
cd frontend && npm test -- --run
```

Expected: 187 tests pass (185 + 2 new).

**Step 6: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: summon new word when enemy survives a solved word"
```

---

### Task 2: CSS for the summoning screen

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Write the failing test**

There is no dedicated CSS test needed — the summoning screen renders correctly if Task 1 tests pass. Skip to implementation.

**Step 2: Append CSS to `frontend/src/index.css`**

Find the end of the file and append:

```css
/* ── Summoning Screen ───────────────────────────────────── */

.summoning-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
  text-align: center;
}

.summoning-screen__message {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
}

.summoning-screen__sub {
  color: var(--text-muted);
  font-size: 1rem;
  margin: 0;
}
```

The Continue button uses the existing `.btn-leave` class — no new button style needed.

**Step 3: Run full suite to confirm no regressions**

```bash
cd frontend && npm test -- --run
```

Expected: 187 tests pass.

**Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add summoning screen CSS"
```

---

## Final verification

```bash
cd frontend && npm test -- --run
```

Expected: 187 tests, all passing.

Spot-check the summoning mechanic manually:
1. Start a new run as any class
2. Reach floor 2 or 3 (where short words can leave the enemy with HP)
3. Solve a word — if the enemy survives, the summoning screen should appear
4. Click Continue — a new word should appear with the enemy's HP unchanged
