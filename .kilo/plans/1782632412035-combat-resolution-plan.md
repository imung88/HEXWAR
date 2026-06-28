# Building HP + War-room UI Overhaul

## Goal
1. Show building HP in `HexTooltip` (currently only shows building type name).
2. Restyle `HexTooltip`, `TopBar`, and `BuildPanel` with a military stencil / war-room aesthetic.

---

## Task 1: Building HP in Tooltip

### Files
- `src/app/ui/HexTooltip.ts`
- `src/app/screens/game/GameScreen.ts`

### Changes
1. **HexTooltip**: add a `BuildManager` reference via `init(buildManager)` method (same pattern as `BuildPanel.init()`).
2. In `showTile()`, after building type lines, fetch building via `this.buildManager.getBuildingAt(tile.q, tile.r)` and append:
   ```
   Building: Command Center  HP 148/200
   Building: Infantry Barracks  HP 100/100
   ```
3. In `GameScreen.prepare()`, call `this.tooltip.init(this.controller.buildManager)`.

---

## Task 2: War-room UI Palette

### File: `src/game/config/GameConfig.ts`
Add new UI color constants (keep existing ones for backward compat):
```typescript
export const UI_COLORS = {
  // ... existing keys ...
  panelBg: 0x2a2d30,          // darker steel gray (was 0x1a1a1a)
  panelBorder: 0x3d4247,      // steel border (was 0x3a3a3a)
  accentAmber: 0xc8a82e,      // war-room amber/gold accent
  headerBg: 0x1e2022,         // darker header bar
  textMuted: 0x7a8088,        // muted secondary text
  cornerBracket: 0xc8a82e,    // corner bracket accent
};
```

---

## Task 3: War-room Styled HexTooltip

### File: `src/app/ui/HexTooltip.ts`

Visual overhaul:
- **Font**: switch to `"Consolas", "Courier New", monospace` (monospace = stencil feel).
- **Background**: steel gray panel with 4 corner brackets drawn via `Graphics.lineTo()` — small angular L-shapes at each corner in amber.
- **Header bar**: thin amber rectangle at top (height 4px) as a section indicator.
- **Section dividers**: thin horizontal amber line between terrain/building/unit sections.
- **Text formatting**: use all-caps for labels (`OWNER`, `BUILDING`, `UNITS`), mixed-case for values.

Implementation approach:
- Replace the single `bg.clear() → roundRect → fill → stroke` with a multi-draw method:
  1. Fill background rect
  2. Draw 4 corner brackets (8 short line segments)
  3. Draw amber header stripe
  4. Draw section divider lines
- Format text with section headers: `▸ OWNER: Friendly`, `▸ BUILDING: Infantry Barracks HP 100/100`, `▸ UNITS: 3 Infantry (HP 14/30)`

---

## Task 4: War-room Styled TopBar

### File: `src/app/ui/TopBar.ts`

- **Background**: steel gray panel with corner brackets (same motif).
- **Title**: "HEXWAR" in amber (`accentAmber`).
- **Faction labels**: keep blue/red tints for friendly/enemy.
- Draw amber header stripe at top.

---

## Task 5: War-room Styled BuildPanel

### File: `src/app/ui/BuildPanel.ts`

- **Font**: switch to `"Consolas", "Courier New", monospace`.
- **Background**: steel gray panel with corner brackets.
- **Section header**: amber stripe at top.
- **Selection marker**: `▸` instead of `>` for affordable options, `×` instead of `x` for unaffordable.

---

## File Summary

| File | Status | Purpose |
|------|--------|---------|
| `src/game/config/GameConfig.ts` | EDIT | Update `UI_COLORS` palette for war-room theme |
| `src/app/ui/HexTooltip.ts` | EDIT | Add `init(BuildManager)`, building HP display, war-room styling |
| `src/app/ui/TopBar.ts` | EDIT | War-room panel styling |
| `src/app/ui/BuildPanel.ts` | EDIT | War-room panel styling, monospace font |
| `src/app/screens/game/GameScreen.ts` | EDIT | Call `tooltip.init(buildManager)` |

### Helper: Corner Bracket Drawing
Create a reusable function (local to each UI file or extracted to a shared util):
```typescript
function drawCornerBrackets(g: Graphics, w: number, h: number, len: number, color: number): void {
  const corners = [
    [0, 0, len, 0, 0, len],           // top-left
    [w, 0, w - len, 0, w, len],       // top-right
    [0, h, len, h, 0, h - len],       // bottom-left
    [w, h, w - len, h, w, h - len],   // bottom-right
  ];
  g.stroke({ width: 2, color });
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    g.moveTo(x1, y1).lineTo(x2, y2).moveTo(x1, y1).lineTo(x3, y3);
  }
}
```

---

## Validation Checklist

- [ ] `tsc --noEmit` clean
- [ ] `vite build` succeeds
- [ ] `npm run dev` →
  - Hover/select a hex with a building → tooltip shows `HP: current/max`
  - All three panels (tooltip, top bar, build panel) have steel gray backgrounds
  - Amber corner brackets visible on all panels
  - Amber header stripe on all panels
  - Monospace font on tooltip and build panel
  - Section dividers visible in tooltip when multiple sections present
  - Building destruction still syncs visually (from previous fix)

## Risks

- Monospace fonts may be wider than Arial; tooltip width may need adjustment (`wordWrapWidth`).
- Corner bracket length should scale with panel size (use a fraction, not fixed px).
- BitmapText in TopBar uses a pre-installed font; changing its fontFamily requires updating the `BitmapFont.install()` call.
