import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS
from game import new_game, make_guess, mask_word, solve_word

app = Flask(__name__)
CORS(app)

games: dict[str, dict] = {}
# NOTE: games are never evicted from this dict (acceptable for a prototype, would need TTL or cleanup for production use).


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


@app.route("/api/game/<game_id>/solve", methods=["POST"])
def solve(game_id: str):
    game = games.get(game_id)
    if game is None:
        return jsonify({"error": "game not found"}), 404
    data = request.get_json(silent=True) or {}
    word = data.get("word", "")
    try:
        result = solve_word(game, word)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
