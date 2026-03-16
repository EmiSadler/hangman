# Combat Rewards & Shop Potion Randomisation — Design

## Goal

Two improvements: (1) randomise which potions appear in the shop each visit, and (2) replace the guaranteed post-fight coin drop with a probabilistic reward system that can also yield potions and artifacts.

## Architecture

### Shop potion randomisation

`ShopArea` currently renders all four potions. Change: always show `health_potion`, plus 2 randomly sampled from `[strength_potion, shielding_potion, archivists_brew]`. The sample is fixed for the life of the shop visit (initialised in `useState`, same pattern as the artifact stock).

### Post-fight reward system

**Reward rolls (independent):**

| Reward     | Enemy fight        | Boss fight          |
|------------|--------------------|---------------------|
| Gold       | 75% → +10 coins    | 100% → +30 coins    |
| Potion     | 10% → random potion | 50% → random potion |
| Artifact   | 1% → random artifact | 20% → random artifact |

Gold is applied immediately to `run.coins` in `handleCombatEnd`. Potion and artifact are held as pending rewards and resolved via the new `CombatRewardScreen`.

**New phase:** `AppPhase` gains `'combat_reward'`.

**New App state:** `pendingRewards: { potion: PotionId | null, artifact: ArtifactId | null }`.

**Flow:**
1. `handleCombatEnd` rolls dice, applies gold to run, sets `pendingRewards`, transitions to `combat_reward`
2. `CombatRewardScreen` shows what was found (coins earned, and any potion/artifact)
3. If potion/artifact found and slot available → auto-add, show confirmation
4. If slot full → swap UI (same pattern as ShopArea: choose which to discard, or skip)
5. Player clicks Continue → `onLeave(updatedRun)` → App advances to next room

**CombatRewardScreen props:**
```ts
interface Props {
  run: RunState
  coinsEarned: number
  pendingPotion: PotionId | null
  pendingArtifact: ArtifactId | null
  onLeave: (updatedRun: RunState) => void
}
```

**UI / navigation:**
- `showProgress` excludes `combat_reward` (same as `floor_intro`)
- Give Up button hidden during `combat_reward`
- If no potion or artifact was found, a simple "Continue" button is shown immediately (no interaction required beyond dismissing)

## Constants removed

`COINS_PER_ENEMY` and `COINS_PER_BOSS` are replaced by new constants:
```ts
COINS_ENEMY_REWARD = 10
COINS_BOSS_REWARD = 30
REWARD_GOLD_ENEMY_CHANCE = 0.75
REWARD_POTION_ENEMY_CHANCE = 0.10
REWARD_ARTIFACT_ENEMY_CHANCE = 0.01
REWARD_POTION_BOSS_CHANCE = 0.50
REWARD_ARTIFACT_BOSS_CHANCE = 0.20
```

## Files touched

- `frontend/src/runState.ts` — new/updated constants
- `frontend/src/types.ts` — no changes needed
- `frontend/src/App.tsx` — new phase, `pendingRewards` state, reward logic in `handleCombatEnd`
- `frontend/src/components/ShopArea.tsx` — randomise potion stock
- `frontend/src/components/CombatRewardScreen.tsx` — new component
- `frontend/src/index.css` — styles for reward screen
- Tests: `App.test.tsx`, new `CombatRewardScreen.test.tsx`
