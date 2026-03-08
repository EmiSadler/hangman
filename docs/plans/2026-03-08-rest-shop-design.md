# Rest Rework + Shop Design

**Date:** 2026-03-08

## Goal

Replace the coin-based rest site with a meaningful pick-one choice, add artifact prices, and introduce a shop room to each floor.

## Rest Site Rework

The rest site becomes a **pick-one-and-leave** screen. Both options are free (no coin cost).

- **Rest fully** — heal to 100% (max HP), then leave
- **Power up** — gain +1 permanent damage for the entire run, then leave

Only one option can be chosen. After choosing, the room is marked complete and the player proceeds.

### RunState change

Add `bonusDamage: number` (default 0) to `RunState`. `buildRun` initialises it to 0. `loadRun` adds a backwards-compat guard (default 0 if missing). `CombatView` adds `bonusDamage` to per-occurrence damage on correct guesses, alongside existing class passives and artifact bonuses.

### Removed

The existing coin-based `HEAL_COST` / `HEAL_AMOUNT` heal button is removed from `RestArea`. `RestArea` no longer needs the `onHeal` prop (replaced by a unified `onLeave(updatedRun)` callback).

---

## Floor Layout (12 rooms)

Each floor gains a **shop** room, expanding from 11 → 12 rooms per floor. The shop sits at index 9, last enemy at 10, boss at 11.

**Layout A** (floors 1 & 3):
```
E E E E REST E TREASURE E E SHOP E BOSS
0 1 2 3  4   5     6    7 8  9  10  11
```

**Layout B** (floor 2):
```
E E E E TREASURE E REST E E SHOP E BOSS
0 1 2 3    4     5  6   7 8  9  10  11
```

`computeRoomsCleared` updates multiplier from 11 → 12. All tests referencing "11 rooms" update to 12.

---

## Artifact Prices

Each artifact in `artifacts.ts` gets a `price: number` field (coins).

| Tier | Price | Artifacts |
|------|-------|-----------|
| Info | 10 | Vowel Seeker, Category Scroll, Crystal Ball |
| Moderate | 15 | Short Sword, Blood Dagger, Thick Skin, Iron Shield, Healing Salve, Gold Tooth |
| Strong / synergy | 20 | Chainmail, Mana Crystal, Battle Scar, Shadow Cloak, Ancient Codex |

---

## Shop Room

### RoomType / AppPhase

`'shop'` added to `RoomType` (types.ts) and `AppPhase` (App.tsx).

### ShopArea component

- Receives `run: RunState` and `onLeave: (updatedRun: RunState) => void`
- On mount, samples 4 artifacts not already owned (`sampleArtifacts(run.artifacts, 4)`)
- Displays each with emoji, name, description, and price
- **Buy** button enabled only if `run.coins >= artifact.price`
- Buying one deducts coins, adds artifact to run, calls `onLeave` immediately (one purchase per shop visit)
- **Leave** button available at all times — player can skip the shop
- Chainmail's +5 maxHp side effect applies on purchase (same logic as TreasureArea)

### App.tsx

- Handle `phase === 'shop'` → render `<ShopArea>`
- `handleShopLeave(updatedRun)` saves run, marks room complete, advances to next room (same pattern as TreasureArea's `handleTreasureChoose`)

---

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `'shop'` to `RoomType`; add `bonusDamage: number` to `RunState` |
| `frontend/src/runState.ts` | Add shop to layouts (12 rooms); update `computeRoomsCleared`; init `bonusDamage: 0` in `buildRun`; backwards-compat guard in `loadRun` |
| `frontend/src/artifacts.ts` | Add `price` field to `Artifact` interface and all 14 artifact definitions |
| `frontend/src/components/RestArea.tsx` | Rewrite: two free options, unified `onLeave(updatedRun)` callback |
| `frontend/src/components/ShopArea.tsx` | New component |
| `frontend/src/components/CombatView.tsx` | Add `bonusDamage` to damage calculation |
| `frontend/src/App.tsx` | Add `'shop'` phase; add `handleShopLeave`; update `handleRestLeave` to match new RestArea API |
| `frontend/src/components/__tests__/RestArea.test.tsx` | Rewrite tests |
| `frontend/src/components/__tests__/ShopArea.test.tsx` | New test file |
| `frontend/src/components/__tests__/CombatView.test.tsx` | Add bonusDamage test |
| `frontend/src/runState.test.ts` | Update 11→12, add bonusDamage tests |
| `frontend/src/components/__tests__/FloorProgress.test.tsx` | Update 11→12 |
