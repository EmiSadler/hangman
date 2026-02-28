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

def test_new_game_max_wrong(client):
    resp = client.post("/api/game")
    data = resp.get_json()
    assert data["max_wrong"] == 6
    assert data["wrong_guesses_left"] == 6

# --- POST /api/game/<game_id>/guess ---

def test_guess_correct_letter(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "a"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert "a" in data["guessed_letters"]

def test_guess_wrong_letter_decrements(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "z"})
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 5  # 6 - 1

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

def test_guess_win_sets_status(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "hi"

    client.post(f"/api/game/{game_id}/guess", json={"letter": "h"})
    resp = client.post(f"/api/game/{game_id}/guess", json={"letter": "i"})
    assert resp.get_json()["status"] == "won"

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

# --- POST /api/game/<game_id>/solve ---

def test_solve_correct_wins(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is True
    assert data["status"] == "won"

def test_solve_wrong_decrements(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["correct"] is False
    assert data["wrong_guesses_left"] == 5  # 6 - 1

def test_solve_wrong_causes_loss(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["wrong_count"] = 5  # one guess left

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "dog"})
    data = resp.get_json()
    assert data["status"] == "lost"
    assert data["word"] == "cat"

def test_solve_unknown_game_returns_404(client):
    resp = client.post("/api/game/nonexistent-id/solve", json={"word": "cat"})
    assert resp.status_code == 404

def test_solve_after_game_over_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]
    games[game_id]["word"] = "cat"
    games[game_id]["status"] = "won"

    resp = client.post(f"/api/game/{game_id}/solve", json={"word": "cat"})
    assert resp.status_code == 400

def test_solve_missing_word_returns_400(client):
    resp = client.post("/api/game")
    game_id = resp.get_json()["game_id"]

    resp = client.post(f"/api/game/{game_id}/solve", json={})
    assert resp.status_code == 400
