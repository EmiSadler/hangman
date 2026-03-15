# Bugs & Balance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix word repetition within a run, add cold-start loading feedback, and display per-occurrence damage stats in CombatView.

**Architecture:** Four independent tasks. Task 1 refactors backend session pooling and adds `excluded_words` fallback. Task 2 threads `usedWords` through frontend run state. Task 3 adds a loading overlay for cold-start. Task 4 adds ATK stat lines in CombatView.

**Tech Stack:** Python 3.11 + Flask 3 (backend, pytest), React 19 + TypeScript + Vitest (frontend), localStorage (existing pattern), no new dependencies.

---

## Task 1: Backend — unified word pool + excluded_words

**Files:**
- Modify: `backend/game.py`
- Modify: `backend/app.py`
- Modify: `backend/tests/test_game.py` (rewrite 3 tests, update 2, add 3)

### Step 1: Rewrite the three create_session tests and add new select_word/new_game tests

In `backend/tests/test_game.py`, replace lines 199–215 (`test_create_session_has_enemy_and_boss_keys`, `test_create_session_enemy_pool_contains_all_words`, `test_create_session_boss_pool_contains_only_long_words`) with:

```python
def test_create_session_has_pool_key():
    words = [('cat', 'animals'), ('elephant', 'animals'), ('butterfly', 'insects')]
    session = create_session(words)
    assert 'pool' in session

def test_create_session_pool_contains_all_words():
    words = [('cat', 'animals'), ('elephant', 'animals')]
    session = create_session(words)
    assert len(session['pool']) == 2

def test_create_session_single_unified_pool():
    words = [('cat', 'animals'), ('elephant', 'animals'), ('butterfly', 'insects')]
    session = create_session(words)
    assert 'enemy' not in session
    assert 'boss' not in session
```

Also update the two `new_game_from_session` tests that reference `session['enemy']` (lines 226–231 and 242–249):

```python
def test_new_game_from_session_pops_word_from_pool():
    words = [('cat', 'animals'), ('dog', 'animals')]
    session = create_session(words)
    before = len(session['pool'])
    new_game_from_session(session, room_type='enemy')
    assert len(session['pool']) == before - 1

def test_new_game_from_session_reshuffles_when_pool_empty():
    words = [('cat', 'animals')]
    session = create_session(words)
    new_game_from_session(session, room_type='enemy')
    assert len(session['pool']) == 0
    game = new_game_from_session(session, room_type='enemy')
    assert game['word'] == 'cat'
```

And add three new tests after the existing `new_game_from_session` group:

```python
def test_new_game_from_session_boss_room_returns_long_word():
    words = [('cat', 'animals'), ('elephant', 'animals'), ('butterfly', 'insects')]
    session = create_session(words)
    game = new_game_from_session(session, room_type='boss')
    assert len(game['word']) >= 8

def test_select_word_excludes_specified_words():
    word1, _ = select_word('enemy')
    word2, _ = select_word('enemy', excluded_words=[word1])
    assert word2 != word1

def test_new_game_excludes_specified_words():
    first = new_game(room_type='enemy')
    second = new_game(room_type='enemy', excluded_words=[first['word']])
    assert second['word'] != first['word']
```

### Step 2: Run backend tests to verify the 8 new/rewritten tests fail

```bash
cd backend && source venv/bin/activate && pytest tests/test_game.py -v 2>&1 | tail -30
```

Expected: 8 failures (the 3 rewritten create_session tests, 2 updated new_game_from_session tests, 1 boss test, 2 select_word/new_game tests). All other tests should still pass.

### Step 3: Implement changes in game.py

Replace the entire `backend/game.py` with:

```python
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

def select_word(room_type: str = 'enemy', excluded_words: list[str] | None = None) -> tuple[str, str]:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    words = load_words()
    if room_type == 'boss':
        words = [(w, c) for w, c in words if len(w) >= 8]
        if not words:
            raise ValueError("No words available for room_type='boss'")
    if excluded_words:
        filtered = [(w, c) for w, c in words if w not in excluded_words]
        if filtered:
            words = filtered
    return random.choice(words)

def mask_word(word: str, guessed_letters: list[str]) -> str:
    return " ".join(c if c in guessed_letters else "_" for c in word)

def new_game(room_type: str = 'enemy', hint: bool = False, excluded_words: list[str] | None = None) -> dict:
    word, category = select_word(room_type, excluded_words)
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
    pool = list(words)
    random.shuffle(pool)
    return {
        'pool': pool,
        '_all_words': list(words),
    }

def new_game_from_session(session: dict, room_type: str = 'enemy', hint: bool = False) -> dict:
    if room_type not in ('enemy', 'boss'):
        raise ValueError(f"Invalid room_type: {room_type!r}")
    pool = session['pool']
    if room_type == 'boss':
        idx = next((i for i, (w, _) in enumerate(pool) if len(w) >= 8), None)
        if idx is None:
            all_words = session.get('_all_words') or load_words()
            refill = [(w, c) for w, c in all_words if len(w) >= 8]
            random.shuffle(refill)
            pool.extend(refill)
            idx = next(i for i, (w, _) in enumerate(pool) if len(w) >= 8)
        word, category = pool.pop(idx)
    else:
        if not pool:
            all_words = session.get('_all_words') or load_words()
            refill = list(all_words)
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
```

### Step 4: Update app.py to pass excluded_words to new_game

In `backend/app.py`, in the `create_game()` function, update the fallback `new_game` call:

Current (lines 30–39):
```python
data = request.get_json(silent=True) or {}
room_type = data.get("room_type", "enemy")
hint = bool(data.get("hint", False))
session_id = data.get("session_id")
try:
    if session_id and session_id in sessions:
        game = new_game_from_session(sessions[session_id], room_type=room_type, hint=hint)
    else:
        game = new_game(room_type=room_type, hint=hint)
```

Replace with:
```python
data = request.get_json(silent=True) or {}
room_type = data.get("room_type", "enemy")
hint = bool(data.get("hint", False))
session_id = data.get("session_id")
excluded_words = data.get("excluded_words") or []
try:
    if session_id and session_id in sessions:
        game = new_game_from_session(sessions[session_id], room_type=room_type, hint=hint)
    else:
        game = new_game(room_type=room_type, hint=hint, excluded_words=excluded_words)
```

### Step 5: Run all backend tests and verify they pass

```bash
cd backend && source venv/bin/activate && pytest tests/ -v 2>&1 | tail -20
```

Expected: all tests pass (count should be previous total + 3 new tests).

### Step 6: Commit

```bash
git add backend/game.py backend/app.py backend/tests/test_game.py
git commit -m "$(cat <<'EOF'
feat: unify session word pool, add excluded_words fallback

- create_session now uses a single shuffled pool (eliminates enemy/boss overlap)
- new_game_from_session scans unified pool for boss words (len >= 8)
- select_word and new_game accept excluded_words for cold-start dedup

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — usedWords tracking

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/runState.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

### Step 1: Write failing test for excluded_words in POST /api/game

Add to `frontend/src/components/__tests__/App.test.tsx`:

```tsx
it('sends excluded_words in POST /api/game when resumed run has usedWords', async () => {
  const savedRun = {
    ...buildRun('berserker', ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId]),
    status: 'in_progress' as const,
    usedWords: ['cat', 'dog'],
  }
  localStorage.setItem('hangman_run', JSON.stringify(savedRun))

  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockGameResponse,
  })
  vi.stubGlobal('fetch', mockFetch)

  render(<App />)

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalled()
    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.excluded_words).toEqual(['cat', 'dog'])
  })
})
```

You'll also need to add the `ThemeId` import at the top:
```tsx
import type { ThemeId } from '../../types'
```

And add `buildRun` to the existing import from `'../../runState'`.

### Step 2: Run test to verify it fails

```bash
cd frontend && npm test -- --run 2>&1 | grep -A5 "excluded_words"
```

Expected: FAIL — `body.excluded_words` is undefined.

### Step 3: Add usedWords to RunState in types.ts

In `frontend/src/types.ts`, add `usedWords: string[]` to `RunState` after `bonusDamage`:

```typescript
export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number        // 1–3
  roomIndex: number    // 0–11
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
  className: ClassName
  shield: number
  artifacts: ArtifactId[]
  sessionId: string | null
  bonusDamage: number
  usedWords: string[]
  floorThemes: [ThemeId, ThemeId, ThemeId]
}
```

### Step 4: Update buildRun in runState.ts

In `frontend/src/runState.ts`, add `usedWords: []` to the object returned by `buildRun` (after `bonusDamage: 0`):

```typescript
export function buildRun(className: ClassName, floorThemes?: [ThemeId, ThemeId, ThemeId]): RunState {
  const maxHp = CLASS_MAX_HP[className]
  return {
    hp: maxHp,
    maxHp,
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
    bonusDamage: 0,
    usedWords: [],
    floorThemes: floorThemes ?? ['space', 'swamp', 'desert'],
  }
}
```

### Step 5: Add migration guard in loadRun

In `frontend/src/runState.ts`, inside `loadRun()` after the existing guards (after line `if (!Array.isArray(parsed.floorThemes)...`):

```typescript
if (!Array.isArray(parsed.usedWords)) parsed.usedWords = []
```

### Step 6: Update fetchAndEnterCombat in App.tsx

In `frontend/src/App.tsx`, in `fetchAndEnterCombat`, add `excluded_words` to the body when `usedWords` is non-empty. Update lines 70–72:

Current:
```typescript
const body: Record<string, unknown> = { room_type: roomType }
if (hint) body.hint = true
if (currentRun.sessionId) body.session_id = currentRun.sessionId
```

Replace with:
```typescript
const body: Record<string, unknown> = { room_type: roomType }
if (hint) body.hint = true
if (currentRun.sessionId) body.session_id = currentRun.sessionId
if (currentRun.usedWords.length > 0) body.excluded_words = currentRun.usedWords
```

### Step 7: Update handleCombatEnd to append the word to usedWords

In `frontend/src/App.tsx`, in `handleCombatEnd`, insert a `usedWords` update at the top. Replace:

```typescript
async function handleCombatEnd(updatedRun: RunState, bossName?: string) {
  const roomIndex = updatedRun.roomIndex
  const updatedRooms = updatedRun.rooms.map((r, i) =>
    i === roomIndex ? { ...r, completed: true } : r,
  )
```

With:

```typescript
async function handleCombatEnd(updatedRun: RunState, bossName?: string) {
  const word = currentGame?.word
  if (word) {
    updatedRun = { ...updatedRun, usedWords: [...updatedRun.usedWords, word] }
  }
  const roomIndex = updatedRun.roomIndex
  const updatedRooms = updatedRun.rooms.map((r, i) =>
    i === roomIndex ? { ...r, completed: true } : r,
  )
```

### Step 8: Run all frontend tests and verify they pass

```bash
cd frontend && npm test -- --run 2>&1 | tail -10
```

Expected: all tests pass.

### Step 9: Commit

```bash
git add frontend/src/types.ts frontend/src/runState.ts frontend/src/App.tsx frontend/src/components/__tests__/App.test.tsx
git commit -m "$(cat <<'EOF'
feat: track used words in run state, pass to API as excluded_words

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — cold-start loading UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/__tests__/App.test.tsx`

### Step 1: Write failing test for loading message

Add to `frontend/src/components/__tests__/App.test.tsx`:

```tsx
it('shows loading message while session is being created', async () => {
  let resolveSession!: (v: unknown) => void
  const pendingSession = new Promise(r => { resolveSession = r })
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pendingSession))

  render(<App />)
  await userEvent.click(screen.getByText(/berserker/i))
  await userEvent.click(screen.getByRole('button', { name: /start run/i }))

  expect(screen.getByText(/waking up the server/i)).toBeInTheDocument()

  resolveSession({ ok: true, json: async () => ({ session_id: 'test-session' }) })
  await waitFor(() => {
    expect(screen.queryByText(/waking up the server/i)).not.toBeInTheDocument()
  })
})

it('shows error message when session creation fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')))

  render(<App />)
  await userEvent.click(screen.getByText(/berserker/i))
  await userEvent.click(screen.getByRole('button', { name: /start run/i }))

  await waitFor(() => {
    expect(screen.getByText(/couldn't reach the server/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd frontend && npm test -- --run 2>&1 | grep -A5 "loading message\|session creation fails"
```

Expected: 2 FAILs.

### Step 3: Add starting state and update handleStartRun in App.tsx

In `frontend/src/App.tsx`, add the `starting` state after the existing state declarations (after line 31):

```typescript
const [starting, setStarting] = useState(false)
```

Replace the `handleStartRun` function (lines 109–117):

Current:
```typescript
async function handleStartRun(className: ClassName) {
  const newRun = buildRun(className, pickFloorThemes())
  const sessionId = await createSession()
  const runWithSession: RunState = { ...newRun, sessionId }
  saveRun(runWithSession)
  setRun(runWithSession)
  setDefeatedBossName(null)
  setPhase('floor_intro')
}
```

Replace with:
```typescript
async function handleStartRun(className: ClassName) {
  setStarting(true)
  const newRun = buildRun(className, pickFloorThemes())
  let sessionId: string | null = null
  try {
    sessionId = await createSession()
  } catch {
    setStarting(false)
    setError("Couldn't reach the server. Please try again.")
    return
  }
  if (sessionId === null) {
    setStarting(false)
    setError("Couldn't reach the server. Please try again.")
    return
  }
  setStarting(false)
  const runWithSession: RunState = { ...newRun, sessionId }
  saveRun(runWithSession)
  setRun(runWithSession)
  setDefeatedBossName(null)
  setPhase('floor_intro')
}
```

### Step 4: Add loading UI and "Try again" button JSX in App.tsx

In the return JSX of `App.tsx`, replace the `{phase === 'idle' && ...}` block. Currently:

```tsx
{phase === 'idle' && (
  <RunSetup
    onStart={handleStartRun}
    score={score}
    onReset={handleReset}
    onShowHelp={() => setPhase('how_to_play')}
  />
)}
```

Replace with:

```tsx
{starting && (
  <div className="cold-start-overlay">
    <p className="cold-start-overlay__message">Waking up the server…</p>
    <p className="cold-start-overlay__sub">This can take up to a minute on first load.</p>
  </div>
)}

{phase === 'idle' && !starting && (
  <RunSetup
    onStart={handleStartRun}
    score={score}
    onReset={handleReset}
    onShowHelp={() => setPhase('how_to_play')}
  />
)}
```

Also update the error display in the JSX. The existing `{error && <p className="app__error">{error}</p>}` stays, but add a "Try again" button when the error is the cold-start error and we're on the idle phase. Replace:

```tsx
{error && <p className="app__error">{error}</p>}
```

With:

```tsx
{error && (
  <div className="app__error-block">
    <p className="app__error">{error}</p>
    {phase === 'idle' && (
      <button className="btn btn--secondary" onClick={() => setError(null)}>Try again</button>
    )}
  </div>
)}
```

### Step 5: Add CSS for cold-start overlay

In `frontend/src/index.css`, append:

```css
/* Cold-start loading overlay */
.cold-start-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 0.75rem;
}

.cold-start-overlay__message {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-gold, #c9a84c);
  animation: pulse 2s ease-in-out infinite;
}

.cold-start-overlay__sub {
  color: var(--color-text-muted, #9a9a9a);
  font-size: 0.9rem;
}

.app__error-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
```

### Step 6: Run all frontend tests and verify they pass

```bash
cd frontend && npm test -- --run 2>&1 | tail -10
```

Expected: all tests pass.

### Step 7: Commit

```bash
git add frontend/src/App.tsx frontend/src/index.css frontend/src/components/__tests__/App.test.tsx
git commit -m "$(cat <<'EOF'
feat: show loading overlay during Render cold-start

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — Strength meter in CombatView

**Files:**
- Modify: `frontend/src/components/CombatView.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/__tests__/CombatView.test.tsx`

### Step 1: Write failing tests for ATK display

Add to `frontend/src/components/__tests__/CombatView.test.tsx`:

```tsx
describe('ATK stats', () => {
  it('renders player ATK and enemy ATK', () => {
    const run = buildRun('berserker')
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // BASE_DAMAGE_PER_HIT=2, rage=0, bonusDamage=0, no short_sword → player ATK 2
    // DAMAGE_PER_WRONG=2, no thick_skin, rogue penalty n/a → enemy ATK 2
    const atkEls = screen.getAllByText(/⚔\s*2/)
    expect(atkEls.length).toBeGreaterThanOrEqual(2)
  })

  it('player ATK increases with bonusDamage', () => {
    const run = { ...buildRun('berserker'), bonusDamage: 3 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // BASE(2) + bonusDamage(3) = 5
    expect(screen.getByText(/⚔\s*5/)).toBeInTheDocument()
  })

  it('enemy ATK decreases with thick_skin artifact', () => {
    const run = { ...buildRun('berserker'), artifacts: ['thick_skin' as ArtifactId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // DAMAGE_PER_WRONG(2) - thick_skin(1) = 1
    expect(screen.getByText(/⚔\s*1/)).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd frontend && npm test -- --run 2>&1 | grep -A5 "ATK stats"
```

Expected: 3 FAILs — `⚔ N` elements not found.

### Step 3: Add calcPlayerAtk and calcEnemyAtk functions in CombatView.tsx

In `frontend/src/components/CombatView.tsx`, add these two functions inside the `CombatView` component, just before the `return` statement (around line 521). Insert after the last computed value block (after `abilityLabel`):

```typescript
function calcPlayerAtk(): number {
  let dmg = BASE_DAMAGE_PER_HIT
  if (run.className === 'berserker') dmg += rage
  if (run.className === 'rogue') dmg += combo
  if (run.className === 'archivist' && hiddenCount >= 5) dmg += 1
  dmg += displayRun.bonusDamage
  if (displayRun.artifacts.includes('short_sword')) dmg += 1
  return dmg
}

function calcEnemyAtk(): number {
  let dmg = DAMAGE_PER_WRONG
  if (run.className === 'rogue') dmg += 1
  if (displayRun.artifacts.includes('thick_skin')) dmg = Math.max(1, dmg - 1)
  return dmg
}
```

### Step 4: Add ATK display JSX

**Player ATK:** In the `combat-view__stats` div (lines 546–552), add a `⚔` span after the HP span and before the coins span:

Current:
```tsx
<div className="combat-view__stats">
  <span className="combat-view__hp">
    HP: {displayRun.hp} / {displayRun.maxHp}
    {displayRun.shield > 0 && <span className="combat-view__shield"> 🛡 {displayRun.shield}</span>}
  </span>
  <span className="combat-view__coins">Coins: {displayRun.coins}</span>
</div>
```

Replace with:
```tsx
<div className="combat-view__stats">
  <span className="combat-view__hp">
    HP: {displayRun.hp} / {displayRun.maxHp}
    {displayRun.shield > 0 && <span className="combat-view__shield"> 🛡 {displayRun.shield}</span>}
  </span>
  <span className="combat-view__atk">⚔ {calcPlayerAtk()}</span>
  <span className="combat-view__coins">Coins: {displayRun.coins}</span>
</div>
```

**Enemy ATK:** After the `combat-view__enemy-hp-label` div (line 591–593), add:

Current:
```tsx
<div className="combat-view__enemy-hp-label">
  Enemy HP: {Math.max(0, currentEnemyHp)} / {maxEnemyHp}
</div>
```

Replace with:
```tsx
<div className="combat-view__enemy-hp-label">
  Enemy HP: {Math.max(0, currentEnemyHp)} / {maxEnemyHp}
</div>
<div className="combat-view__enemy-atk-label">⚔ {calcEnemyAtk()}</div>
```

### Step 5: Add CSS for ATK stat lines

In `frontend/src/index.css`, append:

```css
/* ATK stat lines */
.combat-view__atk {
  font-size: 0.85rem;
  color: var(--color-text-muted, #9a9a9a);
}

.combat-view__enemy-atk-label {
  font-size: 0.85rem;
  color: var(--color-text-muted, #9a9a9a);
  text-align: center;
}
```

### Step 6: Run all frontend tests and verify they pass

```bash
cd frontend && npm test -- --run 2>&1 | tail -10
```

Expected: all tests pass.

### Step 7: Commit

```bash
git add frontend/src/components/CombatView.tsx frontend/src/index.css frontend/src/components/__tests__/CombatView.test.tsx
git commit -m "$(cat <<'EOF'
feat: show ATK stat line under HP for player and enemy

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
