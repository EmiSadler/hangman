# Artifacts System Design

## Goal

Add a collectible artifact system to the dungeon run. Players can find artifacts at Treasure Rooms, build a persistent inventory, and benefit from passive effects throughout combat.

## Architecture

**Option A — ID array + lookup table** (chosen)

- `RunState` gains `artifacts: ArtifactId[]` (serialises cleanly to localStorage)
- New `artifacts.ts` holds the `ARTIFACTS` lookup table and a `sampleArtifacts()` pool helper
- All effect logic lives in `CombatView` (combat-time) and `TreasureArea` (instant pickup)
- No logic in state — only IDs

## Data Model

### `types.ts` additions

```ts
export type ArtifactId =
  'vowel_seeker' | 'crystal_ball' | 'category_scroll' |
  'short_sword' | 'blood_dagger' |
  'iron_shield' | 'thick_skin' | 'chainmail' |
  'healing_salve' | 'gold_tooth' |
  'battle_scar' | 'shadow_cloak' | 'mana_crystal' | 'ancient_codex'

// RunState gains:
// artifacts: ArtifactId[]
```

### `artifacts.ts` (new file)

```ts
export interface Artifact {
  id: ArtifactId
  name: string
  description: string
  emoji: string
}

export const ARTIFACTS: Record<ArtifactId, Artifact> = { ... }

// Returns `count` random artifacts not already in `owned`
export function sampleArtifacts(owned: ArtifactId[], count: number): Artifact[]
```

### `runState.ts` change

`buildRun` gains `artifacts: []`.

## Artifact Roster (14 artifacts)

### General

| ID | Name | Emoji | Effect |
|---|---|---|---|
| `vowel_seeker` | Vowel Seeker | 🔍 | Combat start: display vowel count in the word |
| `crystal_ball` | Crystal Ball | 🔮 | Combat start: reveal one random unknown letter |
| `category_scroll` | Category Scroll | 📜 | Combat start: show word category |
| `short_sword` | Short Sword | ⚔️ | Per correct guess: +1 bonus damage |
| `blood_dagger` | Blood Dagger | 🗡️ | After a wrong guess, next correct hit deals +2 bonus damage |
| `iron_shield` | Iron Shield | 🛡️ | Combat start: +2 shield |
| `thick_skin` | Thick Skin | 🪨 | Per wrong guess: take 1 less damage (min 1) |
| `chainmail` | Chainmail | 🧲 | Instant pickup: +5 max HP (and current HP) |
| `healing_salve` | Healing Salve | 🧪 | Combat end (win): restore +3 HP |
| `gold_tooth` | Gold Tooth | 🪙 | Combat end (win): earn +5 bonus coins |

### Class-Synergy

| ID | Name | Emoji | Synergy | Effect |
|---|---|---|---|---|
| `battle_scar` | Battle Scar | 🩹 | Berserker | Combat start: begin with 1 rage already built |
| `shadow_cloak` | Shadow Cloak | 🌑 | Rogue | Wrong guess: combo drops to 1 instead of 0 |
| `mana_crystal` | Mana Crystal | 💎 | All ability classes | Ability cooldown reduced by 1 (VM: 3→2, Berserker: 4→3, Rogue: 3→2) |
| `ancient_codex` | Ancient Codex | 📖 | Archivist | Cross Reference usable twice per encounter instead of once |

## TreasureArea Changes

- Add a 4th button: **"Find an Artifact"**
- On click: replace button list with 3 artifact cards (name, emoji, description) drawn via `sampleArtifacts(run.artifacts, 3)`
- Player picks one → `onChoose({ ...run, artifacts: [...run.artifacts, chosenId] })`
- Chainmail also applies immediately: `hp: run.hp + 5, maxHp: run.maxHp + 5`

## Inventory Display

- Shown in `CombatView` (below arena, above GameBoard) and in `RestArea` / `TreasureArea`
- Horizontal row of emoji buttons
- Hover/focus shows a tooltip with artifact name and description
- No cap on inventory size; duplicates not possible within a run

## Combat Effects — Hook Points

### Combat start (CombatView mount / `useEffect`)
- `iron_shield`: add 2 to initial shield
- `battle_scar`: initialise `rage` at 1 instead of 0
- `mana_crystal`: reduce initial `cooldown` by 1 (min 0)
- `crystal_ball`: reveal one random unknown letter (update `guessedLetters` via `GameBoard`)
- `vowel_seeker`: compute and store vowel count string for display
- `category_scroll`: store category string for display (non-Archivists)

### Per correct guess (`handleGuessResult`, `correct === true`)
- `short_sword`: add +1 to `dmg` before applying
- `blood_dagger`: if `bloodDaggerReady` flag is set, add +2 to `dmg` then clear flag

### Per wrong guess (`handleGuessResult`, `correct === false`)
- `thick_skin`: subtract 1 from damage taken (min 1)
- `blood_dagger`: set `bloodDaggerReady = true`
- `shadow_cloak`: if Rogue, set combo to `Math.max(1, combo)` instead of 0

### Combat end (`finishCombat`, `won === true`)
- `healing_salve`: add 3 to `effectiveHp` (capped at maxHp)
- `gold_tooth`: add 5 to `coinsEarned`

## Archivist — `abilityUsed` → `abilityUsesLeft`

Replace `abilityUsed: boolean` with `abilityUsesLeft: number`:
- Default: 1
- With `ancient_codex`: initialised to 2
- Ability disabled when `abilityUsesLeft === 0`

## UI — Combat-Start Info Messages

Vowel Seeker, Crystal Ball, and Category Scroll display a one-line message in an artifact info bar (reusing the Archivist info bar area):
- *"🔍 2 vowels in this word"*
- *"🔮 Revealed: E"*
- *"📜 Category: food and drink"*

## Files Touched

| File | Change |
|---|---|
| `frontend/src/types.ts` | Add `ArtifactId`, update `RunState` |
| `frontend/src/artifacts.ts` | New — lookup table + `sampleArtifacts` |
| `frontend/src/runState.ts` | `buildRun` gains `artifacts: []` |
| `frontend/src/components/TreasureArea.tsx` | 4th option + artifact picker UI |
| `frontend/src/components/CombatView.tsx` | Apply all combat-time effects |
| `frontend/src/components/ArtifactShelf.tsx` | New — emoji row + tooltips |
| `frontend/src/index.css` | Artifact shelf + tooltip styles |
| Tests for all of the above | TDD throughout |
