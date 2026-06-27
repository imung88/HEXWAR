import type { Ticker } from "pixi.js";
import { Container } from "pixi.js";

import {
  HEX_SIZE,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game/config/GameConfig";
import { HexGrid } from "../../../game/hex/HexGrid";
import { HexGridView } from "../../../game/hex/HexGridView";
import type { HexTapPayload } from "../../../game/hex/HexGridView";

/**
 * Game screen hosting the hex battlefield.
 *
 * Owns the HexGrid (data) and HexGridView (render). prepare() builds them,
 * resize() centers the map, and hex taps are logged for now (hook for
 * BuildManager later).
 */
export class GameScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles: string[] = [];

  private grid!: HexGrid;
  private view!: HexGridView;
  private paused = false;

  /** Prepare the screen just before showing */
  public prepare() {
    this.grid = new HexGrid(MAP_WIDTH, MAP_HEIGHT);
    this.grid.initMatch();

    this.view = new HexGridView(this.grid, HEX_SIZE);
    this.view.on("hexTap", (payload: HexTapPayload) => {
      // Hook for BuildManager later; for now, log the tapped hex.
      console.log("hexTap", payload);
    });
    this.addChild(this.view);
  }

  /** Update the screen */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(_time: Ticker) {
    if (this.paused) return;
    // Placeholder for GameController tick loop (economy, maintenance, spawning).
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
  }

  /** Show screen with animations */
  public async show(): Promise<void> {}

  /** Hide screen with animations */
  public async hide(): Promise<void> {}

  /** Auto pause the app when window go out of focus */
  public blur() {}
}
