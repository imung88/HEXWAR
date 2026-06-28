/**
 * SpawnManager - per-building cadence timers that create units.
 *
 * Reads spawn speed from BuildManager, uses cadence from config,
 * and registers units with UnitManager. Also handles victory CC
 * auto-spawning of infantry. State-only; no display objects.
 */

import {
  BUILDING_CONFIGS,
  VICTORY_CC_CADENCE_MS,
} from "../config/GameConfig";
import type { BuildingType } from "../config/GameConfig";
import type { BuildManager } from "../build/BuildManager";
import type { HexGrid } from "../hex/HexGrid";
import type { UnitManager } from "../unit/UnitManager";
import { createUnit } from "../unit/Unit";
import { randomSeeded } from "../../engine/utils/random";

const SPAWN_UNIT_TYPE: Record<string, import("../config/GameConfig").UnitType> = {
  infantryBarracks: "infantry",
  tankDivision: "tank",
  artilleryDivision: "artillery",
};

export class SpawnManager {
  private readonly grid: HexGrid;
  private readonly buildManager: BuildManager;
  private readonly unitManager: UnitManager;

  /** Per-building remaining spawn timer in ms. */
  private readonly timers = new Map<string, number>();

  constructor(grid: HexGrid, buildManager: BuildManager, unitManager: UnitManager) {
    this.grid = grid;
    this.buildManager = buildManager;
    this.unitManager = unitManager;
  }

  /**
   * Seed per-building timers with randomized offsets so buildings of the
   * same type don't fire simultaneously. Must be called once after
   * placeStartBuildings().
   */
  public initTimers(seed: string): void {
    this.buildManager.forEachSpawnBuilding((building) => {
      const random = randomSeeded(`${seed}-${building.id}`);
      const cadence = this.getCadence(building.type, building.spawnSpeed);
      if (!isFinite(cadence)) return;
      // Random initial offset: 0..cadence
      this.timers.set(building.id, random() * cadence);
    });
  }

  /** Advance timers by one fixed tick. */
  public update(deltaMs: number): void {
    this.buildManager.forEachSpawnBuilding((building) => {
      const tile = this.grid.get(building.q, building.r);
      if (!tile) return;

      // Victory CC auto-spawns infantry regardless of building type.
      if (tile.commandCenter && tile.isVictory) {
        this.handleVictoryCC(building, deltaMs);
        return;
      }

      const unitType = SPAWN_UNIT_TYPE[building.type];
      if (!unitType) return;

      const cadence = this.getCadence(building.type, building.spawnSpeed);
      if (!isFinite(cadence)) return;

      let timer = this.timers.get(building.id) ?? cadence;
      timer -= deltaMs;

      if (timer <= 0) {
        this.trySpawn(building.owner, unitType, building.q, building.r);
        timer = cadence;
      }

      this.timers.set(building.id, timer);
    });
  }

  private handleVictoryCC(
    building: { id: string; owner: import("../economy/EconomySystem").Faction; q: number; r: number },
    deltaMs: number,
  ): void {
    let timer = this.timers.get(building.id) ?? VICTORY_CC_CADENCE_MS;
    timer -= deltaMs;

    if (timer <= 0) {
      this.trySpawn(building.owner, "infantry", building.q, building.r);
      timer = VICTORY_CC_CADENCE_MS;
    }

    this.timers.set(building.id, timer);
  }

  private trySpawn(
    owner: import("../economy/EconomySystem").Faction,
    unitType: import("../config/GameConfig").UnitType,
    q: number,
    r: number,
  ): void {
    if (!this.unitManager.canSpawn(owner)) return;
    if (!this.unitManager.canSpawnAt(q, r)) return;

    const unit = createUnit(unitType, owner, q, r);
    this.unitManager.addUnit(unit);
  }

  private getCadence(
    buildingType: BuildingType,
    speed: import("../config/GameConfig").SpawnSpeed,
  ): number {
    const cfg = BUILDING_CONFIGS[buildingType];
    return speed === "high" ? cfg.cadenceHighMs : cfg.cadenceLowMs;
  }
}
