# Remove Difficulty — Design Document
_2026-02-28_

## Overview

Remove the difficulty level system. Every game picks from the full word pool and allows exactly 6 wrong guesses (head, body, 2 arms, 2 legs). The start screen becomes a title + single "Play" button.

---

## Decision

| Decision | Choice |
|---|---|
| Word selection | Pick randomly from all 80 words (no length filter) |
| Wrong guesses allowed | Always 6 |
| Start screen | Title + single "Play" button |
| `Difficulty` type | Deleted |

---

## Design

### Backend

**`game.py`**
- `select_word()` — remove `difficulty` parameter; pick from all words.
- `new_game()` — remove `difficulty` parameter; hardcode `max_wrong = 6`.

**`app.py`**
- `POST /api/game` — no longer reads or validates `difficulty` from the request body.

### Frontend

**`types.ts`**
- Remove `Difficulty` type.

**`GameSetup.tsx`**
- Replace three difficulty buttons with a single "Play" button.
- `onStart` prop: `() => void` (no argument).

**`App.tsx`**
- `handleStart` takes no arguments; fetch body no longer includes `difficulty`.

### No changes needed

`HangmanSvg`, `GameBoard`, `WordDisplay`, `Keyboard`, `GameResult`, `index.css`, score persistence — none of these depend on difficulty.

---

## Files Changed

| File | Change |
|---|---|
| `backend/game.py` | Remove `difficulty` param from `select_word` and `new_game` |
| `backend/app.py` | Remove difficulty validation from `POST /api/game` |
| `backend/tests/test_game.py` | Update tests for `select_word` and `new_game` |
| `backend/tests/test_routes.py` | Update tests for `POST /api/game` |
| `frontend/src/types.ts` | Remove `Difficulty` type |
| `frontend/src/components/GameSetup.tsx` | Single "Play" button, `onStart: () => void` |
| `frontend/src/components/__tests__/GameSetup.test.tsx` | Update for new UI |
| `frontend/src/App.tsx` | `handleStart` takes no args, no difficulty in fetch |
| `frontend/src/components/__tests__/App.test.tsx` | Update for no-difficulty start flow |
