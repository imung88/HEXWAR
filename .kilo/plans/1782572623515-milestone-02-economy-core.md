# Milestone 2: Economy Core + Game Controller + Icon Legend + Top Bar

## Goal
Make the battlefield live: resources tick up each tick, player sees them on a top bar, mouse interaction drives the game controller (selecting hexes and inspecting state), and a legend teaches what the colors/markers mean.

## Confirmed Design Decisions
1. **Fixed-step economy, decoupled from render loop** — Economy steps at `TICK_MS` (1000ms) cadence; rendering stays at 60 FPS. `GameController.update(deltaMS)` accumulates elapsed time and only steps `EconomySystem` when accumulator crosses `TICK_MS`.
2. **Single-hex click selection in M2; multi-hex priority panel deferred to M6** — Clicking a hex only selects/inspects it (visual ring + tooltip). The RPD's "up to 3 priority hexes set to Attack/Defend" panel is explicitly excluded.

---

## Files to Create

| File | Role |
|------|------|
| `src/game/economy/EconomySystem.ts` | Per-faction gold/oil state; per-tick income from controlled nodes + victory hex; border-pressure reduction; maintenance registry hook. |
| `src/game/economy/MaintenanceRegistry.ts` | Tracks recurring per-tick costs (empty now; BuildManager registers buildings later). |
| `src/game/GameController.ts` | Owns the tick loop + systems; stepped from `GameScreen` via `app.ticker`. Holds `HexGrid`, `EconomySystem`, `SelectionController`. Win/lose check hook. |
| `src/game/SelectionController.ts` | Mouse hover/click on hexes; tracks selected hex; emits selection events for later BuildManager/priority-panel consumers. |
| `src/app/ui/TopBar.ts` | `BitmapText`-based bar: gold, oil, income/min, maintenance drain (player faction, plus enemy for visibility). |
| `src/app/ui/HexTooltip.ts` | Lightweight hover tooltip: owner, node, defense bonus (river), victory flag. |
| `src/app/ui/Legend.ts` | Overlay documenting owner colors, river tint, victory border, node glyphs. |

## Files to Edit

| File | Changes |
|------|---------|
| `src/game/config/GameConfig.ts` | Add income values per node type, victory income, border-pressure reduction table, tooltip/legend colors. |
| `src/app/screens/game/GameScreen.ts` | Instantiate `GameController` in `prepare()`; add `TopBar`, `Legend`, `HexTooltip`; wire `app.ticker` → `GameController.update(deltaMS)`. |

---

## Scope Boundaries (Explicitly OUT of Scope)
- No building placement, no command centers, no spawn speed toggles (BuildManager is Milestone 3).
- No units, no spawning, no combat (Milestones 4+).
- No A* pathfinding.
- No priority panel (Attack/Defend selection) — selection here is single-hex inspection only.
- No persistence of economy state across sessions.

---

## Implementation Details

### 1. GameConfig.ts (edit)
Add to existing config:
```typescript
// Income per node type per tick (RPD: town=small gold, city=large gold, oilField=medium oil)
export const NODE_INCOME: Record<NodeType, { gold: number; oil: number }> = {
  town: { gold: 5, oil: 0 },
  city: { gold: 15, oil: 0 },
  oilField: { gold: 0, oil: 8 },
};

// Victory hex income (very low gold + very low oil)
export const VICTORY_INCOME = { gold: 1, oil: 1 };

// Border-pressure resource reduction multipliers (RPD-specified)
export const BORDER_PRESSURE_REDUCTION = [
  { neighbors: 3, multiplier: 0.8 },  // -20%
  { neighbors: 4, multiplier: 0.7 },  // -30%
  { neighbors: 5, multiplier: 0.5 },  // -50%
];

// Tooltip/legend colors
export const TOOLTIP_BG = 0x1a1a1a;
export const TOOLTIP_TEXT = 0xffffff;
export const SELECTION_RING_COLOR = 0xffff00;
```

### 2. EconomySystem.ts (new)
- **State**: `gold: number`, `oil: number` per faction (`friendly`, `enemy`).
- **Income calculation**:
  - Iterate all tiles via `HexGrid.forEach()`.
  - For each tile owned by faction, add node income + victory income if `isVictory`.
  - Apply border-pressure reduction: use `HexGrid.borderPressureCount(q, r)` to get neighbor count, look up multiplier from `BORDER_PRESSURE_REDUCTION`.
- **Maintenance**: Deduct registered maintenance costs from `MaintenanceRegistry` per tick.
- **API**: `update()`, `getState(faction)`, `getIncomeBreakdown(faction)`.

### 3. MaintenanceRegistry.ts (new)
- **Registry**: `Map<string, { gold: number; oil: number }>` keyed by building ID.
- **API**: `register(id, cost)`, `unregister(id)`, `getTotal()`, `clear()`.

### 4. GameController.ts (new)
- **Members**: `hexGrid`, `economy`, `selection`, `maintenanceRegistry`.
- **Tick accumulator**: `private tickAccumulator = 0;`
- **update(deltaMS: number)**:
  ```typescript
  this.tickAccumulator += deltaMS;
  while (this.tickAccumulator >= TICK_MS) {
    this.economy.update();
    this.tickAccumulator -= TICK_MS;
  }
  this.selection.update();
  // win/lose check hook (skeleton)
  ```
- **API**: `getEconomy()`, `getSelection()`, `getHexGrid()`.

### 5. SelectionController.ts (new)
- **State**: `selectedHex: {q, r} | null`, `hoveredHex: {q, r} | null`.
- **Input**: Listen to `HexGridView` events (`hexTap` for click, `pointermove` for hover via `eventMode="static"`).
- **Visual feedback**: Emit `hexHover` and `hexSelect` events with payload `{q, r}`. `GameScreen` handles visual ring on `HexGridView`.
- **API**: `getSelected()`, `getHovered()`, `clearSelection()`.

### 6. TopBar.ts (new)
- Extend `Container`.
- Use `BitmapText` for cheap per-tick updates (fallback to `Text` if no bitmap font).
- Display per faction: Gold, Oil, Income/min (gold/oil), Maintenance drain.
- `update(economyState)` called from `GameScreen.update()` after economy tick.

### 7. HexTooltip.ts (new)
- Extend `Container`.
- Lightweight: owner, node type, defense bonus (river = yes/no), victory flag.
- Position follows pointer in screen space (use `toGlobal`/`toLocal`).
- Debounce: only update on hex change, not every `pointermove`.

### 8. Legend.ts (new)
- Extend `Container`.
- Panel (top-left or right-side) explaining:
  - Owner colors: Friendly / Neutral / Enemy.
  - River defense tint.
  - Victory hex border.
  - Node glyphs: Town (circle), City (square), Oil Field (triangle).

### 9. GameScreen.ts (edit)
- In `prepare()`:
  - Create `GameController` with `HexGrid`.
  - Create `TopBar`, `Legend`, `HexTooltip`, `SelectionController`.
  - Wire `HexGridView` events → `SelectionController`.
  - Add UI containers as children (above `HexGridView`).
- In `update(ticker)`:
  - Call `gameController.update(ticker.deltaMS)`.
  - Call `topBar.update(economyState)`.
- In `resize()`: reposition `TopBar`, `Legend`, `HexTooltip`.

---

## Risks / Pitfalls
- **Fixed-step vs render loop**: Must separate economy stepping (`TICK_MS`) from rendering (60 FPS). Accumulate `deltaMS`; step economy when accumulator ≥ `TICK_MS`; never block render tick.
- **Border-pressure parity**: Build reduction as reusable helper returning multiplier, not inline in income only (spawn cadence will reuse later).
- **BitmapText font**: Needs font installed via `BitmapFont.install` or existing asset. Falls back to `Text` if no bitmap font wired.
- **Hover perf**: `pointermove` over hundreds of hexes must not trigger heavy work per move; debounce tooltip, or only update on hex-change.
- **Tooltip coordinate space**: Tooltip follows pointer in screen space — must convert with `toGlobal`/`toLocal`, not assume container-local coords match canvas.
- **GameController ownership**: Owns systems but must not own display objects directly — keep simulation (`EconomySystem`, `SelectionController` state) separate from view (`HexGridView`, `TopBar`).

---

## Validation Plan
1. `tsc --noEmit` clean; `eslint .` clean.
2. `npm run dev` → Start → GameScreen shows hex map PLUS a top bar.
3. Gold and oil counters for the friendly faction increase every tick; enemy counters also increase.
4. Income/min display updates from node production; maintenance drain shows 0 (no buildings yet).
5. Hovering a hex highlights it and shows a tooltip with owner / node / defense-bonus / victory info.
6. Clicking a hex selects it (visible ring); clicking another moves the selection.
7. The legend panel explains all colors and glyphs displayed on the map.
8. Repro check: same seed ⇒ same node positions (already true from M1).

---

## Dependencies
- PixiJS v8 (already in project)
- `@pixi/text-bitmap` for `BitmapText` (verify installed; if not, add via `npm install @pixi/text-bitmap` and a bitmap font asset)

---

## Next Steps (Milestone 3 Preview)
- BuildManager + command center placement + placement UI (uses `hexTap`/selection hook + economy cost deduction from M2).