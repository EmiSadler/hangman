# Floor Themes Design

**Date:** 2026-03-12

## Overview

Each floor of a run has a randomly assigned theme. The theme changes the visual palette, enemy names, and introduces a unique letter mechanic. Themes are assigned when the run is created (3 of 4 available, no repeats) and persist in `RunState`.

---

## Themes

| Theme | Letter Mechanic | Trigger |
|-------|----------------|---------|
| Space | Enemy casts Black Hole — 3 letters vanish | Every 3 guesses |
| Swamp | Enemy hurls mud — 2 letters become mud-stuck (wrong guess = double damage) | Every 2 guesses |
| Jungle | Vines grow up the keyboard (50% chance per correct guess) | Each correct guess |
| Desert | Wind blows away 1 additional letter | Each wrong guess |

---

## Data Model

### New type in `types.ts`

```typescript
export type ThemeId = 'space' | 'swamp' | 'desert' | 'jungle'
```

### RunState addition

```typescript
floorThemes: [ThemeId, ThemeId, ThemeId]
```

### `buildRun` change

Shuffle the 4 themes and assign the first 3 to `floorThemes`. No repeats per run.

```typescript
function pickFloorThemes(): [ThemeId, ThemeId, ThemeId] {
  const all: ThemeId[] = ['space', 'swamp', 'desert', 'jungle']
  const shuffled = all.sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1], shuffled[2]]
}
```

### `loadRun` migration

If `floorThemes` is absent (old save), generate one on load so existing saves don't break.

---

## Combat Mechanics

### CombatView reads theme

```typescript
const theme = run.floorThemes[floor - 1]
```

### New state per combat

```typescript
const [voidLetters, setVoidLetters] = useState<string[]>([])   // space
const [mudLetters, setMudLetters] = useState<string[]>([])     // swamp
const [vinedLetters, setVinedLetters] = useState<string[]>([]) // jungle
// desert uses existing blockedLetters
```

### Guess counter for timer-based abilities

```typescript
const guessCountRef = useRef(0) // increments on every guess
```

### Space — Black Hole

- **Timer**: every 3rd guess (`guessCountRef.current % 3 === 0`)
- **Warning** (on 2nd guess of cycle): show `"The [enemy] is gathering void energy..."`
- **Cast** (on 3rd guess of cycle): pick 3 random letters not yet guessed, voided, or blocked; add to `voidLetters`; show `"[enemy] casts Black Hole! 3 letters are sucked into the void!"`
- Void letters are unplayable (styled as dark empty keys)

### Swamp — Mud

- **Timer**: every 2nd guess (`guessCountRef.current % 2 === 0`)
- **Warning** (on 1st guess of cycle): show `"The [enemy] is winding up..."`
- **Cast** (on 2nd guess of cycle): pick 2 random letters not yet guessed, mud-stuck, or blocked; add to `mudLetters`; show `"[enemy] hurls mud! 2 letters are stuck!"`
- Mud mechanic in `handleGuessResult`: if `mudLetters.includes(letter)` and the guess is wrong, damage dealt to player is doubled

### Desert — Wind

- **Trigger**: each wrong guess
- **Effect**: pick 1 random letter not yet guessed or blocked; add to `blockedLetters`
- **Message**: `"[enemy] stirs the sands! A letter blows away!"`

### Jungle — Vines

Keyboard rows (bottom to top):
- Row 0 (bottom): `['z','x','c','v','b','n','m']`
- Row 1 (middle): `['a','s','d','f','g','h','j','k','l']`
- Row 2 (top): `['q','w','e','r','t','y','u','i','o','p']`

- **At combat start**: 2 random letters from row 0 start vined (added to `vinedLetters`)
- **Trigger**: each correct guess
- **Effect**: 50% chance — pick 1 random unvined, unguessed letter from the lowest row that still has available letters; add to `vinedLetters`
- **Message** (when vines spread): `"[enemy] spreads the jungle! Vines creep higher!"`
- Vined letters are unplayable (styled with green vine overlay)

---

## Cast Messages

Two-stage display for timer-based abilities (Space, Swamp):

1. **Warning** (one guess before cast): brief message above keyboard — `"[enemy] is [preparing]..."`
2. **Cast** (when ability fires): `"[enemy] [casts]! [effect description]"` + letters update visually

Player-triggered abilities (Jungle, Desert) show the cast message immediately when the effect fires.

Message displayed as a `castMessage: string | null` state in CombatView, cleared after a short delay or on next guess.

---

## Visual Theming

### CSS implementation

`data-theme` attribute on the `.combat-view` div:

```tsx
<div className="combat-view" data-theme={theme}>
```

Theme-scoped CSS variable overrides in `index.css`:

```css
[data-theme="space"] {
  --bg:      #0d0d2b;
  --surface: #1a1a3e;
  --accent:  #7c3aed;
  --text:    #e0e0ff;
  --border:  #3d2d6e;
  --text-muted: #9d8fc0;
}
[data-theme="swamp"] {
  --bg:      #1a2a1a;
  --surface: #243324;
  --accent:  #6b8e23;
  --text:    #c8d8b0;
  --border:  #3a5a2a;
  --text-muted: #8aaa70;
}
[data-theme="desert"] {
  --bg:      #f5e6c8;
  --surface: #fdf2da;
  --accent:  #c17f24;
  --text:    #4a2f0a;
  --border:  #d4b896;
  --text-muted: #8a6a40;
}
[data-theme="jungle"] {
  --bg:      #0d2010;
  --surface: #1a3a1a;
  --accent:  #22c55e;
  --text:    #d0f0c0;
  --border:  #2a5a2a;
  --text-muted: #70b080;
}
```

### Keyboard key styles

New CSS classes applied to affected keys:

- `.key--void` (space): very dark key, hollow appearance
- `.key--mud` (swamp): muddy brown overlay
- `.key--vined` (jungle): green vine overlay
- `.key--blown` (desert): already uses `.key--blocked`, styled as faded/sandy within desert theme

### Enemy name pools (per theme)

```typescript
const THEME_ENEMY_NAMES: Record<ThemeId, string[]> = {
  space:  ['Void Stalker', 'Nebula Wraith', 'Star Devourer', 'Cosmic Horror',
           'Event Horizon', 'Dark Matter', 'Gravity Well', 'Stellar Parasite'],
  swamp:  ['Bog Witch', 'Mud Golem', 'Fetid Lurker', 'Spore Shambler',
           'Swamp Troll', 'Plague Mosquito', 'Mire Beast', 'Toxic Salamander'],
  desert: ['Sand Wraith', 'Dune Scorpion', 'Heat Mirage', 'Dust Devil',
           'Bone Collector', 'Desert Sphinx', 'Sand Leech', 'Cactus Demon'],
  jungle: ['Vine Strangler', 'Poison Dart Frog', 'Canopy Serpent', 'Thorn Lizard',
           'Feral Hunter', 'Moss Titan', 'Jungle Witch', 'Spore Creeper'],
}

const THEME_BOSS_NAMES: Record<ThemeId, string[]> = {
  space:  ['The Singularity', 'Void Emperor', 'Entropy Lord', 'The Event Horizon'],
  swamp:  ['The Bog Queen', 'Ancient Ooze', 'The Pestilence', 'Swamp Colossus'],
  desert: ['The Sand King', 'The Buried God', 'Eternal Dune', 'The Bone Sovereign'],
  jungle: ['The Canopy Sovereign', 'Apex Predator', 'The Ancient Tree', 'The Green God'],
}
```

---

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `ThemeId` type; add `floorThemes` to `RunState` |
| `frontend/src/runState.ts` | `buildRun` picks 3 themes; `loadRun` migration |
| `frontend/src/components/CombatView.tsx` | Theme state, mechanics, cast messages, `data-theme` attribute, themed enemy names |
| `frontend/src/components/Keyboard.tsx` | New props: `voidLetters`, `mudLetters`, `vinedLetters`; new key CSS classes |
| `frontend/src/index.css` | Per-theme CSS variable overrides; `.key--void`, `.key--mud`, `.key--vined` styles |
| `frontend/src/components/__tests__/CombatView.test.tsx` | Tests for each mechanic |
| `frontend/src/__tests__/runState.test.ts` | Tests for `pickFloorThemes` |
