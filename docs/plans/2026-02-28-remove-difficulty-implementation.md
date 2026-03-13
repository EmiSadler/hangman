# Remove Difficulty Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the difficulty level system so every game picks from all words and allows exactly 6 wrong guesses.

**Architecture:** Strip `difficulty` from backend (`game.py`, `app.py`) and frontend (`types.ts`, `GameSetup.tsx`, `App.tsx`). The start screen becomes a single "Play" button. No other components change — `HangmanSvg` already draws exactly 6 body parts.

**Tech Stack:** Python 3.11, Flask 3, pytest (backend); React 19, TypeScript, vitest, @testing-library/react (frontend)

---

## Task 1: Backend — remove difficulty

**Files:**
- Modify: `backend/game.py`
- Modify: `backend/tests/test_game.py`
- Modify: `backend/app.py`
- Modify: `backend/tests/test_routes.py`

---

### Step 1: Update `test_game.py` to match the new no-difficulty API

Replace the entire contents of `backend/tests/test_game.py` with:

```python
import pytest
from game import load_words, select_word, new_game, mask_word, make_guess, solve_word

# --- load_words ---

def test_load_words_returns_list():
    words = load_words()
    assert isinstance(words, list)
    assert len(words) > 0

def test_load_words_all_lowercase_alpha():
    for word in load_words():
        assert word.isalpha() and word == word.lower()

# --- select_word ---

def test_select_word_returns_a_word_from_the_list():
    word = select_word()
    assert isinstance(word, str)
    assert len(word) > 0
    assert word in load_words()

# --- mask_word ---

def test_mask_word_no_guesses():
    assert mask_word("cat", []) == "_ _ _"

def test_mask_word_partial():
    assert mask_word("cat", ["a"]) == "_ a _"

def test_mask_word_fully_revealed():
    assert mask_word("cat", ["c", "a", "t"]) == "c a t"

def test_mask_word_repeated_letters():
    assert mask_word("boot", ["o"]) == "_ o o _"

# --- new_game ---

def test_new_game_has_six_max_wrong():
    game = new_game()
    assert game["max_wrong"] == 6
    assert game["wrong_count"] == 0
    assert game["status"] == "in_progress"
    assert game["guessed_letters"] == []
    assert isinstance(game["word"], str)
    assert len(game["word"]) > 0

# --- make_guess ---

def test_make_guess_correct_letter():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["correct"] is True
    assert "a" in result["guessed_letters"]
    assert result["status"] == "in_progress"

def test_make_guess_wrong_letter():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "z")
    assert result["correct"] is False
    assert result["wrong_guesses_left"] == 5  # 6 - 1

def test_make_guess_duplicate_raises():
    game = new_game()
    game["word"] = "cat"
    make_guess(game, "a")
    with pytest.raises(ValueError, match="already guessed"):
        make_guess(game, "a")

def test_make_guess_non_letter_raises():
    game = new_game()
    game["word"] = "cat"
    with pytest.raises(ValueError, match="single letter"):
        make_guess(game, "1")

def test_make_guess_win():
    game = new_game()
    game["word"] = "cat"
    make_guess(game, "c")
    make_guess(game, "a")
    result = make_guess(game, "t")
    assert result["status"] == "won"

def test_make_guess_lose():
    game = new_game()
    game["word"] = "cat"
    for letter in ["z", "x", "q", "v", "j", "w"]:  # 6 wrong guesses
        result = make_guess(game, letter)
    assert result["status"] == "lost"
    assert result["word"] == "cat"

def test_make_guess_masked_word_updates():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["masked_word"] == "_ a _"

def test_make_guess_empty_string_raises():
    game = new_game()
    game["word"] = "cat"
    with pytest.raises(ValueError, match="single letter"):
        make_guess(game, "")

def test_make_guess_after_game_over_raises():
    game = new_game()
    game["word"] = "cat"
    for letter in ["z", "x", "q", "v", "j", "w"]:  # 6 wrong guesses
        make_guess(game, letter)
    assert game["status"] == "lost"
    with pytest.raises(ValueError, match="already over"):
        make_guess(game, "c")

# --- solve_word ---

def test_solve_word_correct_wins():
    game = new_game()
    game["word"] = "cat"
    result = solve_word(game, "cat")
    assert result["correct"] is True
    assert result["status"] == "won"

def test_solve_word_correct_reveals_masked_word():
    game = new_game()
    game["word"] = "cat"
    result = solve_word(game, "cat")
    assert result["masked_word"] == "c a t"

def test_solve_word_wrong_decrements():
    game = new_game()
    game["word"] = "cat"
    result = solve_word(game, "dog")
    assert result["correct"] is False
    assert result["wrong_guesses_left"] == 5  # 6 - 1
    assert result["status"] == "in_progress"

def test_solve_word_wrong_causes_loss():
    game = new_game()
    game["word"] = "cat"
    game["wrong_count"] = 5  # one guess left
    result = solve_word(game, "dog")
    assert result["status"] == "lost"
    assert result["word"] == "cat"

def test_solve_word_case_insensitive():
    game = new_game()
    game["word"] = "cat"
    result = solve_word(game, "CAT")
    assert result["correct"] is True

def test_solve_word_game_over_raises():
    game = new_game()
    game["word"] = "cat"
    game["status"] = "won"
    with pytest.raises(ValueError, match="already over"):
        solve_word(game, "cat")

def test_solve_word_empty_raises():
    game = new_game()
    game["word"] = "cat"
    with pytest.raises(ValueError, match="non-empty"):
        solve_word(game, "")

def test_solve_word_whitespace_only_raises():
    game = new_game()
    game["word"] = "cat"
    with pytest.raises(ValueError, match="non-empty"):
        solve_word(game, "   ")
```

---

### Step 2: Update `test_routes.py` to match the new no-difficulty API

Replace the entire contents of `backend/tests/test_routes.py` with:

```python
import json
import pytest
from app import app, games

@pytest.fixture
def client():
    app.config["TESTING"] = True
    games.clear()
    with app.test_client() as client:
        yield client
    games.clear()

# --- POST /api/game ---

def test_new_game_returns_game_id(client):
    resp = client.post("/api/game")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "game_id" in data

def test_new_game_returns_masked_word(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert "masked_word" in data
    assert "_" in data["masked_word"]

def test_new_game_max_wrong(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert data["max_wrong"] == 6
    assert data["wrong_guesses_left"] == 6

# --- POST /api/game/<game_id>/guess ---

def test_guess_correct_letter(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert "a" in data["guessed_letters"]

def test_guess_wrong_letter_decrements(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "z"})
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 5  # 6 - 1

def test_guess_duplicate_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 400

def test_guess_unknown_game_id_returns_404(client):
    resp = client.post("/api/game/nonexistent-id/guess", json={"letter": "a"})
    assert resp.status_code == 404

def test_guess_win_sets_status(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "hi"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "h"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "i"})
    assert resp.get_json()["status"] == "won"

def test_guess_after_game_over_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "hi"
    games[game_id]["status"] = "won"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 400

def test_guess_invalid_letter_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "123"})
    assert resp.status_code == 400

def test_guess_missing_letter_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]

    resp = client.post(f"/api/game/{game_id}/guess", json={})
    assert resp.status_code == 400

# --- POST /api/game/<game_id>/solve ---

def test_solve_correct_wins(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert data["status"] == "won"

def test_solve_wrong_decrements(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 5  # 6 - 1

def test_solve_wrong_causes_loss(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["wrong_count"] = 5  # one guess left

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    data = resp.get_json()
    assert data["status"] == "lost"
    assert data["word"] == "cat"

def test_solve_unknown_game_returns_404(client):
    resp = client.post("/api/game/nonexistent-id/solve", json={"word": "cat"})
    assert resp.status_code == 404

def test_solve_after_game_over_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["status"] = "won"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 400

def test_solve_missing_word_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]

    resp = client.post(f"/api/game/{game_id}/solve", json={})
    assert resp.status_code == 400
```

---

### Step 3: Run tests to verify they fail

```bash
cd /Users/emily/Code/hangman/backend && source venv/bin/activate && pytest tests/ -v 2>&1 | tail -20
```

Expected: multiple FAILURES — `select_word()` and `new_game()` called without the required `difficulty` arg, and `test_new_game_invalid_difficulty` / `test_new_game_missing_difficulty` no longer exist.

---

### Step 4: Update `game.py`

Replace the entire contents of `backend/game.py` with:

```python
import random
import os

_WORDS: list[str] | None = None

def load_words() -> list[str]:
    global _WORDS
    if _WORDS is None:
        words_path = os.path.join(os.path.dirname(__file__), "words.txt")
        with open(words_path) as f:
            _WORDS = [line.strip().lower() for line in f if line.strip().isalpha()]
    return _WORDS

def select_word() -> str:
    words = load_words()
    return random.choice(words)

def mask_word(word: str, guessed_letters: list[str]) -> str:
    return " ".join(c if c in guessed_letters else "_" for c in word)

def new_game() -> dict:
    word = select_word()
    return {
        "word": word,
        "guessed_letters": [],
        "max_wrong": 6,
        "wrong_count": 0,
        "status": "in_progress",
    }

def make_guess(game: dict, letter: str) -> dict:
    if game["status"] != "in_progress":
        raise ValueError("Game is already over")
    letter = letter.lower()
    if not (len(letter) == 1 and letter.isalpha()):
        raise ValueError("Guess must be a single letter")
    if letter in game["guessed_letters"]:
        raise ValueError(f"'{letter}' already guessed")

    game["guessed_letters"].append(letter)
    correct = letter in game["word"]
    if not correct:
        game["wrong_count"] += 1

    if all(c in game["guessed_letters"] for c in game["word"]):
        game["status"] = "won"
    elif game["wrong_count"] >= game["max_wrong"]:
        game["status"] = "lost"

    return {
        "correct": correct,
        "masked_word": mask_word(game["word"], game["guessed_letters"]),
        "wrong_guesses_left": game["max_wrong"] - game["wrong_count"],
        "guessed_letters": list(game["guessed_letters"]),
        "status": game["status"],
        "word": game["word"] if game["status"] == "lost" else None,
    }

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

---

### Step 5: Update `app.py`

Replace the entire contents of `backend/app.py` with:

```python
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS
from game import new_game, make_guess, mask_word, solve_word

app = Flask(__name__)
CORS(app)

# NOTE: games are never evicted from this dict (acceptable for a prototype,
# would need TTL or cleanup for production use).
games: dict[str, dict] = {}


@app.route("/")
def home():
    return jsonify({"message": "Hangman API running!"})


@app.route("/api/game", methods=["POST"])
def create_game():
    game_id = str(uuid.uuid4())
    game = new_game()
    games[game_id] = game

    return jsonify({
        "game_id": game_id,
        "masked_word": mask_word(game["word"], []),
        "max_wrong": game["max_wrong"],
        "wrong_guesses_left": game["max_wrong"],
        "guessed_letters": [],
    })


@app.route("/api/game/<game_id>/guess", methods=["POST"])
def guess(game_id: str):
    game = games.get(game_id)
    if game is None:
        return jsonify({"error": "game not found"}), 404

    data = request.get_json(silent=True) or {}
    letter = data.get("letter", "")

    try:
        result = make_guess(game, letter)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(result)


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


if __name__ == "__main__":
    app.run(debug=True, port=5001)
```

---

### Step 6: Run ALL backend tests

```bash
cd /Users/emily/Code/hangman/backend && source venv/bin/activate && pytest tests/ -v 2>&1 | tail -20
```

Expected: **44 passed** (was 50 — removed 6 difficulty-specific tests). If any test fails, read the error carefully before changing anything.

---

### Step 7: Commit

```bash
cd /Users/emily/Code/hangman
git add backend/game.py \
        backend/app.py \
        backend/tests/test_game.py \
        backend/tests/test_routes.py
git commit -m "feat: remove difficulty — single word pool, 6 wrong guesses"
```

---

## Task 2: Frontend — remove difficulty

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/GameSetup.tsx`
- Modify: `frontend/src/components/__tests__/GameSetup.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

---

### Step 1: Update frontend tests to match the new no-difficulty API

**Replace `frontend/src/components/__tests__/GameSetup.test.tsx` entirely:**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('renders a Play button', () => {
    render(<GameSetup onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('calls onStart when Play is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
```

**In `frontend/src/components/__tests__/App.test.tsx`**, make these three targeted edits:

1. Change `expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()` to:
   ```tsx
   expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
   ```

2. Change `await userEvent.click(screen.getByRole('button', { name: /easy/i }))` (in "switches to GameBoard") to:
   ```tsx
   await userEvent.click(screen.getByRole('button', { name: /play/i }))
   ```

3. Change `await userEvent.click(screen.getByRole('button', { name: /easy/i }))` (in "shows error when server is unreachable") to:
   ```tsx
   await userEvent.click(screen.getByRole('button', { name: /play/i }))
   ```

---

### Step 2: Run frontend tests to verify they fail

```bash
cd /Users/emily/Code/hangman/frontend && npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|✗|×|renders a Play|calls onStart|shows GameSetup"
```

Expected: the GameSetup tests fail (no "Play" button yet) and App tests that click `/easy/i` fail.

---

### Step 3: Update `types.ts`

Replace the entire contents of `frontend/src/types.ts` with:

```ts
export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface GameState {
  gameId: string
  maskedWord: string
  maxWrong: number
  wrongGuessesLeft: number
  guessedLetters: string[]
  status: GameStatus
  word?: string
}

export interface Score {
  wins: number
  losses: number
}
```

---

### Step 4: Update `GameSetup.tsx`

Replace the entire contents of `frontend/src/components/GameSetup.tsx` with:

```tsx
interface Props {
  onStart: () => void
}

export default function GameSetup({ onStart }: Props) {
  return (
    <div className="game-setup">
      <h1>Hangman</h1>
      <p className="game-setup__subtitle">Press Play to begin</p>
      <div className="game-setup__buttons">
        <button className="btn-difficulty" onClick={onStart}>
          Play
        </button>
      </div>
    </div>
  )
}
```

---

### Step 5: Update `App.tsx`

Replace the entire contents of `frontend/src/App.tsx` with:

```tsx
import { useState } from 'react'
import type { GameState, Score } from './types'
import GameSetup from './components/GameSetup'
import GameBoard from './components/GameBoard'
import './App.css'

const SCORE_KEY = 'hangman_score'

function loadScore(): Score {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { wins: 0, losses: 0 }
    return JSON.parse(raw) as Score
  } catch {
    return { wins: 0, losses: 0 }
  }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [score, setScore] = useState<Score>(loadScore)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setError(null)
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'Failed to start game')
        return
      }
      setGame({
        gameId: data.game_id,
        maskedWord: data.masked_word,
        maxWrong: data.max_wrong,
        wrongGuessesLeft: data.wrong_guesses_left,
        guessedLetters: data.guessed_letters,
        status: 'in_progress',
      })
    } catch {
      setError('Could not reach server — is the backend running?')
    }
  }

  function handleGameEnd(result: 'won' | 'lost') {
    setScore((prev) => {
      const next = {
        wins: result === 'won' ? prev.wins + 1 : prev.wins,
        losses: result === 'lost' ? prev.losses + 1 : prev.losses,
      }
      localStorage.setItem(SCORE_KEY, JSON.stringify(next))
      return next
    })
  }

  function handlePlayAgain() {
    setGame(null)
  }

  function handleReset() {
    localStorage.removeItem(SCORE_KEY)
    setScore({ wins: 0, losses: 0 })
  }

  return (
    <div className="app">
      <div className="score-row">
        <div className="score-pill">
          {score.wins} win{score.wins !== 1 ? 's' : ''} / {score.losses} loss{score.losses !== 1 ? 'es' : ''}
        </div>
        <button className="btn-forget" onClick={handleReset}>Forget me</button>
      </div>
      {error && <p className="app__error">{error}</p>}
      {game === null ? (
        <GameSetup onStart={handleStart} />
      ) : (
        <GameBoard
          initialState={game}
          onGameEnd={handleGameEnd}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  )
}
```

---

### Step 6: Run ALL frontend tests

```bash
cd /Users/emily/Code/hangman/frontend && npm test
```

Expected: **36 passed** (was 38 — removed 2 GameSetup tests for difficulty buttons, added 2 new ones for Play button; net same count for GameSetup, but App tests no longer click "Easy"). Actually count carefully: was 3 GameSetup tests, now 2; was 4 App tests unchanged. Total: 38 - 1 = **37 passed**. If the count differs, read failures carefully.

---

### Step 7: Commit

```bash
cd /Users/emily/Code/hangman
git add frontend/src/types.ts \
        frontend/src/components/GameSetup.tsx \
        frontend/src/components/__tests__/GameSetup.test.tsx \
        frontend/src/App.tsx \
        frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: replace difficulty picker with single Play button"
```

---

## Final check

```bash
cd /Users/emily/Code/hangman/backend && source venv/bin/activate && pytest tests/ -v 2>&1 | tail -5
cd /Users/emily/Code/hangman/frontend && npm test 2>&1 | tail -5
```

Expected: backend 44 passed, frontend 37 passed.
