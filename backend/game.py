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

def create_session(words: list[tuple[str, str]]) -> dict:
    enemy_pool = list(words)
    boss_pool = [(w, c) for w, c in words if len(w) >= 8]
    random.shuffle(enemy_pool)
    random.shuffle(boss_pool)
    return {
        'enemy': enemy_pool,
        'boss': boss_pool,
        '_all_words': list(words),
    }


def new_game_from_session(session: dict, room_type: str = 'enemy', hint: bool = False) -> dict:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    pool = session[room_type]
    if not pool:
        all_words = session.get('_all_words') or load_words()
        refill = list(all_words) if room_type == 'enemy' else [(w, c) for w, c in all_words if len(w) >= 8]
        random.shuffle(refill)
        pool.extend(refill)
    word, category = pool.pop()
    guessed: list[str] = []
    if hint:
        guessed = [random.choice(list(word))]
    return {
        'word': word,
        'category': category,
        'first_letter': word[0],
        'guessed_letters': guessed,
        'status': 'in_progress',
    }


def solve_word(game: dict, word: str) -> dict:
    if game["status"] != "in_progress":
        raise ValueError("Game is already over")
    if word.lower() == game["word"]:
        game["status"] = "won"
    return {"status": game["status"]}

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
