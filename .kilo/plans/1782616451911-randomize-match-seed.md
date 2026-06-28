# Randomize Match Seed Per Game Start

## Problem
`GAME_SEED = "hexwar-demo"` is a hardcoded constant in `GameConfig.ts`. `GameScreen.prepare()` always calls `grid.initMatch(GAME_SEED)`, so river, resource nodes, and starting buildings are identical every match.

## Root Cause
Single line in `GameScreen.ts:44`: `this.grid.initMatch(GAME_SEED)` uses the static constant.

## Fix

### 1. `src/app/screens/game/GameScreen.ts`
- Remove `GAME_SEED` import from `GameConfig`.
- Import `randomHash` from `../../engine/utils/random`.
- In `prepare()`, generate a random seed: `const seed = randomHash(8)` (uses `Math.random` by default — non-seeded, so different every time).
- Pass that seed to `this.grid.initMatch(seed)` and `this.controller.placeStartBuildings(seed)`.
- Store `this.matchSeed = seed` for potential UI display.

That's it. No other files need changes. The seeded RNG in `HexGrid` (`randomSeeded(seed)`) already works correctly — it just needs a different seed each time.

### 2. Optional: Display seed in HUD
- Add seed string to `TopBar` update so players can see it for reproducibility.
- Low priority, can be deferred.

## Validation
- `tsc --noEmit` clean.
- `vite build` succeeds.
- `npm run dev` → Start → GameScreen: river shape, node placement, and starting buildings differ between reloads.
