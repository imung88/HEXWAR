/**
 * BuildPanel - hex-first context panel for building placement.
 *
 * Shows valid buildables for the selected hex; click to build.
 * Toggle spawn speed Off/Low/High when a spawn building is selected.
 * Display-only: reads state from BuildManager, calls place()/setSpawnSpeed().
 */

import { Container, Graphics, Text } from "pixi.js";

import {
  BUILDING_CONFIGS,
  UI_COLORS,
} from "../../game/config/GameConfig";
import type { BuildingType, SpawnSpeed } from "../../game/config/GameConfig";
import type { Faction } from "../../game/economy/EconomySystem";
import type { EconomySystem } from "../../game/economy/EconomySystem";
import type { BuildManager } from "../../game/build/BuildManager";
import type { HexGrid } from "../../game/hex/HexGrid";

const SPEED_OPTIONS: SpawnSpeed[] = ["off", "low", "high"];

export class BuildPanel extends Container {
  private readonly bg: Graphics;
  private readonly content: Text;
  private buildManager: BuildManager | null = null;
  private economy: EconomySystem | null = null;
  private grid: HexGrid | null = null;
  private currentFaction: Faction = "friendly";
  private currentQ = -1;
  private currentR = -1;
  private panelWidth = 340;
  private panelHeight = 120;
  private onBuildCallback: ((q: number, r: number) => void) | null = null;

  constructor() {
    super();
    this.visible = false;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.content = new Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 13,
        fill: UI_COLORS.textPrimary,
        lineHeight: 18,
        align: "left",
        wordWrap: true,
        wordWrapWidth: this.panelWidth - 24,
      },
    });
    this.addChild(this.content);
  }

  public init(
    buildManager: BuildManager,
    economy: EconomySystem,
    grid: HexGrid,
  ): void {
    this.buildManager = buildManager;
    this.economy = economy;
    this.grid = grid;
  }

  public setOnBuild(cb: (q: number, r: number) => void): void {
    this.onBuildCallback = cb;
  }

  /** Show the panel for a selected hex. */
  public showForHex(q: number, r: number, faction: Faction): void {
    if (!this.buildManager || !this.economy || !this.grid) return;

    this.currentQ = q;
    this.currentR = r;
    this.currentFaction = faction;

    const tile = this.grid.get(q, r);
    if (!tile) {
      this.hide();
      return;
    }

    // Read-only for non-owned tiles.
    if (tile.owner !== faction) {
      this.showReadOnly(tile.owner);
      return;
    }

    const building = this.buildManager.getBuildingAt(q, r);

    // Victory hex with CC: read-only.
    if (tile.isVictory && tile.commandCenter) {
      this.showReadOnly(tile.owner);
      return;
    }

    // No CC, no building → show Command Center option.
    if (!tile.commandCenter && !building) {
      const config = BUILDING_CONFIGS.commandCenter;
      const affordable = this.economy.canAfford(faction, config.cost);
      const cd = this.buildManager.getCoolDownRemaining(faction);
      const onCd = cd !== null && cd > 0;

      let status = "";
      if (onCd) status = `  [CC cooldown ${Math.ceil(cd / 1000)}s]`;

      this.showOptions(
        `Command Center\n  Cost: ${config.cost.gold}G ${config.cost.oil}O\n  Build: ${config.buildTimeMs / 1000}s${status}`,
        affordable && !onCd ? "commandCenter" : null,
      );
      return;
    }

    // CC under construction.
    if (tile.underConstruction) {
      const ccBuilding = this.buildManager.getBuildingAt(q, r);
      const remaining = ccBuilding?.buildTimerMs ?? 0;
      this.showText(`Command center building... (${Math.ceil(remaining / 1000)}s)`);
      return;
    }

    // Ready CC, no building → show spawn building options.
    if (tile.commandCenter && !building) {
      const types: BuildingType[] = ["infantryBarracks", "tankDivision", "artilleryDivision"];
      const lines: string[] = [];
      let anyAffordable = false;

      for (const type of types) {
        const config = BUILDING_CONFIGS[type];
        const affordable = this.economy.canAfford(faction, config.cost);
        if (affordable) anyAffordable = true;
        const marker = affordable ? ">" : "x";
        lines.push(`${marker} ${config.label}  (${config.cost.gold}G ${config.cost.oil}O)`);
      }

      this.showOptions(lines.join("\n"), anyAffordable ? "spawn" : null);
      return;
    }

    // Has spawn building → show type + speed toggle.
    if (building && building.type !== "commandCenter") {
      const config = BUILDING_CONFIGS[building.type];
      const lines: string[] = [
        config.label,
        `HP: ${building.hp}/${building.maxHp}`,
      ];

      for (const speed of SPEED_OPTIONS) {
        const marker = building.spawnSpeed === speed ? "*" : " ";
        const maint = this.getSpeedMaint(building.type, speed);
        lines.push(`${marker} ${speed.toUpperCase()}  maint: ${maint.gold}G ${maint.oil}O`);
      }

      this.showSpeedOptions(lines.join("\n"), building.id);
      return;
    }

    this.showText("No actions available.");
  }

  public hide(): void {
    this.visible = false;
  }

  private showText(text: string): void {
    this.content.text = text;
    this.content.position.set(12, 12);
    this.panelHeight = Math.max(80, Math.ceil(this.content.height) + 24);
    this.drawBg();
    this.visible = true;
  }

  private showOptions(text: string, action: BuildingType | "spawn" | null): void {
    this.content.text = text;
    this.content.position.set(12, 12);

    // Make interactive if there's an action.
    this.content.eventMode = "static";
    this.content.cursor = action ? "pointer" : "default";
    this.content.removeAllListeners("pointertap");

    if (action === "commandCenter" || action === "spawn") {
      this.content.on("pointertap", () => {
        this.handleBuildClick(action);
      });
    }

    this.panelHeight = Math.max(80, Math.ceil(this.content.height) + 24);
    this.drawBg();
    this.visible = true;
  }

  private showSpeedOptions(text: string, buildingId: string): void {
    this.content.text = text;
    this.content.position.set(12, 12);

    this.content.eventMode = "static";
    this.content.cursor = "pointer";
    this.content.removeAllListeners("pointertap");
    this.content.on("pointertap", () => {
      this.handleSpeedCycle(buildingId);
    });

    this.panelHeight = Math.max(80, Math.ceil(this.content.height) + 24);
    this.drawBg();
    this.visible = true;
  }

  private showReadOnly(_owner: string): void {
    this.showText("Read-only (no actions)");
  }

  private handleBuildClick(action: BuildingType | "spawn"): void {
    if (!this.buildManager) return;

    if (action === "commandCenter") {
      const ok = this.buildManager.place(this.currentFaction, this.currentQ, this.currentR, "commandCenter");
      if (ok) this.onBuildCallback?.(this.currentQ, this.currentR);
    } else if (action === "spawn") {
      // Build the first affordable type.
      const types: BuildingType[] = ["infantryBarracks", "tankDivision", "artilleryDivision"];
      for (const type of types) {
        const ok = this.buildManager.place(this.currentFaction, this.currentQ, this.currentR, type);
        if (ok) {
          this.onBuildCallback?.(this.currentQ, this.currentR);
          break;
        }
      }
    }

    // Re-render panel.
    this.showForHex(this.currentQ, this.currentR, this.currentFaction);
  }

  private handleSpeedCycle(buildingId: string): void {
    if (!this.buildManager) return;
    const building = this.buildManager.getBuildingById(buildingId);
    if (!building) return;

    const idx = SPEED_OPTIONS.indexOf(building.spawnSpeed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    this.buildManager.setSpawnSpeed(buildingId, next);

    this.onBuildCallback?.(this.currentQ, this.currentR);
    this.showForHex(this.currentQ, this.currentR, this.currentFaction);
  }

  private getSpeedMaint(type: BuildingType, speed: SpawnSpeed) {
    const config = BUILDING_CONFIGS[type];
    if (speed === "off") return { gold: 0, oil: 0 };
    if (speed === "high") return { gold: config.maintenanceHigh.gold, oil: config.maintenanceHigh.oil };
    return { gold: config.maintenanceLow.gold, oil: config.maintenanceLow.oil };
  }

  private drawBg(): void {
    this.bg.clear();
    this.bg
      .roundRect(0, 0, this.panelWidth, this.panelHeight, 6)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.92 })
      .stroke({ width: 1, color: UI_COLORS.panelBorder });
  }

  public resize(width: number, height: number): void {
    // Anchor to bottom-right of viewport.
    this.position.set(
      Math.round(width - this.panelWidth - 12),
      Math.round(height - this.panelHeight - 12),
    );
  }
}
