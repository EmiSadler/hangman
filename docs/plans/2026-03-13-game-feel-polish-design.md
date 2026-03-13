# Game Feel + Polish Design

## Goal

Add combat feedback (floating damage numbers + hit flash) and a How to Play screen to make the game more readable and accessible.

## Architecture

Two independent features, both purely additive — no backend changes, no existing API changes.

---

## Feature 1: Damage Feedback

### Floating damage numbers

**State** — CombatView gains `popups: DamagePopup[]` where:

```ts
interface DamagePopup {
  id: number
  value: number
  target: 'player' | 'enemy'
  heal?: boolean   // true → green + prefix, false → red
}
```

A popup is pushed whenever HP changes:
- Enemy takes damage → `{ value: dmg, target: 'enemy' }`
- Player takes damage → `{ value: dmg, target: 'player' }`
- Player heals → `{ value: amount, target: 'player', heal: true }`

A `useEffect` removes entries after 850 ms to keep the list clean.

**Rendering** — each popup renders as an absolutely-positioned `<span className="damage-popup">` (or `damage-popup--heal`) layered on top of its target's sprite box. A single `@keyframes float-up-fade` animates over 800 ms: translate Y from 0 → -30px, opacity 1 → 0.

### Hit flash

Two boolean states — `playerFlash` and `enemyFlash` — toggled on damage. When true, a `.flash-hit` class is added to the respective sprite placeholder. A `@keyframes flash-hit` pulses background-color transparent → red/orange → transparent over 400 ms. A `setTimeout` of 400 ms clears the boolean.

**Affected call sites in CombatView:**
- `handleGuessResult` — enemy damage and player damage already computed here; push popups and trigger flash
- `handleWordSolved` — hidden-letter solve damage; push enemy popup + flash
- `handleHeal` — push heal popup

### CSS

```css
@keyframes float-up-fade {
  0%   { transform: translateY(0);     opacity: 1; }
  100% { transform: translateY(-30px); opacity: 0; }
}

@keyframes flash-hit {
  0%   { background: transparent; }
  30%  { background: rgba(180, 40, 40, 0.45); }
  100% { background: transparent; }
}

.damage-popup {
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--wrong);
  pointer-events: none;
  animation: float-up-fade 0.8s ease-out forwards;
  z-index: 10;
}

.damage-popup--heal { color: var(--heal); }

.flash-hit {
  animation: flash-hit 0.4s ease-out forwards;
}
```

The sprite placeholder containers need `position: relative` so absolute popup children are positioned correctly.

### Testing

- Correct guess → enemy popup with correct damage value appears
- Wrong guess → player popup with damage value appears
- Heal → player popup with `+` prefix and green colour appears
- Popups are removed from DOM after ~850 ms

---

## Feature 2: How to Play Screen

### Component

`HowToPlayScreen.tsx` — props: `{ onDone: () => void }`.

Five sections:
1. **The Goal** — survive 3 floors, beat the boss on each to win the run
2. **Combat** — guess letters to reveal the word and deal damage; wrong guesses cost HP; HP carries between rooms
3. **Room Types** — ⚔️ Enemy, 🛏 Rest, 💎 Treasure, 🪙 Shop, 💀 Boss
4. **Classes** — one-liner for each of the four classes (reuses passive/active descriptions)
5. **Artifacts** — found in treasure rooms and shops; hover or tap to see what each one does

A "Got it →" button calls `onDone`.

Styled with the existing dark/gold theme (`--bg`, `--accent`, `--text`). Scrollable on mobile.

### App integration

- On mount, check `localStorage.getItem('hangman_seen_howto')`
- If absent → initial phase is `'how_to_play'` (new phase inserted before `'idle'`)
- `onDone` → `localStorage.setItem('hangman_seen_howto', '1')` + `setPhase('idle')`
- `RunSetup` gains a `?` button (top-right) that sets phase back to `'how_to_play'` so returning players can re-read without losing run state; `onDone` from there returns to `'idle'`

### localStorage key

`hangman_seen_howto`

### Testing

- Renders all five sections
- "Got it" calls `onDone`
- App shows screen on first visit (no key in localStorage)
- App skips screen on repeat visit (key present)
- `?` button on RunSetup navigates to the screen

---

## Tech Stack

- React 19 + TypeScript (existing)
- CSS keyframes (existing pattern)
- localStorage (existing pattern)
- No new dependencies
