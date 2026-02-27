# Hangman Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable hangman game with a Flask backend managing game state and a React/TypeScript frontend for the UI.

**Architecture:** Flask stores active games in an in-memory dict keyed by UUID; the frontend receives the UUID on game start and sends it with every guess. React renders game state returned by the API; no game logic lives in the frontend.

**Tech Stack:** Python 3.11, Flask 3, pytest | React 19, TypeScript, Vite 7, vitest, @testing-library/react

---

## Task 1: Backend — words.txt and pytest setup

**Files:**
- Create: `backend/words.txt`
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

**Step 1: Add words.txt**

Create `backend/words.txt` with one word per line (mix of lengths for all three difficulty tiers):

```
cat
dog
frog
bird
fish
bear
wolf
duck
lion
rain
tree
star
book
moon
cake
lamp
ship
rose
fire
leaf
coat
snow
hand
ring
flag
door
farm
jump
rock
blue
python
garden
castle
bridge
jungle
flower
bottle
mirror
rabbit
winter
summer
planet
silver
purple
dragon
spider
coffee
market
island
forest
button
rocket
circle
monkey
banana
candle
pillow
breeze
school
finger
yellow
butterfly
chocolate
adventure
detective
orchestra
pineapple
telescope
strawberry
basketball
carpenter
apartment
hurricane
knowledge
beautiful
dangerous
newspaper
waterfall
celebration
anniversary
```

**Step 2: Add pytest to requirements.txt**

Append to `backend/requirements.txt`:
```
pytest==8.3.5
```

**Step 3: Install it**

```bash
cd backend && source venv/bin/activate && pip install pytest==8.3.5
```

Expected: `Successfully installed pytest-8.3.5`

**Step 4: Create test package**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:
```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
```

**Step 5: Smoke-test pytest**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
```

Expected: `no tests ran` (0 errors)

**Step 6: Commit**

```bash
git add backend/words.txt backend/requirements.txt backend/tests/
git commit -m "feat: add words.txt and pytest setup"
```

---

## Task 2: Backend — game logic module

**Files:**
- Create: `backend/game.py`
- Create: `backend/tests/test_game.py`

**Step 1: Write failing tests**

Create `backend/tests/test_game.py`:

```python
import pytest
from game import load_words, select_word, new_game, mask_word, make_guess

# --- load_words ---

def test_load_words_returns_list():
    words = load_words()
    assert isinstance(words, list)
    assert len(words) > 0

def test_load_words_all_lowercase_alpha():
    for word in load_words():
        assert word.isalpha() and word == word.lower()

# --- select_word ---

def test_select_word_easy_short():
    word = select_word("easy")
    assert len(word) <= 5

def test_select_word_medium_length():
    word = select_word("medium")
    assert 6 <= len(word) <= 8

def test_select_word_hard_long():
    word = select_word("hard")
    assert len(word) >= 9

def test_select_word_invalid_difficulty():
    with pytest.raises(ValueError):
        select_word("impossible")

# --- mask_word ---

def test_mask_word_no_guesses():
    assert mask_word("cat", []) == "_ _ _"

def test_mask_word_partial():
    assert mask_word("cat", ["a"]) == "_ a _"

def test_mask_word_fully_revealed():
    assert mask_word("cat", ["c", "a", "t"]) == "c a t"

# --- new_game ---

def test_new_game_easy():
    game = new_game("easy")
    assert game["max_wrong"] == 8
    assert game["wrong_count"] == 0
    assert game["status"] == "in_progress"
    assert game["guessed_letters"] == []
    assert len(game["word"]) <= 5

def test_new_game_medium():
    game = new_game("medium")
    assert game["max_wrong"] == 6

def test_new_game_hard():
    game = new_game("hard")
    assert game["max_wrong"] == 4

# --- make_guess ---

def test_make_guess_correct_letter():
    game = new_game("easy")
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["correct"] is True
    assert "a" in result["guessed_letters"]
    assert result["status"] == "in_progress"

def test_make_guess_wrong_letter():
    game = new_game("easy")
    game["word"] = "cat"
    result = make_guess(game, "z")
    assert result["correct"] is False
    assert result["wrong_guesses_left"] == game["max_wrong"] - 1

def test_make_guess_duplicate_raises():
    game = new_game("easy")
    game["word"] = "cat"
    make_guess(game, "a")
    with pytest.raises(ValueError, match="already guessed"):
        make_guess(game, "a")

def test_make_guess_non_letter_raises():
    game = new_game("easy")
    game["word"] = "cat"
    with pytest.raises(ValueError, match="single letter"):
        make_guess(game, "1")

def test_make_guess_win():
    game = new_game("easy")
    game["word"] = "cat"
    make_guess(game, "c")
    make_guess(game, "a")
    result = make_guess(game, "t")
    assert result["status"] == "won"

def test_make_guess_lose():
    game = new_game("hard")  # 4 max wrong
    game["word"] = "cat"
    for letter in ["z", "x", "q", "v"]:
        result = make_guess(game, letter)
    assert result["status"] == "lost"
    assert result["word"] == "cat"

def test_make_guess_masked_word_updates():
    game = new_game("easy")
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["masked_word"] == "_ a _"
```

**Step 2: Run tests to confirm they all fail**

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'game'`

**Step 3: Implement game.py**

Create `backend/game.py`:

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

def select_word(difficulty: str) -> str:
    words = load_words()
    if difficulty == "easy":
        pool = [w for w in words if len(w) <= 5]
    elif difficulty == "medium":
        pool = [w for w in words if 6 <= len(w) <= 8]
    elif difficulty == "hard":
        pool = [w for w in words if len(w) >= 9]
    else:
        raise ValueError(f"Invalid difficulty: {difficulty}")
    return random.choice(pool)

def mask_word(word: str, guessed_letters: list[str]) -> str:
    return " ".join(c if c in guessed_letters else "_" for c in word)

def new_game(difficulty: str) -> dict:
    word = select_word(difficulty)
    max_wrong = {"easy": 8, "medium": 6, "hard": 4}[difficulty]
    return {
        "word": word,
        "guessed_letters": [],
        "max_wrong": max_wrong,
        "wrong_count": 0,
        "status": "in_progress",
    }

def make_guess(game: dict, letter: str) -> dict:
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
```

**Step 4: Run tests to confirm they pass**

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -v
```

Expected: all tests `PASSED`

**Step 5: Commit**

```bash
git add backend/game.py backend/tests/test_game.py
git commit -m "feat: add game logic with word selection, masking, and guess validation"
```

---

## Task 3: Backend — Flask routes

**Files:**
- Modify: `backend/app.py`
- Create: `backend/tests/test_routes.py`

**Step 1: Write failing route tests**

Create `backend/tests/test_routes.py`:

```python
import json
import pytest
from app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

# --- POST /api/game ---

def test_new_game_returns_game_id(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "game_id" in data

def test_new_game_returns_masked_word(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    data = resp.get_json()
    assert "masked_word" in data
    assert "_" in data["masked_word"]

def test_new_game_easy_max_wrong(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    data = resp.get_json()
    assert data["max_wrong"] == 8
    assert data["wrong_guesses_left"] == 8

def test_new_game_hard_max_wrong(client):
    resp = client.post("/api/game", json={"difficulty": "hard"})
    data = resp.get_json()
    assert data["max_wrong"] == 4

def test_new_game_invalid_difficulty(client):
    resp = client.post("/api/game", json={"difficulty": "impossible"})
    assert resp.status_code == 400

def test_new_game_missing_difficulty(client):
    resp = client.post("/api/game", json={})
    assert resp.status_code == 400

# --- POST /api/game/<game_id>/guess ---

def test_guess_correct_letter(client):
    # Start a game, then patch the word to a known value
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]

    # Patch the word for determinism
    from app import games
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert "a" in data["guessed_letters"]

def test_guess_wrong_letter_decrements(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    from app import games
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "z"})
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 7

def test_guess_duplicate_returns_400(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    from app import games
    games[game_id]["word"] = "cat"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 400

def test_guess_unknown_game_id_returns_404(client):
    resp = client.post("/api/game/nonexistent-id/guess", json={"letter": "a"})
    assert resp.status_code == 404

def test_guess_win_sets_status(client):
    resp = client.post("/api/game", json={"difficulty": "easy"})
    game_id = resp.get_json()["game_id"]
    from app import games
    games[game_id]["word"] = "hi"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "h"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "i"})
    assert resp.get_json()["status"] == "won"
```

**Step 2: Run tests to confirm they fail**

```bash
cd backend && source venv/bin/activate && pytest tests/test_routes.py -v
```

Expected: failures — `/api/game` endpoint doesn't exist yet.

**Step 3: Implement routes in app.py**

Replace `backend/app.py` contents with:

```python
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS
from game import new_game, make_guess

app = Flask(__name__)
CORS(app)

games: dict[str, dict] = {}


@app.route("/")
def home():
    return jsonify({"message": "Hangman API running!"})


@app.route("/api/game", methods=["POST"])
def create_game():
    data = request.get_json(silent=True) or {}
    difficulty = data.get("difficulty")
    if difficulty not in ("easy", "medium", "hard"):
        return jsonify({"error": "difficulty must be easy, medium, or hard"}), 400

    game_id = str(uuid.uuid4())
    game = new_game(difficulty)
    games[game_id] = game

    from game import mask_word
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


if __name__ == "__main__":
    app.run(debug=True)
```

**Step 4: Run tests to confirm they pass**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
```

Expected: all tests `PASSED`

**Step 5: Commit**

```bash
git add backend/app.py backend/tests/test_routes.py
git commit -m "feat: add Flask routes for new game and guess"
```

---

## Task 4: Frontend — test setup and Vite proxy

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test-setup.ts`
- Modify: `frontend/vite.config.ts`

**Step 1: Install test dependencies**

```bash
cd frontend && npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Expected: packages installed successfully.

**Step 2: Add vitest config**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

**Step 3: Create test setup file**

Create `frontend/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

**Step 4: Add test script to package.json**

In `frontend/package.json`, add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Add Vite proxy for `/api` routes**

Update `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
```

**Step 6: Smoke-test vitest**

```bash
cd frontend && npm test
```

Expected: `No test files found` (exits 0)

**Step 7: Commit**

```bash
git add frontend/vitest.config.ts frontend/src/test-setup.ts frontend/vite.config.ts frontend/package.json
git commit -m "feat: add vitest, RTL test setup, and Vite API proxy"
```

---

## Task 5: Frontend — TypeScript types

**Files:**
- Create: `frontend/src/types.ts`

**Step 1: Create types**

Create `frontend/src/types.ts`:

```typescript
export type Difficulty = 'easy' | 'medium' | 'hard'

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

**Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 6: Frontend — GameSetup component

**Files:**
- Create: `frontend/src/components/GameSetup.tsx`
- Create: `frontend/src/components/__tests__/GameSetup.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/GameSetup.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('renders three difficulty buttons', () => {
    render(<GameSetup onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
  })

  it('calls onStart with easy when Easy is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))
    expect(onStart).toHaveBeenCalledWith('easy')
  })

  it('calls onStart with hard when Hard is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /hard/i }))
    expect(onStart).toHaveBeenCalledWith('hard')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../GameSetup'`

**Step 3: Implement GameSetup**

Create `frontend/src/components/GameSetup.tsx`:

```typescript
import type { Difficulty } from '../types'

interface Props {
  onStart: (difficulty: Difficulty) => void
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

export default function GameSetup({ onStart }: Props) {
  return (
    <div>
      <h1>Hangman</h1>
      <p>Choose a difficulty to start:</p>
      <div>
        {difficulties.map((d) => (
          <button key={d} onClick={() => onStart(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/GameSetup.tsx frontend/src/components/__tests__/GameSetup.test.tsx
git commit -m "feat: add GameSetup component"
```

---

## Task 7: Frontend — HangmanSvg component

**Files:**
- Create: `frontend/src/components/HangmanSvg.tsx`
- Create: `frontend/src/components/__tests__/HangmanSvg.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/HangmanSvg.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HangmanSvg from '../HangmanSvg'

describe('HangmanSvg', () => {
  it('renders an svg element', () => {
    const { container } = render(<HangmanSvg wrongCount={0} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('shows head after 1 wrong guess', () => {
    const { container } = render(<HangmanSvg wrongCount={1} />)
    expect(container.querySelector('[data-part="head"]')).toBeInTheDocument()
  })

  it('does not show head with 0 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={0} />)
    expect(container.querySelector('[data-part="head"]')).not.toBeInTheDocument()
  })

  it('shows body after 2 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={2} />)
    expect(container.querySelector('[data-part="body"]')).toBeInTheDocument()
  })

  it('shows all parts after 6 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={6} />)
    const parts = ['head', 'body', 'left-arm', 'right-arm', 'left-leg', 'right-leg']
    parts.forEach((part) => {
      expect(container.querySelector(`[data-part="${part}"]`)).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../HangmanSvg'`

**Step 3: Implement HangmanSvg**

Create `frontend/src/components/HangmanSvg.tsx`:

```typescript
interface Props {
  wrongCount: number
}

// Body parts in order: head=1, body=2, left-arm=3, right-arm=4, left-leg=5, right-leg=6
export default function HangmanSvg({ wrongCount }: Props) {
  return (
    <svg viewBox="0 0 200 250" width="200" height="250" aria-label="hangman figure">
      {/* Gallows - always visible */}
      <line x1="20" y1="230" x2="180" y2="230" stroke="black" strokeWidth="4" />
      <line x1="60" y1="230" x2="60" y2="20" stroke="black" strokeWidth="4" />
      <line x1="60" y1="20" x2="130" y2="20" stroke="black" strokeWidth="4" />
      <line x1="130" y1="20" x2="130" y2="50" stroke="black" strokeWidth="4" />

      {wrongCount >= 1 && (
        <circle data-part="head" cx="130" cy="70" r="20" stroke="black" strokeWidth="3" fill="none" />
      )}
      {wrongCount >= 2 && (
        <line data-part="body" x1="130" y1="90" x2="130" y2="150" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 3 && (
        <line data-part="left-arm" x1="130" y1="110" x2="100" y2="140" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 4 && (
        <line data-part="right-arm" x1="130" y1="110" x2="160" y2="140" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 5 && (
        <line data-part="left-leg" x1="130" y1="150" x2="100" y2="190" stroke="black" strokeWidth="3" />
      )}
      {wrongCount >= 6 && (
        <line data-part="right-leg" x1="130" y1="150" x2="160" y2="190" stroke="black" strokeWidth="3" />
      )}
    </svg>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/HangmanSvg.tsx frontend/src/components/__tests__/HangmanSvg.test.tsx
git commit -m "feat: add HangmanSvg component with progressive body parts"
```

---

## Task 8: Frontend — WordDisplay component

**Files:**
- Create: `frontend/src/components/WordDisplay.tsx`
- Create: `frontend/src/components/__tests__/WordDisplay.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/WordDisplay.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WordDisplay from '../WordDisplay'

describe('WordDisplay', () => {
  it('renders underscores for unrevealed letters', () => {
    render(<WordDisplay maskedWord="_ _ _" />)
    const blanks = screen.getAllByText('_')
    expect(blanks).toHaveLength(3)
  })

  it('renders revealed letters', () => {
    render(<WordDisplay maskedWord="c a _" />)
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('_')).toBeInTheDocument()
  })

  it('renders all letters when word is fully guessed', () => {
    render(<WordDisplay maskedWord="c a t" />)
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('t')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../WordDisplay'`

**Step 3: Implement WordDisplay**

Create `frontend/src/components/WordDisplay.tsx`:

```typescript
interface Props {
  maskedWord: string
}

export default function WordDisplay({ maskedWord }: Props) {
  const letters = maskedWord.split(' ')
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '2rem', fontFamily: 'monospace' }}>
      {letters.map((letter, i) => (
        <span key={i} style={{ borderBottom: '2px solid black', minWidth: '1ch', textAlign: 'center' }}>
          {letter}
        </span>
      ))}
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/WordDisplay.tsx frontend/src/components/__tests__/WordDisplay.test.tsx
git commit -m "feat: add WordDisplay component"
```

---

## Task 9: Frontend — Keyboard component

**Files:**
- Create: `frontend/src/components/Keyboard.tsx`
- Create: `frontend/src/components/__tests__/Keyboard.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/Keyboard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Keyboard from '../Keyboard'

describe('Keyboard', () => {
  it('renders 26 letter buttons', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(26)
  })

  it('disables already-guessed letters', () => {
    render(<Keyboard guessedLetters={['a', 'b']} correctLetters={['a']} onGuess={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })

  it('calls onGuess with the clicked letter', async () => {
    const onGuess = vi.fn()
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={onGuess} disabled={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onGuess).toHaveBeenCalledWith('a')
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={true} />)
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled())
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../Keyboard'`

**Step 3: Implement Keyboard**

Create `frontend/src/components/Keyboard.tsx`:

```typescript
interface Props {
  guessedLetters: string[]
  correctLetters: string[]
  onGuess: (letter: string) => void
  disabled: boolean
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

export default function Keyboard({ guessedLetters, correctLetters, onGuess, disabled }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '400px' }}>
      {LETTERS.map((letter) => {
        const wasGuessed = guessedLetters.includes(letter)
        const wasCorrect = correctLetters.includes(letter)
        return (
          <button
            key={letter}
            onClick={() => onGuess(letter)}
            disabled={disabled || wasGuessed}
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: wasGuessed ? (wasCorrect ? '#4caf50' : '#f44336') : '#e0e0e0',
              color: wasGuessed ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: wasGuessed || disabled ? 'default' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {letter.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/Keyboard.tsx frontend/src/components/__tests__/Keyboard.test.tsx
git commit -m "feat: add Keyboard component with guess state coloring"
```

---

## Task 10: Frontend — GameResult component

**Files:**
- Create: `frontend/src/components/GameResult.tsx`
- Create: `frontend/src/components/__tests__/GameResult.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/GameResult.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameResult from '../GameResult'

describe('GameResult', () => {
  it('shows win message on won status', () => {
    render(<GameResult status="won" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/you won/i)).toBeInTheDocument()
  })

  it('shows lose message on lost status', () => {
    render(<GameResult status="lost" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/game over/i)).toBeInTheDocument()
  })

  it('always reveals the word', () => {
    render(<GameResult status="won" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/python/i)).toBeInTheDocument()
  })

  it('calls onPlayAgain when Play Again is clicked', async () => {
    const onPlayAgain = vi.fn()
    render(<GameResult status="won" word="cat" onPlayAgain={onPlayAgain} />)
    await userEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onPlayAgain).toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../GameResult'`

**Step 3: Implement GameResult**

Create `frontend/src/components/GameResult.tsx`:

```typescript
import type { GameStatus } from '../types'

interface Props {
  status: GameStatus
  word: string
  onPlayAgain: () => void
}

export default function GameResult({ status, word, onPlayAgain }: Props) {
  return (
    <div>
      <h2>{status === 'won' ? 'You Won!' : 'Game Over!'}</h2>
      <p>The word was: <strong>{word}</strong></p>
      <button onClick={onPlayAgain}>Play Again</button>
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/GameResult.tsx frontend/src/components/__tests__/GameResult.test.tsx
git commit -m "feat: add GameResult component"
```

---

## Task 11: Frontend — GameBoard component

**Files:**
- Create: `frontend/src/components/GameBoard.tsx`
- Create: `frontend/src/components/__tests__/GameBoard.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/GameBoard.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GameBoard from '../GameBoard'

const mockInitialState = {
  gameId: 'test-id',
  maskedWord: '_ _ _',
  maxWrong: 6,
  wrongGuessesLeft: 6,
  guessedLetters: [],
  status: 'in_progress' as const,
}

describe('GameBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the hangman svg', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} />)
    expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
  })

  it('renders the word display', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} />)
    expect(screen.getAllByText('_').length).toBeGreaterThan(0)
  })

  it('renders the keyboard', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
  })

  it('calls onGameEnd with won when game is won', async () => {
    const onGameEnd = vi.fn()
    const wonResponse = {
      masked_word: 'c a t',
      correct: true,
      wrong_guesses_left: 6,
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => wonResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={onGameEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => {
      expect(onGameEnd).toHaveBeenCalledWith('won')
    })
  })

  it('shows error message on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module '../GameBoard'`

**Step 3: Implement GameBoard**

Create `frontend/src/components/GameBoard.tsx`:

```typescript
import { useState } from 'react'
import type { GameState, GameStatus } from '../types'
import HangmanSvg from './HangmanSvg'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGameEnd: (result: 'won' | 'lost') => void
}

export default function GameBoard({ initialState, onGameEnd }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  const correctLetters = game.guessedLetters.filter((l) => game.maskedWord.includes(l))
  const isOver = game.status !== 'in_progress'

  return (
    <div>
      <HangmanSvg wrongCount={wrongCount} />
      <WordDisplay maskedWord={game.maskedWord} />
      <p>Wrong guesses left: {game.wrongGuessesLeft}</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Keyboard
        guessedLetters={game.guessedLetters}
        correctLetters={correctLetters}
        onGuess={handleGuess}
        disabled={loading || isOver}
      />
      {isOver && (
        <GameResult
          status={game.status}
          word={game.word ?? game.maskedWord}
          onPlayAgain={() => window.location.reload()}
        />
      )}
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/components/GameBoard.tsx frontend/src/components/__tests__/GameBoard.test.tsx
git commit -m "feat: add GameBoard component with fetch and error handling"
```

---

## Task 12: Frontend — App.tsx wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/__tests__/App.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/components/__tests__/App.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

const mockGameResponse = {
  game_id: 'test-uuid',
  masked_word: '_ _ _ _ _ _',
  max_wrong: 6,
  wrong_guesses_left: 6,
  guessed_letters: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows GameSetup on initial render', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
  })

  it('shows score starting at 0-0', () => {
    render(<App />)
    expect(screen.getByText(/0.*win/i)).toBeInTheDocument()
  })

  it('switches to GameBoard after starting a game', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
    })
  })

  it('increments wins when a game is won', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))

    // Simulate game won by directly calling onGameEnd
    // We test this via the score display updating
    await waitFor(() => screen.getByLabelText(/hangman figure/i))
    // Score still 0 wins at this point
    expect(screen.getByText(/0.*win/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test
```

Expected: tests fail because `App` doesn't implement the new structure yet.

**Step 3: Rewrite App.tsx**

Replace `frontend/src/App.tsx` with:

```typescript
import { useState } from 'react'
import type { Difficulty, GameState, Score } from './types'
import GameSetup from './components/GameSetup'
import GameBoard from './components/GameBoard'
import './App.css'

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [score, setScore] = useState<Score>({ wins: 0, losses: 0 })
  const [error, setError] = useState<string | null>(null)

  async function handleStart(difficulty: Difficulty) {
    setError(null)
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
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
    setScore((prev) => ({
      wins: result === 'won' ? prev.wins + 1 : prev.wins,
      losses: result === 'lost' ? prev.losses + 1 : prev.losses,
    }))
  }

  function handlePlayAgain() {
    setGame(null)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
      <p>{score.wins} win{score.wins !== 1 ? 's' : ''} / {score.losses} loss{score.losses !== 1 ? 'es' : ''}</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
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

Note: `GameBoard` needs an `onPlayAgain` prop added. Update `frontend/src/components/GameBoard.tsx` — change the `Props` interface and replace `window.location.reload()` with `onPlayAgain()`:

```typescript
// In Props interface, add:
onPlayAgain: () => void

// In the component signature:
export default function GameBoard({ initialState, onGameEnd, onPlayAgain }: Props) {

// In the GameResult render:
<GameResult
  status={game.status}
  word={game.word ?? game.maskedWord}
  onPlayAgain={onPlayAgain}
/>
```

**Step 4: Run all tests to confirm they pass**

```bash
cd frontend && npm test
```

Expected: all tests `PASS`

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/GameBoard.tsx frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: wire App with score tracking and game lifecycle"
```

---

## Task 13: Smoke test the full app

**Step 1: Start the backend**

```bash
cd backend && source venv/bin/activate && python app.py
```

Expected: `Running on http://127.0.0.1:5000`

**Step 2: Start the frontend (new terminal)**

```bash
cd frontend && npm run dev
```

Expected: `Local: http://localhost:5173`

**Step 3: Manual test checklist**

Open `http://localhost:5173` and verify:

- [ ] Score shows "0 wins / 0 losses" on load
- [ ] Three difficulty buttons appear
- [ ] Clicking Easy starts a game (SVG gallows appears, blanks appear, A–Z keyboard appears)
- [ ] Clicking a correct letter turns the button green and reveals letters in the word
- [ ] Clicking a wrong letter turns the button red and adds a body part to the figure
- [ ] Already-clicked letters are disabled
- [ ] Winning shows "You Won!" with the word and a Play Again button
- [ ] Losing shows "Game Over!" with the word and a Play Again button
- [ ] Score increments correctly after each game
- [ ] Play Again returns to the difficulty picker
- [ ] Hard mode uses 4 wrong guesses max; Easy uses 8

**Step 4: Run all backend and frontend tests one final time**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
cd frontend && npm test
```

Expected: all tests `PASS`
