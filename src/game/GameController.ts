/**
 * GameController - owns the fixed-step simulation loop + core systems.
 *
 * Stepped from GameScreen via the PixiJS render ticker: GameScreen passes
 * `ticker.deltaMS` to `update()`. The controller accumulates elapsed time and
 * steps the economy + build manager at fixed TICK_MS intervals.
 *
 * Holds HexGrid (data), EconomySystem, SelectionController, MaintenanceRegistry,
 * and BuildManager. Does NOT own display objects; the view layer reads state.
 */

import { TICK_MS } from "./config/GameConfig";
import { BuildManager } from "./build/BuildManager";
import { EconomySystem } from "./economy/EconomySystem";
import type { Faction } from "./economy/EconomySystem";
import { MaintenanceRegistry } from "./economy/MaintenanceRegistry";
import type { HexGrid } from "./hex/HexGrid";
import { SelectionController } from "./SelectionController";
import { SpawnManager } from "./spawn/SpawnManager";
import { MovementManager } from "./unit/MovementManager";
import { UnitManager } from "./unit/UnitManager";

export class GameController {
  public readonly hexGrid: HexGrid;
  public readonly economy: EconomySystem;
  public readonly selection: SelectionController;
  public readonly maintenance: MaintenanceRegistry;
  public readonly buildManager: BuildManager;
  public readonly unitManager: UnitManager;
  public readonly spawnManager: SpawnManager;
  public readonly movementManager: MovementManager;

  private tickAccumulator = 0;
  private tickCount = 0;

  constructor(hexGrid: HexGrid) {
    this.hexGrid = hexGrid;
    this.maintenance = new MaintenanceRegistry();
    this.economy = new EconomySystem(hexGrid, this.maintenance);
    this.selection = new SelectionController();
    this.buildManager = new BuildManager(hexGrid, this.economy, this.maintenance);
    this.unitManager = new UnitManager();
    this.spawnManager = new SpawnManager(hexGrid, this.buildManager, this.unitManager);
    this.movementManager = new MovementManager(hexGrid, this.unitManager);
  }

  /**
   * Advance the simulation by elapsed milliseconds. Driven by the render
   * ticker's deltaMS. Economy/BuildManager step at fixed TICK_MS intervals.
   */
  public update(deltaMS: number): void {
    this.tickAccumulator += deltaMS;

    let stepped = false;
    const maxStepsPerFrame = 5;
    let steps = 0;
    while (this.tickAccumulator >= TICK_MS && steps < maxStepsPerFrame) {
      this.economy.update();
      this.buildManager.update(TICK_MS);
      this.spawnManager.update(TICK_MS);
      this.movementManager.update(this.tickCount);
      this.tickCount++;
      this.tickAccumulator -= TICK_MS;
      steps++;
      stepped = true;
    }

    this.selection.update();

    if (stepped) {
      this.checkWinLose();
    }
  }

  /** Place starting buildings for both factions. */
  public placeStartBuildings(seed: string): void {
    this.buildManager.placeStartBuildings(seed);
  }

  public getTickCount(): number {
    return this.tickCount;
  }

  public getTickMs(): number {
    return TICK_MS;
  }

  public getFactionState(faction: Faction) {
    return this.economy.getState(faction);
  }

  private checkWinLose(): void {
    // TODO (M6)
  }
}
