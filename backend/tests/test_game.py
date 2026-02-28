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

# --- select_word room_type ---

def test_select_word_enemy_returns_any_word():
    word = select_word(room_type='enemy')
    assert word in load_words()

def test_select_word_boss_returns_word_length_gte_8():
    for _ in range(20):
        word = select_word(room_type='boss')
        assert len(word) >= 8, f"boss word '{word}' is shorter than 8 letters"

def test_select_word_boss_word_in_word_list():
    word = select_word(room_type='boss')
    assert word in load_words()

def test_select_word_invalid_room_type_raises():
    with pytest.raises(ValueError, match="room_type"):
        select_word(room_type='invalid')

# --- new_game room_type + hint ---

def test_new_game_boss_word_length_gte_8():
    for _ in range(10):
        game = new_game(room_type='boss')
        assert len(game["word"]) >= 8

def test_new_game_hint_true_has_one_guessed_letter():
    game = new_game(hint=True)
    assert len(game["guessed_letters"]) == 1
    assert game["guessed_letters"][0] in game["word"]

def test_new_game_hint_false_has_no_guessed_letters():
    game = new_game(hint=False)
    assert game["guessed_letters"] == []

def test_new_game_hint_default_is_false():
    game = new_game()
    assert game["guessed_letters"] == []

def test_solve_word_non_alpha_raises():
    game = new_game()
    game["word"] = "cat"
    with pytest.raises(ValueError, match="only letters"):
        solve_word(game, "123")
