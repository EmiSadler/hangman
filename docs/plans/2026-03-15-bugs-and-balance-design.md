# Bugs & Balance Design

## Goal

Fix three issues: word repetition within a run, missing cold-start feedback, and invisible damage modifiers (strength meter).

## Architecture

Three independent features. Feature 1 touches backend and frontend. Features 2 and 3 are frontend-only. No new dependencies.

---

## Feature 1: Word Deduplication

### Problem

Two bugs cause word repetition:
1. `create_session` builds separate enemy and boss word pools both drawn from the same 200-word list, so a word can appear in both pools and repeat across rooms.
2. Render cold-starts wipe in-memory sessions. The fallback `select_word` uses `random.choice()` with no deduplication.

### Backend changes

**`backend/game.py` — `create_session`:** Replace the two separate pools with a single unified shuffled pool. Boss rooms find the next word from that pool with `len(word) >= 8` instead of having their own pool.

**`backend/game.py` — `select_word` (fallback path):** Accept an optional `excluded_words: list[str]` parameter. Filter the word list before picking.

**`backend/app.py` — `POST /api/game`:** Accept optional `excluded_words` in the request body. Pass it to `select_word` when falling back (no session found).

### Frontend changes

**`frontend/src/types.ts` — `RunState`:** Add `usedWords: string[]` field.

**`frontend/src/runState.ts` — `buildRun`:** Initialise `usedWords: []`.

**`frontend/src/App.tsx` — `fetchAndEnterCombat`:** Pass `excluded_words: run.usedWords` in the `POST /api/game` body. After combat resolves (word known), append the word to `run.usedWords` and save.

### When to record a used word

After `POST /api/game` succeeds, the response includes the masked word but not the plain word. The plain word is only known at combat end (via `CombatView`'s `onCombatEnd`). The `onCombatEnd` callback already receives the `bossName` (the word) for victory screens — extend it or add a separate callback to record the word in RunState after each room.

Simplest approach: `onCombatEnd` already passes enough context. App reads `currentGame.word` from the game state it holds after session creation. Actually the game word is returned by `POST /api/game` in the response — store it in RunState as `currentWord` when starting combat, then move it to `usedWords` when the room ends.

**`RunState`:** Add `currentWord: string` (the word for the active room, set on combat start, cleared on end). On combat end, push `currentWord` into `usedWords`.

### localStorage migration

`loadRun` already handles missing fields gracefully with defaults — add `usedWords: run.usedWords ?? []` and `currentWord: run.currentWord ?? ''`.

---

## Feature 2: Cold-Start Loading

### Problem

`createSession()` (the first `POST /api/session`) is called when the user clicks "Start Run". On Render cold-start this takes 30–60 seconds with no feedback.

### Solution

Add `starting: boolean` state to `App.tsx` (default `false`).

On "Start Run":
1. Set `starting = true` immediately
2. Call `createSession()`
3. On resolve: set `starting = false`, then proceed as normal
4. On error: set `starting = false`, show error message, stay on RunSetup

**Loading UI:** When `starting` is true, show a full-screen message instead of RunSetup:

```
Waking up the server…
This can take up to a minute on first load.
```

Styled with the existing dark/gold theme. No spinner required — a simple pulsing text or static message is fine.

**Error state:** If `createSession()` returns null (network error), show:

```
Couldn't reach the server. Please try again.
```

with a "Try again" button that re-renders RunSetup.

---

## Feature 3: Strength Meter

### Display

Add a `⚔ N` stat line under the HP line for both player and enemy in `CombatView`. Styled identically to the existing HP and gold stat lines.

### Player ATK (damage dealt per letter occurrence)

Computed each render from existing state — no new stored state:

```
dmgPerOcc = BASE_DAMAGE_PER_HIT  // 2
           + (berserker ? rage : 0)
           + (rogue ? combo : 0)
           + (vowelMage && guessing a vowel ? 1 : 0)  // not statically knowable pre-guess
           + (archivist && hiddenCount >= 5 ? 1 : 0)
           + bonusDamage
           + (artifacts.includes('short_sword') ? 1 : 0)
```

For **Vowel Mage**, the +1 only applies on vowel guesses — show the base without the vowel bonus (it varies per guess). Or show it as a range: "⚔ 2–3". Simplest: show the non-vowel base, add a `(+1 on vowels)` note only for Vowel Mage.

Actually, simplest approach: compute `calcDamageDealt` with `occurrences=1` and `isAbilityHit=false` and a neutral letter (consonant for consistency). This gives the stable per-occurrence baseline. Vowel Mage will show their consonant base; the player already knows vowels deal more.

**Player ATK formula for display:**
```typescript
function calcPlayerAtk(): number {
  let dmg = BASE_DAMAGE_PER_HIT
  if (className === 'berserker') dmg += rage
  if (className === 'rogue') dmg += combo
  if (className === 'archivist' && hiddenCount >= 5) dmg += 1
  dmg += displayRun.bonusDamage
  if (displayRun.artifacts.includes('short_sword')) dmg += 1
  return dmg
}
```

(Vowel Mage shows their consonant base; the vowel bonus is visible via the +1 popup when it fires.)

### Enemy ATK (damage taken per wrong guess)

```typescript
function calcEnemyAtk(): number {
  let dmg = DAMAGE_PER_WRONG
  if (className === 'rogue') dmg += 1
  // Vowel Mage consonant penalty: not pre-knowable (depends on letter), omit
  // Berserker ability miss (×2): only during abilityMode, shown separately
  if (displayRun.artifacts.includes('thick_skin')) dmg = Math.max(1, dmg - 1)
  return dmg
}
```

Shield is **not** deducted here — shield is already displayed separately.

### Testing

- Player ATK reflects `bonusDamage` from treasure/shop
- Player ATK increases when berserker gains rage
- Player ATK increases when rogue builds combo
- Enemy ATK decreases when `thick_skin` artifact is held
- Both stats render in CombatView

---

## Tech Stack

- React 19 + TypeScript (frontend)
- Python 3.11 + Flask 3 (backend)
- localStorage (existing pattern)
- No new dependencies
