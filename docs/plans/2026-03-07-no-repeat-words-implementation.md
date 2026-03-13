# No-Repeat Words Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Prevent the same word appearing twice in a run by maintaining a server-side shuffled word pool per session that the client cannot manipulate.

**Architecture:** A new `sessions` dict in `app.py` stores per-run word pools (one for enemy words, one for boss words). `POST /api/session` creates a pool and returns a UUID. `POST /api/game` uses the pool when a valid `session_id` is supplied, otherwise falls back to random selection. The frontend creates a session when a run starts, stores the ID in `RunState` (persisted in localStorage), and passes it on every game request.

**Tech Stack:** Python 3.11 / Flask 3 / pytest (backend); React 19 / TypeScript / vitest + @testing-library/react (frontend). Run backend tests from `backend/` with the venv active: `source venv/bin/activate && pytest tests/ -v`. Run frontend tests from `frontend/` with `npm test -- --run`.

---

### Task 1: Backend — session functions in `game.py`

**Files:**
- Modify: `backend/game.py`
- Test: `backend/tests/test_game.py`

**Context:** `game.py` already has `load_words()`, `select_word()`, and `new_game()`. We're adding two new functions: `create_session(words)` which builds two shuffled pools from a word list, and `new_game_from_session(session, room_type, hint)` which pops from the appropriate pool (reshuffling if exhausted) instead of calling `select_word`. These two functions are tested in isolation with a tiny hand-crafted word list so tests never touch the filesystem.

---

**Step 1: Add failing tests to `backend/tests/test_game.py`**

Add this import at the top alongside the existing imports:

```python
from game import load_words, select_word, new_game, mask_word, make_guess, solve_word, create_session, new_game_from_session
```

Add these tests at the bottom of the file:

```python
# --- create_session ---

def test_create_session_has_enemy_and_boss_keys():
    words = [('cat', 'animals'), ('elephant', 'animals'), ('butterfly', 'insects')]
    session = create_session(words)
    assert 'enemy' in session
    assert 'boss' in session

def test_create_session_enemy_pool_contains_all_words():
    words = [('cat', 'animals'), ('elephant', 'animals')]
    session = create_session(words)
    assert len(session['enemy']) == 2

def test_create_session_boss_pool_contains_only_long_words():
    words = [('cat', 'animals'), ('elephant', 'animals'), ('butterfly', 'insects')]
    session = create_session(words)
    # 'elephant' (8) and 'butterfly' (9) qualify; 'cat' (3) does not
    assert len(session['boss']) == 2
    assert all(len(w) >= 8 for w, _ in session['boss'])

# --- new_game_from_session ---

def test_new_game_from_session_returns_valid_game():
    words = [('cat', 'animals'), ('dog', 'animals')]
    session = create_session(words)
    game = new_game_from_session(session, room_type='enemy')
    assert game['status'] == 'in_progress'
    assert game['word'] in ('cat', 'dog')

def test_new_game_from_session_pops_word_from_pool():
    words = [('cat', 'animals'), ('dog', 'animals')]
    session = create_session(words)
    before = len(session['enemy'])
    new_game_from_session(session, room_type='enemy')
    assert len(session['enemy']) == before - 1

def test_new_game_from_session_no_repeats_until_pool_exhausted():
    words = [('cat', 'animals'), ('dog', 'animals'), ('fox', 'animals')]
    session = create_session(words)
    seen = set()
    for _ in range(3):
        game = new_game_from_session(session, room_type='enemy')
        seen.add(game['word'])
    assert len(seen) == 3  # all three distinct words used

def test_new_game_from_session_reshuffles_when_pool_empty():
    words = [('cat', 'animals')]
    session = create_session(words)
    new_game_from_session(session, room_type='enemy')
    assert len(session['enemy']) == 0
    # pool was exhausted; next call should reshuffle and succeed
    game = new_game_from_session(session, room_type='enemy')
    assert game['word'] == 'cat'

def test_new_game_from_session_invalid_room_type_raises():
    words = [('cat', 'animals')]
    session = create_session(words)
    with pytest.raises(ValueError, match='room_type'):
        new_game_from_session(session, room_type='dragon')

def test_new_game_from_session_hint_reveals_one_letter():
    words = [('castle', 'places')]
    session = create_session(words)
    game = new_game_from_session(session, room_type='enemy', hint=True)
    assert len(game['guessed_letters']) == 1
    assert game['guessed_letters'][0] in 'castle'
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -v -k "create_session or new_game_from_session"
```

Expected: `ImportError: cannot import name 'create_session'`

**Step 3: Implement `create_session` and `new_game_from_session` in `backend/game.py`**

Add these two functions after `new_game` (before `make_guess`):

```python
def create_session(words: list[tuple[str, str]]) -> dict:
    enemy_pool = list(words)
    boss_pool = [(w, c) for w, c in words if len(w) >= 8]
    random.shuffle(enemy_pool)
    random.shuffle(boss_pool)
    return {'enemy': enemy_pool, 'boss': boss_pool}


def new_game_from_session(session: dict, room_type: str = 'enemy', hint: bool = False) -> dict:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    pool = session[room_type]
    if not pool:
        all_words = load_words()
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
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_game.py -v -k "create_session or new_game_from_session"
```

Expected: 9 new tests pass.

**Step 5: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: 57 + 9 = 66 tests pass.

**Step 6: Commit**

```bash
git add backend/game.py backend/tests/test_game.py
git commit -m "feat: create_session and new_game_from_session for word deduplication"
```

---

### Task 2: Backend — `POST /api/session` route + update `POST /api/game`

**Files:**
- Modify: `backend/app.py`
- Test: `backend/tests/test_routes.py`

**Context:** `app.py` has `games: dict[str, dict] = {}` and three routes. We add a parallel `sessions` dict and a `POST /api/session` route. We update `POST /api/game` to check for an optional `session_id` in the request body and use `new_game_from_session` if the session is found, otherwise fall back to `new_game`. Unknown session IDs (cold-start) silently fall back — no error.

---

**Step 1: Add failing tests to `backend/tests/test_routes.py`**

Add at the bottom of the file:

```python
# --- POST /api/session ---

def test_create_session_returns_session_id(client):
    resp = client.post('/api/session')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'session_id' in data
    assert isinstance(data['session_id'], str)
    assert len(data['session_id']) > 0

# --- POST /api/game with session_id ---

def test_game_with_valid_session_id_returns_word(client):
    session_resp = client.post('/api/session')
    session_id = session_resp.get_json()['session_id']
    resp = client.post('/api/game', json={'room_type': 'enemy', 'session_id': session_id})
    assert resp.status_code == 200
    assert 'word' in resp.get_json()

def test_game_without_session_id_still_works(client):
    resp = client.post('/api/game', json={'room_type': 'enemy'})
    assert resp.status_code == 200
    assert 'word' in resp.get_json()

def test_game_with_unknown_session_id_falls_back_to_random(client):
    resp = client.post('/api/game', json={'room_type': 'enemy', 'session_id': 'does-not-exist'})
    assert resp.status_code == 200
    assert 'word' in resp.get_json()

def test_session_words_do_not_repeat_within_pool(client):
    from app import sessions
    session_resp = client.post('/api/session')
    session_id = session_resp.get_json()['session_id']
    # Shrink the pool to 3 words so we can exhaust it quickly
    sessions[session_id]['enemy'] = [('cat', 'animals'), ('dog', 'animals'), ('fox', 'animals')]
    seen = []
    for _ in range(3):
        resp = client.post('/api/game', json={'room_type': 'enemy', 'session_id': session_id})
        seen.append(resp.get_json()['word'])
    assert len(set(seen)) == 3  # all unique
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_routes.py -v -k "session"
```

Expected: `404 NOT FOUND` for `POST /api/session`; word-repeat test fails because route doesn't exist.

**Step 3: Update `backend/app.py`**

Replace the import line at the top:

```python
from game import new_game, make_guess, mask_word, solve_word, create_session, new_game_from_session, load_words
```

Add `sessions` dict after `games`:

```python
sessions: dict[str, dict] = {}
```

Add the new route after the `home()` route:

```python
@app.route("/api/session", methods=["POST"])
def new_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = create_session(load_words())
    return jsonify({"session_id": session_id})
```

Update `create_game()` to accept and use `session_id`:

```python
@app.route("/api/game", methods=["POST"])
def create_game():
    data = request.get_json(silent=True) or {}
    room_type = data.get("room_type", "enemy")
    hint = bool(data.get("hint", False))
    session_id = data.get("session_id")
    try:
        if session_id and session_id in sessions:
            game = new_game_from_session(sessions[session_id], room_type=room_type, hint=hint)
        else:
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
```

Also update the `conftest.py` fixture to clear sessions between tests. Open `backend/tests/conftest.py` and check if there is a fixture that resets state — if it only clears `games`, add `sessions.clear()` in the same place. Look for `games.clear()` and add `sessions.clear()` right after it in both the setup and teardown lines.

**Step 4: Update `conftest.py` to reset sessions**

Open `backend/tests/conftest.py` and check the fixture. The `client` fixture in `test_routes.py` already does `games.clear()` in setup and teardown. Update it:

```python
from app import app, games, sessions   # add sessions to import

@pytest.fixture
def client():
    app.config["TESTING"] = True
    games.clear()
    sessions.clear()
    with app.test_client() as client:
        yield client
    games.clear()
    sessions.clear()
```

Note: the `client` fixture lives in `test_routes.py` itself (not conftest). Open `backend/tests/test_routes.py` and update:

```python
from app import app, games, sessions
```

and update the `client` fixture body:

```python
@pytest.fixture
def client():
    app.config["TESTING"] = True
    games.clear()
    sessions.clear()
    with app.test_client() as client:
        yield client
    games.clear()
    sessions.clear()
```

**Step 5: Run tests to verify they pass**

```bash
pytest tests/test_routes.py -v
```

Expected: all previous tests still pass + 5 new tests pass.

**Step 6: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: 66 + 5 = 71 tests pass.

**Step 7: Commit**

```bash
git add backend/app.py backend/tests/test_routes.py
git commit -m "feat: POST /api/session route + session-aware POST /api/game"
```

---

### Task 3: Frontend — `RunState` type + `runState.ts`

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Test: `frontend/src/__tests__/runState.test.ts`

**Context:** `RunState` needs a `sessionId: string | null` field. `buildRun` must initialise it to `null`. `loadRun` must add `if (parsed.sessionId === undefined) parsed.sessionId = null` for backwards compatibility with runs saved before this feature.

---

**Step 1: Add failing tests to `frontend/src/__tests__/runState.test.ts`**

Add inside `describe('buildRun', ...)`:

```ts
it('initialises sessionId to null', () => {
  const run = buildRun('berserker')
  expect(run.sessionId).toBeNull()
})
```

Add inside `describe('localStorage helpers', ...)`:

```ts
it('loadRun sets sessionId to null when missing from saved data', () => {
  const run = buildRun('berserker')
  const legacy = { ...run } as Record<string, unknown>
  delete legacy.sessionId
  localStorage.setItem('hangman_run', JSON.stringify(legacy))
  const loaded = loadRun()
  expect(loaded?.sessionId).toBeNull()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --run src/__tests__/runState.test.ts
```

Expected: TypeScript compilation error — `sessionId` does not exist on type `RunState`.

**Step 3: Add `sessionId` to `RunState` in `frontend/src/types.ts`**

Add the field at the end of the `RunState` interface:

```ts
export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number
  roomIndex: number
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
  className: ClassName
  shield: number
  artifacts: ArtifactId[]
  sessionId: string | null
}
```

**Step 4: Update `buildRun` in `frontend/src/runState.ts`**

Add `sessionId: null,` at the end of the returned object:

```ts
export function buildRun(className: ClassName): RunState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
    artifacts: [],
    sessionId: null,
  }
}
```

**Step 5: Update `loadRun` in `frontend/src/runState.ts`**

Add a backwards-compatibility guard after the existing `artifacts` guard:

```ts
export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunState
    if (!parsed.artifacts) parsed.artifacts = []
    if (parsed.sessionId === undefined) parsed.sessionId = null
    return parsed
  } catch {
    return null
  }
}
```

**Step 6: Run tests to verify they pass**

```bash
npm test -- --run src/__tests__/runState.test.ts
```

Expected: all existing tests + 2 new tests pass.

**Step 7: Run all frontend tests**

```bash
npm test -- --run
```

Expected: 161 + 2 = 163 tests pass.

**Step 8: Commit**

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/__tests__/runState.test.ts
git commit -m "feat: add sessionId to RunState with backwards-compatible loadRun"
```

---

### Task 4: Frontend — session creation in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/App.test.tsx`

**Context:** When a new run starts, `handleStartRun` must call `POST /api/session` to get a session ID, store it in `RunState`, and then call `fetchAndEnterCombat`. `fetchAndEnterCombat` must include `session_id` in the request body when `currentRun.sessionId` is non-null. A `createSession()` helper handles the fetch and returns `null` on any error (graceful degradation). One existing test that uses sequential `mockResolvedValueOnce` calls needs an extra mock call prepended for the session request.

---

**Step 1: Add failing tests to `frontend/src/components/__tests__/App.test.tsx`**

Add these two tests inside `describe('App', ...)`:

```tsx
it('calls POST /api/session when starting a new run', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGameResponse,
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByText(/berserker/i))
  await userEvent.click(screen.getByRole('button', { name: /start run/i }))
  await waitFor(() => screen.getByRole('button', { name: 'A' }))
  expect(fetchMock.mock.calls[0][0]).toBe('/api/session')
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
})

it('passes session_id to POST /api/game when session was created', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'run-abc' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => mockGameResponse })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByText(/berserker/i))
  await userEvent.click(screen.getByRole('button', { name: /start run/i }))
  await waitFor(() => screen.getByRole('button', { name: 'A' }))
  const gameCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
  expect(gameCallBody.session_id).toBe('run-abc')
})
```

Also update the existing `'loads a fresh game board after clicking Continue following a won combat'` test — prepend a session mock as the first `mockResolvedValueOnce` call:

```tsx
it('loads a fresh game board after clicking Continue following a won combat', async () => {
  const game1 = { game_id: 'game-1', masked_word: '_ _ _', word: 'cat', category: 'general', first_letter: 'c', guessed_letters: [] }
  const wonGuess = { correct: true, masked_word: 'c a t', guessed_letters: ['c'], status: 'won' }
  const game2 = { game_id: 'game-2', masked_word: '_ _ _ _ _', word: 'brave', category: 'general', first_letter: 'b', guessed_letters: [] }

  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => game1 })
    .mockResolvedValueOnce({ ok: true, json: async () => wonGuess })
    .mockResolvedValueOnce({ ok: true, json: async () => game2 }),
  )

  render(<App />)
  await userEvent.click(screen.getByText(/berserker/i))
  await userEvent.click(screen.getByRole('button', { name: /start run/i }))
  await waitFor(() => screen.getByRole('button', { name: 'A' }))

  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await waitFor(() => screen.getByRole('button', { name: /continue/i }))

  await userEvent.click(screen.getByRole('button', { name: /continue/i }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument())
  expect(screen.queryByText(/you won/i)).not.toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: the two new tests fail (session fetch not yet called), and the updated existing test fails (wrong call order).

**Step 3: Update `frontend/src/App.tsx`**

Add the `createSession` helper function after the state declarations and before `fetchAndEnterCombat`:

```ts
async function createSession(): Promise<string | null> {
  try {
    const resp = await fetch('/api/session', { method: 'POST' })
    if (!resp.ok) return null
    const data = await resp.json()
    return (data.session_id as string) ?? null
  } catch {
    return null
  }
}
```

Update `handleStartRun` to call `createSession` and store the result:

```ts
async function handleStartRun(className: ClassName) {
  const newRun = buildRun(className)
  const sessionId = await createSession()
  const runWithSession: RunState = { ...newRun, sessionId }
  saveRun(runWithSession)
  setRun(runWithSession)
  await fetchAndEnterCombat(runWithSession, 'enemy', false)
}
```

Update `fetchAndEnterCombat` to include `session_id` when available. Find the line `if (hint) body.hint = true` and add after it:

```ts
if (currentRun.sessionId) body.session_id = currentRun.sessionId
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/components/__tests__/App.test.tsx
```

Expected: all 12 existing + 2 new = 14 tests pass.

**Step 5: Run TypeScript check**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

**Step 6: Run all frontend tests**

```bash
npm test -- --run
```

Expected: 163 + 2 = 165 tests pass.

**Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/__tests__/App.test.tsx
git commit -m "feat: create session on run start and pass session_id to game requests"
```

---

### Final check

Run all tests (both frontend and backend) to confirm nothing is broken:

```bash
# Backend
cd backend && source venv/bin/activate && pytest tests/ -v
# Expected: 71 tests pass

# Frontend
cd frontend && npm test -- --run
# Expected: 165 tests pass
```
