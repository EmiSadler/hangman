# Heal Action & Solve Input Design

## Goal

Add two new combat mechanics to make encounters feel more decision-rich:

1. **Heal action** — player can heal +5 HP per use, but each heal randomly blocks one unguessed letter from the keyboard.
2. **Solve input** — player can type the full word at any time to win instantly; a wrong attempt costs 5 HP.

Together these create a meaningful risk/reward loop: healing is always available but degrades the puzzle, and the solve input provides an escape hatch when blocked letters pile up.

## Heal Action

A "🩹 Heal" button sits in the combat UI alongside the class ability button.

**Each press:**
- Player gains +5 HP, capped at `maxHp`
- One random letter is chosen from the *unguessed, unblocked* pool and added to `blockedLetters`
- Blocked letters appear greyed/crossed-out on the keyboard and cannot be clicked to guess

**Constraints:**
- Disabled when combat is over (`combatDone`)
- Disabled when player HP is already at `maxHp`
- Blocked letters are drawn only from letters not yet guessed (correct or wrong) and not already blocked

**Balance:** Because blocked letters are random from the unguessed pool, they may or may not be letters in the word. Repeated healing can make individual letter guessing impossible — but the solve input always remains available as an escape hatch.

## Solve Input

A text field + submit button below the keyboard. Available at any time during active combat.

**On correct submission:**
- Triggers `onWordSolved` — combat ends as a win, same as solving normally

**On wrong submission:**
- Player takes 5 HP damage (matches the heal amount — symmetric risk)
- Input clears, player can try again

**Key property:** The solve input works regardless of which letters are blocked. A player who healed aggressively can still win by typing the word directly, so the game is never truly unwinnable.

**Backend:** `POST /api/game/<id>/solve` already exists and handles this — frontend only.

## Architecture

All changes are frontend-only. No new files.

### `CombatView.tsx`

- Add `blockedLetters: string[]` state (starts `[]`)
- Add `handleHeal()`:
  - Builds pool of letters a–z minus already-guessed letters minus already-blocked letters
  - Picks one at random
  - Adds to `blockedLetters`
  - Increments `displayRun.hp` by 5 (capped at `displayRun.maxHp`)
- Add heal button to JSX (disabled when `combatDone` or HP full)
- Pass `blockedLetters` to `GameBoard` as new prop

### `GameBoard.tsx`

- Accept `blockedLetters: string[]` prop (default `[]` for backwards compatibility)
- Pass `blockedLetters` to `Keyboard`
- Re-add solve text input:
  - Controlled input + submit button
  - On submit: call `POST /api/game/<id>/solve`
  - Correct → call `onWordSolved()`
  - Wrong → call `onGuessResult(letter='', correct=false, occurrences=0)` with a synthetic 5 HP penalty (or a dedicated `onWrongSolve` callback)
- Solve input hidden when `combatOver`

### `Keyboard.tsx`

- Accept `blockedLetters: string[]` prop (default `[]`)
- Blocked letters render with `keyboard__key--blocked` class and `disabled={true}`
- Visually distinct from wrong-guess keys (different colour/style)

### `index.css`

- `.keyboard__key--blocked` — visually distinct from wrong-guess keys (e.g. strikethrough or muted colour with an ✕ indicator)
- Solve input + button styles
- Heal button styles (consistent with ability button)

## Files Touched

| File | Change |
|---|---|
| `frontend/src/components/CombatView.tsx` | `blockedLetters` state, `handleHeal()`, heal button, pass prop to GameBoard |
| `frontend/src/components/GameBoard.tsx` | `blockedLetters` prop, solve text input + submit |
| `frontend/src/components/Keyboard.tsx` | `blockedLetters` prop, blocked key rendering |
| `frontend/src/index.css` | blocked key style, solve input style, heal button style |
