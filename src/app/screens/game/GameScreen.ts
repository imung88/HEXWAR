import type { Ticker } from "pixi.js";
import { Container } from "pixi.js";

import {
  HEX_SIZE,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game/config/GameConfig";
import { randomHash } from "../../../engine/utils/random";
import { HexGrid } from "../../../game/hex/HexGrid";
import { HexGridView } from "../../../game/hex/HexGridView";
import type {
  HexHoverPayload,
  HexTapPayload,
} from "../../../game/hex/HexGridView";
import { GameController } from "../../../game/GameController";
import { UnitRenderer } from "../../../game/unit/UnitRenderer";
import { BuildPanel } from "../../ui/BuildPanel";
import { HexTooltip } from "../../ui/HexTooltip";
import { Legend } from "../../ui/Legend";
import { TopBar } from "../../ui/TopBar";

/**
 * Game screen hosting the hex battlefield.
 *
 * Owns the HexGrid (data) + HexGridView (render) plus the GameController
 * (fixed-step economy + selection) and the HUD (TopBar, Legend, HexTooltip,
 * BuildPanel).
 */
export class GameScreen extends Container {
  public static assetBundles: string[] = [];

  private grid!: HexGrid;
  private view!: HexGridView;
  private controller!: GameController;
  private topBar!: TopBar;
  private legend!: Legend;
  private tooltip!: HexTooltip;
  private buildPanel!: BuildPanel;
  private unitRenderer!: UnitRenderer;
  private paused = false;
  private matchSeed = "";

  public prepare() {
    this.grid = new HexGrid(MAP_WIDTH, MAP_HEIGHT);
    const seed = randomHash(8);
    this.matchSeed = seed;
    this.grid.initMatch(seed);

    this.view = new HexGridView(this.grid, HEX_SIZE);
    this.addChild(this.view);

    this.controller = new GameController(this.grid);

    // Place starting buildings after controller (with BuildManager) exists.
    this.controller.placeStartBuildings(this.matchSeed);

    // Refresh tile graphics so building icons appear immediately.
    this.view.refreshAll();

    // Initialize spawn timers with seeded stagger.
    this.controller.spawnManager.initTimers(this.matchSeed);

    // Unit renderer on top of buildings.
    this.unitRenderer = new UnitRenderer(
      this.view.getUnitLayer(),
      this.grid,
      this.controller.unitManager,
      HEX_SIZE,
    );

    // HUD layers.
    this.topBar = new TopBar();
    this.legend = new Legend();
    this.tooltip = new HexTooltip();
    this.buildPanel = new BuildPanel();
    this.buildPanel.init(this.controller.buildManager, this.controller.economy, this.grid);
    this.tooltip.init(this.controller.buildManager);
    this.buildPanel.setOnBuild((_q, _r) => {
      this.refreshSelectedTile();
    });

    this.addChild(this.topBar, this.legend, this.tooltip, this.buildPanel);

    this.wireInteraction();
  }

  private wireInteraction(): void {
    const sel = this.controller.selection;

    this.view.on("hexTap", (payload: HexTapPayload) => {
      sel.select(payload);
      this.buildPanel.showForHex(payload.q, payload.r, "friendly");
    });

    this.view.on("hexHover", (payload: HexHoverPayload) => {
      sel.hover({ q: payload.q, r: payload.r });
      const tile = this.grid.get(payload.q, payload.r);
      if (tile) {
        const units = this.controller.unitManager.getUnitsAt(payload.q, payload.r);
        this.tooltip.startHover(tile, units.length > 0 ? units : undefined);
      }
    });

    this.view.on("hexHoverEnd", () => {
      sel.hover(null);
      this.tooltip.endHover();
    });

    sel.onSelectionChange((hex) => {
      this.view.setSelectedHex(hex?.q ?? null, hex?.r ?? null);
      if (hex) {
        const tile = this.grid.get(hex.q, hex.r);
        const units = this.controller.unitManager.getUnitsAt(hex.q, hex.r);
        this.tooltip.selectTile(tile ?? null, units.length > 0 ? units : undefined);
        this.buildPanel.showForHex(hex.q, hex.r, "friendly");
      } else {
        this.tooltip.selectTile(null);
        this.buildPanel.hide();
      }
    });
    sel.onHoverChange((hex) => {
      this.view.setHoveredHex(hex?.q ?? null, hex?.r ?? null);
    });
  }

  private refreshSelectedTile(): void {
    const sel = this.controller.selection.getSelected();
    if (sel) {
      this.view.setTileOwner(sel.q, sel.r, this.grid.get(sel.q, sel.r)?.owner ?? "neutral");
    }
  }

  public update(_time: Ticker) {
    if (this.paused) return;

    this.controller.update(_time.deltaMS);
    this.unitRenderer.updateAll();

    // Sync building destruction visuals
    for (const pos of this.controller.buildManager.getAndClearDestroyedPositions()) {
      this.view.updateTileBuilding(pos.q, pos.r);
    }

    this.topBar.update({
      friendly: this.controller.getFactionState("friendly"),
      enemy: this.controller.getFactionState("enemy"),
      tickMs: this.controller.getTickMs(),
    });
  }

  public async pause() {
    this.interactiveChildren = false;
    this.paused = true;
  }

  public async resume() {
    this.interactiveChildren = true;
    this.paused = false;
  }

  public reset() {
    this.removeChildren();
    this.grid = undefined as unknown as HexGrid;
    this.view = undefined as unknown as HexGridView;
    this.controller = undefined as unknown as GameController;
    this.topBar = undefined as unknown as TopBar;
    this.legend = undefined as unknown as Legend;
    this.tooltip = undefined as unknown as HexTooltip;
    this.buildPanel = undefined as unknown as BuildPanel;
  }

  public resize(width: number, height: number) {
    if (!this.view) return;

    const bounds = this.view.getBoundsPixels();
    const gridCenterX = (bounds.minX + bounds.maxX) * 0.5;
    const gridCenterY = (bounds.minY + bounds.maxY) * 0.5;

    this.view.position.set(
      width * 0.5 - gridCenterX,
      height * 0.5 - gridCenterY,
    );

    this.topBar.resize(width, height);
    this.legend.resize(width, height);
    this.tooltip.setViewport(width, height);
    this.buildPanel.resize(width, height);
  }

  public async show(): Promise<void> {}
  public async hide(): Promise<void> {}
  public blur() {}
}
