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
