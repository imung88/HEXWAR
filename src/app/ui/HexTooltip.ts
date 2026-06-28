/**
 * HexTooltip - fixed bottom panel showing hex tile info.
 *
 * No longer follows the mouse. Shows after a 500ms hover delay.
 * Persists while a hex is selected (shows selected hex info even when not hovering).
 * River info shown only when tile has river.
 * Building info included from M3 tile state.
 */

import { Container, Graphics, Text } from "pixi.js";

import {
  BUILDING_CONFIGS,
  NODE_COLORS,
  OWNER_COLORS,
  UNIT_CONFIGS,
  UI_COLORS,
} from "../../game/config/GameConfig";
import type { NodeType, Owner, UnitType } from "../../game/config/GameConfig";
import type { Tile } from "../../game/hex/HexGrid";
import type { Unit } from "../../game/unit/Unit";

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

const HOVER_DELAY_MS = 500;

export class HexTooltip extends Container {
  private readonly bg: Graphics;
  private readonly text: Text;
  private viewportWidth = 0;
  private viewportHeight = 0;

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTile: Tile | null = null;
  private pendingUnits: Unit[] | null = null;
  private selectedTile: Tile | null = null;
  private selectedUnits: Unit[] | null = null;
  private currentTile: Tile | null = null;

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
        lineHeight: 17,
        align: "left",
        wordWrap: true,
        wordWrapWidth: 400,
      },
    });
    this.addChild(this.text);
  }

  public setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.reposition();
  }

  /** Start hover delay timer for a tile. */
  public startHover(tile: Tile, units?: Unit[]): void {
    this.pendingTile = tile;
    this.pendingUnits = units ?? null;
    this.cancelTimer();
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      if (this.pendingTile === tile) {
        this.showTile(tile, this.pendingUnits ?? undefined);
      }
    }, HOVER_DELAY_MS);
  }

  /** Cancel hover timer and hide if showing hovered (not selected) tile. */
  public endHover(): void {
    this.cancelTimer();
    this.pendingTile = null;
    // If showing a hover tile (not selected), hide.
    if (this.currentTile && !this.selectedTile) {
      this.visible = false;
      this.currentTile = null;
    }
  }

  /** Persist tooltip for selected hex. */
  public selectTile(tile: Tile | null, units?: Unit[]): void {
    this.selectedTile = tile;
    this.selectedUnits = units ?? null;
    if (tile) {
      this.cancelTimer();
      this.showTile(tile, this.selectedUnits ?? undefined);
    } else if (!this.pendingTile) {
      this.visible = false;
      this.currentTile = null;
    }
  }

  public hide(): void {
    this.cancelTimer();
    this.visible = false;
    this.currentTile = null;
    this.pendingTile = null;
  }

  private showTile(tile: Tile, units?: Unit[]): void {
    this.currentTile = tile;
    const lines: string[] = [`Owner: ${OWNER_LABELS[tile.owner]}`];

    if (tile.isVictory) {
      lines.push("Victory Point Hex");
    }
    if (tile.node) {
      lines.push(`Resource: ${NODE_LABELS[tile.node]}`);
    }
    if (tile.river) {
      lines.push("River: +defense bonus");
    }
    if (tile.commandCenter) {
      lines.push("Building: Command Center");
    }
    if (tile.building && tile.building.type !== "commandCenter") {
      const config = BUILDING_CONFIGS[tile.building.type];
      lines.push(`Building: ${config.label}`);
    }
    if (tile.underConstruction) {
      lines.push("Status: Under Construction");
    }

    if (units && units.length > 0) {
      const grouped = new Map<UnitType, Unit[]>();
      for (const u of units) {
        const list = grouped.get(u.type) ?? [];
        list.push(u);
        grouped.set(u.type, list);
      }
      const unitLines: string[] = [];
      for (const [type, list] of grouped) {
        const avgHp = Math.round(list.reduce((s, u) => s + u.hp, 0) / list.length);
        const maxHp = list[0].maxHp;
        const label = UNIT_CONFIGS[type].label;
        unitLines.push(`${list.length} ${label} (HP ${avgHp}/${maxHp})`);
      }
      lines.push(`Units: ${unitLines.join(", ")}`);
    }

    this.text.text = lines.join("\n");

    const pad = 10;
    const tWidth = Math.max(200, Math.ceil(this.text.width) + pad * 2);
    const tHeight = Math.ceil(this.text.height) + pad * 2;

    this.bg.clear();
    this.bg
      .roundRect(0, 0, tWidth, tHeight, 6)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.92 })
      .stroke({ width: 1, color: UI_COLORS.panelBorder });

    this.text.position.set(pad, pad);
    this.visible = true;
    this.reposition();
  }

  private reposition(): void {
    if (this.viewportWidth <= 0) return;
    // Bottom-center of screen.
    const w = this.width || 200;
    const h = this.height || 60;
    const x = Math.round((this.viewportWidth - w) / 2);
    const y = Math.round(this.viewportHeight - h - 8);
    this.position.set(x, y);
  }

  private cancelTimer(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  /** Expose colors for the legend. */
  public static get colorMap() {
    return { OWNER_COLORS, NODE_COLORS };
  }
}
