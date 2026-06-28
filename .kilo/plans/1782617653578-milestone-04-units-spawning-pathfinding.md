# Hexwar — Milestone 04: Units, Spawning, A* Pathfinding, Movement Penalty

## Goals

1. **Unit entities**: Define Infantry / Tank / Artillery with full RPD stats (HP, Attack, Defense, Movement, Vision). UnitManager stores all units, provides queries.
2. **SpawnManager**: Per-building cadence timers driven by spawn speed. When timer fires → check global faction cap → create unit on building's hex. Victory CC auto-spawns infantry slowly.
3. **A\* pathfinding**: Hex-adapted A\* with movement-cost multiplier for enemy hexes (2x). Returns path array or null.
4. **Unit rendering**: Stacked offset sprites per hex — small colored shape per unit type, offset to show stack, count badge for overflow.
5. **Building icon polish**: Make CC + spawn building glyphs larger, outlined, and clearly visible on every hex.
6. **All starting hexes get CCs**: Every friendly and enemy hex starts with a free Command Center (no maintenance), enabling the enemy to destroy CCs to reclaim territory.

## Design Decisions (confirmed)

1. **Unit rendering**: Stacked offset sprites — each unit is a small colored icon; up to ~5-6 visible per hex, offset to show stack. Remaining count shown as badge.
2. **Scale**: Max ~10 units per hex, ~50 units per faction global cap.
3. **Movement penalty**: Hex cost multiplier — entering enemy hex costs 2× movement points. River does NOT affect movement cost (defense only).
4. **Victory CC cadence**: 60s (low) / 30s (high) auto-infantry spawn.
5. **CC maintenance: NONE**. Command centers have zero maintenance cost. Only spawn buildings incur maintenance.
6. **All starting hexes get CCs**: Every friendly (50 hexes) and enemy (40 hexes) tile gets an instant-ready free CC at match start. No cost, no maintenance.

---

## Task Order

### 1. Config additions

**File: `src/game/config/GameConfig.ts`**
- [ ] Add `UnitType = "infantry" | "tank" | "artillery"`
- [ ] Add `UnitConfig` interface: `label, maxHp, attack, defense, movement, vision, color`
- [ ] Add `UNIT_CONFIGS: Record<UnitType, UnitConfig>` with RPD-aligned values:
  - Infantry: hp 30, atk 5, def 2, mov 3, vision 2
  - Tank: hp 80, atk 12, def 6, mov 2, vision 3
  - Artillery: hp 40, atk 15, def 1, mov 1, vision 4
- [ ] Add `MAX_UNITS_PER_HEX = 10`
- [ ] Add `MAX_UNITS_PER_FACTION = 50`
- [ ] Add `ENEMY_HEX_MOVE_COST_MULT = 2`
- [ ] Add `VICTORY_CC_CADENCE_MS = 60000`
- [ ] Add `cadenceLowMs` and `cadenceHighMs` to `BuildingTypeConfig` interface
- [ ] Fill cadence values in `BUILDING_CONFIGS`:
  - commandCenter: `Infinity / Infinity` (CCs don't spawn)
  - infantryBarracks: `20000 / 10000`
  - tankDivision: `40000 / 20000`
  - artilleryDivision: `50000 / 25000`
- [ ] Set CC `maintenanceLow` and `maintenanceHigh` to `{ gold: 0, oil: 0 }` — no CC maintenance
- [ ] Add `BUILDING_ICON_SIZES` config: CC glyph radius, spawn building glyph radius (larger than current)

### 2. Unit entity + UnitManager

**File: `src/game/unit/Unit.ts`** (new)
- [ ] `Unit` interface: `id, type, owner, q, r, hp, maxHp, attack, defense, movement, vision`
- [ ] Factory function `createUnit(type, owner, q, r): Unit` — reads `UNIT_CONFIGS`

**File: `src/game/unit/UnitManager.ts`** (new)
- [ ] Stores all units in a `Map<string, Unit>` by id
- [ ] `addUnit(unit)` — registers, returns id
- [ ] `removeUnit(id)` — removes
- [ ] `getUnit(id)` — lookup
- [ ] `getUnitsAt(q, r): Unit[]` — all units on a hex
- [ ] `getUnitsByFaction(faction): Unit[]`
- [ ] `getFactionUnitCount(faction): number`
- [ ] `canSpawn(faction): boolean` — below global cap
- [ ] `moveUnit(id, toQ, toR)` — updates position
- [ ] `forEach(cb)` — iterate all units (for rendering)

### 3. SpawnManager

**File: `src/game/spawn/SpawnManager.ts`** (new)
- [ ] Constructor: `HexGrid`, `BuildManager`, `UnitManager`
- [ ] Internal per-building spawn timer `Map<string, number>` (buildingId → remaining ms)
- [ ] `update(deltaMs)` — each TICK_MS:
  - For each ready spawn building (via BuildManager iteration):
    - Read building's spawnSpeed → skip if "off"
    - Read cadence from config (cadenceLowMs or cadenceHighMs based on speed)
    - Decrement timer; if ≤ 0 → try spawn:
      - Check `UnitManager.canSpawn(faction)`
      - Check unit count at hex < MAX_UNITS_PER_HEX
      - Create unit on building's hex, register with UnitManager
      - Reset timer to cadence
- [ ] `initTimers(seed)` — seed per-building timers with randomized offset (stagger spawns)
- [ ] Victory CC handling: SpawnManager checks `tile.isVictory` on the building's hex → spawns infantry at `VICTORY_CC_CADENCE_MS` regardless of building type/spawn speed

**File: `src/game/build/BuildManager.ts`** (edit)
- [ ] Add `forEachSpawnBuilding(cb)` — iterates all ready spawn buildings for SpawnManager
- [ ] In `placeStartBuildings()`: place instant-ready free CCs on ALL friendly/enemy hexes, then spawn buildings on the 3+1 selected hexes

**File: `src/game/build/BuildingTypes.ts`** (edit)
- [ ] Add `unitType: UnitType | null` to `Building` interface (null for CC)

### 4. A* pathfinding

**File: `src/game/pathfinding/HexAStar.ts`** (new)
- [ ] `findPath(grid, startQ, startR, goalQ, goalR): {q,r}[] | null`
- [ ] Movement cost: 1 per friendly/neutral hex, `ENEMY_HEX_MOVE_COST_MULT` for enemy hexes
- [ ] Heuristic: `hexDistance()` (admissible)
- [ ] Uses hex neighbors from `HexGrid.neighbors()`
- [ ] Returns array of {q,r} from start to goal (inclusive), or null if unreachable

**File: `src/game/hex/HexGrid.ts`** (edit)
- [ ] Add `getMovementCost(q, r): number` — returns 1 for friendly/neutral, `ENEMY_HEX_MOVE_COST_MULT` for enemy

### 5. Building icon polish

**File: `src/game/build/BuildRenderer.ts`** (edit)
- [ ] Enlarge CC glyph: increase from `size * 0.22` to `size * 0.30`, add white outline stroke for visibility
- [ ] Enlarge spawn building glyph: increase from `size * 0.18` to `size * 0.24`, add outline stroke, center properly
- [ ] Ensure building icons are clearly distinguishable from resource node markers (different position/size)

### 6. Unit rendering

**File: `src/game/unit/UnitRenderer.ts`** (new)
- [ ] Reads `UnitManager` state, renders stacked offset sprites on the hex grid
- [ ] `drawUnits(container, q, r, units, size)`:
  - Group units by type
  - Draw small colored shape per type: circle = infantry, rounded rect = tank, triangle = artillery
  - Stack with offset: dx = i * 5px, dy = -i * 4px (diagonal upward stack)
  - If count > visible limit (~6), show count badge
- [ ] `updateAll()` — full redraw of all unit overlays
- [ ] `updateHex(q, r)` — redraw units on a single hex (selective update)

### 7. Wiring

**File: `src/game/GameController.ts`** (edit)
- [ ] Own `UnitManager` and `SpawnManager`
- [ ] Step `spawnManager.update(TICK_MS)` each fixed tick
- [ ] Expose `getUnitManager()`

**File: `src/game/hex/HexGridView.ts`** (edit)
- [ ] Add a `unitLayer` child `Container` for unit overlays (above base tiles + buildings)
- [ ] Expose `getUnitLayer()` for UnitRenderer

**File: `src/app/screens/game/GameScreen.ts`** (edit)
- [ ] Instantiate `UnitManager`, `SpawnManager`, `UnitRenderer`
- [ ] Call `spawnManager.initTimers(matchSeed)` after grid init
- [ ] After each tick step, call `unitRenderer.updateAll()`
- [ ] Add unit renderer as child via HexGridView's unit layer

### 8. Validation

- [ ] `tsc --noEmit` clean
- [ ] `vite build` succeeds
- [ ] `npm run dev` → Start → GameScreen:
  - **All friendly/enemy hexes show a clear CC icon** (gold diamond with white outline)
  - Spawn buildings show clearly visible colored icons (green/blue/red circles with outline)
  - Units spawn from buildings over time (visible on hexes as stacked colored icons)
  - Infantry from barracks, tanks from tank divisions, artillery from artillery divisions
  - Victory CC spawns infantry slowly
  - Unit stack renders correctly (offset icons, count badge for overflow)
  - A* pathfinding produces valid paths (debug log or test)
  - Movement cost: enemy hex = 2× in pathfinding
  - Global unit cap enforced (no spawning when cap reached)
  - Per-hex cap enforced (units don't pile past limit)
  - CC maintenance = 0 in TopBar (only spawn building maintenance shown)

---

## File Summary

### Create
| File | Role |
|---|---|
| `src/game/unit/Unit.ts` | Unit interface + factory |
| `src/game/unit/UnitManager.ts` | Unit storage, queries, cap checks |
| `src/game/unit/UnitRenderer.ts` | Stacked offset sprite rendering per hex |
| `src/game/spawn/SpawnManager.ts` | Per-building cadence timers, unit creation |
| `src/game/pathfinding/HexAStar.ts` | Hex-adapted A* pathfinding |

### Edit
| File | Changes |
|---|---|
| `src/game/config/GameConfig.ts` | Unit configs, cadence fields, CC zero maintenance, caps, movement cost mult, icon sizes |
| `src/game/build/BuildingTypes.ts` | Add `unitType` to Building |
| `src/game/build/BuildManager.ts` | `forEachSpawnBuilding()`, place CCs on ALL starting hexes |
| `src/game/build/BuildRenderer.ts` | Enlarge + outline building icons |
| `src/game/GameController.ts` | Own UnitManager + SpawnManager, step them |
| `src/app/screens/game/GameScreen.ts` | Instantiate + wire unit system + renderer |
| `src/game/hex/HexGridView.ts` | Add unit container layer |
| `src/game/hex/HexGrid.ts` | Add `getMovementCost()` |

---

## Risks

- **Starting CC flood**: 90 CCs placed instantly at match start. `placeStartBuildings` needs to loop all friendly/enemy tiles. Performance is fine (one-time init), but maintenance registry must handle zero-cost entries correctly.
- **Building icon overlap with nodes**: Resource nodes (circle/square/triangle markers) and building icons (diamonds/circles) must be visually distinct — different sizes, positions, or outlines prevent confusion.
- **SpawnManager iteration**: Needs to enumerate all buildings. BuildManager currently has no public iterator — add `forEachSpawnBuilding()`.
- **Victory CC identification**: SpawnManager checks `tile.isVictory` via grid lookup on the building's hex to decide auto-infantry behavior.
- **Unit stacking perf**: Stacked sprites with per-hex Graphics redraw could be expensive if units move frequently (M5). Use selective `updateHex()` only on changed hexes.
- **Spawn cadence stagger**: Without randomized initial timers, all buildings of the same type fire simultaneously. Use per-building random offset at init.

## Out of Scope

- Unit movement / autonomous AI (M5)
- Combat / damage / HP reduction (M5)
- Unit death / removal from combat (M5)
- Priority panel (3 Attack/Defend hexes) (M6)
- Notifications (low resources / unit cap reached) (M6)
- Win/lose resolution (M6)
