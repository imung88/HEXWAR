import type { Ticker } from "pixi.js";
import { Container } from "pixi.js";

import {
  HEX_SIZE,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game/config/GameConfig";
import { HexGrid } from "../../../game/hex/HexGrid";
import { HexGridView } from "../../../game/hex/HexGridView";
import type {
  HexHoverPayload,
  HexTapPayload,
} from "../../../game/hex/HexGridView";
import { GameController } from "../../../game/GameController";
import { HexTooltip } from "../../ui/HexTooltip";
import { Legend } from "../../ui/Legend";
import { TopBar } from "../../ui/TopBar";

/**
 * Game screen hosting the hex battlefield.
 *
 * Owns the HexGrid (data) + HexGridView (render) plus the GameController
 * (fixed-step economy + selection) and the HUD (TopBar, Legend, HexTooltip).
 * The render ticker drives GameController.update(deltaMS); rendering stays at
 * 60 FPS while the economy steps at TICK_MS.
 */
export class GameScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles: string[] = [];

  private grid!: HexGrid;
  private view!: HexGridView;
  private controller!: GameController;
  private topBar!: TopBar;
  private legend!: Legend;
  private tooltip!: HexTooltip;
  private paused = false;

  /** Prepare the screen just before showing */
  public prepare() {
    this.grid = new HexGrid(MAP_WIDTH, MAP_HEIGHT);
    this.grid.initMatch();

    this.view = new HexGridView(this.grid, HEX_SIZE);
    this.addChild(this.view);

    this.controller = new GameController(this.grid);

    // HUD layers (added after the view so they render on top).
    this.topBar = new TopBar();
    this.legend = new Legend();
    this.tooltip = new HexTooltip();
    this.addChild(this.topBar, this.legend, this.tooltip);

    this.wireInteraction();
  }

  /** Forward view pointer events to the selection controller + HUD. */
  private wireInteraction(): void {
    const sel = this.controller.selection;

    this.view.on("hexTap", (payload: HexTapPayload) => {
      sel.select(payload);
    });

    this.view.on("hexHover", (payload: HexHoverPayload) => {
      sel.hover({ q: payload.q, r: payload.r });
      const tile = this.grid.get(payload.q, payload.r);
      if (tile) {
        this.tooltip.showFor(tile, payload.globalX, payload.globalY);
      }
    });

    this.view.on("hexHoverEnd", () => {
      sel.hover(null);
      this.tooltip.hide();
    });

    sel.onSelectionChange((hex) => {
      this.view.setSelectedHex(hex?.q ?? null, hex?.r ?? null);
    });
    sel.onHoverChange((hex) => {
      this.view.setHoveredHex(hex?.q ?? null, hex?.r ?? null);
    });
  }

  /** Update the screen */
  public update(_time: Ticker) {
    if (this.paused) return;

    // Step the fixed-tick simulation with elapsed milliseconds.
    this.controller.update(_time.deltaMS);

    // Refresh HUD values from economy state.
    this.topBar.update({
      friendly: this.controller.getFactionState("friendly"),
      enemy: this.controller.getFactionState("enemy"),
      tickMs: this.controller.getTickMs(),
    });
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause() {
    this.interactiveChildren = false;
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume() {
    this.interactiveChildren = true;
    this.paused = false;
  }

  /** Fully reset */
  public reset() {
    this.removeChildren();
    this.grid = undefined as unknown as HexGrid;
    this.view = undefined as unknown as HexGridView;
    this.controller = undefined as unknown as GameController;
    this.topBar = undefined as unknown as TopBar;
    this.legend = undefined as unknown as Legend;
    this.tooltip = undefined as unknown as HexTooltip;
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(width: number, height: number) {
    if (!this.view) return;

    const bounds = this.view.getBoundsPixels();
    const gridCenterX = (bounds.minX + bounds.maxX) * 0.5;
    const gridCenterY = (bounds.minY + bounds.maxY) * 0.5;

    // Center the grid's content within the viewport.
    this.view.position.set(
      width * 0.5 - gridCenterX,
      height * 0.5 - gridCenterY,
    );

    this.topBar.resize(width, height);
    this.legend.resize(width, height);
    this.tooltip.setViewport(width, height);
  }

  /** Show screen with animations */
  public async show(): Promise<void> {}

  /** Hide screen with animations */
  public async hide(): Promise<void> {}

  /** Auto pause the app when window go out of focus */
  public blur() {}
}
