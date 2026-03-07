# No-Repeat Words Design

## Goal

Prevent the same word appearing twice in a single run. Words are tracked server-side so the client cannot manipulate which words are excluded.

## Architecture

### Backend

A `sessions` dict (parallel to `games`) stores a per-run word pool:

```python
sessions: dict[str, dict] = {}
# { session_id: { "enemy": ["word1", ...], "boss": ["word1", ...] } }
```

**`POST /api/session`** — creates a new session. Loads all words, splits into enemy pool (any length) and boss pool (≥ 8 letters), shuffles both independently, stores under a UUID, returns `{ "session_id": "uuid" }`.

**`POST /api/game`** — accepts an optional `session_id` in the request body. If present and found, pops the next word from the appropriate pool instead of calling `select_word`. If the pool is exhausted, reshuffles it silently (graceful fallback for very long sessions). If `session_id` is absent or the session is not found (e.g. server cold-start), falls back to random `select_word` — no crash, just no deduplication for that game.

### Frontend

**`RunState`** gains `sessionId: string | null` (null = no session yet / legacy run).

**`App.tsx`** — when starting a new run, calls `POST /api/session` before entering the first room, stores the returned `session_id` in `RunState`, persists it in localStorage. On every subsequent `POST /api/game`, passes `session_id` in the body. If that call fails with a session-not-found error (cold-start recovery), creates a new session silently and retries once.

**`loadRun`** — already handles missing fields gracefully; add `if (!parsed.sessionId) parsed.sessionId = null` for backwards compatibility with runs saved before this feature.

## Data Flow

```
Player starts run
  → POST /api/session
  → { session_id }
  → RunState.sessionId = session_id (saved to localStorage)

Player enters combat room
  → POST /api/game { room_type, session_id, hint? }
  → Backend pops next word from session pool
  → { game_id, word, masked_word, ... }

If session not found (cold-start)
  → POST /api/session (new session)
  → retry POST /api/game
```

## Error Handling

| Scenario | Behaviour |
|---|---|
| Session not found (cold-start) | Create new session, retry once |
| Pool exhausted | Reshuffle pool, continue |
| `/api/session` network error | Log, proceed without session (random words) |
| Legacy run (no sessionId) | Pass no session_id; backend falls back to random |

## Files Touched

| File | Change |
|---|---|
| `backend/game.py` | `create_session()`, update `select_word_from_session()` |
| `backend/app.py` | `POST /api/session` route; update `POST /api/game` to accept `session_id` |
| `backend/tests/test_game.py` | Tests for session creation, pool depletion, reshuffle |
| `backend/tests/test_routes.py` | Tests for `/api/session` route and session-aware game creation |
| `frontend/src/types.ts` | Add `sessionId: string \| null` to `RunState` |
| `frontend/src/runState.ts` | Add `sessionId: null` to `buildRun`; backwards-compat in `loadRun` |
| `frontend/src/App.tsx` | Call `POST /api/session` on run start; pass `session_id` to game creation; cold-start retry |
