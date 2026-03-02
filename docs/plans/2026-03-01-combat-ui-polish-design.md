# Combat UI Polish Design

## Goal

Two visual improvements to the combat arena:
1. Move the artifact shelf to sit as a vertical column to the left of the player sprite.
2. Give enemies a name (regular enemies: random from a general pool; bosses: random from a scarier pool) displayed above their sprite, balancing both sides of the arena.

## Architecture

All changes are frontend-only. No new files — `CombatView.tsx`, `ArtifactShelf.tsx`, and `index.css` cover everything.

## Enemy Names

Two constant arrays at the top of `CombatView.tsx`:

```ts
const ENEMY_NAMES = [
  'Swamp Monster', 'Skeleton Archer', 'Mutated Bee', 'Cave Troll',
  'Plague Rat', 'Stone Golem', 'Shadow Wraith', 'Bog Witch',
  'Dire Wolf', 'Fungal Horror', 'Cursed Scarecrow', 'Sand Shark',
]

const BOSS_NAMES = [
  'Death Knight', 'Ancient Vampire', 'The Hollow King',
  'Bone Colossus', 'Plague Bringer', 'Void Serpent',
  'The Undying', 'Abyssal Tyrant',
]
```

A `useState` initialiser picks one name on mount based on `room.type`:

```ts
const [enemyName] = useState(() => {
  const pool = room.type === 'boss' ? BOSS_NAMES : ENEMY_NAMES
  return pool[Math.floor(Math.random() * pool.length)]
})
```

The name renders above the enemy sprite in a `combat-view__enemy-name` element, styled identically to `.combat-view__class-label` (accent colour, 0.9rem, bold).

## Artifact Shelf — Vertical Mode

`ArtifactShelf` gains an optional `vertical?: boolean` prop. When `true`:
- The shelf container uses `flex-direction: column` and `flex-wrap: nowrap` via a `artifact-shelf--vertical` modifier class.

In `CombatView`, the sprite area of the player section is wrapped in a new `combat-view__player-sprite-row` flex-row:

```tsx
<div className="combat-view__player-sprite-row">
  <ArtifactShelf artifacts={run.artifacts} vertical />
  <div className="combat-view__player-sprite-placeholder" aria-hidden="true" />
</div>
```

The existing `<ArtifactShelf artifacts={run.artifacts} />` line below the arena is removed.

## Arena Balance

After changes, both sides mirror each other structurally:

| Player side | Enemy side |
|---|---|
| Class label (🧙 Vowel Mage) | Enemy name (Swamp Monster) |
| [artifacts] + sprite | Sprite |
| HP bar | HP bar |
| HP / coins stats | HP label |
| Ability button | — |

## CSS Changes

```css
/* Vertical artifact shelf */
.artifact-shelf--vertical {
  flex-direction: column;
  flex-wrap: nowrap;
  padding: 0;
  gap: 0.3rem;
  justify-content: center;
}

/* Sprite row — shelf + sprite side by side */
.combat-view__player-sprite-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* Enemy name — mirrors .combat-view__class-label */
.combat-view__enemy-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--wrong);
}
```

The enemy name uses `--wrong` (red) to contrast with the player's `--accent` (blue/gold), reinforcing the adversarial framing.

## Files Touched

| File | Change |
|---|---|
| `frontend/src/components/CombatView.tsx` | `ENEMY_NAMES`, `BOSS_NAMES` arrays; `enemyName` state; sprite-row JSX; remove old shelf |
| `frontend/src/components/ArtifactShelf.tsx` | Add `vertical?: boolean` prop + modifier class |
| `frontend/src/index.css` | Three new CSS rules |
