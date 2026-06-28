# Milestone 5 — Revision 01: Implementation Status

> Generated from codebase audit on 2026-06-28.

---

## M5 Plan Recap (from milestone05.md)

| # | Feature | Priority |
|---|---------|----------|
| 1 | Combat Resolution | Core |
| 2 | Territory Capture | Core |
| 3 | Unit Selection | Core |
| 4 | Manual Movement | Core |
| 5 | Combat Visualization | Polish |
| 6 | Priority Panel | RPD |

---

## What Has Been Implemented

### 1. Combat Resolution — DONE

**`src/game/combat/CombatResolver.ts`** (216 lines)

- `resolveUnitPairCombat()`: 1v1 paired combat sorted by attack descending
- `resolveBuildingCombat()`: Units attack enemy buildings after clearing defenders
- `resolveHexCombat()`: Orchestrates full hex combat — unit phase then building phase
- Damage formula: `max(1, attack - defense + random(-2, 2))` using seeded RNG
- Returns structured results with damage dealt, units killed, buildings destroyed

**`src/game/unit/MovementManager.ts`** — triggers combat before moving:
- Checks target hex for enemy units/buildings (lines 83–89)
- Calls `combatResolver.resolveHexCombat()` (line 98)
- Applies damage to attackers, defenders, and buildings
- Only proceeds with move if enemies eliminated and unit alive

**`src/game/config/GameConfig.ts`** — combat config:
- `COMBAT_RANDOM_RANGE = 2`
- `COMBAT_INITIATIVE_ORDER = "attack"`
- `MIN_DAMAGE = 1`

### 2. Building HP in Tooltip — DONE (post-M5 plan)

**`src/app/ui/HexTooltip.ts`**:
- `init(buildManager)` method stores `BuildManager` reference
- `showTile()` fetches live building HP via `buildManager.getBuildingAt(q, r)`
- Displays `▸ COMMAND CENTER HP 148/200` and `▸ INFANTRY BARRACKS HP 100/100`
- Wired from `GameScreen.prepare()` at line 78

### 3. War-room UI Overhaul — DONE (post-M5 plan)

**Palette** (`src/game/config/GameConfig.ts`):
- `panelBg: 0x2a2d30` (steel gray, was 0x1a1a1a)
- `panelBorder: 0x3d4247` (was 0x3a3a3a)
- New keys: `accentAmber`, `headerBg`, `textMuted`, `cornerBracket`

**All three panels restyled** — `HexTooltip`, `TopBar`, `BuildPanel`:
- Corner brackets drawn via `Graphics.lineTo()` at all four corners
- Amber header stripe (4px) at top of each panel
- Monospace font: `"Consolas", "Courier New", monospace`
- TopBar title changed to `accentAmber` color
- BitmapFont install updated to monospace in TopBar
- BuildPanel selection markers: `▸` (affordable), `×` (unaffordable)

### 4. Unit Renderer Faction Colors — DONE (post-M5 plan)

**`src/engine/utils/color.ts`**:
- `darkenColor(color, factor)` — extracts RGB, multiplies by factor, returns hex

**`src/game/unit/UnitRenderer.ts`**:
- Friendly units: base config color
- Enemy units: `darkenColor(baseColor, 0.5)` for visual distinction

### 5. Destroyed Building Positions Queue — DONE (post-M5 plan)

**`src/game/build/BuildManager.ts`**:
- `destroyedPositions: {q, r}[]` queue
- Pushed in `destroyBuilding()` when buildings are killed
- `getAndClearDestroyedPositions()` splices and returns all entries

**`src/app/screens/game/GameScreen.ts`** (lines 141–143):
- Flushes queue each frame, calls `view.updateTileBuilding()` for visual sync

---

## What Has NOT Been Implemented

### 2. Territory Capture — MISSING

- No `captureHex()` method on HexGrid
- No `onHexCaptured()` on BuildManager
- When combat kills all enemy units on a hex, nothing changes ownership
- Buildings can be destroyed but the hex stays enemy-owned
- This is a **critical missing feature** — without it, combat has no strategic consequence

### 3. Unit Selection — MISSING

- No `UnitSelectionController.ts` file exists
- `SelectionController` is hex-level only (select/hover hex coordinates)
- No mechanism to select individual units or groups of units
- No selection ring, no unit info panel
- Players cannot interact with their units at all

### 4. Manual Movement — MISSING

- No adjacent-hex click-to-move logic
- `MovementManager` only does autonomous A*-based movement toward enemy victory hex
- `UnitManager.moveUnit()` exists but is only called by autonomous movement
- Players have zero control over unit positioning

### 5. Combat Visualization — MISSING

- No `CombatVisualizer.ts` file exists
- No damage numbers floating up
- No death animations or unit removal effects
- No hex flash on capture
- Combat resolves silently — units just disappear when HP reaches 0
- Damage is applied directly to HP in `MovementManager.update()` with no visual feedback

### 6. Priority Panel — MISSING

- No priority/attack/defend section in BuildPanel
- `SelectionController` JSDoc explicitly defers this to Milestone 6
- No hex pressure calculation or highlighting

---

## Summary

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Combat Resolution | ✅ DONE | Full damage calc, paired combat, building attacks |
| 2 | Territory Capture | ❌ MISSING | No hex ownership change after combat |
| 3 | Unit Selection | ❌ MISSING | No unit-level selection at all |
| 4 | Manual Movement | ❌ MISSING | No player-driven movement |
| 5 | Combat Visualization | ❌ MISSING | No visual feedback for combat |
| 6 | Priority Panel | ❌ MISSING | Deferred to M6 |
| 7 | Building HP in Tooltip | ✅ DONE | Post-M5 plan addition |
| 8 | War-room UI Styling | ✅ DONE | Post-M5 plan addition |
| 9 | Unit Renderer Colors | ✅ DONE | Post-M5 plan addition |
| 10 | Destroyed Buildings Queue | ✅ DONE | Post-M5 plan addition |

**M5 core features: 1 of 4 implemented (Combat Resolution).**
**Post-M5 additions: 4 of 4 implemented.**

---

## Remaining Work for M5 Completion

### Priority 1: Territory Capture (unblocks strategic gameplay)
- Add `captureHex(q, r, newOwner)` to HexGrid
- Add `onHexCaptured(q, r, newOwner)` to BuildManager
- Trigger capture in MovementManager after winning combat and moving into hex
- Convert CC/building ownership on captured hex

### Priority 2: Unit Selection (unblocks player agency)
- Create `src/game/unit/UnitSelectionController.ts`
- Wire hex tap to select friendly units on hex
- Show selection ring on selected hex
- Display unit info in tooltip

### Priority 3: Manual Movement (core gameplay)
- Add `moveSelected(toQ, toR)` to UnitSelectionController
- Validate adjacent hex, per-hex cap, movement cost
- Wire interaction: select units → tap adjacent hex to move
- Show valid move target highlights

### Priority 4: Combat Visualization (polish)
- Create `src/game/combat/CombatVisualizer.ts`
- Floating damage text on combat
- Unit death fade animation
- Hex flash on capture (once capture is implemented)

### Priority 5: Priority Panel (RPD, deferred to M6)
- Per SelectionController JSDoc, this is M6 scope
