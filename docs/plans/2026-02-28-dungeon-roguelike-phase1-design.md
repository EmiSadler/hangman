# Dungeon Roguelike — Phase 1 Design Document
_2026-02-28_

## Overview

Transform the Hangman game into a dungeon-crawling roguelike. Each word encounter is a combat fight. Players run through 3 floors of 11 rooms each, managing HP and coins across enemies, rest stops, and treasure rooms before facing a boss.

Phase 1 covers the core combat loop only: HP, damage, coins, rest, treasure, scoring. Classes and advanced enemy modifiers are out of scope.

---

## Run Structure

A run consists of **3 floors**, each with **11 rooms** in a fixed order:

| Floor | Room sequence |
|---|---|
| 1 | E E E E REST E TREASURE E E E BOSS |
| 2 | E E E E TREASURE E REST E E E BOSS |
| 3 | E E E E REST E TREASURE E E E BOSS |

- **E** — enemy encounter (word guess)
- **REST** — spend coins to heal
- **TREASURE** — pick one of three bonuses
- **BOSS** — harder word encounter (word length ≥ 8)

Rooms are completed in order; the player cannot skip or revisit rooms. A run has a maximum of 33 rooms.

---

## Combat Mechanics

### Player stats
- Starts each run with **20 HP** (max 20)
- HP carries between all rooms — no reset between enemies
- HP hits 0 → run ends immediately (defeat)

### Enemy encounter
- Wrong guess → player takes **2 damage**
- Correct guess → enemy takes **floor × 1 damage** (1 dmg on floor 1, 2 on floor 2, 3 on floor 3)
- Enemy HP = **word length × floor number**
- Enemy reaches 0 HP when the word is fully guessed (the two events are equivalent — enemy HP is a visual progress tracker)
- Word fully guessed or solved early → enemy defeated

### Coins
- Defeat a regular enemy → **+5 coins**
- Defeat a boss → **+20 coins**

---

## Special Rooms

### Rest area
- Spend **10 coins → +5 HP**, repeatable
- Capped at max HP (20)
- Player may leave without spending

### Treasure area
Pick **one** of three bonuses:
1. Reveal a random unguessed letter in the next encounter
2. +5 HP (immediate)
3. +10 coins (immediate)

---

## Scoring

Replaces the existing win/loss score pill.

| Field | Description |
|---|---|
| `runsCleared` | Full 3-floor runs completed |
| `runsFailed` | Runs ended by HP reaching 0 |
| `bestRooms` | Most rooms cleared in a single run (max 33) |

Display: `X runs cleared / Y failed • best: N rooms`

"Forget me" resets all three values.

---

## State Management

### `localStorage` keys

**`hangman_run`** — active run (persists across page refresh):
```json
{
  "hp": 14,
  "maxHp": 20,
  "coins": 15,
  "floor": 1,
  "roomIndex": 3,
  "rooms": [
    { "type": "enemy", "completed": true, "gameId": "uuid" },
    { "type": "enemy", "completed": true, "gameId": "uuid" },
    { "type": "enemy", "completed": true, "gameId": "uuid" },
    { "type": "enemy", "completed": false, "gameId": null },
    ...
  ],
  "status": "in_progress"
}
```

**`hangman_score`** (updated shape):
```json
{ "runsCleared": 2, "runsFailed": 5, "bestRooms": 18 }
```

---

## Frontend Architecture

### New / replaced components

| Component | Role |
|---|---|
| `RunSetup` | Replaces `GameSetup`. Single "Start Run" button + score display. |
| `FloorProgress` | Visual strip of 11 rooms for the current floor. Highlights current room, marks completed rooms. |
| `CombatView` | Wraps `GameBoard`. Adds player HP bar, enemy HP bar, damage flash on each guess. |
| `RestArea` | Shows HP, coins. Spend 10 coins for +5 HP button (repeatable). Leave button. |
| `TreasureArea` | Three bonus buttons. Player picks one. |
| `RunResult` | End-of-run screen (win or loss). Shows rooms cleared, coins earned, "Start New Run" button. |

### App state machine

```
idle
  → run_active
      → combat         (enemy or boss room)
      → rest           (rest room)
      → treasure       (treasure room)
      → floor_complete (after boss — brief transition, then next floor begins)
  → run_won            (all 3 floors cleared)
  → run_lost           (HP hits 0)
```

### Updated `types.ts`

```ts
export type RoomType = 'enemy' | 'boss' | 'rest' | 'treasure'

export interface Room {
  type: RoomType
  completed: boolean
  gameId: string | null
}

export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number        // 1–3
  roomIndex: number    // 0–10
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
```

---

## Backend Changes

### Modified: `POST /api/game`

Accepts an optional `room_type` field:
- `"enemy"` (default) → random word from full pool
- `"boss"` → word length ≥ 8

```json
{ "room_type": "boss" }
```

No other backend changes. All run state, scoring, and room sequencing is managed by the frontend.

---

## Files Changed

| File | Change |
|---|---|
| `backend/game.py` | `select_word()` accepts optional `room_type`; boss picks word length ≥ 8 |
| `backend/app.py` | `POST /api/game` reads optional `room_type` |
| `backend/tests/test_game.py` | Tests for boss word selection |
| `backend/tests/test_routes.py` | Tests for `room_type` param |
| `frontend/src/types.ts` | Add `RoomType`, `Room`, `RunState`, `RunScore`; remove `Score` |
| `frontend/src/App.tsx` | Replace score/game state with run state machine |
| `frontend/src/components/RunSetup.tsx` | New — replaces GameSetup |
| `frontend/src/components/FloorProgress.tsx` | New |
| `frontend/src/components/CombatView.tsx` | New — wraps GameBoard |
| `frontend/src/components/RestArea.tsx` | New |
| `frontend/src/components/TreasureArea.tsx` | New |
| `frontend/src/components/RunResult.tsx` | New — replaces GameResult for run-end |
| `frontend/src/components/GameSetup.tsx` | Deleted |
| `frontend/src/components/GameResult.tsx` | Kept for individual word outcomes within combat (won/lost word) |
| `frontend/src/index.css` | New styles for run UI, HP bars, floor progress strip |
