# Inventory Limit Design

## Goal

Cap the player's artifact inventory at 8 items. Allow multiple purchases per shop visit. When the inventory is full, let the player swap an existing item for a new one, with a confirmation step before discarding the old item.

## Architecture

Three focused changes to the frontend only: a new `MAX_INVENTORY` constant, a reworked `ShopArea` (local run state, swap mode), and a small `onRemove` prop addition to `ArtifactShelf`. No backend changes. No new dependencies.

---

## Feature 1: Multi-buy (shop stays open)

### Current behaviour

`handleBuy` immediately calls `onLeave(updated)` — the shop exits on the first purchase.

### New behaviour

`ShopArea` manages a `localRun: RunState` (initialised from the `run` prop). All purchases update `localRun` without calling `onLeave`. The **Leave** button is the only exit; it calls `onLeave(localRun)`.

Stock is sampled once on shop entry (unchanged). The displayed list is derived by filtering the fixed stock against `localRun.artifacts`, so a purchased item disappears immediately without reshuffling. If 4 items were on offer and one is bought, 3 remain.

---

## Feature 2: Inventory cap + swap mode

### Constant

`MAX_INVENTORY = 8` added to `frontend/src/runState.ts` alongside `MAX_HP`, `DAMAGE_PER_WRONG`, etc.

### Normal buy path

When `localRun.artifacts.length < MAX_INVENTORY`: Buy buttons behave as in Feature 1 above.

### Swap mode

When `localRun.artifacts.length >= MAX_INVENTORY`: clicking Buy on a shop item sets `pendingSwap: Artifact` (the item the player wants to acquire). The shop enters swap mode:

- A banner renders: *"Inventory full (8/8). Choose an item to remove:"*
- `ArtifactShelf` receives an `onRemove` callback, causing each item to render a small Remove button beneath it
- The stock items and their Buy buttons remain visible (so the player can see what they're trading for)
- A **Cancel** button clears `pendingSwap` and returns to normal browsing

---

## Feature 3: Confirmation step

When the player clicks Remove on an existing inventory item while in swap mode, `pendingRemove: ArtifactId` is set. The swap-mode banner is replaced by a confirmation banner:

> *"Remove [old emoji name] to get [new emoji name]? This cannot be undone."*
> **[Confirm] [Cancel]**

- **Confirm** → deduct coins, remove old item from `localRun.artifacts`, add new item, apply any on-pickup effects (e.g. chainmail +5 max HP), clear `pendingSwap` and `pendingRemove`
- **Cancel** → clears `pendingRemove` only, returning to swap mode so the player can choose a different item to remove

---

## ArtifactShelf changes

Add optional prop `onRemove?: (id: ArtifactId) => void`. When provided, each item renders a small "Remove" button beneath its emoji. When not provided, behaviour is identical to today (tooltips only).

---

## State summary (ShopArea)

| State | Type | Purpose |
|---|---|---|
| `localRun` | `RunState` | Tracks coins and artifacts across multiple purchases |
| `stock` | `Artifact[]` | Fixed initial sample; filtered for display |
| `pendingSwap` | `Artifact \| null` | The shop item the player wants to buy when full |
| `pendingRemove` | `ArtifactId \| null` | The inventory item the player wants to drop |

---

## Edge cases

- **Chainmail on swap-in**: the `+5 max HP / +5 HP` bonus applies whether chainmail is bought normally or swapped in.
- **Swapped-out item not rebuyable**: removed items were pre-owned before the shop visit; they are not in the original stock sample, so they can't be re-acquired in the same visit.
- **Pool smaller than 4**: unchanged — `sampleArtifacts` already handles this.

---

## Tech stack

- React 19 + TypeScript (frontend only)
- No new dependencies
