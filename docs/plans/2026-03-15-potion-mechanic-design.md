# Potion Mechanic Design

## Goal

Replace the exploitable in-combat heal button (which costs a blocked letter) with a finite potion system. Players buy potions at the shop with coins and use them during combat. Designed to extend naturally to other single-use combat potions later.

## Architecture

Four focused changes: a new `potions.ts` data file, `RunState` extended with a `potions` field, `ShopArea` gains a potions section, and `CombatView` loses the old heal button and gains a potion belt. No backend changes. No new dependencies.

---

## Section 1: Data model

### New file: `frontend/src/potions.ts`

Mirrors `artifacts.ts` in structure. Defines each potion's display data.

```ts
export type PotionId = 'health_potion'  // union grows as new potions are added

export interface Potion {
  id: PotionId
  name: string
  emoji: string
  description: string
  price: number
}

export const POTIONS: Record<PotionId, Potion> = {
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    emoji: '🧪',
    description: 'Restore 10 HP.',
    price: 10,
  },
}
```

### `frontend/src/types.ts`

- Import `PotionId` from `potions.ts` and export it (or define directly alongside `ArtifactId`)
- Add `potions: PotionId[]` field to `RunState`

### `frontend/src/runState.ts`

- Add `export const POTION_HEAL_AMOUNT = 10`
- Remove `export const HEAL_AMOUNT = 5` (no longer referenced after CombatView change)
- `buildRun`: include `potions: []`
- `loadRun`: migration guard — `if (!Array.isArray(parsed.potions)) parsed.potions = []`

---

## Section 2: Shop changes

`ShopArea` gains a "Potions" section below the artifact stock. It lists all available potion types (for now just `health_potion`) with a Buy button each.

**Buy button disabled when:**
- `localRun.coins < potion.price`, OR
- `localRun.potions.length >= 4` (pouch full)

Buying deducts coins and appends the potion ID to `localRun.potions`. No swap mechanic — full means full.

The existing artifact stock (4 random items) is unchanged. Potions are always available (not random, unlimited stock subject to the 4-slot cap).

---

## Section 3: CombatView changes

### Removed

- `handleHeal` function
- `🩹 Heal (+5 HP)` button (`btn-heal`)
- `HEAL_AMOUNT` import

### Added: Potion belt

Rendered when `!combatDone`. One button per potion in `displayRun.potions`:

```
🧪 Health Potion (+10 HP)
```

Clicking a potion:
1. Removes it from `displayRun.potions` (consume the first matching ID)
2. Heals `Math.min(maxHp, hp + POTION_HEAL_AMOUNT)` HP
3. Shows green `+10` popup (reuses existing `pushPopup(..., 'player', true)` path)

If the pouch is empty, no buttons render.

### Unchanged

- `healing_salve` artifact (+3 HP on victory) — separate mechanic, unaffected
- RestArea full heal — unchanged
- `WRONG_SOLVE_PENALTY` and all other combat mechanics — unchanged

---

## Pouch limit

`MAX_POTION_SLOTS = 4` constant added to `runState.ts` (or collocated with the potion data — TBD at implementation). Enforced at buy-time in `ShopArea`.

---

## localStorage migration

`loadRun` already handles missing fields. Add:
```ts
if (!Array.isArray(parsed.potions)) parsed.potions = []
```

Existing saved runs will start with an empty pouch — no data loss.

---

## Tech stack

- React 19 + TypeScript (frontend only)
- No new dependencies
