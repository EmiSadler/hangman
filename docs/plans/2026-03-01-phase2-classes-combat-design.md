# Dungeon Roguelike — Phase 2: Classes & Combat Redesign
_2026-03-01_

## Overview

Phase 2 removes the hangman mechanic entirely and replaces it with a proper RPG combat system. Players choose a class at run start, each with a unique passive, active ability, and drawback. Combat is now driven by enemy HP and player HP — no wrong-guess limit.

---

## Combat System Redesign

### Removing Hangman

The hangman figure (`HangmanSvg`) and wrong-guess limit (`max_wrong` / `wrong_guesses_left`) are removed. The backend no longer returns `status: 'lost'` — it only returns `'in_progress'` or `'won'` (word fully solved). The frontend owns all run-end logic via HP.

### Enemy HP

```
Enemy HP = word_length × floor × 2
```

Examples:
| Word length | Floor 1 | Floor 2 | Floor 3 |
|-------------|---------|---------|---------|
| 5 letters   | 10 HP   | 20 HP   | 30 HP   |
| 8 letters   | 16 HP   | 32 HP   | 48 HP   |

### Damage

**Correct guess** → `2 damage × number of occurrences` of that letter in the word.
- Guessing 'L' in "hello" (appears twice) = 4 damage.
- A clean full solve on floor 1 always kills the enemy exactly.
- On floor 2+, class abilities and combos are required to kill before solving.

**Wrong guess** → player takes 2 damage. Some classes modify this.

### Combat End Conditions

| Condition | Result |
|-----------|--------|
| Enemy HP hits 0 | All unrevealed letters flash into view, combat ends, player advances |
| Word fully solved | Combat ends, player advances |
| Player HP hits 0 | Run ends immediately (defeat) |

When the enemy dies before the word is solved, the remaining letters auto-reveal as a victory flourish — there is no free-solving phase.

### Shield

Gained via Vowel Mage's Resonance ability. Each shield point absorbs 1 damage from the next wrong guess, then is consumed. Displayed as a value next to the player HP bar.

### Visual

The hangman figure area becomes the enemy area:
- Enemy HP bar
- Sprite placeholder div (sprites added in a future phase)
- Player HP bar + shield indicator remains below

---

## Class System

Class is chosen on the start screen before a run begins. It persists for the whole run.

**Base stats:** 50 max HP, 2 damage per correct letter occurrence, 2 damage taken per wrong guess.

### 1. Vowel Mage 🧙

| | |
|---|---|
| **Max HP** | 50 |
| **Passive** | Vowels deal +1 damage per occurrence |
| **Active** | **Resonance** (3-turn cooldown): choose a vowel — if in word: reveal all instances + gain 1 shield per instance; if not: take only 1 damage (reduced penalty) |
| **Con** | Wrong consonant guesses deal +1 damage to you (3 total instead of 2) |

Encourages opening with vowel economy, strategic ability timing, and accepting risk on consonants.

### 2. The Archivist 📚

| | |
|---|---|
| **Max HP** | 45 |
| **Passive** | See word category, first letter, and word length before guessing; deal +1 damage per occurrence if 5+ letters are still hidden |
| **Active** | **Cross Reference** (once per encounter): reveal 1 random letter OR eliminate 3 letters not in the word (grayed out on keyboard) |
| **Con** | Cannot deal bonus burst damage (Bloodletter/Backstab-style effects don't apply) |

Rewards probability thinking, careful elimination, and analytical play.

### 3. Berserker 🪓

| | |
|---|---|
| **Max HP** | 50 |
| **Passive** | Each wrong guess permanently adds +1 damage this encounter (Rage); correct guesses deal base damage + current Rage stacks. Rage resets between encounters. |
| **Active** | **Bloodletter** (4-turn cooldown): guess a letter blindly — correct = double damage, wrong = double damage taken |
| **Con** | Cannot use reveal abilities or gain shield |

Encourages aggression and risk-taking. Punishes caution, rewards speed.

### 4. Rogue 🗡️

| | |
|---|---|
| **Max HP** | 40 |
| **Passive** | **Combo**: each consecutive correct guess adds +1 stacking damage. Resets on any wrong guess. |
| **Active** | **Backstab** (3-turn cooldown): requires 2+ consecutive correct guesses — reveal 1 random hidden letter + deal double combo damage |
| **Con** | Wrong guesses deal +1 damage to you (3 total instead of 2); lowest max HP |

Rewards precision and patience for burst windows. Punishes mistakes harder than any other class.

---

## Per-Encounter State

These values live in `CombatView` local state and reset on each new encounter (not persisted to localStorage):

| Field | Default | Description |
|---|---|---|
| `berserkerRage` | 0 | Wrong guess count this encounter (Berserker only) |
| `rogueCombo` | 0 | Consecutive correct guesses (Rogue only) |
| `abilityCooldown` | 0 | Turns until ability is ready (0 = ready) |
| `abilityUsedThisEncounter` | false | Archivist once-per-encounter gate |

---

## Active Ability UI

An ability button is displayed below the enemy/player HP bar area, always visible during combat:
- Shows ability name and cooldown remaining when on cooldown
- Grayed out and unclickable when on cooldown or already used (Archivist)
- For abilities that require a letter (Resonance, Bloodletter): two-step interaction — click ability button to enter targeting mode, then click or type a letter from the keyboard

---

## Starting Screen Redesign

`RunSetup.tsx` is rewritten in-place (no new files).

**Class selection** — four class cards in a 2×2 grid:
- Class emoji + name
- Max HP
- One-line passive summary
- One-line active summary
- Con (muted/red colour)
- Clicking a card selects it (highlighted border)
- "Start Run" button activates only when a class is selected

**How-to-Play** — collapsible section ("How to play ▾", collapsed by default):
- Run structure: 3 floors, 11 rooms each
- Room types: enemy, boss, rest, treasure
- Combat: correct guesses damage the enemy, wrong guesses damage you
- Win: kill the enemy (HP → 0) or solve the word
- Lose: your HP hits 0

**Score display** stays at the top as-is.

---

## Word Categories

`words.txt` becomes CSV format:
```
cat,animals
bottle,food and drink
rain,nature
```

User tags all words manually. Backend parses with Python's `csv` module.

The Archivist's passive displays the category, first letter, and word length in the combat UI before the first guess.

---

## State Changes

### `types.ts`

```ts
export type ClassName = 'vowel_mage' | 'archivist' | 'berserker' | 'rogue'

// RunState gains:
className: ClassName
shield: number          // persisted (survives page refresh mid-combat)

// GameState gains:
category: string        // e.g. "food and drink"
firstLetter: string     // e.g. "b"
```

### `runState.ts`

`buildRun()` accepts a `className` parameter, initialises `shield: 0`.

---

## Backend Changes

| File | Change |
|---|---|
| `backend/words.txt` | CSV format: `word,category` (user-tagged) |
| `backend/game.py` | `load_words()` parses CSV; `select_word()` returns `(word, category)`; `new_game()` includes `category` and `first_letter`; remove `max_wrong` / `wrong_guesses_left` |
| `backend/app.py` | Response includes `category` and `first_letter`; remove wrong-guess-limit fields |
| `backend/tests/` | Update all tests for new response shape |

---

## Frontend Files Changed

| File | Change |
|---|---|
| `frontend/src/types.ts` | Add `ClassName`; update `RunState` (add `className`, `shield`); update `GameState` (add `category`, `firstLetter`) |
| `frontend/src/runState.ts` | `buildRun()` accepts class; initialise `shield: 0` |
| `frontend/src/components/RunSetup.tsx` | Rewrite — class selection grid + how-to-play collapsible |
| `frontend/src/components/CombatView.tsx` | Major rewrite — enemy HP tracking, class damage calc, shield, ability button, per-encounter state |
| `frontend/src/components/GameBoard.tsx` | Remove `HangmanSvg`; remove wrong-guess-limit display |
| `frontend/src/components/HangmanSvg.tsx` | Deleted |
| `frontend/src/index.css` | New styles: class cards, ability button, shield indicator, enemy HP bar |
