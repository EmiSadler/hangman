# Solve Puzzle — Design Document
_2026-02-27_

## Overview

Add a "Solve Puzzle" button to the game board that lets the player guess the entire word at once. A wrong word guess costs one wrong guess (same penalty as a wrong letter). A correct guess wins the game immediately.

---

## Decision

| Decision | Choice |
|---|---|
| Logic location | Server-side (new backend endpoint) |
| Wrong guess penalty | Costs one wrong guess; if that hits the limit the game is lost |
| UI pattern | Inline solve input replaces keyboard while active |

---

## Backend

### New function — `game.py`: `solve_word(game, word)`

- Raises `ValueError("Game is already over")` if `game["status"] != "in_progress"`
- Normalises input to lowercase and strips whitespace
- Raises `ValueError("Guess must be a non-empty word")` if blank
- Correct match (`word == game["word"]`): sets `game["status"] = "won"`
- Wrong match: increments `game["wrong_count"]` by 1; if `wrong_count >= max_wrong` sets `game["status"] = "lost"`
- Returns same shape as `make_guess`: `{correct, masked_word, wrong_guesses_left, guessed_letters, status, word}`
  - `word` is revealed only when `status == "lost"` (same rule as letter guesses)

### New route — `app.py`: `POST /api/game/<id>/solve`

- Accepts `{"word": "..."}` JSON body
- Calls `solve_word()`, returns its result
- Same error handling pattern as `/guess` (404 if game not found, 400 for ValueError)

---

## Frontend

### State change in `GameBoard.tsx`

New boolean state: `solvingMode` (default `false`).

### UI behaviour

| State | What renders |
|---|---|
| `solvingMode = false`, game in progress | Keyboard + "Solve Puzzle" button below it |
| `solvingMode = true` | Solve input (auto-focused) + Submit + Cancel; keyboard hidden |
| Game over | Neither keyboard nor solve UI (existing behaviour) |

### Solve flow

1. Player clicks "Solve Puzzle" → `solvingMode = true`
2. Player types word, clicks Submit (or presses Enter)
3. Frontend calls `POST /api/game/<id>/solve` with `{"word": input}`
4. Correct → game transitions to won, `GameResult` appears
5. Wrong → `solvingMode = false`, keyboard reappears, wrong count updated; if game now lost, `GameResult` appears

### Styling

- "Solve Puzzle" button: existing `btn-difficulty` pill class
- Solve input: plain `<input type="text">` styled with `--surface` background, `--border` border, `--accent` focus ring — no new design tokens
- Submit button: `btn-difficulty` pill class
- Cancel button: subdued style using `--text-muted` colour and `--border` border

---

## Files Changed

| File | Change |
|---|---|
| `backend/game.py` | Add `solve_word()` function |
| `backend/app.py` | Add `POST /api/game/<id>/solve` route |
| `backend/tests/test_game.py` | Tests for `solve_word()` |
| `backend/tests/test_routes.py` | Tests for the new route |
| `frontend/src/components/GameBoard.tsx` | `solvingMode` state, solve UI, `handleSolve()` |
| `frontend/src/index.css` | Solve input styles |

No new dependencies. No changes to TypeScript types.
