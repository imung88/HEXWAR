/**
 * GameController - owns the fixed-step simulation loop + core systems (RPD).
 *
 * Stepped from GameScreen via the PixiJS render ticker: GameScreen passes
 * `ticker.deltaMS` to `update()`. The controller accumulates elapsed time and
 * only steps the economy when the accumulator crosses TICK_MS, keeping the
 * simulation deterministic and decoupled from frame rate (render stays 60 FPS).
 *
 * Holds HexGrid (data), EconomySystem, SelectionController, and the
 * MaintenanceRegistry. Does NOT own display objects; the view layer reads state
 * from here.
 */

import { TICK_MS } from "./config/GameConfig";
import { EconomySystem } from "./economy/EconomySystem";
import type { Faction } from "./economy/EconomySystem";
import { MaintenanceRegistry } from "./economy/MaintenanceRegistry";
import type { HexGrid } from "./hex/HexGrid";
import { SelectionController } from "./SelectionController";

export class GameController {
  public readonly hexGrid: HexGrid;
  public readonly economy: EconomySystem;
  public readonly selection: SelectionController;
  public readonly maintenance: MaintenanceRegistry;

  private tickAccumulator = 0;
  private tickCount = 0;

  constructor(hexGrid: HexGrid) {
    this.hexGrid = hexGrid;
    this.maintenance = new MaintenanceRegistry();
    this.economy = new EconomySystem(hexGrid, this.maintenance);
    this.selection = new SelectionController();
  }

  /**
   * Advance the simulation by elapsed milliseconds. Driven by the render
   * ticker's deltaMS. Economy/Maintenance step at fixed TICK_MS intervals.
   */
  public update(deltaMS: number): void {
    this.tickAccumulator += deltaMS;

    let stepped = false;
    // Guard against spiral-of-death after a long tab-away with a sane cap.
    const maxStepsPerFrame = 5;
    let steps = 0;
    while (this.tickAccumulator >= TICK_MS && steps < maxStepsPerFrame) {
      this.economy.update();
      this.tickCount++;
      this.tickAccumulator -= TICK_MS;
      steps++;
      stepped = true;
    }

    // Pointer/selection state updates every frame (cheap).
    this.selection.update();

    if (stepped) {
      this.checkWinLose();
    }
  }

  /** Public read of the total simulated ticks elapsed (for income/min calc). */
  public getTickCount(): number {
    return this.tickCount;
  }

  /** Per-tick interval in ms (exposes config to view for income/min math). */
  public getTickMs(): number {
    return TICK_MS;
  }

  public getFactionState(faction: Faction) {
    return this.economy.getState(faction);
  }

  /**
   * Win/lose check hook (skeleton). Real resolution arrives once units/victory
   * command centers exist; for now we only log when a faction can no longer
   * produce. Called once per economy tick.
   */
  private checkWinLose(): void {
    // TODO (M6): destroy enemy victory hex => win; player victory destroyed or
    // player can't produce and has no units => lose.
  }
}
