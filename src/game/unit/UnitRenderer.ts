/**
 * UnitRenderer - renders stacked unit icons on the hex grid.
 *
 * Owns a Container added to HexGridView's unitLayer. Draws per-hex Graphics
 * overlays showing stacked unit icons (circle=infantry, roundedRect=tank,
 * triangle=artillery) with offset stacking and count badge for overflow.
 */

import { Container, Graphics, Text } from "pixi.js";

import { HEX_SIZE, UNIT_CONFIGS } from "../config/GameConfig";
import type { UnitType } from "../config/GameConfig";
import type { HexGrid } from "../hex/HexGrid";
import { hexToPixel } from "../hex/hexMath";
import type { UnitManager } from "../unit/UnitManager";
import type { Unit } from "../unit/Unit";
import type { Faction } from "../economy/EconomySystem";
import { darkenColor } from "../../engine/utils/color";

const MAX_VISIBLE_PER_TYPE = 6;
const STACK_DX = 5;
const STACK_DY = -4;
const ICON_RADIUS = 4;

export class UnitRenderer {
  private readonly container: Container;
  private readonly grid: HexGrid;
  private readonly unitManager: UnitManager;
  private readonly size: number;
  private readonly hexContainers = new Map<string, Container>();

  constructor(
    container: Container,
    grid: HexGrid,
    unitManager: UnitManager,
    size: number = HEX_SIZE,
  ) {
    this.container = container;
    this.grid = grid;
    this.unitManager = unitManager;
    this.size = size;
  }

  /** Full redraw of all unit overlays. */
  public updateAll(): void {
    for (const c of this.hexContainers.values()) {
      c.destroy({ children: true });
    }
    this.hexContainers.clear();

    this.grid.forEach((tile) => {
      const units = this.unitManager.getUnitsAt(tile.q, tile.r);
      if (units.length > 0) {
        this.drawHexUnits(tile.q, tile.r, units);
      }
    });
  }

  /** Redraw units on a single hex. */
  public updateHex(q: number, r: number): void {
    const key = `${q},${r}`;
    const existing = this.hexContainers.get(key);
    if (existing) {
      existing.destroy({ children: true });
      this.hexContainers.delete(key);
    }

    const units = this.unitManager.getUnitsAt(q, r);
    if (units.length > 0) {
      this.drawHexUnits(q, r, units);
    }
  }

  private drawHexUnits(q: number, r: number, units: Unit[]): void {
    const { x, y } = hexToPixel(q, r, this.size);
    const hexContainer = new Container();
    hexContainer.position.set(x, y);

    const g = new Graphics();
    hexContainer.addChild(g);

    const groups = this.groupByType(units);
    let globalIdx = 0;

    for (const [type, typeUnits] of groups) {
      const visible = typeUnits.slice(0, MAX_VISIBLE_PER_TYPE);
      const overflow = typeUnits.length > MAX_VISIBLE_PER_TYPE;
      const owner = typeUnits[0].owner;

      for (let i = 0; i < visible.length; i++) {
        const dx = globalIdx * STACK_DX;
        const dy = globalIdx * STACK_DY;
        this.drawUnitIcon(g, type, owner, dx, dy);
        globalIdx++;
      }

      if (overflow) {
        const dx = globalIdx * STACK_DX;
        const dy = globalIdx * STACK_DY;
        const badge = new Text({
          text: `${typeUnits.length}`,
          style: { fontSize: 8, fill: 0xffffff, fontWeight: "bold" },
        });
        badge.anchor.set(0.5);
        badge.position.set(dx, dy);
        hexContainer.addChild(badge);
        globalIdx++;
      }
    }

    this.container.addChild(hexContainer);
    this.hexContainers.set(`${q},${r}`, hexContainer);
  }

  private groupByType(units: Unit[]): Map<UnitType, Unit[]> {
    const map = new Map<UnitType, Unit[]>();
    for (const u of units) {
      let list = map.get(u.type);
      if (!list) {
        list = [];
        map.set(u.type, list);
      }
      list.push(u);
    }
    return map;
  }

  private drawUnitIcon(g: Graphics, type: UnitType, owner: Faction, dx: number, dy: number): void {
    const baseColor = UNIT_CONFIGS[type].color;
    const color = owner === "friendly" ? baseColor : darkenColor(baseColor, 0.5);
    const r = ICON_RADIUS;

    switch (type) {
      case "infantry":
        g.circle(dx, dy, r).fill({ color });
        break;
      case "tank":
        g.roundRect(dx - r, dy - r, r * 2, r * 2, 2).fill({ color });
        break;
      case "artillery":
        g.poly([dx, dy - r, dx + r, dy + r, dx - r, dy + r]).fill({ color });
        break;
    }
  }
}
