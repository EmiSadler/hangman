import pytest
import game as game_module
from game import load_words, select_word, new_game, mask_word, make_guess

@pytest.fixture(autouse=True)
def reset_word_cache():
    game_module._WORDS = None
    yield
    game_module._WORDS = None

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
        if letter not in game["word"] and letter not in game["guessed_letters"]:
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
