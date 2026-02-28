# Score Persistence — Design Document
_2026-02-28_

## Overview

Persist the win/loss score across page refreshes using `localStorage`, and provide a "forget me" button to reset it.

---

## Decision

| Decision | Choice |
|---|---|
| Storage mechanism | `localStorage` |
| Storage key | `"hangman_score"` |
| Reset UI | "Forget me" button next to the score pill |

---

## Design

### Storage

Score is stored as JSON under the key `"hangman_score"`:

```json
{"wins": 3, "losses": 1}
```

### `App.tsx`

**On load:** Initialise `score` state by reading from `localStorage`. If the key is absent or the JSON is malformed, fall back to `{ wins: 0, losses: 0 }`.

**On score change:** After every `handleGameEnd` call, write the updated score to `localStorage`.

**"Forget me" button:** Resets score state to `{ wins: 0, losses: 0 }` and removes the `localStorage` key. Renders next to the score pill. No confirmation dialog.

### Error handling

`localStorage` reads are wrapped in a try/catch — malformed JSON silently falls back to zero. No other error handling needed.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Read localStorage on init, write on score change, add reset button |
| `frontend/src/components/__tests__/App.test.tsx` | Tests for persistence and reset |
