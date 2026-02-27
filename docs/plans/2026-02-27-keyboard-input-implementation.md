# Keyboard Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let players press a physical keyboard letter key to make a guess, as an alternative to clicking the on-screen buttons.

**Architecture:** A single `useEffect` in `GameBoard` attaches a `keydown` listener to `window`. The listener validates the key and delegates to the existing `handleGuess` function — no new logic, no backend changes, no new state.

**Tech Stack:** React 19, TypeScript, vitest, @testing-library/react

---

## Task 1: Keyboard input in GameBoard

**Files:**
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/components/__tests__/GameBoard.test.tsx`

**Step 1: Add a failing test**

In `frontend/src/components/__tests__/GameBoard.test.tsx`:

1a. Add `fireEvent` to the existing import on line 1:
```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
```

1b. Append this test inside the `describe('GameBoard', ...)` block, after the last existing test:
```tsx
  it('triggers a guess when a letter key is pressed', async () => {
    const guessResponse = {
      correct: false,
      masked_word: '_ _ _',
      wrong_guesses_left: 5,
      guessed_letters: ['a'],
      status: 'in_progress',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => guessResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)

    fireEvent.keyDown(window, { key: 'a' })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/game/test-id/guess`,
        expect.objectContaining({
          body: JSON.stringify({ letter: 'a' }),
        })
      )
    })
  })
```

**Step 2: Run new test to verify it fails**

```bash
cd /Users/emily/Code/hangman/frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "triggers a guess"
```

Expected: test FAILS (fetch not called — listener doesn't exist yet)

**Step 3: Implement — add `useEffect` to `GameBoard.tsx`**

Change line 1 from:
```tsx
import { useState } from 'react'
```
to:
```tsx
import { useState, useEffect } from 'react'
```

Then add this `useEffect` directly before the `const isOver = ...` line (currently line 97):

```tsx
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOver || loading || solvingMode) return
      const letter = e.key.toLowerCase()
      if (letter.length !== 1 || !/^[a-z]$/.test(letter)) return
      if (game.guessedLetters.includes(letter)) return
      handleGuess(letter)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOver, loading, solvingMode, game.guessedLetters, handleGuess])
```

**Step 4: Run ALL frontend tests**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **33 passed** (32 existing + 1 new). If any existing test breaks, read the failure carefully — you may have introduced a stale-closure issue or a missing dependency in the effect.

**Step 5: Commit**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/GameBoard.tsx \
        frontend/src/components/__tests__/GameBoard.test.tsx
git commit -m "feat: physical keyboard input triggers letter guess"
```

---

## Final check

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **33 passed**.

Manual smoke test (requires backend running):
1. Start a game
2. Press any unguessed letter key — the corresponding on-screen key should highlight and the word/count should update
3. Press the same key again — nothing happens (already guessed)
4. Click "Solve Puzzle" — pressing letter keys should type into the solve input, not trigger guesses
