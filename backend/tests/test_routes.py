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
