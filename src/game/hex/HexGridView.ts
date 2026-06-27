/**
 * HexGridView - Renders a HexGrid using PixiJS Graphics (RPD Renderer slice).
 *
 * One Graphics object per tile, tinted by owner. River tiles get an inner
 * overlay; victory hexes get a distinct border; resource nodes get a marker
 * glyph. Tiles are interactive and emit "hexTap" { q, r }.
 */

import { Container, Graphics } from "pixi.js";

import {
  HEX_SIZE,
  NODE_COLORS,
  OWNER_COLORS,
  RIVER_COLOR,
  UI_COLORS,
  VICTORY_BORDER_COLOR,
} from "../config/GameConfig";
import type { Owner } from "../config/GameConfig";
import type { HexGrid, Tile } from "./HexGrid";
import { gridPixelBounds, hexPolygonPoints, hexToPixel } from "./hexMath";
import type { Bounds } from "./hexMath";

export interface HexHoverPayload {
  q: number;
  r: number;
  globalX: number;
  globalY: number;
}

export type HexTapPayload = { q: number; r: number };

export class HexGridView extends Container {
  private readonly grid: HexGrid;
  private readonly size: number;
  private readonly tileGraphics = new Map<string, Graphics>();
  private readonly hoverRing: Graphics;
  private readonly selectionRing: Graphics;

  constructor(grid: HexGrid, size: number = HEX_SIZE) {
    super();
    this.grid = grid;
    this.size = size;

    this.eventMode = "static";
    this.cullable = true;
    this.build();

    // Overlay rings added last so they render above the tiles.
    this.hoverRing = this.createRing(UI_COLORS.hoverRing, 2.5);
    this.selectionRing = this.createRing(UI_COLORS.selectionRing, 4);
    this.hoverRing.visible = false;
    this.selectionRing.visible = false;
    this.addChild(this.hoverRing, this.selectionRing);
  }

  private createRing(color: number, width: number): Graphics {
    const g = new Graphics();
    g.poly(hexPolygonPoints(this.size)).stroke({ width, color, alignment: 0 });
    return g;
  }

  private build(): void {
    const points = hexPolygonPoints(this.size);

    this.grid.forEach((tile) => {
      const { x, y } = hexToPixel(tile.q, tile.r, this.size);

      const g = new Graphics();
      // Hex body tinted by owner.
      g.poly(points).fill({ color: OWNER_COLORS[tile.owner] });

      // River overlay: a smaller inner hex in the river tint.
      if (tile.river) {
        const inner = hexPolygonPoints(this.size * 0.7);
        g.poly(inner).fill({ color: RIVER_COLOR, alpha: 0.55 });
      }

      // Tile outline.
      g.poly(points).stroke({ width: 1.5, color: 0x222222, alpha: 0.6 });

      // Victory border.
      if (tile.isVictory) {
        g.poly(points).stroke({
          width: 4,
          color: VICTORY_BORDER_COLOR,
          alignment: 0,
        });
      }

      // Resource node marker.
      if (tile.node) {
        this.drawNodeMarker(g, tile);
      }

      g.position.set(x, y);
      g.eventMode = "static";
      g.on("pointertap", (e: { global: { x: number; y: number } }) => {
        this.emit("hexTap", {
          q: tile.q,
          r: tile.r,
        } satisfies HexTapPayload);
        void e;
      });
      g.on("pointerenter", (e: { global: { x: number; y: number } }) => {
        this.emit("hexHover", {
          q: tile.q,
          r: tile.r,
          globalX: e.global.x,
          globalY: e.global.y,
        } satisfies HexHoverPayload);
      });
      g.on("pointermove", (e: { global: { x: number; y: number } }) => {
        // Keep the tooltip following the pointer while over the same hex.
        this.emit("hexHover", {
          q: tile.q,
          r: tile.r,
          globalX: e.global.x,
          globalY: e.global.y,
        } satisfies HexHoverPayload);
      });
      g.on("pointerleave", () => {
        this.emit("hexHoverEnd", null);
      });

      this.addChild(g);
      this.tileGraphics.set(`${tile.q},${tile.r}`, g);
    });
  }

  private drawNodeMarker(g: Graphics, tile: Tile): void {
    const color = NODE_COLORS[tile.node!];
    const r = this.size * 0.28;
    switch (tile.node) {
      case "town":
        g.circle(0, 0, r).fill({ color });
        break;
      case "city":
        // Square to distinguish from town.
        g.rect(-r, -r, r * 2, r * 2).fill({ color });
        break;
      case "oilField":
        // Triangle.
        g.poly([0, -r, r, r, -r, r]).fill({ color });
        break;
    }
  }

  /** Re-tint a tile after an owner change (used by later gameplay modules). */
  public setTileOwner(q: number, r: number, owner: Owner): void {
    const g = this.tileGraphics.get(`${q},${r}`);
    if (!g) return;
    // Clear and rebuild the tile's geometry for the new owner.
    g.clear();
    const points = hexPolygonPoints(this.size);
    g.poly(points).fill({ color: OWNER_COLORS[owner] });
    const tile = this.grid.get(q, r);
    if (tile?.river) {
      const inner = hexPolygonPoints(this.size * 0.7);
      g.poly(inner).fill({ color: RIVER_COLOR, alpha: 0.55 });
    }
    g.poly(points).stroke({ width: 1.5, color: 0x222222, alpha: 0.6 });
    if (tile?.isVictory) {
      g.poly(points).stroke({
        width: 4,
        color: VICTORY_BORDER_COLOR,
        alignment: 0,
      });
    }
    if (tile?.node) this.drawNodeMarker(g, tile);
  }

  /** Move the hover ring to a hex (or hide it). */
  public setHoveredHex(q: number | null, r: number | null): void {
    if (q === null || r === null) {
      this.hoverRing.visible = false;
      return;
    }
    const { x, y } = hexToPixel(q, r, this.size);
    this.hoverRing.position.set(x, y);
    this.hoverRing.visible = true;
  }

  /** Move the selection ring to a hex (or hide it). */
  public setSelectedHex(q: number | null, r: number | null): void {
    if (q === null || r === null) {
      this.selectionRing.visible = false;
      return;
    }
    const { x, y } = hexToPixel(q, r, this.size);
    this.selectionRing.position.set(x, y);
    this.selectionRing.visible = true;
  }

  /** Pixel bounds of the rendered grid, for centering by the screen. */
  public getBoundsPixels(): Bounds {
    return gridPixelBounds(this.grid.width, this.grid.height, this.size);
  }
}
