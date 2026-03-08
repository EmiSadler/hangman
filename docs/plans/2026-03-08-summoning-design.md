# Enemy Summoning Design

**Date:** 2026-03-08

## Problem

On higher floors, enemy HP scales as `wordLength × floor × 2`. Short words on later floors produce an enemy that cannot be killed through normal letter-guessing alone — the player solves the word but the enemy survives, and the game advances anyway. This feels anticlimactic and hollow.

## Solution

When a word is solved but the enemy still has HP remaining, the enemy **summons another word**. The fight continues with a fresh word until the enemy dies or the player does. This repeats as many times as needed.

---

## Trigger Condition

`handleWordSolved` in `CombatView.tsx` currently always calls `finishCombat(true)`. It changes to:

- If `currentEnemyHp > 0` → start summoning sequence
- If `currentEnemyHp <= 0` → call `finishCombat(true)` as before (enemy died from accumulated guess damage mid-word)

---

## Summoning Sequence

1. CombatView enters a `summoning` state — the word/keyboard display is replaced by a message
2. Simultaneously, a new word is fetched from the backend (`POST /api/game`, same `room_type`, no hint)
3. Message displayed: **"The enemy survives with X HP! They summon another word..."**
4. Player clicks **Continue** button to dismiss
5. On Continue: word state resets, new word appears, play resumes

The fetch happens in the background while the message is shown. By the time the player clicks Continue the word is ready — no loading state needed in the common case. If the fetch is still in flight when Continue is clicked, the button shows a brief loading state until it resolves.

---

## State Management

### Carries over to new word
- `currentEnemyHp` (same enemy, same HP)
- `displayRun.hp`, `displayRun.shield`, `displayRun.coins`
- `rage`, `combo`
- `cooldown`, `abilityMode`, `abilityUsesLeft`
- `bloodDaggerReady`

### Resets for new word
- `currentGame` (new `GameState` from backend)
- `guessedLetters` → `[]`
- `hiddenCount` → derived from new word

---

## Internal Architecture

`currentGame: GameState` becomes a React state variable (starts as `initialState` prop). All word-display and keyboard logic reads from `currentGame` instead of `initialState` directly.

A new `summoning: boolean` state (or `summoningHp: number | null` to carry the HP value for the message) controls the summon screen.

---

## UI

The summoning screen replaces the word/keyboard area:

```
The enemy survives with 8 HP!
They summon another word...

[ Continue ]
```

Styled consistently with other area screens (centred, card-style). `Continue` button uses existing `.btn-leave` style.

---

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/components/CombatView.tsx` | `currentGame` state, `summoning` state, modified `handleWordSolved`, summoning JSX |
| `frontend/src/components/__tests__/CombatView.test.tsx` | New tests for summoning trigger and continue flow |
| `frontend/src/index.css` | `.summoning-screen` CSS block |
