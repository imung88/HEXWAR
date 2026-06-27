# Hexwar — Milestone 01

This document records what was delivered in Milestone 1 and defines the next
milestone to execute.

---

## Part 1 — Milestone 1 (COMPLETED): Start Page + Hex Map

### Goal
First playable slice of Hexwar using the existing PixiJS v8 scaffold: a Start
screen that navigates into a fully-initialized 15×10 hex map (owners, diagonal
river, seeded resource nodes). No combat/AI/economy yet — only the rendering +
map-data foundation every later module plugs into.

### Design decisions (resolved)
- **Scope**: full map init — owner bands (Friendly/Neutral/Enemy), diagonal
  river with defense tint, seeded resource-node placement, one victory hex per
  faction.
- **Hex orientation**: pointy-top.
- **Map shape**: rhombus axial map (q 0..14, r 0..9), each row offset.
- **Coordinates**: axial (q, r), as the RPD mandates.
- **Art**: none yet — all tiles drawn with `Graphics` (vector). No manifest
  changes needed (other than the `main` bundle load fix).
- **Routing**: `main.ts` routes to a new `StartScreen` → `GameScreen`.

### Files created
| File | Role |
|---|---|
| `src/game/config/GameConfig.ts` | Single tuning file: hex size, map dims, seed, tick rate, owner/river/node colors, banding thresholds, node counts. |
| `src/game/hex/hexMath.ts` | Pointy-top axial→pixel conversion, `hexPolygonPoints`, `gridPixelBounds`. Logic-only. |
| `src/game/hex/HexGrid.ts` | Logic-only grid: tiles, `neighbors`, `borderPressureCount`, `initMatch()` (owner banding + diagonal river + seeded resource nodes + victory hexes). |
| `src/game/hex/HexGridView.ts` | PixiJS `Container` rendering one `Graphics` hex per tile, owner-tinted, river overlay, victory border, node markers; `eventMode="static"`, emits `hexTap`; `setTileOwner` for later mutation. |
| `src/app/screens/StartScreen.ts` | HEXWAR title + "Start Battle" button → `GameScreen`. |
| `src/app/screens/game/GameScreen.ts` | Owns `HexGrid`+`HexGridView`, centers map in `resize()`, logs hex taps. |

### Files edited
- `src/main.ts` — routes `LoadScreen → StartScreen` (was `MainScreen`).

### Bug fixed during delivery
- `StartScreen` initially declared `assetBundles = []`, but it constructs a
  `Button` whose `defaultView: "button.png"` needs the `main` bundle. The
  bundle was never loaded, so `new Button(...)` threw inside the constructor,
  `BigPool.get(StartScreen)` propagated the throw, and the screen never reached
  the stage — resulting in a blank canvas after the LoadScreen faded out.
  **Fix:** `public static assetBundles = ["main"]`, so `navigation.showScreen`
  loads `button.png` before constructing the screen.

### Validation
- `tsc --noEmit` — clean.
- `eslint .` — clean.
- `npm run dev` — LoadScreen → StartScreen (HEXWAR title + Start button) →
  click Start → centered 15×10 pointy-top hex rhombus with friendly/neutral/
  enemy owner bands, a blue diagonal river, seeded resource-node markers, and
  gold-bordered victory hexes. Clicking any hex logs `{q, r}` to the console.

### RPD coverage after Milestone 1
| RPD Module | Status |
|---|---|
| HexGrid (axial coords, neighbors, river flag) | ✅ Data + render. Missing: A*, command-center-presence on tile state. |
| GameController (tick loop, economy, win/lose) | ❌ Not started. |
| BuildManager | ❌ Not started. |
| SpawnManager | ❌ Not started. |
| AIController | ❌ Not started. |
| Renderer (sprites, river, priority markers, CC visuals, UI overlays) | 🟡 Hex tiles + river + node markers only. |
| Economy (gold/oil, income, maintenance, spawn speed) | ❌ Not started. |
| Units (infantry/tank/artillery) | ❌ Not started. |
| UI (top bar, build panel, priority panel, tooltip, notifications) | ❌ Not started. |

---

## Part 2 — Milestone 2 (NEXT): Economy Core + Game Controller + Icon Legend + Top Bar

### Goal
Make the battlefield *live*: resources tick up each tick, the player sees them
on a top bar, mouse interaction drives the game controller (selecting hexes and
inspecting state), and a legend teaches what the colors/markers mean.

This milestone unblocks BuildManager (needs cost deduction) and SpawnManager
(spawn cost amortized into maintenance). It directly reuses Milestone 1's
`borderPressureCount()` (RPD: border pressure reduces resource gain).

### Why this milestone, and what it unblocks
Every gameplay feature in the RPD depends on the resource economy:
- Buildings cost gold/oil (immediate + per-tick maintenance).
- Unit spawn cost is amortized into maintenance.
- Border-pressure reductions apply to resource gain AND spawn cadence.

So the economy + GameController tick loop is the dependency root. The top bar
gives the first visible live feedback. Mouse-based control lays the interaction
foundation that BuildManager (placement) and the priority panel will reuse.

```
GameController.tick (fixed TICK_MS)
  ├── EconomySystem.update()
  │     ├── income: towns/cities/oilFields/victory hex
  │     ├── border-pressure reduction on resource gain
  │     └── maintenance deduction (registry; no buildings yet, hook exists)
  ├── SelectionController.update()  (mouse hover/click)
  └── Win/Lose check (skeleton hook)
```

### Design decisions (proposed, to confirm)
- **Tick loop**: fixed-step simulation driven by PixiJS `app.ticker`. Accumulate
  elapsed time; step the economy at `TICK_MS` (already in `GameConfig`). Render
  continues at 60 FPS independent of tick rate.
- **Income values** (new in `GameConfig`):
  - `town`: small gold; `city`: large gold; `oilField`: medium oil.
  - Victory hex: very low gold + very low oil (RPD).
- **Border-pressure resource reduction** (RPD-specified, reuse `borderPressureCount`):
  - 3 enemy neighbors → −20% resource gain
  - 4 → −30%
  - 5 → −50%
- **Top bar**: `BitmapText` (cheap per-tick updates) showing, per faction:
  gold, oil, income/min, maintenance drain.
- **Mouse interaction**: hover → highlight hex + show a lightweight tooltip
  (owner/node/defense bonus/victory flag); click → select hex (visual ring).
  Left-click select; right-click clear (platform permitting). This is the hook
  BuildManager swaps in later for placement.
- **Icon legend**: an overlay (top-left or right-side panel) explaining:
  owner colors (friendly/neutral/enemy), river defense tint, victory-hex border,
  resource-node glyphs (town = circle, city = square, oilField = triangle).
- **Factions**: player = friendly; AI = enemy. Economy runs for both so later
  AI spawning/training has resources to spend.

### Files to create (proposed)
| File | Role |
|---|---|
| `src/game/economy/EconomySystem.ts` | Per-faction gold/oil state; per-tick income from controlled nodes + victory hex; border-pressure reduction; maintenance registry hook. |
| `src/game/economy/MaintenanceRegistry.ts` | Tracks recurring per-tick costs (empty now; BuildManager registers buildings later). |
| `src/game/GameController.ts` | Owns the tick loop + systems; stepped from `GameScreen` via `app.ticker`. Holds `HexGrid`, `EconomySystem`, `SelectionController`. Win/lose check hook. |
| `src/game/SelectionController.ts` | Mouse hover/click on hexes; tracks selected hex; emits selection events for later BuildManager/priority-panel consumers. |
| `src/app/ui/TopBar.ts` | `BitmapText`-based bar: gold, oil, income/min, maintenance drain (player faction, plus enemy for visibility). |
| `src/app/ui/HexTooltip.ts` | Lightweight hover tooltip: owner, node, defense bonus (river), victory flag. |
| `src/app/ui/Legend.ts` | Overlay documenting owner colors, river tint, victory border, node glyphs. |
| `src/game/config/GameConfig.ts` (edit) | Add income values per node type, victory income, border-pressure reduction table, tooltip/legend colors. |
| `src/app/screens/game/GameScreen.ts` (edit) | Instantiate `GameController` in `prepare()`; add `TopBar`, `Legend`, `HexTooltip`; wire `app.ticker` → `GameController.update(deltaMS)`. |

### Scope boundaries (explicitly OUT of scope)
- No building placement, no command centers, no spawn speed toggles
  (BuildManager is Milestone 3).
- No units, no spawning, no combat (Milestones 4+).
- No A* pathfinding.
- No priority panel (Attack/Defend selection) — selection here is single-hex
  inspection only; multi-hex priority selection is its own milestone.
- No persistence of economy state across sessions.

### Risks / pitfalls
- **Fixed-step vs render loop**: must separate economy stepping (TICK_MS) from
  rendering (60 FPS). Accumulate `deltaMS`; step economy when accumulator ≥
  TICK_MS; never block the render tick.
- **Border-pressure parity**: ensure the same reduction applies to spawn cadence
  later — build the reduction as a reusable helper returning a multiplier, not
  inline in income only.
- **BitmapText font**: needs a font installed via `BitmapFont.install` or an
  existing asset. Falls back to `Text` if no bitmap font is wired — confirm
  before relying on per-tick BitmapText updates.
- **Hover perf**: `pointermove` over hundreds of hexes must not trigger heavy
  work per move; debounce tooltip, or only update on hex-change.
- **Tooltip coordinate space**: tooltip follows the pointer in screen space —
  must convert with `toScreen`/local-to-global, not assume container-local
  coords match the canvas.
- **`GameController` ownership**: it owns systems but must not own display
  objects directly — keep simulation (`EconomySystem`,
  `SelectionController` state) separate from view (`HexGridView`, `TopBar`).

### Validation plan
1. `tsc --noEmit` clean; `eslint .` clean.
2. `npm run dev` → Start → GameScreen shows hex map PLUS a top bar.
3. Gold and oil counters for the friendly faction increase every tick; enemy
   counters also increase.
4. Income/min display updates from node production; maintenance drain shows 0
   (no buildings yet).
5. Hovering a hex highlights it and shows a tooltip with owner / node /
   defense-bonus / victory info.
6. Clicking a hex selects it (visible ring); clicking another moves the
   selection.
7. The legend panel explains all colors and glyphs displayed on the map.
8. Repro check: same seed ⇒ same node positions (already true from M1).

### Proposed decisions awaiting confirmation
Two design choices need a yes/no before execution. Both already align with the
RPD's intent, but they shape file structure, so confirm before planning.

1. **Fixed-step economy, decoupled from the render loop (RECOMMENDED).**
   The economy steps at a fixed `TICK_MS` cadence regardless of frame rate;
   rendering stays at 60 FPS. A `GameController.update(deltaMS)` accumulates
   elapsed time and only steps `EconomySystem` (income, maintenance, border-
   pressure reductions) when the accumulator crosses `TICK_MS`.
   - **Why**: matches the RPD's per-tick economy language ("per tick", "recurring
     per tick"), keeps simulation deterministic across machines (frame drops
     won't warp income), and is what later unit-AI stepping will expect.
   - **Alternative (rejected)**: stepping every frame. Simpler, but income becomes
     frame-rate-dependent and the maintenance/spawn cadence math gets messy.

2. **Single-hex click selection in M2; multi-hex priority panel deferred to M6
   (RECOMMENDED).**
   In this milestone clicking a hex only *selects/inspects* it (visual ring +
   tooltip). The RPD's "up to three priority hexes set to Attack/Defend" panel
   is explicitly excluded — it arrives in Milestone 6 because it needs the
   build/attack context to be meaningful.
   - **Why**: priority weighting is meaningless without units to weight toward
     objectives; building it now would be dead UI. The selection infra built here
     (hover highlight, click select, selection state) is what M3's BuildManager
     placement and M6's priority panel will reuse.
   - **Alternative (rejected)**: priority hex selection now. Would be visual-only
     with nothing consuming it — wasted effort and rework risk.

Confirm both (or override) before I move to the detailed plan for M2.

### Suggested subsequent milestones (for roadmap context, not this file's scope)
- **Milestone 3**: BuildManager + command center placement + placement UI (uses
  the `hexTap`/selection hook + economy cost deduction from M2).
- **Milestone 4**: SpawnManager + unit entities + A* pathfinding + movement
  penalty.
- **Milestone 5**: AIController + combat + engagement/fallback + artillery
  range-2 targeting.
- **Milestone 6**: Priority panel (3 hexes, Attack/Defend), full tooltips,
  notifications, win/lose resolution, tuning pass.
