# Hangman Game — Design Document
_2026-02-27_

## Overview

A hangman word-guessing game built as a learning project for Python/Flask and React/TypeScript. The backend manages all game state; the frontend handles display and user interaction.

---

## Architecture

```
frontend/          (Vite + React 19 + TypeScript)
  src/
    App.tsx           — root; holds session score (wins/losses)
    components/
      GameSetup.tsx   — difficulty picker and start button
      GameBoard.tsx   — main game screen; holds game state
      HangmanSvg.tsx  — SVG figure, progressively revealed
      WordDisplay.tsx — masked word with revealed letters
      Keyboard.tsx    — A–Z buttons, colored by guess result
      GameResult.tsx  — win/lose banner and play again button

backend/
  app.py            — Flask routes and in-memory game store
  words.txt         — ~1000 common English words (one per line)
```

In development, Vite proxies `/api/*` requests to `localhost:5000` so no CORS config is needed beyond what's already in place.

---

## Backend

### Session management

Games are stored in a Python dict on the server, keyed by UUID:

```python
games: dict[str, GameState] = {}
```

The frontend receives the UUID when a game starts and includes it in every subsequent request.

### Difficulty

| Difficulty | Word length | Wrong guesses allowed |
|------------|-------------|----------------------|
| easy       | ≤ 5 letters | 8                    |
| medium     | 6–8 letters | 6                    |
| hard       | ≥ 9 letters | 4                    |

Words are loaded from `words.txt` at startup and filtered by length per difficulty on each new game request.

### API endpoints

**`POST /api/game`**
Start a new game.
```
Request:  { "difficulty": "easy" | "medium" | "hard" }
Response: {
  "game_id": "<uuid>",
  "masked_word": "_ _ _ _ _",
  "max_wrong": 8,
  "wrong_guesses_left": 8,
  "guessed_letters": []
}
```

**`POST /api/game/<game_id>/guess`**
Submit a single letter guess.
```
Request:  { "letter": "a" }
Response: {
  "masked_word": "_ a _ _ _",
  "correct": true,
  "wrong_guesses_left": 8,
  "guessed_letters": ["a"],
  "status": "in_progress" | "won" | "lost",
  "word": null          // revealed only when status == "lost"
}
```

Error responses (HTTP 400): invalid letter, duplicate guess, unknown game_id.

---

## Frontend

### Component tree

```
App
├── score state: { wins: number, losses: number }
├── GameSetup          (when no active game)
│   └── difficulty buttons → POST /api/game
└── GameBoard          (when game is active)
    ├── game state: masked_word, guessed_letters, wrong_guesses_left, status
    ├── HangmanSvg     (prop: wrongCount, maxWrong)
    ├── WordDisplay    (prop: maskedWord)
    ├── Keyboard       (prop: guessedLetters, onGuess callback)
    └── GameResult     (rendered when status != "in_progress")
        └── Play Again → clears game, returns to GameSetup
```

### HangmanSvg

SVG component that progressively reveals body parts based on `wrongCount`. Parts drawn in order: gallows → head → body → left arm → right arm → left leg → right leg. The total number of parts drawn when the game is lost equals `maxWrong` (so all modes show a complete figure at game over).

### Keyboard

26 letter buttons, A–Z. Each button is:
- **Default** — not yet guessed
- **Green** — guessed, letter is in the word
- **Red** — guessed, letter is not in the word
- **Disabled** — already guessed (prevents duplicate submissions)

### Score

`App.tsx` holds `{ wins, losses }` in React state. `GameResult` calls a callback to increment the appropriate counter when a game ends. Score resets on page refresh (session-only).

---

## Error handling

- **Frontend**: disables guessed letters to prevent duplicate submissions; shows an inline error message on network failure ("Could not reach server — try again").
- **Backend**: returns HTTP 400 with a descriptive message for invalid input (bad letter format, duplicate guess, unknown game_id).

---

## Testing

**Backend** (`pytest`):
- Unit tests: word selection by difficulty, masking logic, guess validation
- Route tests: new game endpoint, guess endpoint (correct/incorrect/duplicate/win/lose)

**Frontend** (`vitest` + React Testing Library):
- `Keyboard`: buttons disable after guess, correct color applied
- `WordDisplay`: renders blanks and revealed letters correctly
- `GameBoard`: win and lose state transitions

**Manual**:
- Play through a full win path on each difficulty
- Play through a full loss path on hard
- Verify score increments correctly
- Verify "Play Again" resets the board
