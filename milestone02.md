# Hexwar — Milestone 03

This document defines the next milestone to execute. Recaps of prior milestones
live in `milestone01.md`.

> Note: this plan was requested as `milestone02.md` at repo root, but the
> workspace edit permissions restrict writes to plan directories. It is saved
> here so it remains editable; move it next to `milestone01.md` if you prefer
> (requires granting repo-root write access).

---

## Part 0 — Milestone recap

| Milestone | Status |
|---|---|
| M1 — Start page + 15×10 hex map (owners, river, seeded nodes, victory hexes) | ✅ Done |
| M2 — Economy core + GameController (fixed-step tick) + TopBar + Tooltip + Legend + hover/selection | ✅ Done |
| **M3 — Map-gen polish + BuildManager + starting buildings + build UI** | ⬅️ **This milestone** |

---

## Part 1 — Milestone 3 Goal

1. **Fix the battlefield**: the river currently covers ~19% of tiles with
   **zero tiles on the enemy side** (entirely left-biased), and resource nodes
   use a fixed seed so every match is identical. Both must be regenerated per
   match.
2. **Make buildings exist**: implement the RPD BuildManager — command centers,
   spawn buildings, placement rules, immediate cost + per-faction maintenance,
   CC build time, rebuild-cooldown structure, and auto-placed starting buildings
   (3 Infantry Barracks + 1 Tank Division per faction). This turns the M2 top
   bar's maintenance drain from a permanent 0 into live upkeep.
3. **Let the player build**: hex-first context BuildPanel — select a hex, see
   only the buildable types valid for that hex, confirm to build, and toggle
   spawn speed to change maintenance live.

SpawnManager (actual unit spawning) remains M4; it will consume the buildings +
spawn-speed state produced here.

---

## Part 2 — Confirmed Design Decisions

1. **River**: procedural winding path generated from the per-match seed,
   confined **mostly to the neutral band (q 5–10)** — i.e. the contested front,
   not edge-to-edge and not on faction back columns. Rare single-tile
   excursions into adjacent friendly/enemy columns allowed. Thinner than before
   (target ~6–10 river tiles). Defense-bonus mechanic unchanged (river flag on
   tile); because river tiles sit in neutral territory the bonus only matters
   once a faction captures them.
2. **Resource nodes**: random seed per match (seed logged/displayed for repro)
   **+** balanced regional allocation (proportional to region tile counts) **+**
   min-spacing so nodes never cluster or pile onto one side.
3. **Build UX: hex-first context build**. Player clicks a hex (reuses M2
   selection ring) → a context BuildPanel shows only buildable types valid for
   THAT hex → click a type to build there. No separate placement-mode hover
   preview.
4. **Per-faction maintenance** (forced fix): the M2 MaintenanceRegistry applies
   one global total to both factions — wrong once enemy buildings exist. It must
   track owner and report `getTotal(faction)`.

---

## Part 3 — Map Generation Changes

### River (procedural, neutral-fronted)
- Generated from the per-match RNG (varies per match, deterministic given seed).
- Path: start at left neutral column (q = first neutral col), end at right
  neutral column (q = last neutral col); start/end `r` random within `[1, H-2]`.
  Step `q+1`; each step drift `r` by a random choice in `{-1, 0, +1}`, clamped to
  `[0, H-1]`. Mark path tiles `river = true`.
- Rare excursion: with small probability, place one extra river tile one column
  into the adjacent friendly (`q-1`) or enemy (`q+1`) band, so the river is
  "mostly" neutral rather than 100%.
- Clear all previous river flags before regenerating (no leftover old river).
- Config: neutral-band column bounds, drift, excursion probability, max tiles.

### Resource nodes (random + balanced + spaced)
- Per-match random seed (keep the seeded-RNG mechanism for reproducibility;
  expose/log the seed).
- Allocate node counts per region proportional to region non-victory tile counts
  (≈ friendly 3 / neutral 4 / enemy 3 of 10 = town 4, city 2, oilField 4).
- Within each region: seeded-shuffle candidates, place nodes with a min hex
  distance (e.g. ≥ 2) between any two nodes; cycle node types from a shuffled
  global pool so types don't cluster.
- Add `hexDistance(q1,r1,q2,r2)` to `hexMath.ts` (axial cube distance).

### Tile state additions
`Tile` gains:
- `commandCenter: boolean` (CC presence flag — RPD: "tile state including ...
  command center presence") and a reference to its build/construction state.
- `building: BuildingRef | null` (the spawn building, if any).
- `underConstruction: boolean` (CC being built).

---

## Part 4 — BuildManager

### Building data model (new `BuildingTypes.ts`)
```ts
type SpawnSpeed = "off" | "low" | "high";
type BuildingType = "commandCenter" | "infantryBarracks" | "tankDivision"
                  | "artilleryDivision" | "victoryCC";

interface BuildingTypeConfig {
  kind: "commandCenter" | "spawn";
  cost: { gold: number; oil: number };
  maintenance: { low: ResourceCost; high: ResourceCost }; // off => minimal/0
  cadenceLowMs: number; cadenceHighMs: number;             // SpawnManager reads these in M4
  maxHp: number;
  buildTimeMs: number;   // CC on neutral -> 5000; spawn buildings -> 0 (instant)
}
```
All numeric knobs live in `GameConfig.ts` (RPD building-stats table → config).

### Placement rules (RPD-enforced)
- **One spawn building per hex**, plus a command center, plus at most one
  resource node — all can coexist on one hex.
- A spawn building requires a **ready** command center on that hex (CC not under
  construction).
- Command center placement:
  - Only on a **player-controlled or neutral** hex (claim the hex on placement
    by setting owner = friendly).
  - Small gold cost deducted **immediately** on placement.
  - **5s build time** (under construction) when built; becomes ready on
    completion; spawn buildings unlock only after ready.
  - **Rebuild cooldown (15s)**: after a faction loses a CC it cannot rebuild for
    15s. Implement the cooldown data structure + check; the destroy trigger
    arrives with M5 combat, so it won't fire from gameplay this milestone.
  - Does **not** count toward the one-building-per-hex limit.
- Victory hex already has a special CC (from M1) — treated as a `victoryCC`
  building (very low income already handled by `VICTORY_INCOME` in M2; very
  large HP config; no spawn-speed toggle; its slow auto-infantry spawn is M4).
- Immediate cost deducted on placement; **maintenance registers only once the
  building is ready** (i.e. after CC construction completes for a CC; instantly
  for spawn buildings).

### Maintenance (per faction)
- Each ready building registers its maintenance cost via `MaintenanceRegistry`,
  choosing the `low` or `high` value from its `spawnSpeed` (off => minimal/0).
- Re-register on spawn-speed change so the top bar updates live.
- Economy deducts `getTotal(faction)` per faction each tick (fixes M2's
  apply-global-to-both bug).

### HP / regen (skeleton, no combat yet)
- Buildings/CCs store `hp`/`maxHp`. CC regenerates HP while no enemy unit is
  present (always true in M3) — increment toward max per tick. Real damage +
  destruction + rebuild-cooldown trigger arrive with M5.

### Starting buildings (init)
- Per faction: 3 Infantry Barracks + 1 Tank Division on randomly chosen
  controlled, non-victory hexes. Each host hex is auto-given a CC (instant,
  ready, no cost) then the building (instant, ready, default spawn speed Low).
- Registers maintenance immediately → top bar shows non-zero upkeep at match
  start.

### Ownership & stepping
- `GameController` owns `BuildManager` and steps `buildManager.update()` each
  fixed `TICK_MS` tick (build timers + regen). GameScreen accesses it via the
  controller; BuildManager never owns display objects (view reads its state).

---

## Part 5 — Build UX (hex-first, new `BuildPanel.ts`)

Selecting a hex (M2 hook) opens a context `BuildPanel` showing, for that hex:

| Hex state | Panel shows |
|---|---|
| Player-owned, no CC, no building | `[Command Center]` (cost; greyed if unaffordable or cooldown active) |
| Player-owned, has ready CC, no building | `[Infantry Barracks] [Tank Division] [Artillery Division]` (costs; greyed if unaffordable) |
| Player-owned, CC under construction | "Command center building… (Ns)" — no build actions |
| Has a spawn building | Building type + spawn-speed toggle `Off/Low/High` + current maintenance; (replace disabled for now) |
| Victory CC or enemy/neutral-unclaimed | Non-buildable / read-only info; no build actions |

- Clicking a buildable type → `BuildManager.place(...)`; if `canAfford` and
  rules pass, deduct cost, create building, set tile state, start CC timer if
  applicable. If unaffordable/invalid, no-op (notifications are M6).
- Spawn-speed toggle → `BuildManager.setSpawnSpeed(...)` → re-register
  maintenance → top bar updates.
- Panel re-renders whenever the selected hex or its building state changes.

---

## Part 6 — Files

### Create
| File | Role |
|---|---|
| `src/game/build/BuildingTypes.ts` | SpawnSpeed/BuildingType types, BuildingTypeConfig, Building record + defaults from GameConfig. |
| `src/game/build/BuildManager.ts` | Building registry; placement validation + rules; cost deduction via EconomySystem; per-faction maintenance registration; CC build timer + rebuild-cooldown structure; HP/regen skeleton; `placeStartBuildings()`. |
| `src/app/ui/BuildPanel.ts` | Hex-first context panel: buildable types for the selected hex + affordability + spawn-speed toggle + upkeep indicator. |
| `src/game/build/BuildRenderer.ts` (or extend HexGridView) | Render CC + spawn-building glyphs + under-construction hatching per tile. |

### Edit
| File | Changes |
|---|---|
| `src/game/config/GameConfig.ts` | River procedural params (neutral band, drift, excursion chance, max tiles); node randomization params (region allocation table, min spacing, per-match seed handling); building configs (costs, maintenance low/high, cadence, maxHp, build/cooldown timers); spawn-speed multiplier table; building/CC/construction colors. |
| `src/game/hex/hexMath.ts` | Add `hexDistance(q1,r1,q2,r2)` (axial cube distance). |
| `src/game/hex/HexGrid.ts` | `Tile` += `commandCenter`, `building`, `underConstruction`; replace `generateRiver` with procedural neutral-band winding; replace `placeResourceNodes` with random-per-match-seed + balanced regional spread + min spacing; expose mutation helpers used by BuildManager. |
| `src/game/hex/HexGridView.ts` | Draw CC + building glyphs + construction state on tiles; rebuild a tile's graphics on placement/speed change. |
| `src/game/economy/MaintenanceRegistry.ts` | Track `owner` per entry; `getTotal(owner: Faction)`. |
| `src/game/economy/EconomySystem.ts` | Deduct maintenance per faction via `getTotal(faction)` (was global-to-both); add `canAfford(faction, cost)` and `spend(faction, cost): boolean`. |
| `src/game/GameController.ts` | Own + construct `BuildManager`; step `buildManager.update()` each fixed `TICK_MS` tick; expose `getBuildManager()`. |
| `src/game/SelectionController.ts` | (Minimal) selection-change already emitted; GameScreen wires it to BuildPanel context. No structural change expected. |
| `src/app/screens/game/GameScreen.ts` | Instantiate BuildManager via controller; call `placeStartBuildings()` after grid init; add BuildPanel + BuildRenderer; wire `hexTap`/selection → BuildPanel context; rebuild tile graphics on build/speed changes; pass per-match seed into grid init. |

---

## Part 7 — Scope Boundaries (OUT of scope)

- Units, spawning, combat, damage application, CC destruction (M4–M5). HP/regen
  is a non-interactive skeleton.
- SpawnManager (cadence timers actually producing units) — M4. Spawn-speed state
  + cadence config are produced here but produce no units yet.
- A* pathfinding (M4).
- Priority panel (3 Attack/Defend hexes) — M6.
- Notifications (low-resource / unpaid-maintenance / CC-destroyed / cooldown)
  — M6. This milestone only greys/invalidates unaffordable actions silently.
- Win/lose resolution — M6.
- Victory CC's auto-infantry spawning — M4.

---

## Part 8 — Risks / Pitfalls

- **Per-faction maintenance correctness**: must verify friendly upkeep does not
  drain enemy gold/oil and vice versa; add a repro scenario in validation.
- **River regeneration must clear old river first** or leftover `river:true`
  tiles from the previous algorithm linger.
- **CC "ready" gating**: spawn buildings must be blocked while CC is under
  construction (don't register a building on an unready CC hex).
- **Maintenance registration timing**: register only when a building becomes
  ready; unregister on any removal path so totals never double-count.
- **Affordability race**: `canAfford` + `spend` must be atomic within placement
  (spent before the maintenance tick runs) to avoid spending funds the economy
  already consumed.
- **Render separation**: BuildManager holds only state; all drawing via
  HexGridView/BuildRenderer reading that state.
- **Starting CC auto-claim**: auto-placed CCs on friendly hexes are instant +
  ready + free (no 5s timer, no cost) — distinct from player-built CCs.

---

## Part 9 — Validation Plan

1. `tsc --noEmit` clean; `eslint .` clean; `vite build` succeeds.
2. `npm run dev` → Start → GameScreen:
   - River renders only on the front (mostly neutral band), thinner, and
     differs when the per-match seed changes (reload match).
   - Node positions differ per match and are spread across friendly/neutral/
     enemy regions (no clustering, no left-pile).
   - Both factions' top-bar maintenance drain is **> 0** at match start
     (starting buildings' upkeep).
3. Select a player-owned hex with no CC → BuildPanel shows `[Command Center]`
   with its cost; click to build (cost deducted; hex claimed; on a neutral
   hex the CC shows under-construction for ~5s then ready).
4. With a ready CC on a hex → BuildPanel shows the 3 spawn-building types;
   build one → it appears on the hex and registers maintenance (drain rises).
5. Select a hex with a building → toggle spawn speed Off→Low→High and confirm
   the top-bar maintenance drain changes accordingly.
6. Verify enemy resources are NOT drained by player maintenance and vice versa.
7. Repro: same seed ⇒ same river + node layout (log/show the seed).

---

## Part 10 — Suggested Subsequent Milestones

- **Milestone 4**: SpawnManager + unit entities + A* pathfinding + movement
  penalty (consumes buildings + spawn-speed state + cadence config from M3).
- **Milestone 5**: AIController + combat + engagement/fallback + artillery
  range-2 + CC destruction (wires the rebuild-cooldown + HP/regen skeletons).
- **Milestone 6**: Priority panel (3 Attack/Defend), notifications, win/lose
  resolution, full tooltips, tuning pass.
