# Solve Puzzle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Solve Puzzle" button that lets the player guess the entire word at once; a wrong guess costs one wrong guess and potentially ends the game.

**Architecture:** New `solve_word()` pure function in `game.py` + new `POST /api/game/<id>/solve` route mirrors the existing letter-guess pattern exactly. Frontend adds `solvingMode` state to `GameBoard` — when active, the keyboard is replaced by a text input + Submit/Cancel.

**Tech Stack:** Python 3 / Flask (backend), React 19 / TypeScript (frontend), pytest, vitest + @testing-library/react

---

## Task 1: `solve_word()` in `game.py`

**Files:**
- Modify: `backend/game.py`
- Modify: `backend/tests/test_game.py`

**Step 1: Add `solve_word` to the import line in `test_game.py`**

Change line 2 of `backend/tests/test_game.py` from:
```python
from game import load_words, select_word, new_game, mask_word, make_guess
```
to:
```python
from game import load_words, select_word, new_game, mask_word, make_guess, solve_word
```

**Step 2: Append these failing tests to `backend/tests/test_game.py`**

```python
# --- solve_word ---

def test_solve_word_correct_wins():
    game = new_game("easy")
    game["word"] = "cat"
    result = solve_word(game, "cat")
    assert result["correct"] is True
    assert result["status"] == "won"

def test_solve_word_correct_reveals_masked_word():
    game = new_game("easy")
    game["word"] = "cat"
    result = solve_word(game, "cat")
    assert result["masked_word"] == "c a t"

def test_solve_word_wrong_decrements():
    game = new_game("easy")
    game["word"] = "cat"
    result = solve_word(game, "dog")
    assert result["correct"] is False
    assert result["wrong_guesses_left"] == game["max_wrong"] - 1
    assert result["status"] == "in_progress"

def test_solve_word_wrong_causes_loss():
    game = new_game("hard")  # max_wrong == 4
    game["word"] = "cat"
    game["wrong_count"] = 3   # one guess left
    result = solve_word(game, "dog")
    assert result["status"] == "lost"
    assert result["word"] == "cat"

def test_solve_word_case_insensitive():
    game = new_game("easy")
    game["word"] = "cat"
    result = solve_word(game, "CAT")
    assert result["correct"] is True

def test_solve_word_game_over_raises():
    game = new_game("easy")
    game["word"] = "cat"
    game["status"] = "won"
    with pytest.raises(ValueError, match="already over"):
        solve_word(game, "cat")

def test_solve_word_empty_raises():
    game = new_game("easy")
    game["word"] = "cat"
    with pytest.raises(ValueError, match="non-empty"):
        solve_word(game, "")

def test_solve_word_whitespace_only_raises():
    game = new_game("easy")
    game["word"] = "cat"
    with pytest.raises(ValueError, match="non-empty"):
        solve_word(game, "   ")
```

**Step 3: Run the new tests to verify they fail**

```bash
cd /Users/emily/Code/hangman/backend && source venv/bin/activate && python -m pytest tests/test_game.py -k "solve_word" -v
```

Expected: all 8 new tests FAIL with `ImportError: cannot import name 'solve_word'`

**Step 4: Add `solve_word` to `backend/game.py`**

Append after the `make_guess` function (end of file):

```python
def solve_word(game: dict, word: str) -> dict:
    if game["status"] != "in_progress":
        raise ValueError("Game is already over")
    word = word.strip().lower()
    if not word:
        raise ValueError("Guess must be a non-empty word")

    correct = word == game["word"]
    if correct:
        game["status"] = "won"
    else:
        game["wrong_count"] += 1
        if game["wrong_count"] >= game["max_wrong"]:
            game["status"] = "lost"

    # On a correct solve reveal the full word; otherwise show current masked state
    masked = " ".join(game["word"]) if correct else mask_word(game["word"], game["guessed_letters"])
    return {
        "correct": correct,
        "masked_word": masked,
        "wrong_guesses_left": game["max_wrong"] - game["wrong_count"],
        "guessed_letters": list(game["guessed_letters"]),
        "status": game["status"],
        "word": game["word"] if game["status"] == "lost" else None,
    }
```

**Step 5: Run all backend tests**

```bash
cd /Users/emily/Code/hangman/backend && python -m pytest tests/ -v
```

Expected: **44 passed** (36 existing + 8 new)

**Step 6: Commit**

```bash
cd /Users/emily/Code/hangman
git add backend/game.py backend/tests/test_game.py
git commit -m "feat: add solve_word() to game logic"
```

---

## Task 2: `POST /api/game/<id>/solve` route

**Files:**
- Modify: `backend/app.py`
- Modify: `backend/tests/test_routes.py`

**Step 1: Append failing route tests to `backend/tests/test_routes.py`**

```python
# --- POST /api/game/<game_id>/solve ---

def test_solve_correct_wins(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert data["status"] == "won"

def test_solve_wrong_decrements(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 7   # easy max_wrong=8, minus 1

def test_solve_wrong_causes_loss(client):
    resp = client.post("/api/game", json={"difficulty": "hard"})  # max_wrong=4
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["wrong_count"] = 3        # one guess left

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    data = resp.get_json()
    assert data["status"] == "lost"
    assert data["word"] == "cat"

def test_solve_unknown_game_returns_404(client):
    resp = client.post("/api/game/nonexistent-id/solve", json={"word": "cat"})
    assert resp.status_code == 404

def test_solve_after_game_over_returns_400(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["status"] = "won"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 400

def test_solve_missing_word_returns_400(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]

    resp = client.post(f"/api/game/{game_id}/solve", json={})
    assert resp.status_code == 400
```

**Step 2: Run new route tests to verify they fail**

```bash
cd /Users/emily/Code/hangman/backend && python -m pytest tests/test_routes.py -k "solve" -v
```

Expected: all 6 new tests FAIL with 404 (route doesn't exist yet)

**Step 3: Add `solve_word` to the import and add the route in `backend/app.py`**

Change line 4 from:
```python
from game import new_game, make_guess, mask_word
```
to:
```python
from game import new_game, make_guess, mask_word, solve_word
```

Then append this route after the `guess` route (before `if __name__ == "__main__":`):

```python
@app.route("/api/game/<game_id>/solve", methods=["POST"])
def solve(game_id: str):
    game = games.get(game_id)
    if game is None:
        return jsonify({"error": "game not found"}), 404

    data = request.get_json(silent=True) or {}
    word = data.get("word", "")

    try:
        result = solve_word(game, word)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(result)
```

**Step 4: Run all backend tests**

```bash
cd /Users/emily/Code/hangman/backend && python -m pytest tests/ -v
```

Expected: **50 passed** (44 from Task 1 + 6 new route tests)

**Step 5: Commit**

```bash
cd /Users/emily/Code/hangman
git add backend/app.py backend/tests/test_routes.py
git commit -m "feat: add POST /api/game/<id>/solve route"
```

---

## Task 3: Frontend — GameBoard solve UI + CSS

**Files:**
- Modify: `frontend/src/components/GameBoard.tsx`
- Modify: `frontend/src/components/__tests__/GameBoard.test.tsx`
- Modify: `frontend/src/index.css`

**Step 1: Append failing tests to `frontend/src/components/__tests__/GameBoard.test.tsx`**

Add inside the `describe('GameBoard', ...)` block, after the existing tests:

```tsx
  it('renders Solve Puzzle button when game is in progress', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByRole('button', { name: /solve puzzle/i })).toBeInTheDocument()
  })

  it('shows solve input and hides keyboard when Solve Puzzle is clicked', async () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    expect(screen.getByPlaceholderText(/type the word/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument()
  })

  it('returns to keyboard view when Cancel is clicked', async () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/type the word/i)).not.toBeInTheDocument()
  })

  it('calls /solve endpoint and transitions to won on correct guess', async () => {
    const onGameEnd = vi.fn()
    const solveResponse = {
      correct: true,
      masked_word: 'c a t',
      wrong_guesses_left: 6,
      guessed_letters: [],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => solveResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={onGameEnd} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    await userEvent.type(screen.getByPlaceholderText(/type the word/i), 'cat')
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(onGameEnd).toHaveBeenCalledWith('won')
    })
  })
```

**Step 2: Run the new tests to verify they fail**

```bash
cd /Users/emily/Code/hangman/frontend && npm test -- --reporter=verbose 2>&1 | grep -A2 "solve\|Solve"
```

Expected: 4 new tests FAIL (button/input not found)

**Step 3: Replace `frontend/src/components/GameBoard.tsx` with:**

```tsx
import { useState } from 'react'
import type { GameState, GameStatus } from '../types'
import HangmanSvg from './HangmanSvg'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGameEnd: (result: 'won' | 'lost') => void
  onPlayAgain: () => void
}

export default function GameBoard({ initialState, onGameEnd, onPlayAgain }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctLetters, setCorrectLetters] = useState<string[]>([])
  const [solvingMode, setSolvingMode] = useState(false)
  const [solveInput, setSolveInput] = useState('')

  const wrongCount = game.maxWrong - game.wrongGuessesLeft

  async function handleGuess(letter: string) {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${game.gameId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      const updated: GameState = {
        ...game,
        maskedWord: data.masked_word,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
        word: data.word ?? undefined,
      }
      if (data.correct) {
        setCorrectLetters((prev) => [...prev, letter])
      }
      setGame(updated)
      if (updated.status === 'won' || updated.status === 'lost') {
        onGameEnd(updated.status)
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleSolve() {
    const word = solveInput.trim()
    if (!word) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${game.gameId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      const updated: GameState = {
        ...game,
        maskedWord: data.masked_word,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
        word: data.word ?? undefined,
      }
      setGame(updated)
      setSolvingMode(false)
      setSolveInput('')
      if (updated.status === 'won' || updated.status === 'lost') {
        onGameEnd(updated.status)
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }

  const isOver = game.status !== 'in_progress'

  return (
    <div className="game-board">
      <HangmanSvg wrongCount={wrongCount} />
      <WordDisplay maskedWord={game.maskedWord} />
      <p className="wrong-count">
        {game.wrongGuessesLeft} guess{game.wrongGuessesLeft !== 1 ? 'es' : ''} remaining
      </p>
      {error && <p className="app__error">{error}</p>}
      {!isOver && (
        solvingMode ? (
          <div className="solve-form">
            <input
              autoFocus
              type="text"
              className="solve-input"
              value={solveInput}
              onChange={(e) => setSolveInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSolve()}
              placeholder="Type the word..."
              disabled={loading}
            />
            <div className="solve-form__actions">
              <button
                className="btn-difficulty"
                onClick={handleSolve}
                disabled={loading || !solveInput.trim()}
              >
                Submit
              </button>
              <button
                className="btn-cancel"
                onClick={() => { setSolvingMode(false); setSolveInput('') }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <Keyboard
              guessedLetters={game.guessedLetters}
              correctLetters={correctLetters}
              onGuess={handleGuess}
              disabled={loading}
            />
            <button className="btn-solve" onClick={() => setSolvingMode(true)}>
              Solve Puzzle
            </button>
          </>
        )
      )}
      {isOver && (
        <GameResult
          status={game.status}
          word={game.word ?? game.maskedWord.replace(/ /g, '')}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  )
}
```

**Step 4: Append to `frontend/src/index.css`:**

```css
/* ── Solve form ────────────────────────────────────────── */

.btn-solve {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.4rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
  margin-top: 0.5rem;
}

.btn-solve:hover {
  background: var(--surface);
  color: var(--text);
}

.solve-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
}

.solve-input {
  font-family: 'Courier New', Courier, monospace;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--accent);
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  outline: none;
  transition: border-color 0.15s;
}

.solve-input:focus {
  border-color: var(--accent);
}

.solve-form__actions {
  display: flex;
  gap: 0.75rem;
}

.btn-cancel {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.6rem 1.8rem;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.15s;
}

.btn-cancel:hover {
  background: var(--surface);
}
```

**Step 5: Run all frontend tests**

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **32 passed** (28 existing + 4 new)

**Step 6: Commit**

```bash
cd /Users/emily/Code/hangman
git add frontend/src/components/GameBoard.tsx \
        frontend/src/components/__tests__/GameBoard.test.tsx \
        frontend/src/index.css
git commit -m "feat: add Solve Puzzle UI to GameBoard"
```

---

## Final check

Run both test suites one last time:

```bash
cd /Users/emily/Code/hangman/backend && python -m pytest tests/ -q
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **50 backend passed**, **32 frontend passed**.
