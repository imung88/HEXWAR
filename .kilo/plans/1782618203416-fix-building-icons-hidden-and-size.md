# Fix: Building icons + icon size + unit autonomous movement

## Problems

1. **Icons hidden at start**: `HexGridView.build()` runs in the constructor (line 52) and draws all tiles. At this point, `placeStartBuildings()` hasn't executed yet (GameScreen line 56), so every tile has `commandCenter: false` and `building: null`. `BuildRenderer.drawBuilding()` draws nothing. No view refresh happens after buildings are placed.

2. **Icons too large**: CC glyph is `size * 0.30 = 12px` radius, spawn glyph is `size * 0.24 = 9.6px`. Original M3 values were `0.22` / `0.18` which were visible and proportionate.

3. **Units don't move**: A* pathfinding exists (`HexAStar.findPath`), `UnitManager.moveUnit()` exists, but there is no autonomous movement logic. Each unit should move toward the enemy victory hex.

## Plan

### 1. Refresh tile graphics after buildings are placed

**File: `src/game/hex/HexGridView.ts`**
- Add a `refreshAll()` public method that iterates all `tileGraphics` and redraws each tile's base + building overlay (same logic as `updateTileBuilding` but for all tiles).

**File: `src/app/screens/game/GameScreen.ts`**
- After `this.controller.placeStartBuildings(this.matchSeed)` (line 56), call `this.view.refreshAll()` to redraw all tiles with their now-placed buildings.

### 2. Reduce building icon sizes

**File: `src/game/config/GameConfig.ts`**
- Change `BUILDING_ICON_SIZES`:
  - `ccGlyphRadius`: `0.30` → `0.22` (back to original)
  - `spawnBuildingGlyphRadius`: `0.24` → `0.18` (back to original)

Outlines (white stroke) from M4 remain for visibility.

### 3. Unit autonomous movement

**Design**: Each unit moves toward the enemy's victory hex. Movement timing is based on the unit's `movement` stat — infantry (3) moves every tick, tank (2) every 2 ticks, artillery (1) every 3 ticks. Units cache their path and recompute only when they reach a waypoint or the path is invalidated. Per-hex cap is enforced before each step.

**File: `src/game/hex/HexGrid.ts`**
- Add `getVictoryHex(owner: Faction): {q: number, r: number} | null` — scans tiles for `isVictory && owner` and returns its coordinates.

**File: `src/game/unit/Unit.ts`**
- Add `moveTimer: number` field to `Unit` interface — countdown in ticks until next move. Initialized to 0.
- Update `createUnit()` factory to set `moveTimer: 0`.

**File: `src/game/unit/UnitManager.ts`**
- Add `getEnemyVictoryHex(unit: Unit, grid: HexGrid): {q: number, r: number} | null` — returns the enemy faction's victory hex coords. (Or keep this logic in MovementManager.)

**New file: `src/game/unit/MovementManager.ts`**
- Constructor: `HexGrid`, `UnitManager`
- `update(tickCount: number)` — called each TICK_MS from GameController:
  1. For each unit via `unitManager.forEach()`:
     - Compute movement interval: `4 - unit.movement` ticks (infantry=1, tank=2, artillery=3).
     - If `tickCount % interval !== 0`, skip this unit.
     - Find enemy victory hex via `grid.getVictoryHex(enemyFaction)`.
     - If no goal or unit already at goal, skip.
     - Call `findPath(grid, unit.q, unit.r, goalQ, goalR)` to get path.
     - If path has length > 1, get `nextStep = path[1]`.
     - If `unitManager.canSpawnAt(nextStep.q, nextStep.r)`, call `unitManager.moveUnit(unit.id, nextStep.q, nextStep.r)`.
  - Path caching: store last computed path per unit (Map<string, path>). Reuse if unit is still at path[0]. Clear when unit reaches goal or path becomes stale.

**File: `src/game/GameController.ts`**
- Add `movementManager: MovementManager` field, constructed after `unitManager`.
- Call `this.movementManager.update(this.tickCount)` after `this.spawnManager.update(TICK_MS)` in the tick loop.

**File: `src/app/screens/game/GameScreen.ts`**
- No changes needed — `unitRenderer.updateAll()` already redraws every frame.

### Validation

- `tsc --noEmit` clean
- `vite build` succeeds
- `npm run dev` →
  - All hexes show building icons immediately on load
  - CC diamonds are proportionate (not oversized)
  - Units spawn from buildings and visually move across the hex grid toward the enemy victory hex
  - Infantry moves fastest, artillery slowest
  - Units stop at enemy victory hex when they arrive
  - Per-hex cap respected (units don't pile past 10)
