import json
import pytest
import game as game_module
from app import app, games

@pytest.fixture(autouse=True)
def reset_word_cache():
    game_module._WORDS = None
    yield
    game_module._WORDS = None

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
