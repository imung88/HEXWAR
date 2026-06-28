/**
 * BuildRenderer - draws building glyphs and under-construction hatching on tiles.
 *
 * Receives PixiJS Graphics objects from HexGridView and draws on them.
 * State-only: does not own display objects, just mutates existing Graphics.
 */

import { Graphics } from "pixi.js";

import { BUILDING_COLORS, BUILDING_ICON_SIZES } from "../config/GameConfig";
import type { BuildingRef } from "../hex/HexGrid";
import type { Tile } from "../hex/HexGrid";
import { hexPolygonPoints } from "../hex/hexMath";

export class BuildRenderer {
  /**
   * Draw building state onto a tile's Graphics object.
   * Should be called after the base tile fill (owner + river + node) is drawn.
   */
  public drawBuilding(g: Graphics, tile: Tile, size: number): void {
    if (tile.underConstruction) {
      this.drawConstructionHatch(g, size);
    }
    if (tile.commandCenter) {
      this.drawCCGlyph(g, size, tile.owner);
    }
    if (tile.building && tile.building.type !== "commandCenter") {
      this.drawBuildingGlyph(g, tile.building, size);
    }
  }

  /** Clear building overlays from a tile Graphics (call before redraw). */
  public clearBuilding(_g: Graphics): void {
    // Building overlays are part of the full tile redraw; no separate clear needed
    // because HexGridView.setTileOwner() already calls g.clear().
  }

  /** Draw a command center glyph: gold diamond with white outline. */
  private drawCCGlyph(g: Graphics, size: number, _owner: string): void {
    const s = size * BUILDING_ICON_SIZES.ccGlyphRadius;
    const color = BUILDING_COLORS.commandCenter;
    g.poly([0, -s, s, 0, 0, s, -s, 0]).fill({ color });
    g.poly([0, -s, s, 0, 0, s, -s, 0]).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
  }

  /** Draw a spawn building glyph: colored circle with white outline. */
  private drawBuildingGlyph(g: Graphics, ref: BuildingRef, size: number): void {
    const r = size * BUILDING_ICON_SIZES.spawnBuildingGlyphRadius;
    const color = BUILDING_COLORS[ref.type] ?? 0x888888;
    g.circle(0, -size * 0.35, r).fill({ color });
    g.circle(0, -size * 0.35, r).stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
  }

  /** Draw diagonal hatching for under-construction state. */
  private drawConstructionHatch(g: Graphics, size: number): void {
    const color = BUILDING_COLORS.underConstruction;
    const inner = hexPolygonPoints(size * 0.6);
    // Clip hint: draw hatching lines inside the hex.
    for (let i = -2; i <= 2; i++) {
      const offset = i * size * 0.2;
      g.moveTo(-size * 0.5 + offset, -size * 0.5);
      g.lineTo(size * 0.5 + offset, size * 0.5);
    }
    g.stroke({ width: 1.5, color, alpha: 0.6 });
    void inner;
  }
}
