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
    if not pool:
        raise ValueError(f"No words available for difficulty '{difficulty}'")
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
