# Phase 2: Classes & Combat Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove the hangman mechanic, add RPG combat (enemy HP, per-letter damage, classes) and a reworked start screen with class selection.

**Architecture:** Backend drops wrong-guess limits, adds `category`/`first_letter`/`occurrences` to responses, parses CSV `words.txt`. Frontend adds 4 classes with passives/actives tracked in CombatView local state; RunSetup gains class selection cards and a how-to-play collapsible; GameBoard loses HangmanSvg and the Solve Puzzle button.

**Tech Stack:** Python 3.11 / Flask / pytest; React 19 / TypeScript / Vite / vitest + @testing-library/react.

**Run tests:**
- Backend: `cd backend && source venv/bin/activate && pytest tests/ -v`
- Frontend: `cd frontend && npm test`

---

### Task 1: Backend — CSV words.txt + API redesign

Remove wrong-guess limits. Add `category`, `first_letter`, `occurrences`. Parse CSV `words.txt`.

**Files:**
- Modify: `backend/words.txt`
- Modify: `backend/game.py`
- Modify: `backend/app.py`
- Modify: `backend/tests/test_game.py`
- Modify: `backend/tests/test_routes.py`

**Step 1: Convert words.txt to CSV format**

Every line becomes `word,category`. Run this once from the repo root:

```bash
cd backend
python3 -c "
lines = open('words.txt').read().splitlines()
out = [l + ',general' for l in lines if l.strip()]
open('words.txt', 'w').write('\n'.join(out) + '\n')
"
```

Verify: `head -5 backend/words.txt` should show e.g. `cat,general`.

**Step 2: Write failing tests for new game.py behaviour**

Replace `backend/tests/test_game.py` entirely:

```python
import pytest
from game import load_words, select_word, new_game, mask_word, make_guess

# --- load_words ---

def test_load_words_returns_list():
    words = load_words()
    assert isinstance(words, list)
    assert len(words) > 0

def test_load_words_returns_tuples_with_category():
    words = load_words()
    word, category = words[0]
    assert isinstance(word, str) and word.isalpha()
    assert isinstance(category, str) and len(category) > 0

def test_load_words_all_lowercase():
    for word, _ in load_words():
        assert word == word.lower()

# --- select_word ---

def test_select_word_returns_tuple():
    result = select_word()
    assert isinstance(result, tuple) and len(result) == 2
    word, category = result
    assert isinstance(word, str) and len(word) > 0

def test_select_word_word_in_list():
    word, _ = select_word()
    all_words = [w for w, _ in load_words()]
    assert word in all_words

def test_select_word_boss_returns_word_length_gte_8():
    for _ in range(20):
        word, _ = select_word(room_type='boss')
        assert len(word) >= 8

def test_select_word_invalid_room_type_raises():
    with pytest.raises(ValueError, match="room_type"):
        select_word(room_type='invalid')

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

def test_new_game_has_no_max_wrong():
    game = new_game()
    assert "max_wrong" not in game
    assert "wrong_count" not in game

def test_new_game_has_word_and_category():
    game = new_game()
    assert isinstance(game["word"], str) and len(game["word"]) > 0
    assert isinstance(game["category"], str) and len(game["category"]) > 0

def test_new_game_has_first_letter():
    game = new_game()
    assert game["first_letter"] == game["word"][0]

def test_new_game_status_in_progress():
    game = new_game()
    assert game["status"] == "in_progress"
    assert game["guessed_letters"] == []

def test_new_game_boss_word_length_gte_8():
    for _ in range(10):
        game = new_game(room_type='boss')
        assert len(game["word"]) >= 8

def test_new_game_hint_reveals_one_letter():
    game = new_game(hint=True)
    assert len(game["guessed_letters"]) == 1
    assert game["guessed_letters"][0] in game["word"]

def test_new_game_no_hint_default():
    game = new_game()
    assert game["guessed_letters"] == []

# --- make_guess ---

def test_make_guess_correct_returns_occurrences():
    game = new_game()
    game["word"] = "hello"
    result = make_guess(game, "l")
    assert result["correct"] is True
    assert result["occurrences"] == 2

def test_make_guess_correct_single_occurrence():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["occurrences"] == 1

def test_make_guess_wrong_returns_zero_occurrences():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "z")
    assert result["correct"] is False
    assert result["occurrences"] == 0

def test_make_guess_no_wrong_guesses_left_field():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "z")
    assert "wrong_guesses_left" not in result

def test_make_guess_never_returns_lost_status():
    game = new_game()
    game["word"] = "cat"
    for letter in "zxqvjwbdfghi":
        if letter not in game["word"]:
            result = make_guess(game, letter)
            assert result["status"] != "lost"

def test_make_guess_win():
    game = new_game()
    game["word"] = "cat"
    make_guess(game, "c")
    make_guess(game, "a")
    result = make_guess(game, "t")
    assert result["status"] == "won"

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

def test_make_guess_after_won_raises():
    game = new_game()
    game["word"] = "hi"
    make_guess(game, "h")
    make_guess(game, "i")
    with pytest.raises(ValueError, match="already over"):
        make_guess(game, "a")

def test_make_guess_masked_word_updates():
    game = new_game()
    game["word"] = "cat"
    result = make_guess(game, "a")
    assert result["masked_word"] == "_ a _"
```

**Step 3: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -v
```

Expected: many failures (`KeyError: 'category'`, assertion errors about `max_wrong`, etc.)

**Step 4: Rewrite game.py**

```python
import random
import os
import csv

_WORDS: list[tuple[str, str]] | None = None

def load_words() -> list[tuple[str, str]]:
    global _WORDS
    if _WORDS is None:
        words_path = os.path.join(os.path.dirname(__file__), "words.txt")
        result = []
        with open(words_path, newline='') as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    word = row[0].strip().lower()
                    category = row[1].strip()
                    if word.isalpha():
                        result.append((word, category))
        _WORDS = result
    return _WORDS

def select_word(room_type: str = 'enemy') -> tuple[str, str]:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    words = load_words()
    if room_type == 'boss':
        words = [(w, c) for w, c in words if len(w) >= 8]
        if not words:
            raise ValueError("No words available for room_type='boss'")
    return random.choice(words)

def mask_word(word: str, guessed_letters: list[str]) -> str:
    return " ".join(c if c in guessed_letters else "_" for c in word)

def new_game(room_type: str = 'enemy', hint: bool = False) -> dict:
    word, category = select_word(room_type)
    guessed: list[str] = []
    if hint:
        guessed = [random.choice(list(word))]
    return {
        "word": word,
        "category": category,
        "first_letter": word[0],
        "guessed_letters": guessed,
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
    occurrences = game["word"].count(letter) if correct else 0
    if all(c in game["guessed_letters"] for c in game["word"]):
        game["status"] = "won"
    return {
        "correct": correct,
        "masked_word": mask_word(game["word"], game["guessed_letters"]),
        "guessed_letters": list(game["guessed_letters"]),
        "status": game["status"],
        "occurrences": occurrences,
    }
```

**Step 5: Run game.py tests to verify they pass**

```bash
pytest tests/test_game.py -v
```

Expected: all pass. If `test_make_guess_never_returns_lost_status` fails, check that `make_guess` no longer has `lost` logic.

**Step 6: Update test_routes.py**

Replace `backend/tests/test_routes.py` entirely:

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

def test_new_game_returns_word(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert "word" in data
    assert data["word"].isalpha()

def test_new_game_returns_category(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert "category" in data
    assert isinstance(data["category"], str)

def test_new_game_returns_first_letter(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert "first_letter" in data
    assert data["first_letter"] == data["word"][0]

def test_new_game_no_max_wrong_field(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert "max_wrong" not in data
    assert "wrong_guesses_left" not in data

def test_new_game_boss_room_type_returns_long_word(client):
    for _ in range(5):
        resp = client.post("/api/game", json={"room_type": "boss"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["word"]) >= 8

def test_new_game_invalid_room_type_returns_400(client):
    resp = client.post("/api/game", json={"room_type": "dragon"})
    assert resp.status_code == 400

def test_new_game_hint_true_has_guessed_letter(client):
    resp = client.post("/api/game", json={"hint": True})
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["guessed_letters"]) == 1

def test_new_game_omitting_room_type_defaults_to_enemy(client):
    resp = client.post("/api/game")
    assert resp.status_code == 200

# --- POST /api/game/<game_id>/guess ---

def test_guess_correct_letter(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert data["occurrences"] == 1
    assert "a" in data["guessed_letters"]

def test_guess_correct_repeated_letter_occurrences(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "hello"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "l"})
    data = resp.get_json()
    assert data["occurrences"] == 2

def test_guess_wrong_letter_zero_occurrences(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "z"})
    data = resp.get_json()
    assert data["correct"] is False
    assert data["occurrences"] == 0

def test_guess_no_wrong_guesses_left_field(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "z"})
    data = resp.get_json()
    assert "wrong_guesses_left" not in data

def test_guess_status_never_lost(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    for letter in "zxqvjwbdfg":
        resp = client.post(f"/api/game/{game_id}/guess", json={"letter": letter})
        assert resp.get_json()["status"] != "lost"

def test_guess_win_sets_status(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "hi"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "h"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "i"})
    assert resp.get_json()["status"] == "won"

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
```

**Step 7: Update app.py**

```python
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS
from game import new_game, make_guess, mask_word

app = Flask(__name__)
CORS(app)

games: dict[str, dict] = {}


@app.route("/")
def home():
    return jsonify({"message": "Hangman API running!"})


@app.route("/api/game", methods=["POST"])
def create_game():
    data = request.get_json(silent=True) or {}
    room_type = data.get("room_type", "enemy")
    hint = bool(data.get("hint", False))
    try:
        game = new_game(room_type=room_type, hint=hint)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    game_id = str(uuid.uuid4())
    games[game_id] = game
    return jsonify({
        "game_id": game_id,
        "word": game["word"],
        "masked_word": mask_word(game["word"], game["guessed_letters"]),
        "category": game["category"],
        "first_letter": game["first_letter"],
        "guessed_letters": list(game["guessed_letters"]),
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
    app.run(debug=True, port=5001)
```

Note: the `/api/game/<id>/solve` route is removed.

**Step 8: Run all backend tests**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
```

Expected: all tests pass. Note: `_WORDS` is cached globally — if tests run in sequence and a previous test populated it before `words.txt` changed format, tests may fail. Fix by resetting the cache between runs: add `from game import _WORDS` or just run `pytest` fresh.

If `load_words` cache causes issues across tests, add this fixture to `test_game.py`:

```python
import game as game_module

@pytest.fixture(autouse=True)
def reset_word_cache():
    game_module._WORDS = None
    yield
    game_module._WORDS = None
```

**Step 9: Commit**

```bash
git add backend/words.txt backend/game.py backend/app.py backend/tests/test_game.py backend/tests/test_routes.py
git commit -m "feat: backend CSV words, category/first_letter/occurrences in API, remove wrong-guess limit"
```

---

### Task 2: Frontend types + runState

Update type definitions and constants to match the new backend and class system.

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/__tests__/runState.test.ts`

**Step 1: Write failing tests for runState**

Open `frontend/src/__tests__/runState.test.ts`. Add these tests (keep existing tests, update the ones that break):

```ts
// New tests to add:

it('buildRun accepts className and stores it', () => {
  const run = buildRun('rogue')
  expect(run.className).toBe('rogue')
})

it('buildRun initialises shield to 0', () => {
  const run = buildRun('vowel_mage')
  expect(run.shield).toBe(0)
})

it('enemyHp equals wordLength × floor × 2', () => {
  expect(enemyHp(5, 1)).toBe(10)
  expect(enemyHp(5, 2)).toBe(20)
  expect(enemyHp(8, 3)).toBe(48)
})

// Update existing test:
it('MAX_HP is 50', () => {
  expect(MAX_HP).toBe(50)
})
```

Run: `cd frontend && npm test -- --reporter=verbose 2>&1 | head -40`

Expected: new tests fail with `className` / `shield` not on `RunState`.

**Step 2: Update types.ts**

```ts
export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface GameState {
  gameId: string
  word: string           // always present — used for reveal when enemy dies early
  maskedWord: string
  category: string
  firstLetter: string
  guessedLetters: string[]
  status: GameStatus
}

export type RoomType = 'enemy' | 'boss' | 'rest' | 'treasure'

export interface Room {
  type: RoomType
  completed: boolean
  gameId: string | null
}

export type ClassName = 'vowel_mage' | 'archivist' | 'berserker' | 'rogue'

export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number
  roomIndex: number
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
  className: ClassName
  shield: number
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
```

**Step 3: Update runState.ts**

```ts
import type { Room, RunState, RunScore, RoomType, ClassName } from './types'

export const MAX_HP = 50
export const DAMAGE_PER_WRONG = 2
export const BASE_DAMAGE_PER_HIT = 2
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
export const HEAL_COST = 10
export const HEAL_AMOUNT = 5

export const RUN_KEY = 'hangman_run'
export const SCORE_KEY = 'hangman_score'

const LAYOUT_A: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'rest',
  'enemy', 'treasure', 'enemy', 'enemy', 'enemy', 'boss',
]
const LAYOUT_B: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'treasure',
  'enemy', 'rest', 'enemy', 'enemy', 'enemy', 'boss',
]

export function getFloorLayout(floor: number): RoomType[] {
  return floor === 2 ? LAYOUT_B : LAYOUT_A
}

export function buildRooms(floor: number): Room[] {
  return getFloorLayout(floor).map(type => ({ type, completed: false, gameId: null }))
}

export function buildRun(className: ClassName = 'berserker'): RunState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
  }
}

export function enemyHp(wordLength: number, floor: number): number {
  return wordLength * floor * 2
}

export function computeRoomsCleared(run: RunState): number {
  return (run.floor - 1) * 11 + run.rooms.filter(r => r.completed).length
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RunState
  } catch {
    return null
  }
}

export function saveRun(run: RunState): void {
  localStorage.setItem(RUN_KEY, JSON.stringify(run))
}

export function clearRun(): void {
  localStorage.removeItem(RUN_KEY)
}

export function loadRunScore(): RunScore {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
    return JSON.parse(raw) as RunScore
  } catch {
    return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
  }
}

export function saveRunScore(score: RunScore): void {
  localStorage.setItem(SCORE_KEY, JSON.stringify(score))
}
```

Note: Archivist has `-5 max HP` (45 HP). This is applied in `buildRun`:

```ts
export function buildRun(className: ClassName = 'berserker'): RunState {
  const maxHp = className === 'archivist' ? MAX_HP - 5
              : className === 'rogue'     ? MAX_HP - 10
              : MAX_HP
  return {
    hp: maxHp,
    maxHp,
    ...
  }
}
```

Update the full `buildRun` accordingly.

**Step 4: Run frontend tests**

```bash
cd frontend && npm test
```

Expected: `runState.test.ts` passes. Other test files may have TypeScript errors due to `GameState` shape change — fix them by updating mock objects to include `word`, `category`, `firstLetter` where needed.

For all test files using `mockGame` or similar, add the new required fields:

```ts
const mockGame: GameState = {
  gameId: 'test-id',
  word: 'cat',
  maskedWord: '_ _ _',
  category: 'animals',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}
```

**Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/
git commit -m "feat: add ClassName, shield to RunState; category/firstLetter/word to GameState; update enemyHp"
```

---

### Task 3: GameBoard cleanup

Remove HangmanSvg, remove Solve Puzzle, update callbacks for new combat system.

**Files:**
- Modify: `frontend/src/components/GameBoard.tsx`
- Delete: `frontend/src/components/HangmanSvg.tsx`
- Modify: `frontend/src/components/__tests__/GameBoard.test.tsx`
- Modify: `frontend/src/components/__tests__/HangmanSvg.test.tsx` → delete

**Step 1: Update GameBoard tests**

Replace `frontend/src/components/__tests__/GameBoard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GameBoard from '../GameBoard'
import type { GameState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  word: 'cat',
  maskedWord: '_ _ _',
  category: 'animals',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}

describe('GameBoard', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders WordDisplay', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByText('_')).toBeInTheDocument()
  })

  it('renders Keyboard', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
  })

  it('does NOT render a hangman figure', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.queryByLabelText(/hangman figure/i)).not.toBeInTheDocument()
  })

  it('does NOT render a Solve Puzzle button', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /solve puzzle/i })).not.toBeInTheDocument()
  })

  it('calls onGuessResult with letter, correct=true, occurrences on correct guess', async () => {
    const correctResponse = {
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => correctResponse }))
    const onGuessResult = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={onGuessResult} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onGuessResult).toHaveBeenCalledWith('a', true, 1)
  })

  it('calls onGuessResult with correct=false, occurrences=0 on wrong guess', async () => {
    const wrongResponse = {
      masked_word: '_ _ _', correct: false,
      guessed_letters: ['z'], status: 'in_progress', occurrences: 0,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wrongResponse }))
    const onGuessResult = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={onGuessResult} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    expect(onGuessResult).toHaveBeenCalledWith('z', false, 0)
  })

  it('calls onWordSolved when backend returns status won', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))
    const onWordSolved = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={onWordSolved} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    expect(onWordSolved).toHaveBeenCalledOnce()
  })

  it('when combatOver=true, reveals full word and shows continue button', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} combatOver={true} playAgainLabel="Continue" />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    // Full word "cat" should be visible
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('t')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- GameBoard
```

Expected: multiple failures (no `onGuessResult`, still has hangman, etc.)

**Step 3: Rewrite GameBoard.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { GameState, GameStatus } from '../types'
import WordDisplay from './WordDisplay'
import Keyboard from './Keyboard'
import GameResult from './GameResult'

interface Props {
  initialState: GameState
  onGuessResult: (letter: string, correct: boolean, occurrences: number) => void
  onWordSolved: () => void
  onPlayAgain: () => void
  playAgainLabel?: string
  combatOver?: boolean
}

export default function GameBoard({ initialState, onGuessResult, onWordSolved, onPlayAgain, playAgainLabel, combatOver }: Props) {
  const [game, setGame] = useState<GameState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctLetters, setCorrectLetters] = useState<string[]>([])

  const isWordSolved = game.status === 'won'
  const isOver = isWordSolved || !!combatOver

  // When combatOver, show fully revealed word
  const displayMasked = combatOver
    ? initialState.word.split('').join(' ')
    : game.maskedWord

  const handleGuess = useCallback(async (letter: string) => {
    if (isOver || loading) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/game/${initialState.gameId}/guess`, {
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
        guessedLetters: data.guessed_letters,
        status: data.status as GameStatus,
      }
      if (data.correct) {
        setCorrectLetters(prev => [...prev, letter])
      }
      setGame(updated)
      onGuessResult(letter, data.correct, data.occurrences)
      if (updated.status === 'won') {
        onWordSolved()
      }
    } catch {
      setError('Could not reach server — try again')
    } finally {
      setLoading(false)
    }
  }, [initialState, game, isOver, loading, onGuessResult, onWordSolved])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOver || loading) return
      const letter = e.key.toLowerCase()
      if (letter.length !== 1 || !/^[a-z]$/.test(letter)) return
      if (game.guessedLetters.includes(letter)) return
      handleGuess(letter)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOver, loading, game.guessedLetters, handleGuess])

  return (
    <div className="game-board">
      <WordDisplay maskedWord={displayMasked} />
      {error && <p className="app__error">{error}</p>}
      {!isOver && (
        <Keyboard
          guessedLetters={game.guessedLetters}
          correctLetters={correctLetters}
          onGuess={handleGuess}
          disabled={loading}
        />
      )}
      {isOver && (
        <GameResult
          status={isWordSolved ? 'won' : 'won'}
          word={initialState.word}
          onPlayAgain={onPlayAgain}
          buttonLabel={playAgainLabel}
        />
      )}
    </div>
  )
}
```

**Step 4: Delete HangmanSvg.tsx and its test**

```bash
rm frontend/src/components/HangmanSvg.tsx
rm frontend/src/components/__tests__/HangmanSvg.test.tsx
```

**Step 5: Run GameBoard tests**

```bash
cd frontend && npm test -- GameBoard
```

Expected: all pass.

**Step 6: Run all frontend tests**

```bash
cd frontend && npm test
```

Fix any TypeScript errors in other test files (e.g. CombatView.test.tsx which uses `wrongGuessesLeft` — those will be rewritten in Task 4).

**Step 7: Commit**

```bash
git add frontend/src/components/GameBoard.tsx
git rm frontend/src/components/HangmanSvg.tsx frontend/src/components/__tests__/HangmanSvg.test.tsx
git add frontend/src/components/__tests__/GameBoard.test.tsx
git commit -m "feat: remove HangmanSvg and Solve Puzzle; update GameBoard to onGuessResult/onWordSolved callbacks"
```

---

### Task 4: CombatView rewrite

Full rewrite with enemy HP tracking, class damage calculation, shield, per-encounter state, and ability button.

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Step 1: Write new CombatView tests**

Replace `frontend/src/components/__tests__/CombatView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CombatView from '../CombatView'
import { buildRun } from '../../runState'
import type { GameState, RunState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  word: 'cat',
  maskedWord: '_ _ _',
  category: 'animals',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}

function enemyRoom() {
  return { type: 'enemy' as const, completed: false, gameId: null }
}

function mockGuessResponse(overrides = {}) {
  return {
    masked_word: '_ _ _', correct: false,
    guessed_letters: ['z'], status: 'in_progress', occurrences: 0,
    ...overrides,
  }
}

describe('CombatView', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders player HP and coins', () => {
    const run = { ...buildRun('berserker'), hp: 14, coins: 10 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/14 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('renders enemy HP bar', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // mockGame word='cat' (3 letters), floor=1 → enemy HP = 3×1×2 = 6
    expect(screen.getByText(/6 \/ 6/)).toBeInTheDocument()
  })

  it('reduces enemy HP on correct guess', async () => {
    // word='cat', 'a' appears once → 2 damage (base). Enemy HP 6→4
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/4 \/ 6/)).toBeInTheDocument())
  })

  it('reduces player HP on wrong guess', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run: RunState = { ...buildRun('berserker'), hp: 50 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/48 \/ 50/)).toBeInTheDocument())
  })

  it('shows Continue button when word solved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('calls onCombatEnd with updated run when Continue clicked after win', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 1 }),
    }))
    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 50, coins: 0 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }))
  })

  it('shows Play Again when player HP hits 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run: RunState = { ...buildRun('berserker'), hp: 2 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
  })

  it('enemy killed early: reveals all letters and shows Continue', async () => {
    // word='cat' (3 letters), floor=1 → enemy HP=6. Guess 'c' (1 occ, 2 dmg) then 'a' (1 occ, 2 dmg) then 't' (1 occ, 2 dmg) → 6 total
    // Just do it in one step by mocking a correct guess that deals enough damage
    // Start enemy HP at 2 by making prior wrong guesses irrelevant — just test the reveal
    const mockGameLowHp: GameState = { ...mockGame, word: 'hi', maskedWord: '_ _' }
    // 'hi': 2 letters, floor 1 → enemy HP = 2×1×2 = 4
    // Guess 'h' (1 occ → 2 dmg → HP 4→2), guess 'i' (1 occ → 2 dmg → HP 2→0) → enemy dead
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'h _', correct: true, guessed_letters: ['h'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'h i', correct: true, guessed_letters: ['h','i'], status: 'won', occurrences: 1 }) })
    )
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGameLowHp} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'H' }))
    await userEvent.click(screen.getByRole('button', { name: 'I' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('Berserker gains rage on wrong guess, increases damage', async () => {
    // wrong guess first (rage+1), then correct guess → base 2 + rage 1 = 3 per occurrence
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['z','a'], status: 'in_progress', occurrences: 1 }) })
    )
    // word='cat', floor=1 → enemy HP=6. After wrong guess: rage=1. After correct 'a': damage = (2+1)×1 = 3. HP: 6→3
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Vowel Mage deals bonus damage on vowels', async () => {
    // word='cat', floor=1 → enemy HP=6. Guess 'a' (vowel, 1 occ) → base 2 + vowel bonus 1 = 3. HP: 6→3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], status: 'in_progress', occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('vowel_mage')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Rogue combo stacks increase damage', async () => {
    // Guess 'c' (combo→1, dmg = (2+0)×1=2, HP 6→4), guess 'a' (combo→2, dmg=(2+1)×1=3, HP 4→1)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c _ _', correct: true, guessed_letters: ['c'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c a _', correct: true, guessed_letters: ['c','a'], status: 'in_progress', occurrences: 1 }) })
    )
    render(<CombatView run={buildRun('rogue')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    // After C: enemy HP = 6 - 2 = 4 (combo was 0 at time of C, so (2+0)×1=2)
    // After A: enemy HP = 4 - 3 = 1 (combo was 1 at time of A, so (2+1)×1=3)
    await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
  })

  it('renders ability button', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /bloodletter/i })).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to confirm failures**

```bash
cd frontend && npm test -- CombatView
```

Expected: many failures.

**Step 3: Rewrite CombatView.tsx**

```tsx
import { useState } from 'react'
import type { GameState, Room, RunState, ClassName } from '../types'
import {
  DAMAGE_PER_WRONG, BASE_DAMAGE_PER_HIT,
  COINS_PER_ENEMY, COINS_PER_BOSS, enemyHp,
} from '../runState'
import GameBoard from './GameBoard'

interface Props {
  run: RunState
  room: Room
  initialState: GameState
  floor: number
  onCombatEnd: (updatedRun: RunState) => void
}

// Class-specific HP values are set in buildRun, but we also need class names for display
const CLASS_LABELS: Record<ClassName, string> = {
  vowel_mage: '🧙 Vowel Mage',
  archivist: '📚 Archivist',
  berserker: '🪓 Berserker',
  rogue: '🗡️ Rogue',
}

const ABILITY_NAMES: Record<ClassName, string> = {
  vowel_mage: 'Resonance',
  archivist: 'Cross Reference',
  berserker: 'Bloodletter',
  rogue: 'Backstab',
}

const ABILITY_COOLDOWNS: Record<ClassName, number> = {
  vowel_mage: 3,
  archivist: 0, // once per encounter, tracked separately
  berserker: 4,
  rogue: 3,
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

function calcDamageDealt(
  letter: string,
  occurrences: number,
  className: ClassName,
  rage: number,
  combo: number,
  hiddenCount: number,
  isAbilityHit: boolean,
): number {
  let dmgPerOcc = BASE_DAMAGE_PER_HIT

  switch (className) {
    case 'vowel_mage':
      if (VOWELS.has(letter)) dmgPerOcc += 1
      break
    case 'archivist':
      if (hiddenCount >= 5) dmgPerOcc += 1
      break
    case 'berserker':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + rage
      break
    case 'rogue':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + combo
      break
  }

  let total = dmgPerOcc * occurrences
  if (isAbilityHit && (className === 'berserker' || className === 'rogue')) {
    total *= 2
  }
  return total
}

function calcDamageTaken(
  letter: string,
  className: ClassName,
  isAbilityMiss: boolean,
  shield: number,
): { playerDmg: number; shieldLeft: number } {
  const isConsonant = !VOWELS.has(letter)
  let dmg = DAMAGE_PER_WRONG

  if (className === 'vowel_mage' && isConsonant) dmg += 1
  if (className === 'rogue') dmg += 1
  if (className === 'berserker' && isAbilityMiss) dmg *= 2

  const absorbed = Math.min(shield, dmg)
  return { playerDmg: dmg - absorbed, shieldLeft: shield - absorbed }
}

export default function CombatView({ run, room, initialState, floor, onCombatEnd }: Props) {
  const maxEnemyHp = enemyHp(initialState.word.length, floor)
  const [currentEnemyHp, setCurrentEnemyHp] = useState(maxEnemyHp)
  const [displayRun, setDisplayRun] = useState<RunState>(run)
  const [combatDone, setCombatDone] = useState(false)
  const [pendingRun, setPendingRun] = useState<RunState | null>(null)

  // Per-encounter state
  const [rage, setRage] = useState(0)      // Berserker
  const [combo, setCombo] = useState(0)    // Rogue
  const [cooldown, setCooldown] = useState(0)
  const [abilityUsed, setAbilityUsed] = useState(false)  // Archivist once-per-encounter
  const [abilityMode, setAbilityMode] = useState(false)  // targeting mode active

  const hiddenCount = initialState.word.split('').filter(
    (_, i) => !displayRun.hp // use latest masked state
  ).length // simplified — recalc below in handleGuessResult

  function countHidden(maskedWord: string): number {
    return maskedWord.split(' ').filter(c => c === '_').length
  }

  function handleGuessResult(letter: string, correct: boolean, occurrences: number) {
    const isAbilityHit = abilityMode && correct
    const isAbilityMiss = abilityMode && !correct

    if (abilityMode) {
      setAbilityMode(false)
      if (run.className === 'vowel_mage' || run.className === 'berserker' || run.className === 'rogue') {
        setCooldown(ABILITY_COOLDOWNS[run.className])
      }
      if (run.className === 'archivist') setAbilityUsed(true)
    }

    if (correct) {
      const currentHidden = countHidden(initialState.maskedWord) // approximate
      const dmg = calcDamageDealt(letter, occurrences, run.className, rage, combo, currentHidden, isAbilityHit)
      const newEnemyHp = Math.max(0, currentEnemyHp - dmg)
      setCurrentEnemyHp(newEnemyHp)
      if (run.className === 'rogue') setCombo(prev => prev + 1)
      if (run.className === 'vowel_mage' && abilityMode && VOWELS.has(letter)) {
        // Shield: gain 1 per occurrence from Resonance
        const newShield = displayRun.shield + occurrences
        const updated = { ...displayRun, shield: newShield }
        setDisplayRun(updated)
      }
    } else {
      // Wrong guess
      if (run.className === 'rogue') setCombo(0)
      if (run.className === 'berserker') setRage(prev => prev + 1)

      const { playerDmg, shieldLeft } = calcDamageTaken(letter, run.className, isAbilityMiss, displayRun.shield)
      const newHp = Math.max(0, displayRun.hp - playerDmg)
      const updated = { ...displayRun, hp: newHp, shield: shieldLeft }
      setDisplayRun(updated)
    }

    // Decrement cooldown each turn
    if (!abilityMode) setCooldown(prev => Math.max(0, prev - 1))
  }

  function handleWordSolved() {
    finishCombat(true)
  }

  function finishCombat(won: boolean) {
    const coinsEarned = won ? (room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY) : 0
    const updated: RunState = {
      ...displayRun,
      coins: displayRun.coins + coinsEarned,
      status: displayRun.hp <= 0 ? 'lost' : run.status,
    }
    setPendingRun(updated)
    setCombatDone(true)
  }

  function handleContinue() {
    onCombatEnd(pendingRun ?? displayRun)
  }

  function handleAbility() {
    if (run.className === 'archivist') {
      // Cross Reference: show sub-choice (handled inline)
      setAbilityMode(true)
      return
    }
    setAbilityMode(true)
  }

  // Check if enemy died (but word not yet solved — GameBoard handles the 'won' case)
  const enemyDead = currentEnemyHp <= 0 && !combatDone

  const playAgainLabel = displayRun.hp <= 0 ? 'Play Again' : 'Continue'

  const abilityName = ABILITY_NAMES[run.className]
  const abilityCooldownForClass = ABILITY_COOLDOWNS[run.className]
  const abilityAvailable = run.className === 'archivist'
    ? !abilityUsed
    : cooldown === 0
  const abilityDisabled = !abilityAvailable || abilityMode || combatDone || enemyDead
  const abilityLabel = abilityMode
    ? `${abilityName} — choose a letter`
    : cooldown > 0
    ? `${abilityName} (${cooldown})`
    : abilityUsed && run.className === 'archivist'
    ? `${abilityName} (used)`
    : abilityName

  return (
    <div className="combat-view">
      <div className="combat-view__class-label">{CLASS_LABELS[run.className]}</div>
      <div className="combat-view__stats">
        <span className="combat-view__hp">
          HP: {displayRun.hp} / {displayRun.maxHp}
          {displayRun.shield > 0 && <span className="combat-view__shield"> 🛡 {displayRun.shield}</span>}
        </span>
        <span className="combat-view__coins">Coins: {displayRun.coins}</span>
      </div>
      <div className="combat-view__enemy">
        <div className="combat-view__enemy-sprite-placeholder" aria-hidden="true" />
        <div className="combat-view__enemy-hp-label">
          Enemy HP: {Math.max(0, currentEnemyHp)} / {maxEnemyHp}
        </div>
        <div className="combat-view__enemy-hp-bar">
          <div
            className="combat-view__enemy-hp-fill"
            style={{ width: `${Math.max(0, (currentEnemyHp / maxEnemyHp) * 100)}%` }}
          />
        </div>
      </div>
      <p className="combat-view__floor">Floor {floor}</p>
      <GameBoard
        initialState={initialState}
        onGuessResult={handleGuessResult}
        onWordSolved={handleWordSolved}
        onPlayAgain={handleContinue}
        playAgainLabel={playAgainLabel}
        combatOver={combatDone || enemyDead}
      />
      {!combatDone && !enemyDead && (
        <button
          className="btn-ability"
          onClick={handleAbility}
          disabled={abilityDisabled}
        >
          {abilityLabel}
        </button>
      )}
      {enemyDead && !combatDone && (
        <button className="btn-continue" onClick={() => finishCombat(true)}>
          Continue
        </button>
      )}
    </div>
  )
}
```

**Step 4: Run CombatView tests**

```bash
cd frontend && npm test -- CombatView
```

Expected: all pass. Fix any import errors first.

**Step 5: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all pass (App.test.tsx may need mock updates — fix `mockGame` shapes and any `onGameEnd` references to `onWordSolved`).

**Step 6: Add CSS for combat view updates**

Append to `frontend/src/index.css`:

```css
/* ── CombatView additions ───────────────────────────────── */

.combat-view__class-label {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

.combat-view__shield {
  color: #4a90d9;
  margin-left: 0.5rem;
}

.combat-view__enemy {
  margin: 0.75rem 0;
}

.combat-view__enemy-sprite-placeholder {
  width: 80px;
  height: 80px;
  margin: 0 auto 0.5rem;
  border: 2px dashed var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.combat-view__enemy-hp-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.combat-view__enemy-hp-bar {
  width: 200px;
  height: 12px;
  background: var(--border);
  border-radius: 6px;
  margin: 0 auto;
  overflow: hidden;
}

.combat-view__enemy-hp-fill {
  height: 100%;
  background: var(--wrong);
  border-radius: 6px;
  transition: width 0.2s ease;
}

.btn-ability {
  display: block;
  margin: 0.75rem auto 0;
  padding: 0.5rem 1.5rem;
  background: var(--surface);
  color: var(--accent);
  border: 2px solid var(--accent);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}

.btn-ability:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.btn-ability:disabled {
  opacity: 0.4;
  border-color: var(--border);
  color: var(--text-muted);
}

.btn-continue {
  display: block;
  margin: 1rem auto 0;
  padding: 0.6rem 2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
}

.btn-continue:hover {
  background: var(--accent-hover);
}
```

**Step 7: Commit**

```bash
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx frontend/src/index.css
git commit -m "feat: CombatView — enemy HP, class damage, shield, ability button"
```

---

### Task 5: RunSetup rewrite + class CSS

Add class selection cards and how-to-play collapsible.

**Files:**
- Modify: `frontend/src/components/RunSetup.tsx`
- Modify: `frontend/src/components/__tests__/RunSetup.test.tsx`
- Modify: `frontend/src/index.css`

**Step 1: Write new RunSetup tests**

Replace `frontend/src/components/__tests__/RunSetup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunSetup from '../RunSetup'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }

describe('RunSetup', () => {
  it('renders title', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /dungeon hangman/i })).toBeInTheDocument()
  })

  it('renders all 4 class cards', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByText(/vowel mage/i)).toBeInTheDocument()
    expect(screen.getByText(/archivist/i)).toBeInTheDocument()
    expect(screen.getByText(/berserker/i)).toBeInTheDocument()
    expect(screen.getByText(/rogue/i)).toBeInTheDocument()
  })

  it('Start Run button is disabled until a class is selected', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeDisabled()
  })

  it('Start Run button enables after selecting a class', async () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/berserker/i))
    expect(screen.getByRole('button', { name: /start run/i })).not.toBeDisabled()
  })

  it('calls onStart with className when Start Run clicked', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledWith('berserker')
  })

  it('calls onStart with vowel_mage when Vowel Mage selected', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/vowel mage/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledWith('vowel_mage')
  })

  it('shows how-to-play toggle', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /how to play/i })).toBeInTheDocument()
  })

  it('how-to-play content hidden by default', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.queryByText(/3 floors/i)).not.toBeInTheDocument()
  })

  it('how-to-play content visible after clicking toggle', async () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /how to play/i }))
    expect(screen.getByText(/3 floors/i)).toBeInTheDocument()
  })

  it('shows score', () => {
    render(<RunSetup onStart={vi.fn()} score={{ runsCleared: 2, runsFailed: 5, bestRooms: 18 }} onReset={vi.fn()} />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
  })

  it('calls onReset when Forget me clicked', async () => {
    const onReset = vi.fn()
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={onReset} />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Run to confirm failures**

```bash
cd frontend && npm test -- RunSetup
```

Expected: failures (no class cards, `onStart` doesn't accept className).

**Step 3: Rewrite RunSetup.tsx**

```tsx
import { useState } from 'react'
import type { RunScore, ClassName } from '../types'

interface Props {
  onStart: (className: ClassName) => void
  score: RunScore
  onReset: () => void
}

const CLASSES: {
  id: ClassName
  emoji: string
  name: string
  maxHp: number
  passive: string
  active: string
  activeCooldown: string
  con: string
}[] = [
  {
    id: 'vowel_mage',
    emoji: '🧙',
    name: 'Vowel Mage',
    maxHp: 50,
    passive: 'Vowels deal +1 damage per occurrence',
    active: 'Resonance (3-turn cd): choose a vowel — if in word, reveal all + gain 1 shield per instance; if not, take only 1 damage',
    activeCooldown: '3-turn cooldown',
    con: 'Wrong consonant guesses deal +1 damage to you',
  },
  {
    id: 'archivist',
    emoji: '📚',
    name: 'The Archivist',
    maxHp: 45,
    passive: 'See word category, first letter, and length; +1 damage per occurrence if 5+ letters still hidden',
    active: 'Cross Reference (once/encounter): reveal 1 random letter OR eliminate 3 non-word letters',
    activeCooldown: 'Once per encounter',
    con: 'Cannot deal bonus burst damage; -5 max HP',
  },
  {
    id: 'berserker',
    emoji: '🪓',
    name: 'Berserker',
    maxHp: 50,
    passive: 'Each wrong guess: +1 permanent damage this encounter (Rage). Correct guesses deal base + Rage.',
    active: 'Bloodletter (4-turn cd): guess blindly — correct = double damage, wrong = double damage taken',
    activeCooldown: '4-turn cooldown',
    con: 'Cannot use reveal abilities or gain shield',
  },
  {
    id: 'rogue',
    emoji: '🗡️',
    name: 'Rogue',
    maxHp: 40,
    passive: 'Combo: each consecutive correct guess adds +1 stacking damage. Resets on wrong guess.',
    active: 'Backstab (3-turn cd): after 2+ correct in a row — reveal 1 hidden letter + deal double combo damage',
    activeCooldown: '3-turn cooldown',
    con: 'Wrong guesses deal +1 damage to you; lowest max HP (40)',
  },
]

export default function RunSetup({ onStart, score, onReset }: Props) {
  const [selected, setSelected] = useState<ClassName | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="run-setup">
      <h1>Dungeon Hangman</h1>
      <p className="run-setup__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>

      <h2 className="run-setup__choose-heading">Choose your class</h2>
      <div className="class-grid">
        {CLASSES.map(cls => (
          <button
            key={cls.id}
            className={`class-card${selected === cls.id ? ' class-card--selected' : ''}`}
            onClick={() => setSelected(cls.id)}
          >
            <div className="class-card__header">
              <span className="class-card__emoji">{cls.emoji}</span>
              <span className="class-card__name">{cls.name}</span>
              <span className="class-card__hp">{cls.maxHp} HP</span>
            </div>
            <p className="class-card__passive">{cls.passive}</p>
            <p className="class-card__active">{cls.active}</p>
            <p className="class-card__con">{cls.con}</p>
          </button>
        ))}
      </div>

      <button
        className="btn-start-run"
        onClick={() => selected && onStart(selected)}
        disabled={!selected}
      >
        Start Run
      </button>

      <button
        className="btn-how-to-play"
        onClick={() => setShowHelp(v => !v)}
      >
        How to play {showHelp ? '▴' : '▾'}
      </button>

      {showHelp && (
        <div className="how-to-play">
          <p><strong>Run structure:</strong> 3 floors, 11 rooms each</p>
          <p><strong>Room types:</strong> enemy, boss, rest area, treasure</p>
          <p><strong>Combat:</strong> correct guesses damage the enemy; wrong guesses damage you</p>
          <p><strong>Win:</strong> reduce enemy HP to 0 or solve the word</p>
          <p><strong>Lose:</strong> your HP reaches 0</p>
        </div>
      )}

      <button className="btn-forget" onClick={onReset}>Forget me</button>
    </div>
  )
}
```

**Step 4: Run RunSetup tests**

```bash
cd frontend && npm test -- RunSetup
```

Expected: all pass.

**Step 5: Add class card CSS**

Append to `frontend/src/index.css`:

```css
/* ── Class selection ────────────────────────────────────── */

.run-setup__choose-heading {
  margin: 1rem 0 0.5rem;
  font-size: 1rem;
  color: var(--text-muted);
}

.class-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  width: 100%;
  max-width: 580px;
  margin: 0 auto 1rem;
}

.class-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.class-card:hover {
  border-color: var(--accent);
}

.class-card--selected {
  border-color: var(--accent);
  background: #fff8ee;
}

.class-card__header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.class-card__emoji {
  font-size: 1.2rem;
}

.class-card__name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--accent);
  flex: 1;
}

.class-card__hp {
  font-size: 0.8rem;
  color: var(--wrong);
  font-weight: 600;
}

.class-card__passive,
.class-card__active {
  font-size: 0.78rem;
  color: var(--text);
  margin: 0 0 0.3rem;
  line-height: 1.4;
}

.class-card__con {
  font-size: 0.75rem;
  color: var(--wrong);
  margin: 0;
  font-style: italic;
}

/* ── How-to-play ────────────────────────────────────────── */

.btn-how-to-play {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.35rem 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.btn-how-to-play:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.how-to-play {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  text-align: left;
  max-width: 480px;
  margin: 0 auto 0.5rem;
}

.how-to-play p {
  font-size: 0.88rem;
  color: var(--text);
  margin: 0 0 0.4rem;
}

.how-to-play p:last-child {
  margin-bottom: 0;
}
```

**Step 6: Commit**

```bash
git add frontend/src/components/RunSetup.tsx frontend/src/components/__tests__/RunSetup.test.tsx frontend/src/index.css
git commit -m "feat: RunSetup — class selection cards + how-to-play collapsible"
```

---

### Task 6: App.tsx updates + fix remaining test failures

Update App.tsx to pass `className` to `buildRun`, update all mock shapes in test files, verify build.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

**Step 1: Update App.tsx**

Change the `handleStartRun` function and RunSetup usage:

```tsx
// Change this line:
import type { GameState, GameStatus, RunState, RunScore, Room } from './types'
// to:
import type { GameState, GameStatus, RunState, RunScore, Room, ClassName } from './types'

// Change handleStartRun:
async function handleStartRun(className: ClassName) {
  const newRun = buildRun(className)
  saveRun(newRun)
  setRun(newRun)
  await fetchAndEnterCombat(newRun, 'enemy', false)
}

// Change the fetchAndEnterCombat to build GameState without maxWrong/wrongGuessesLeft:
const game: GameState = {
  gameId: data.game_id,
  word: data.word,
  maskedWord: data.masked_word,
  category: data.category,
  firstLetter: data.first_letter,
  guessedLetters: data.guessed_letters,
  status: 'in_progress' as GameStatus,
}

// RunSetup prop — onStart already typed as (className: ClassName) => void,
// so <RunSetup onStart={handleStartRun} ... /> works unchanged.
```

Also remove `maxWrong`, `wrongGuessesLeft` from the `game` object in `fetchAndEnterCombat`. The full updated `fetchAndEnterCombat`:

```tsx
async function fetchAndEnterCombat(
  currentRun: RunState,
  roomType: 'enemy' | 'boss',
  hint: boolean,
) {
  setError(null)
  try {
    const body: Record<string, unknown> = { room_type: roomType }
    if (hint) body.hint = true
    const resp = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await resp.json()
    if (!resp.ok) {
      setError(data.error ?? 'Failed to start game')
      return
    }
    const game: GameState = {
      gameId: data.game_id,
      word: data.word,
      maskedWord: data.masked_word,
      category: data.category,
      firstLetter: data.first_letter,
      guessedLetters: data.guessed_letters,
      status: 'in_progress' as GameStatus,
    }
    if (hint) {
      const withRevealCleared = { ...currentRun, pendingReveal: false }
      setRun(withRevealCleared)
      saveRun(withRevealCleared)
    }
    setCurrentGame(game)
    setPhase('combat')
  } catch {
    setError('Could not reach server — is the backend running?')
  }
}
```

**Step 2: Update App.test.tsx mocks**

In `App.test.tsx`, update all mock fetch responses for `POST /api/game` to include `word`, `category`, `first_letter`:

```ts
// Mock for creating a game — update all instances:
{
  game_id: 'game-1',
  word: 'cat',
  masked_word: '_ _ _',
  category: 'animals',
  first_letter: 'c',
  guessed_letters: [],
}

// Mock for guess responses — update all instances to include occurrences, remove wrong_guesses_left:
{
  masked_word: 'c a t',
  correct: true,
  guessed_letters: ['c', 'a', 't'],
  status: 'won',
  occurrences: 1,
}
```

Also update `buildRun()` calls in tests to pass a className:
```ts
buildRun('berserker')
```

**Step 3: Run all tests**

```bash
cd frontend && npm test
```

Fix any remaining TypeScript errors. Common issues:
- `buildRun()` called without args: add `'berserker'` as default (already done in runState.ts)
- `CombatView` test using old `wrongGuessesLeft` in mock responses: remove those fields

**Step 4: Verify the frontend builds**

```bash
cd frontend && npm run build
```

Expected: build succeeds, `dist/` created, no TypeScript errors.

**Step 5: Run all backend tests**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
```

Expected: all pass.

**Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: App.tsx passes className to buildRun; update GameState shape from new API"
```

---

### Task 7: Archivist passive UI

The Archivist sees word category, first letter, and word length before guessing. Show this in CombatView when the player's class is `archivist`.

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

**Step 1: Add failing test**

Add to `CombatView.test.tsx`:

```tsx
it('shows category, first letter and word length for Archivist', () => {
  const archivistRun = buildRun('archivist')
  render(<CombatView run={archivistRun} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.getByText(/animals/i)).toBeInTheDocument()      // category
  expect(screen.getByText(/first letter.*c/i)).toBeInTheDocument() // first letter
  expect(screen.getByText(/3 letters/i)).toBeInTheDocument()    // word length
})

it('does NOT show Archivist info for other classes', () => {
  render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
  expect(screen.queryByText(/first letter/i)).not.toBeInTheDocument()
})
```

**Step 2: Run to confirm failure**

```bash
cd frontend && npm test -- CombatView
```

**Step 3: Add Archivist info panel to CombatView.tsx**

Add just below the `<p className="combat-view__floor">` element:

```tsx
{run.className === 'archivist' && (
  <div className="combat-view__archivist-info">
    <span>Category: <strong>{initialState.category}</strong></span>
    <span>First letter: <strong>{initialState.firstLetter.toUpperCase()}</strong></span>
    <span><strong>{initialState.word.length}</strong> letters</span>
  </div>
)}
```

Add CSS to `index.css`:

```css
.combat-view__archivist-info {
  display: flex;
  gap: 1rem;
  justify-content: center;
  font-size: 0.82rem;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  margin-bottom: 0.5rem;
}
```

**Step 4: Run tests, commit**

```bash
cd frontend && npm test -- CombatView
cd frontend && npm test
git add frontend/src/components/CombatView.tsx frontend/src/components/__tests__/CombatView.test.tsx frontend/src/index.css
git commit -m "feat: Archivist passive — show category, first letter, word length in combat"
```

---

### Final verification

After all tasks:

```bash
# Backend
cd backend && source venv/bin/activate && pytest tests/ -v

# Frontend
cd frontend && npm test
cd frontend && npm run build
```

All tests pass, build succeeds.
