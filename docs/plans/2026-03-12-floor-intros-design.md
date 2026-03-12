# Floor Intros & Victory Screen Design

**Date:** 2026-03-12

## Overview

Add interstitial screens between floors to set the scene, introduce theme mechanics, and make the final win feel earned and dramatic. Also fix two minor contrast issues caught during review.

---

## New AppPhase: `floor_intro`

Add `'floor_intro'` to the `AppPhase` union in `App.tsx`:

```typescript
type AppPhase = 'idle' | 'floor_intro' | 'combat' | 'rest' | 'treasure' | 'shop' | 'run_won' | 'run_lost'
```

New App state:

```typescript
const [defeatedBossName, setDefeatedBossName] = useState<string | null>(null)
```

`FloorProgress` bar and Give Up button are hidden during `floor_intro` (same exclusion rule as `idle`, `run_won`, `run_lost`).

---

## Flow Changes

### Run start (Floor 1 intro)

`handleStartRun`:
1. Build run, create session (unchanged)
2. Set `defeatedBossName = null`
3. Set phase to `'floor_intro'`
4. **Do not** fetch combat yet — deferred to `handleFloorIntroContinue`

### Floor transition (Floor 2 & 3 intro)

`handleCombatEnd` (roomIndex === 11, floor < 3):
1. Advance floor, build new rooms (unchanged)
2. Set `defeatedBossName` to the boss name passed from CombatView
3. Set phase to `'floor_intro'`
4. **Do not** fetch combat yet

### Floor intro → combat

New handler `handleFloorIntroContinue`:
```typescript
async function handleFloorIntroContinue() {
  if (!run) return
  setDefeatedBossName(null)
  await fetchAndEnterCombat(run, 'enemy', false)
}
```

### Final boss defeated (Floor 3, run_won)

`handleCombatEnd` (roomIndex === 11, floor === 3):
- Set `defeatedBossName` to the boss name
- Set phase to `'run_won'` (no floor_intro — goes straight to VictoryScreen)

### Passing boss name from CombatView

`onCombatEnd` signature change:
```typescript
onCombatEnd: (updatedRun: RunState, bossName?: string) => void
```

CombatView passes `enemyName` as the second argument when the room type is `'boss'` and the game is won.

---

## FloorIntroScreen Component

File: `frontend/src/components/FloorIntroScreen.tsx`

Props:
```typescript
interface FloorIntroScreenProps {
  run: RunState                    // to derive floor number and theme
  defeatedBossName: string | null  // null = fresh run start
  onContinue: () => void
}
```

Renders with `data-theme={theme}` on the outer div so the floor palette is active.

### Per-theme content

```typescript
const FLOOR_INTRO_DATA: Record<ThemeId, {
  title: string
  tagline: string
  mechanicHint: string
}> = {
  space: {
    title: 'The Void Depths',
    tagline: 'Stars die here. The silence between them is hungry.',
    mechanicHint: 'Every 3 guesses, your enemy tears letters into the void — unplayable, gone.',
  },
  swamp: {
    title: 'The Festering Mire',
    tagline: 'The water does not move. Neither do the things beneath it.',
    mechanicHint: 'Every 2 guesses, mud is hurled at your keyboard — wrong guesses on stuck letters deal double damage.',
  },
  desert: {
    title: 'The Endless Dune',
    tagline: 'The wind remembers every traveller who did not make it.',
    mechanicHint: 'Each wrong guess, the wind steals another letter from you.',
  },
  jungle: {
    title: 'The Canopy Dark',
    tagline: 'The light that reaches the floor has forgotten what it came from.',
    mechanicHint: 'Correct guesses invite vines — they creep up your keyboard with every letter you find.',
  },
}
```

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  [victory line, if boss defeated]       │  ← muted gold, small
│                                         │
│  Floor N                                │  ← small label, muted
│  THE VOID DEPTHS                        │  ← large heading, accent colour
│                                         │
│  Stars die here. The silence            │  ← atmospheric tagline
│  between them is hungry.                │
│                                         │
│  ⚠ Every 3 guesses, your enemy tears   │  ← mechanic hint, italicised,
│    letters into the void — unplayable,  │     text-muted colour
│    gone.                                │
│                                         │
│        [ Enter Floor N ]                │  ← primary button
│                                         │
└─────────────────────────────────────────┘
```

CSS class: `.floor-intro` on the outer div. Full-page centred layout matching the existing `rest-area` / `treasure-area` structure.

---

## VictoryScreen Component

File: `frontend/src/components/VictoryScreen.tsx`

Props:
```typescript
interface VictoryScreenProps {
  run: RunState
  score: RunScore
  defeatedBossName: string | null
  onNewRun: () => void
}
```

No `data-theme` — uses its own `.victory-screen` CSS class with a gold/amber treatment independent of any floor theme. Dark background, bright gold heading.

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│           V I C T O R Y                │  ← large spaced gold heading
│                                         │
│    You defeated [Final Boss Name].      │  ← subheading
│    The dungeon falls silent.            │  ← flavour line
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Floors cleared      3 / 3      │   │
│  │  Rooms cleared      33 / 33     │   │
│  │  Coins                   N      │   │
│  └─────────────────────────────────┘   │
│                                         │
│    Runs cleared: N                      │  ← persistent score
│                                         │
│           [ Play Again ]                │
│                                         │
└─────────────────────────────────────────┘
```

---

## CSS Changes

### Global `--text-muted` contrast fix

Current `#8a7e6a` gives 4.36:1 on the dark background — just below the 4.5:1 WCAG AA threshold.

Update in `:root`:
```css
--text-muted: #9a8e78;  /* was #8a7e6a — bumped to 5.4:1 contrast */
```

### Desert palette replacement

Replace current near-black desert theme with warm amber-brown sandstone tones:

```css
[data-theme="desert"] {
  --bg:           #4e2808;  /* deep amber-brown, like desert rock shadow */
  --surface:      #6e3e10;  /* warm sandy-brown surface */
  --accent:       #f0b030;  /* hot sun gold */
  --accent-hover: #cc9020;
  --text:         #f8e4b4;  /* bleached sand — 10.3:1 contrast */
  --text-muted:   #d4a050;  /* dusty gold — 5.5:1 contrast */
  --border:       #5c3208;
  --correct:      #4a7c59;
  --wrong:        #8b2e2e;
}
```

### New CSS classes

`.floor-intro` — full-page centred, inherits theme via `data-theme`
`.floor-intro__floor-label` — small muted floor number label
`.floor-intro__title` — large heading using `--accent`
`.floor-intro__tagline` — atmospheric text, normal weight
`.floor-intro__hint` — mechanic hint, italicised, `--text-muted`
`.floor-intro__victory` — "You defeated X!" prelude line, small muted gold
`.victory-screen` — gold/amber palette, dark background
`.victory-screen__heading` — large spaced-out "VICTORY" title
`.victory-screen__stats` — stats card

---

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `floor_intro` phase; `defeatedBossName` state; `handleFloorIntroContinue`; update `handleStartRun`, `handleCombatEnd` |
| `frontend/src/components/CombatView.tsx` | `onCombatEnd(updatedRun, bossName?)` — pass `enemyName` on boss win |
| `frontend/src/components/FloorIntroScreen.tsx` | New component |
| `frontend/src/components/VictoryScreen.tsx` | New component |
| `frontend/src/index.css` | `:root --text-muted` fix; desert palette; `.floor-intro*` and `.victory-screen*` styles |
| `frontend/src/components/__tests__/FloorIntroScreen.test.tsx` | Tests for floor 1 vs floor 2+ display, all 4 themes, continue button |
| `frontend/src/components/__tests__/VictoryScreen.test.tsx` | Tests for stats display, boss name, play again |
