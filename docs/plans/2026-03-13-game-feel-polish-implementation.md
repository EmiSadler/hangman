# Game Feel + Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add floating damage numbers + hit flash to combat, and replace the inline "How to play" toggle with a proper full-screen onboarding screen shown automatically on first visit.

**Architecture:** Four independent tasks. Tasks 1–3 are purely additive changes to CombatView and its CSS. Task 4 replaces RunSetup's inline help toggle with a new `HowToPlayScreen` component wired into App's phase state machine. No backend changes. No new dependencies.

**Tech Stack:** React 19, TypeScript, CSS keyframes, localStorage, vitest + @testing-library/react

---

### Task 1: CSS — keyframes, popup styles, flash class

**Files:**
- Modify: `frontend/src/index.css`

No automated test needed — pure CSS additions. Verify visually after Task 3.

**Step 1: Add `position: relative` to sprite placeholder selectors**

Find `.combat-view__player-sprite-placeholder` and `.combat-view__enemy-sprite-placeholder` in `frontend/src/index.css` and add `position: relative` to each so absolutely-positioned popup children are anchored correctly.

The `.combat-view__player-sprite-placeholder` block currently looks like:
```css
.combat-view__player-sprite-placeholder {
  width: 80px;
  height: 80px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  background: var(--surface);
}
```
Add `position: relative;` to both that and `.combat-view__enemy-sprite-placeholder`.

**Step 2: Append the following CSS to the end of `frontend/src/index.css`**

```css
/* ── Damage feedback ─────────────────────────────────────── */

@keyframes float-up-fade {
  0%   { transform: translateX(-50%) translateY(0);     opacity: 1; }
  100% { transform: translateX(-50%) translateY(-36px); opacity: 0; }
}

@keyframes flash-hit {
  0%   { background: transparent; }
  30%  { background: rgba(180, 40, 40, 0.5); }
  100% { background: transparent; }
}

.damage-popup {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Courier New', Courier, monospace;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--wrong);
  pointer-events: none;
  white-space: nowrap;
  animation: float-up-fade 0.8s ease-out forwards;
  z-index: 10;
}

.damage-popup--heal {
  color: var(--heal);
}

.flash-hit {
  animation: flash-hit 0.4s ease-out forwards;
}
```

**Step 3: Run the test suite to confirm nothing broke**

```bash
cd frontend && npm test -- --run
```
Expected: all tests pass (no CSS-only changes can break JS tests).

**Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add damage popup and flash-hit CSS keyframes"
```

---

### Task 2: Floating damage numbers in CombatView

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Step 1: Write three failing tests**

At the bottom of the `describe('CombatView', ...)` block in `frontend/src/components/__tests__/CombatView.test.tsx`, add:

```typescript
it('shows enemy damage popup on correct guess', async () => {
  // word='cat', floor=1 → enemy HP=6. 'a' (1 occ, 2 dmg) → popup '-2' appears on enemy side
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGuessResponse({
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }),
  }))
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => expect(screen.getByText('-2')).toBeInTheDocument())
})

it('shows player damage popup on wrong guess', async () => {
  // wrong guess → DAMAGE_PER_WRONG=2 → popup '-2' appears on player side
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => expect(screen.getByText('-2')).toBeInTheDocument())
})

it('shows heal popup when player heals', async () => {
  // Heal button pressed → HEAL_AMOUNT=5 → popup '+5' appears
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /heal/i }))
  await waitFor(() => expect(screen.getByText('+5')).toBeInTheDocument())
})
```

**Step 2: Run the new tests to confirm they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```
Expected: 3 new tests FAIL with "Unable to find an element with the text".

**Step 3: Add state, helpers, and rendering to `CombatView.tsx`**

At the top of `frontend/src/components/CombatView.tsx`, add the `DamagePopup` interface just before the component function:

```typescript
interface DamagePopup {
  id: number
  value: number
  target: 'player' | 'enemy'
  heal: boolean
}
```

Inside the `CombatView` component function, add these after the existing state declarations (after the `const [nextGame, setNextGame]` line around line 178):

```typescript
const [popups, setPopups] = useState<DamagePopup[]>([])
const nextPopupId = useRef(0)

function pushPopup(value: number, target: 'player' | 'enemy', heal = false) {
  const id = nextPopupId.current++
  setPopups(prev => [...prev, { id, value, target, heal }])
  setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 850)
}
```

**Step 4: Call `pushPopup` in the three places damage/healing occurs**

In `handleGuessResult`, after `setCurrentEnemyHp(newEnemyHp)` (inside the `if (correct)` branch), add:
```typescript
pushPopup(dmg, 'enemy')
```

In `handleGuessResult`, after `setDisplayRun(prev => ({ ...prev, hp: newHp, shield: shieldLeft }))` (inside the `else` branch, after calculating `playerDmg`), add:
```typescript
if (playerDmg > 0) pushPopup(playerDmg, 'player')
```

In `handleHeal`, after `setDisplayRun(...)`, add:
```typescript
pushPopup(HEAL_AMOUNT, 'player', true)
```

In `handleWordSolved`, after `setCurrentEnemyHp(newEnemyHp)` (inside the `if (hiddenRemaining > 0)` block), add:
```typescript
pushPopup(dmg, 'enemy')
```

**Step 5: Render popups inside the sprite placeholder divs**

Find the player sprite placeholder in the JSX (around line 474):
```tsx
<div className="combat-view__player-sprite-placeholder" aria-hidden="true" />
```
Replace with:
```tsx
<div className="combat-view__player-sprite-placeholder" aria-hidden="true">
  {popups.filter(p => p.target === 'player').map(p => (
    <span key={p.id} className={`damage-popup${p.heal ? ' damage-popup--heal' : ''}`}>
      {p.heal ? '+' : '-'}{p.value}
    </span>
  ))}
</div>
```

Find the enemy sprite placeholder (around line 511):
```tsx
<div className="combat-view__enemy-sprite-placeholder" aria-hidden="true" />
```
Replace with:
```tsx
<div className="combat-view__enemy-sprite-placeholder" aria-hidden="true">
  {popups.filter(p => p.target === 'enemy').map(p => (
    <span key={p.id} className="damage-popup">
      -{p.value}
    </span>
  ))}
</div>
```

**Step 6: Run tests to confirm all pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests pass including the 3 new ones.

**Step 7: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: floating damage numbers on player and enemy hits"
```

---

### Task 3: Hit flash on damage

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Step 1: Write two failing tests**

Add to the bottom of the describe block in `CombatView.test.tsx`:

```typescript
it('applies flash-hit class to enemy sprite on correct guess', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGuessResponse({
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }),
  }))
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  // Flash class applied immediately after hit
  await waitFor(() => {
    const sprite = document.querySelector('.combat-view__enemy-sprite-placeholder')
    expect(sprite).toHaveClass('flash-hit')
  })
})

it('applies flash-hit class to player sprite on wrong guess', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
  }))
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Z' }))
  await waitFor(() => {
    const sprite = document.querySelector('.combat-view__player-sprite-placeholder')
    expect(sprite).toHaveClass('flash-hit')
  })
})
```

**Step 2: Run to confirm they fail**

```bash
cd frontend && npm test -- --run src/components/__tests__/CombatView.test.tsx
```
Expected: 2 new tests FAIL.

**Step 3: Add flash state and helper to `CombatView.tsx`**

After the `popups` / `pushPopup` additions from Task 2, add:

```typescript
const [enemyFlash, setEnemyFlash] = useState(false)
const [playerFlash, setPlayerFlash] = useState(false)

function triggerFlash(target: 'player' | 'enemy') {
  if (target === 'enemy') {
    setEnemyFlash(true)
    setTimeout(() => setEnemyFlash(false), 400)
  } else {
    setPlayerFlash(true)
    setTimeout(() => setPlayerFlash(false), 400)
  }
}
```

**Step 4: Call `triggerFlash` alongside the existing `pushPopup` calls**

In `handleGuessResult`, right after `pushPopup(dmg, 'enemy')`, add:
```typescript
triggerFlash('enemy')
```

Right after `if (playerDmg > 0) pushPopup(playerDmg, 'player')`, add:
```typescript
if (playerDmg > 0) triggerFlash('player')
```

In `handleWordSolved`, right after `pushPopup(dmg, 'enemy')`, add:
```typescript
triggerFlash('enemy')
```

**Step 5: Apply flash class to sprite placeholders**

Update the player sprite placeholder (already modified in Task 2) to:
```tsx
<div
  className={`combat-view__player-sprite-placeholder${playerFlash ? ' flash-hit' : ''}`}
  aria-hidden="true"
>
  {popups.filter(p => p.target === 'player').map(p => (
    <span key={p.id} className={`damage-popup${p.heal ? ' damage-popup--heal' : ''}`}>
      {p.heal ? '+' : '-'}{p.value}
    </span>
  ))}
</div>
```

Update the enemy sprite placeholder (already modified in Task 2) to:
```tsx
<div
  className={`combat-view__enemy-sprite-placeholder${enemyFlash ? ' flash-hit' : ''}`}
  aria-hidden="true"
>
  {popups.filter(p => p.target === 'enemy').map(p => (
    <span key={p.id} className="damage-popup">
      -{p.value}
    </span>
  ))}
</div>
```

**Step 6: Run tests to confirm all pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests pass.

**Step 7: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "feat: hit flash animation on player and enemy sprites"
```

---

### Task 4: HowToPlayScreen component + App integration

**Files:**
- Create: `frontend/src/components/HowToPlayScreen.tsx`
- Create: `frontend/src/components/__tests__/HowToPlayScreen.test.tsx`
- Modify: `frontend/src/components/RunSetup.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`
- Modify: `frontend/src/index.css`

**Step 1: Write failing tests for `HowToPlayScreen`**

Create `frontend/src/components/__tests__/HowToPlayScreen.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import HowToPlayScreen from '../HowToPlayScreen'

describe('HowToPlayScreen', () => {
  it('renders all five sections', () => {
    render(<HowToPlayScreen onDone={vi.fn()} />)
    expect(screen.getByText(/the goal/i)).toBeInTheDocument()
    expect(screen.getByText(/combat/i)).toBeInTheDocument()
    expect(screen.getByText(/room types/i)).toBeInTheDocument()
    expect(screen.getByText(/classes/i)).toBeInTheDocument()
    expect(screen.getByText(/artifacts/i)).toBeInTheDocument()
  })

  it('calls onDone when Got it button is clicked', async () => {
    const onDone = vi.fn()
    render(<HowToPlayScreen onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Write failing App tests**

Add to `frontend/src/components/__tests__/App.test.tsx` inside the existing `describe` block:

```typescript
describe('HowToPlayScreen', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shows HowToPlayScreen on first visit (no localStorage key)', () => {
    render(<App />)
    expect(screen.getByText(/the goal/i)).toBeInTheDocument()
    expect(screen.queryByText(/choose your class/i)).not.toBeInTheDocument()
  })

  it('skips HowToPlayScreen on repeat visit (key present)', () => {
    localStorage.setItem('hangman_seen_howto', '1')
    render(<App />)
    expect(screen.queryByText(/the goal/i)).not.toBeInTheDocument()
    expect(screen.getByText(/choose your class/i)).toBeInTheDocument()
  })

  it('clicking Got it shows class selection and sets localStorage key', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.getByText(/choose your class/i)).toBeInTheDocument()
    expect(localStorage.getItem('hangman_seen_howto')).toBe('1')
  })

  it('How to play button on RunSetup navigates back to HowToPlayScreen', async () => {
    localStorage.setItem('hangman_seen_howto', '1')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /how to play/i }))
    expect(screen.getByText(/the goal/i)).toBeInTheDocument()
  })
})
```

**Step 3: Run the new tests to confirm they fail**

```bash
cd frontend && npm test -- --run
```
Expected: 6 new tests fail (2 HowToPlayScreen + 4 App).

**Step 4: Create `HowToPlayScreen.tsx`**

Create `frontend/src/components/HowToPlayScreen.tsx`:

```tsx
interface Props {
  onDone: () => void
}

export default function HowToPlayScreen({ onDone }: Props) {
  return (
    <div className="how-to-play-screen">
      <h1 className="how-to-play-screen__title">How to Play</h1>

      <section className="how-to-play-screen__section">
        <h2>🎯 The Goal</h2>
        <p>Survive 3 floors and defeat the boss on each to win the run. Your HP carries between every room.</p>
      </section>

      <section className="how-to-play-screen__section">
        <h2>⚔️ Combat</h2>
        <p>Guess letters to reveal the hidden word and deal damage to the enemy. Wrong guesses cost you HP. Solve the word (by guessing all letters or typing it in the box) to end the fight.</p>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🗺️ Room Types</h2>
        <ul className="how-to-play-screen__list">
          <li>⚔️ <strong>Enemy</strong> — fight a monster for coins</li>
          <li>💀 <strong>Boss</strong> — harder fight, bigger coin reward, ends the floor</li>
          <li>🛏 <strong>Rest</strong> — spend 10 coins to restore 5 HP</li>
          <li>💎 <strong>Treasure</strong> — choose a free reward</li>
          <li>🪙 <strong>Shop</strong> — buy artifacts with your coins</li>
        </ul>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🧙 Classes</h2>
        <ul className="how-to-play-screen__list">
          <li>🧙 <strong>Vowel Mage</strong> — vowels deal bonus damage; ability reveals all instances of a chosen vowel</li>
          <li>📚 <strong>Archivist</strong> — sees category, first letter, and word length; ability reveals or eliminates letters</li>
          <li>🪓 <strong>Berserker</strong> — builds Rage on wrong guesses for bigger hits; ability bets on a blind guess for double damage</li>
          <li>🗡️ <strong>Rogue</strong> — builds a damage Combo on consecutive correct guesses; ability doubles combo damage and reveals a letter</li>
        </ul>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🎒 Artifacts</h2>
        <p>Found in treasure rooms and shops. Each artifact gives a passive bonus for the rest of the run. Hover or tap any artifact icon to see what it does.</p>
      </section>

      <button className="btn-how-to-play-done" onClick={onDone}>
        Got it →
      </button>
    </div>
  )
}
```

**Step 5: Add CSS for `HowToPlayScreen` to `index.css`**

Append to the end of `frontend/src/index.css`:

```css
/* ── HowToPlayScreen ─────────────────────────────────────── */

.how-to-play-screen {
  max-width: 560px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.how-to-play-screen__title {
  text-align: center;
  font-size: 1.8rem;
  margin: 0;
}

.how-to-play-screen__section h2 {
  font-size: 1.05rem;
  margin: 0 0 0.4rem;
  color: var(--accent);
}

.how-to-play-screen__section p,
.how-to-play-screen__section ul {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.6;
}

.how-to-play-screen__list {
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.btn-how-to-play-done {
  align-self: center;
  padding: 0.65rem 2rem;
  background: var(--accent);
  color: #1c1a16;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition: background 0.15s, transform 0.1s;
}

.btn-how-to-play-done:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
```

**Step 6: Update `RunSetup.tsx`**

The current RunSetup has its own inline `showHelp` state and a "How to play" toggle. Replace it with a prop-based callback:

Change the `Props` interface from:
```typescript
interface Props {
  onStart: (className: ClassName) => void
  score: RunScore
  onReset: () => void
}
```
to:
```typescript
interface Props {
  onStart: (className: ClassName) => void
  score: RunScore
  onReset: () => void
  onShowHelp: () => void
}
```

Change the function signature from:
```typescript
export default function RunSetup({ onStart, score, onReset }: Props) {
  const [selected, setSelected] = useState<ClassName | null>(null)
  const [showHelp, setShowHelp] = useState(false)
```
to:
```typescript
export default function RunSetup({ onStart, score, onReset, onShowHelp }: Props) {
  const [selected, setSelected] = useState<ClassName | null>(null)
```

Replace the entire "How to play" button + inline help block:
```tsx
      <button
        className="btn-how-to-play"
        onClick={() => setShowHelp(v => !v)}
      >
        How to play {showHelp ? '▴' : '▾'}
      </button>

      {showHelp && (
        <div className="how-to-play">
          <p><strong>Run structure:</strong> 3 floors, 12 rooms each</p>
          <p><strong>Room types:</strong> enemy, boss, rest area, treasure</p>
          <p><strong>Combat:</strong> correct guesses damage the enemy; wrong guesses damage you</p>
          <p><strong>Win:</strong> reduce enemy HP to 0 or solve the word</p>
          <p><strong>Lose:</strong> your HP reaches 0</p>
        </div>
      )}
```
with:
```tsx
      <button className="btn-how-to-play" onClick={onShowHelp}>
        How to play ?
      </button>
```

**Step 7: Update `App.tsx`**

Add `'how_to_play'` to the `AppPhase` type:
```typescript
type AppPhase = 'how_to_play' | 'idle' | 'floor_intro' | 'combat' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'
```

Change the `phase` initial state from:
```typescript
const [phase, setPhase] = useState<AppPhase>('idle')
```
to:
```typescript
const [phase, setPhase] = useState<AppPhase>(() =>
  localStorage.getItem('hangman_seen_howto') ? 'idle' : 'how_to_play'
)
```

Add an import for `HowToPlayScreen` at the top alongside the other component imports:
```typescript
import HowToPlayScreen from './components/HowToPlayScreen'
```

Add the handler function (near the other handlers):
```typescript
function handleHowToPlayDone() {
  localStorage.setItem('hangman_seen_howto', '1')
  setPhase('idle')
}
```

In the JSX return, add the `how_to_play` phase before the `idle` phase render. Find the block that renders `RunSetup` (when `phase === 'idle'`) and add a `HowToPlayScreen` guard before it, and pass `onShowHelp` to RunSetup:

```tsx
{phase === 'how_to_play' && (
  <HowToPlayScreen onDone={handleHowToPlayDone} />
)}
{phase === 'idle' && (
  <RunSetup
    onStart={handleStartRun}
    score={score}
    onReset={handleReset}
    onShowHelp={() => setPhase('how_to_play')}
  />
)}
```

**Note:** The existing `phase === 'idle'` render already exists — you're splitting it into two blocks and adding the `onShowHelp` prop. Remove the old single `phase === 'idle'` block and replace with the two blocks above.

**Step 8: Run tests to confirm all pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests pass (6 new + all existing).

**Step 9: Commit**

```bash
git add frontend/src/components/HowToPlayScreen.tsx \
        frontend/src/components/__tests__/HowToPlayScreen.test.tsx \
        frontend/src/components/RunSetup.tsx \
        frontend/src/App.tsx \
        frontend/src/components/__tests__/App.test.tsx \
        frontend/src/index.css
git commit -m "feat: HowToPlayScreen shown on first visit, accessible via ? button"
```
