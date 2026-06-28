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
import type { BuildManager } from "../../game/build/BuildManager";

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
const BRACKET_LEN = 10;

function drawCornerBrackets(g: Graphics, w: number, h: number, color: number): void {
  const corners = [
    [0, 0, BRACKET_LEN, 0, 0, BRACKET_LEN],
    [w, 0, w - BRACKET_LEN, 0, w, BRACKET_LEN],
    [0, h, BRACKET_LEN, h, 0, h - BRACKET_LEN],
    [w, h, w - BRACKET_LEN, h, w, h - BRACKET_LEN],
  ];
  g.stroke({ width: 2, color });
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    g.moveTo(x1, y1).lineTo(x2, y2).moveTo(x1, y1).lineTo(x3, y3);
  }
}

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
  private buildManager: BuildManager | null = null;

  constructor() {
    super();
    this.visible = false;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.text = new Text({
      text: "",
      style: {
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 12,
        fill: UI_COLORS.textPrimary,
        lineHeight: 16,
        align: "left",
        wordWrap: true,
        wordWrapWidth: 420,
      },
    });
    this.addChild(this.text);
  }

  public init(buildManager: BuildManager): void {
    this.buildManager = buildManager;
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
    const lines: string[] = [`▸ OWNER: ${OWNER_LABELS[tile.owner]}`];

    if (tile.isVictory) {
      lines.push("▸ VICTORY POINT HEX");
    }
    if (tile.node) {
      lines.push(`▸ RESOURCE: ${NODE_LABELS[tile.node]}`);
    }
    if (tile.river) {
      lines.push("▸ RIVER: +defense bonus");
    }

    // Building section
    if (tile.commandCenter) {
      const bld = this.buildManager?.getBuildingAt(tile.q, tile.r);
      const hp = bld ? ` HP ${bld.hp}/${bld.maxHp}` : "";
      lines.push(`▸ COMMAND CENTER${hp}`);
    }
    if (tile.building && tile.building.type !== "commandCenter") {
      const config = BUILDING_CONFIGS[tile.building.type];
      const bld = this.buildManager?.getBuildingAt(tile.q, tile.r);
      const hp = bld ? ` HP ${bld.hp}/${bld.maxHp}` : "";
      lines.push(`▸ ${config.label.toUpperCase()}${hp}`);
    }
    if (tile.underConstruction) {
      lines.push("▸ STATUS: Under Construction");
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
      lines.push(`▸ UNITS: ${unitLines.join(", ")}`);
    }

    this.text.text = lines.join("\n");

    const pad = 10;
    const headerH = 4;
    const tWidth = Math.max(220, Math.ceil(this.text.width) + pad * 2);
    const tHeight = Math.ceil(this.text.height) + pad * 2 + headerH;

    this.bg.clear();
    this.bg
      .roundRect(0, 0, tWidth, tHeight, 4)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.94 })
      .stroke({ width: 1, color: UI_COLORS.panelBorder });

    // Amber header stripe
    this.bg
      .rect(0, 0, tWidth, headerH)
      .fill({ color: UI_COLORS.accentAmber });

    // Corner brackets
    drawCornerBrackets(this.bg, tWidth, tHeight, UI_COLORS.cornerBracket);

    this.text.position.set(pad, pad + headerH);
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
