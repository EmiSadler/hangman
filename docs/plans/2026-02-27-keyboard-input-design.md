# Keyboard Input — Design Document
_2026-02-27_

## Overview

Allow players to press a physical keyboard letter key to make a guess, as an alternative to clicking the on-screen QWERTY buttons.

---

## Decision

| Decision | Choice |
|---|---|
| Listener location | `GameBoard` component (`useEffect` on `window`) |
| Scope of change | Frontend only — `GameBoard.tsx` + one new test |

---

## Design

### `GameBoard.tsx`

A single `useEffect` attaches a `keydown` listener to `window` on mount and removes it on cleanup.

The listener ignores the event when:
- `isOver` — game is already won or lost
- `loading` — a network request is in flight
- `solvingMode` — the solve text input has focus and captures its own keys
- Key is not a single `a–z` letter (filters out digits, punctuation, modifier combos)
- Letter is already in `game.guessedLetters`

Otherwise, calls `handleGuess(letter)` — the same function triggered by clicking an on-screen key.

No backend changes. No new components. No new state. No CSS changes.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/GameBoard.tsx` | Add `useEffect` keydown listener |
| `frontend/src/components/__tests__/GameBoard.test.tsx` | One new test: keydown triggers guess |
