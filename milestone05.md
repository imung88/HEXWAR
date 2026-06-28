# Milestone 4 & 5: Units, Spawning, Pathfinding, Movement, Combat

---

## M4 Summary: What Was Implemented

### 1. Unit System

**`src/game/unit/Unit.ts`** — Pure data interface + factory function.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Auto-incrementing `"u1"`, `"u2"`, ... |
| `type` | `UnitType` | `"infantry"` \| `"tank"` \| `"artillery"` |
| `owner` | `Faction` | `"friendly"` \| `"enemy"` |
| `q`, `r` | `number` | Axial hex coordinates |
| `hp`, `maxHp` | `number` | Hit points |
| `attack`, `defense` | `number` | Combat stats (RPD-aligned) |
| `movement` | `number` | Movement speed tier (3=fast, 1=slow) |
| `vision` | `number` | Vision range (reserved for fog of war) |
| `moveTimer` | `number` | Countdown ticks until next move |

**Unit Stats (RPD-aligned):**

| Type | HP | ATK | DEF | MOV | VIS | Color |
|------|----|-----|-----|-----|-----|-------|
| Infantry | 30 | 5 | 2 | 3 | 2 | `0x55aa55` |
| Tank | 80 | 12 | 6 | 2 | 3 | `0x8888cc` |
| Artillery | 40 | 15 | 1 | 1 | 4 | `0xcc5555` |

**`src/game/unit/UnitManager.ts`** — Logic-only storage. Map-based, no display objects.

- `addUnit(unit)` → registers, returns id
- `removeUnit(id)` → removes
- `getUnit(id)` → lookup
- `getUnitsAt(q, r): Unit[]` → all units on a hex
- `getUnitsByFaction(faction): Unit[]` → faction filter
- `getFactionUnitCount(faction): number` → total count
- `canSpawn(faction): boolean` → below `MAX_UNITS_PER_FACTION` (50)
- `canSpawnAt(q, r): boolean` → below `MAX_UNITS_PER_HEX` (10)
- `moveUnit(id, toQ, toR)` → updates position
- `forEach(cb)` → iterate all units

### 2. SpawnManager

**`src/game/spawn/SpawnManager.ts`** — Per-building cadence timers that create units.

- **Constructor**: `HexGrid`, `BuildManager`, `UnitManager`
- **`initTimers(seed)`**: Seeds per-building timers with randomized offsets using `randomSeeded(seed + buildingId)` to prevent simultaneous spawns
- **`update(deltaMs)`**: Each tick:
  - Iterates all ready spawn buildings via `BuildManager.forEachSpawnBuilding()`
  - Victory CCs auto-spawn infantry at `VICTORY_CC_CADENCE_MS` (60s)
  - Spawn buildings use `cadenceLowMs` or `cadenceHighMs` based on `spawnSpeed`
  - Checks `UnitManager.canSpawn()` (global cap) and `canSpawnAt()` (per-hex cap)
  - Creates unit via `createUnit()` and registers with `UnitManager`

**Spawn Cadence (config in `GameConfig.ts`):**

| Building | Low Speed | High Speed |
|----------|-----------|------------|
| Infantry Barracks | 20s | 10s |
| Tank Division | 40s | 20s |
| Artillery Division | 50s | 25s |
| Victory CC | 60s | 60s (fixed) |

### 3. A* Pathfinding

**`src/game/pathfinding/HexAStar.ts`** — Hex-adapted A* pathfinding.

- `findPath(grid, startQ, startR, goalQ, goalR): {q,r}[] | null`
- Movement cost: 1 per friendly/neutral hex, `ENEMY_HEX_MOVE_COST_MULT` (2x) for enemy hexes
- Heuristic: `hexDistance()` (admissible)
- Uses `HexGrid.neighbors()` for adjacency
- Returns path array from start to goal (inclusive), or null if unreachable

**`src/game/hex/HexGrid.ts`** additions:
- `getMovementCost(q, r): number` — returns 1 for friendly/neutral, 2 for enemy
- `getVictoryHex(owner): {q,r} | null` — scans tiles for `isVictory && owner`

### 4. Unit Rendering

**`src/game/unit/UnitRenderer.ts`** — Stacked offset sprites per hex.

- **Container-based**: Each hex gets its own `Container` with a `Graphics` for icons and `Text` for overflow badges
- **Shape per type**: circle = infantry, roundedRect = tank, triangle = artillery
- **Stack offset**: `dx = i * 5px`, `dy = -i * 4px` (diagonal upward)
- **Overflow badge**: When > 6 units of a type, shows count as `Text`
- **`updateAll()`**: Full redraw every frame (called from `GameScreen.update()`)
- **`updateHex(q, r)`**: Selective single-hex redraw (available for future optimization)

### 5. Building Icon Polish

**`src/game/build/BuildRenderer.ts`** changes:
- CC glyph: `size * 0.22` radius diamond with white outline stroke
- Spawn building glyph: `size * 0.18` radius circle with white outline stroke
- Construction hatching unchanged

**`src/game/config/GameConfig.ts`** — `BUILDING_ICON_SIZES`:
- `ccGlyphRadius: 0.22`
- `spawnBuildingGlyphRadius: 0.18`

### 6. All Starting Hexes Get CCs

**`src/game/build/BuildManager.ts`** — `placeStartBuildings()` rewrite:
1. Place instant-ready free CCs on ALL friendly/enemy hexes (no maintenance cost)
2. Then shuffle non-victory hexes and place 3 Infantry Barracks + 1 Tank Division per faction

**CC Maintenance = 0**: `commandCenter` config has `maintenanceLow/maintenanceHigh = {gold:0, oil:0}`. The `MaintenanceRegistry.register()` calls create zero-cost entries — harmless but present.

### 7. Autonomous Movement

**`src/game/unit/MovementManager.ts`** — Moves units toward enemy victory hex.

- **Movement timing**: Based on `unit.movement` stat:
  - Infantry (3) → every tick (interval = 1)
  - Tank (2) → every 2 ticks (interval = 2)
  - Artillery (1) → every 3 ticks (interval = 3)
  - Formula: `interval = 4 - movement`
- **Path caching**: Stores last computed path per unit id. Invalidates if unit position doesn't match `path[0]`
- **Goal**: Enemy faction's victory hex via `grid.getVictoryHex(enemyFaction)`
- **Per-hex cap**: Checks `unitManager.canSpawnAt()` before each step
- **Path consumption**: Shifts waypoints as units move; recomputes when path is stale

### 8. Wiring

**`src/game/GameController.ts`** — Owns all managers:
```
economy.update()
buildManager.update(TICK_MS)
spawnManager.update(TICK_MS)
movementManager.update(tickCount)
```

**`src/game/hex/HexGridView.ts`** — Added:
- `unitLayer: Container` child for unit overlays
- `getUnitLayer(): Container` accessor
- `refreshAll()` method to redraw all tiles after buildings are placed

**`src/app/screens/game/GameScreen.ts`** — Initialization order:
1. `grid.initMatch(seed)` — generates map
2. `new HexGridView(grid)` — draws tiles (no buildings yet)
3. `new GameController(grid)` — creates managers
4. `controller.placeStartBuildings(seed)` — places CCs + spawn buildings
5. `view.refreshAll()` — redraws tiles with buildings
6. `controller.spawnManager.initTimers(seed)` — seeds spawn timers
7. `new UnitRenderer(view.getUnitLayer(), ...)` — unit display

### File Summary (M4)

| File | Status | Purpose |
|------|--------|---------|
| `src/game/unit/Unit.ts` | **NEW** | Unit interface + factory |
| `src/game/unit/UnitManager.ts` | **NEW** | Unit storage, queries, caps |
| `src/game/unit/UnitRenderer.ts` | **NEW** | Stacked offset sprite rendering |
| `src/game/unit/MovementManager.ts` | **NEW** | Autonomous movement toward enemy victory |
| `src/game/spawn/SpawnManager.ts` | **NEW** | Per-building cadence timers |
| `src/game/pathfinding/HexAStar.ts` | **NEW** | Hex A* pathfinding |
| `src/game/config/GameConfig.ts` | EDIT | Unit configs, cadence, CC zero maint, caps, icon sizes |
| `src/game/build/BuildingTypes.ts` | EDIT | Added `unitType` to Building |
| `src/game/build/BuildManager.ts` | EDIT | CCs on all hexes, `forEachSpawnBuilding()` |
| `src/game/build/BuildRenderer.ts` | EDIT | Enlarged + outlined building icons |
| `src/game/GameController.ts` | EDIT | Owns UnitManager, SpawnManager, MovementManager |
| `src/game/hex/HexGrid.ts` | EDIT | `getMovementCost()`, `getVictoryHex()` |
| `src/game/hex/HexGridView.ts` | EDIT | `unitLayer`, `refreshAll()` |
| `src/app/screens/game/GameScreen.ts` | EDIT | Wires unit system + renderer |

---

## M5 Plan: Combat, Territory Capture, Unit Selection, Manual Movement

### Goals

1. **Combat system**: When enemy units occupy the same hex, resolve combat using attack/defense stats. Units take damage; at 0 HP they are removed.
2. **Territory capture**: When all enemy units on a hex are destroyed and a friendly unit moves in, the hex changes owner. CCs and buildings on captured hexes change faction.
3. **Unit selection**: Click a friendly hex with units to select them. Show selection ring and unit info panel.
4. **Manual movement**: Selected units can be moved to an adjacent hex via click/tap. Movement cost applies (enemy hex = 2x).
5. **Combat visualization**: Damage numbers, unit death animations, hex flash on capture.
6. **Priority panel**: 3 Attack/Defend hexes (RPD) — highlight hexes where combat is most likely.

### Task Order

#### 1. Combat Resolution

**New file: `src/game/combat/CombatResolver.ts`**
- `resolveCombat(attacker: Unit, defender: Unit): { damage: number, killed: boolean }`
- Damage formula: `max(1, attacker.attack - defender.defense + random(-2, 2))`
- When attacker moves into hex with enemy units, each attacker unit fights one defender unit
- Order: highest attack first
- If defender HP <= 0, remove from UnitManager
- If all defenders dead, hex becomes contested → capture on next friendly move-in

**Edit: `src/game/unit/MovementManager.ts`**
- Before moving to next hex, check if target hex has enemy units
- If yes, trigger combat via `CombatResolver` instead of moving
- If combat wins (all enemies dead), proceed with move

**Edit: `src/game/unit/Unit.ts`**
- No changes needed — `hp` and `defense` already exist

#### 2. Territory Capture

**Edit: `src/game/hex/HexGrid.ts`**
- `captureHex(q, r, newOwner: Owner)`: Changes tile owner, converts CCs/buildings to new faction
- `destroyBuilding(q, r)`: Removes building from tile, unregisters maintenance

**Edit: `src/game/build/BuildManager.ts`**
- `onHexCaptured(q, r, newOwner)`: Called when hex changes owner
  - Convert CC ownership
  - Convert spawn building ownership
  - Re-register maintenance under new faction

**Edit: `src/game/unit/MovementManager.ts`**
- After winning combat and moving into hex, call `grid.captureHex()`
- Call `buildManager.onHexCaptured()` to update buildings

#### 3. Unit Selection

**New file: `src/game/unit/UnitSelectionController.ts`**
- `selectedHex: {q, r} | null`
- `selectedUnits: Unit[]`
- `select(q, r)`: Selects all friendly units on hex
- `deselect()`: Clears selection
- `onSelectionChange(cb)`: Event emitter for UI updates

**Edit: `src/app/screens/game/GameScreen.ts`**
- Wire hex tap to `UnitSelectionController.select()`
- Show selection ring on selected hex
- Display unit info in tooltip/panel

**New file: `src/app/ui/UnitInfoPanel.ts`**
- Shows selected unit(s) info: type, HP, ATK, DEF, MOV
- Shows unit count per type on hex

#### 4. Manual Movement

**Edit: `src/game/unit/UnitSelectionController.ts`**
- `moveSelected(toQ, toR)`: Moves all selected units to target hex
- Validates: adjacent hex, per-hex cap, movement cost affordability

**Edit: `src/game/hex/HexGridView.ts`**
- On hex tap: if units selected and target is adjacent, move instead of select
- Visual feedback: highlight valid move targets

**Edit: `src/app/screens/game/GameScreen.ts`**
- Wire interaction: select → then tap adjacent hex to move
- Show movement path preview on hover

#### 5. Combat Visualization

**Edit: `src/game/unit/UnitRenderer.ts`**
- Flash hex red on combat
- Show damage numbers floating up
- Remove dead unit icons with fade animation

**New file: `src/game/combat/CombatVisualizer.ts`**
- `showDamage(q, r, damage: number)`: Floating damage text
- `showCapture(q, r)`: Hex flash animation
- `showDeath(q, r, unitType)`: Unit death effect

#### 6. Priority Panel (RPD)

**Edit: `src/app/ui/BuildPanel.ts`**
- Add "Priority" section showing 3 hexes with highest enemy pressure
- Highlight these hexes on the grid
- Show recommended build types for each

### Config Additions

**`src/game/config/GameConfig.ts`:**
```typescript
// Combat
export const COMBAT_RANDOM_RANGE = 2; // +/- damage variance
export const COMBAT_INITIATIVE_ORDER = "attack"; // attacker strikes first

// Territory
export const CAPTURE_REQUIRES_ALL_ENEMIES_DEAD = true;

// Manual movement
export const MOVE_PREVIEW_COLOR = 0x00ff00;
export const INVALID_MOVE_COLOR = 0xff0000;
```

### File Summary (M5)

| File | Status | Purpose |
|------|--------|---------|
| `src/game/combat/CombatResolver.ts` | **NEW** | Damage calculation, death removal |
| `src/game/combat/CombatVisualizer.ts` | **NEW** | Damage numbers, death effects |
| `src/game/unit/UnitSelectionController.ts` | **NEW** | Selection state, manual move |
| `src/app/ui/UnitInfoPanel.ts` | **NEW** | Selected unit display |
| `src/game/unit/MovementManager.ts` | EDIT | Combat check before move, capture trigger |
| `src/game/hex/HexGrid.ts` | EDIT | `captureHex()`, `destroyBuilding()` |
| `src/game/build/BuildManager.ts` | EDIT | `onHexCaptured()` ownership transfer |
| `src/game/unit/UnitRenderer.ts` | EDIT | Combat effects, death animations |
| `src/app/screens/game/GameScreen.ts` | EDIT | Wire selection, manual movement |
| `src/app/ui/BuildPanel.ts` | EDIT | Priority hex panel |

### Validation (M5)

- [ ] `tsc --noEmit` clean
- [ ] `vite build` succeeds
- [ ] `npm run dev` →
  - Units spawn and move toward enemy victory hex
  - Clicking friendly hex selects units, shows info panel
  - Selected units can be moved to adjacent hex via click
  - Combat resolves when opposing units meet on same hex
  - Damage numbers appear during combat
  - Dead units are removed from display
  - Hex ownership changes when all enemy units destroyed + friendly moves in
  - Buildings on captured hex change faction
  - Priority panel shows 3 high-pressure hexes
  - Movement cost: enemy hex = 2x movement points

### Risks

- **Combat balance**: Attack/defense values may need tuning after playtesting
- **Capture edge case**: What if a hex has buildings but no units? Should it auto-capture?
- **Manual vs auto movement conflict**: If player manually moves a unit, should auto-movement resume?
- **Performance**: Combat resolution + territory capture + re-rendering could cause frame drops with many units
- **UI complexity**: Unit selection + manual movement adds interaction modes that need clear visual feedback

### Out of Scope (M6)

- Win/lose resolution
- Notifications (low resources / unit cap reached)
- Advanced AI (flanking, retreat, combined arms)
- Unit experience/leveling
- Special abilities per unit type
