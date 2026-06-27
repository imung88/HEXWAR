/**
 * HexTooltip - lightweight hover info for a hex tile (RPD "Hex tooltip").
 *
 * Shows owner, resource node, defense bonus (river), and victory flag.
 * Content only refreshes when the hovered hex changes (debounced at the
 * SelectionController level), so a plain `Text` (canvas) is acceptable here —
 * it does not update every frame.
 *
 * The tooltip follows the pointer; GameScreen passes global pointer coords and
 * this container converts them to its local space and clamps inside the viewport.
 */

import { Container, Graphics, Text } from "pixi.js";

import {
  NODE_COLORS,
  OWNER_COLORS,
  UI_COLORS,
} from "../../game/config/GameConfig";
import type { NodeType, Owner } from "../../game/config/GameConfig";
import type { Tile } from "../../game/hex/HexGrid";

const NODE_LABELS: Record<NodeType, string> = {
  town: "Town (gold)",
  city: "City (gold)",
  oilField: "Oil Field (oil)",
};

const OWNER_LABELS: Record<Owner, string> = {
  friendly: "Friendly",
  neutral: "Neutral",
  enemy: "Enemy",
};

export class HexTooltip extends Container {
  private readonly bg: Graphics;
  private readonly text: Text;
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor() {
    super();
    this.visible = false;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.text = new Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 13,
        fill: UI_COLORS.textPrimary,
        lineHeight: 16,
        align: "left",
      },
    });
    this.addChild(this.text);
  }

  public setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Render the tooltip for a tile near the given global pointer position. */
  public showFor(tile: Tile, globalX: number, globalY: number): void {
    const lines: string[] = [`Owner: ${OWNER_LABELS[tile.owner]}`];

    if (tile.isVictory) {
      lines.push("Victory Point Hex");
    }
    if (tile.node) {
      lines.push(`Resource: ${NODE_LABELS[tile.node]}`);
    } else if (!tile.isVictory) {
      lines.push("Resource: none");
    }
    lines.push(tile.river ? "River: +defense bonus" : "River: none");

    this.text.text = lines.join("\n");

    const pad = 8;
    const tWidth = Math.ceil(this.text.width) + pad * 2;
    const tHeight = Math.ceil(this.text.height) + pad * 2;

    // Re-draw background to fit text.
    this.bg.clear();
    this.bg
      .roundRect(0, 0, tWidth, tHeight, 6)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.92 })
      .stroke({ width: 1, color: UI_COLORS.panelBorder });

    this.text.position.set(pad, pad);

    // Convert global pointer to this container's local space, then clamp.
    const local = this.toLocal({ x: globalX, y: globalY });
    let x = local.x + 14;
    let y = local.y + 14;

    if (this.viewportWidth > 0) {
      if (x + tWidth > this.viewportWidth) {
        x = local.x - tWidth - 14;
      }
      if (y + tHeight > this.viewportHeight) {
        y = this.viewportHeight - tHeight - 4;
      }
      if (y < 0) y = 4;
      if (x < 0) x = 4;
    }

    this.position.set(Math.round(x), Math.round(y));
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }

  /** Expose colors for the legend (kept together with tooltip semantics). */
  public static get colorMap() {
    return { OWNER_COLORS, NODE_COLORS };
  }
}
