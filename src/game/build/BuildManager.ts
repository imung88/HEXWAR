/**
 * BuildManager - state-only building placement and lifecycle.
 *
 * No display objects. All drawing flows through BuildRenderer via GameScreen.
 * Owned and stepped by GameController (update called each TICK_MS).
 */

import type { BuildingType } from "../config/GameConfig";
import { BUILDING_CONFIGS } from "../config/GameConfig";
import type { Faction } from "../economy/EconomySystem";
import type { EconomySystem } from "../economy/EconomySystem";
import type { MaintenanceRegistry } from "../economy/MaintenanceRegistry";
import type { HexGrid } from "../hex/HexGrid";
import { randomSeeded } from "../../engine/utils/random";
import {
  type Building,
  getBuildingConfig,
  getMaintenanceCost,
} from "./BuildingTypes";

const UNIT_TYPE_FOR_BUILDING: Record<string, import("../config/GameConfig").UnitType> = {
  infantryBarracks: "infantry",
  tankDivision: "tank",
  artilleryDivision: "artillery",
};

let nextBuildingId = 1;

function makeId(): string {
  return `b${nextBuildingId++}`;
}

export class BuildManager {
  private readonly grid: HexGrid;
  private readonly economy: EconomySystem;
  private readonly maintenance: MaintenanceRegistry;

  /** All buildings keyed by unique id. */
  private readonly buildings = new Map<string, Building>();
  /** Tile key → building id for quick lookup. */
  private readonly tileIndex = new Map<string, string>();
  /** Per-faction CC cooldown remaining ms. */
  private readonly ccCooldown = new Map<Faction, number>();

  constructor(grid: HexGrid, economy: EconomySystem, maintenance: MaintenanceRegistry) {
    this.grid = grid;
    this.economy = economy;
    this.maintenance = maintenance;
  }

  /**
   * Auto-place starting buildings:
   * 1. Place instant-ready free CCs on ALL friendly and enemy hexes.
   * 2. Then place spawn buildings (3 Infantry Barracks + 1 Tank Division)
   *    on random controlled non-victory hexes.
   */
  public placeStartBuildings(seed: string): void {
    const random = randomSeeded(seed);
    const factions: Faction[] = ["friendly", "enemy"];

    for (const faction of factions) {
      // Step 1: Place CCs on every hex owned by this faction.
      this.grid.forEach((tile) => {
        if (tile.owner === faction) {
          this.placeInstantCC(faction, tile.q, tile.r);
        }
      });

      // Step 2: Shuffle non-victory hexes and place spawn buildings.
      const owned = this.getOwnedNonVictoryHexes(faction);
      const shuffled = [...owned];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const infantrySpots = shuffled.slice(0, 3);
      const tankSpots = shuffled.slice(3, 4);

      for (const tile of infantrySpots) {
        this.placeInstantBuilding(faction, tile.q, tile.r, "infantryBarracks");
      }
      for (const tile of tankSpots) {
        this.placeInstantBuilding(faction, tile.q, tile.r, "tankDivision");
      }
    }
  }

  /** Place an instant-ready CC (for start buildings). */
  private placeInstantCC(faction: Faction, q: number, r: number): void {
    const tile = this.grid.get(q, r);
    if (!tile || tile.commandCenter) return;

    const config = getBuildingConfig("commandCenter");
    const id = makeId();
    const building: Building = {
      id,
      type: "commandCenter",
      owner: faction,
      hp: config.maxHp,
      maxHp: config.maxHp,
      spawnSpeed: "low",
      ready: true,
      buildTimerMs: 0,
      cooldownTimerMs: 0,
      unitType: null,
    };
    this.buildings.set(id, building);
    this.tileIndex.set(this.grid.key(q, r), id);
    this.grid.setCommandCenter(q, r, true);

    const maint = getMaintenanceCost(building);
    this.maintenance.register(id, maint, faction, 1);
  }

  /** Place an instant-ready spawn building (for start buildings). */
  private placeInstantBuilding(faction: Faction, q: number, r: number, type: BuildingType): void {
    if (type === "commandCenter") return;
    const tile = this.grid.get(q, r);
    if (!tile || tile.building) return;

    const config = getBuildingConfig(type);
    const id = makeId();
    const building: Building = {
      id,
      type,
      owner: faction,
      hp: config.maxHp,
      maxHp: config.maxHp,
      spawnSpeed: "low",
      ready: true,
      buildTimerMs: 0,
      cooldownTimerMs: 0,
      unitType: UNIT_TYPE_FOR_BUILDING[type] ?? null,
    };
    this.buildings.set(id, building);
    this.tileIndex.set(this.grid.key(q, r), id);
    this.grid.setBuilding(q, r, { type, id });

    const maint = getMaintenanceCost(building);
    this.maintenance.register(id, maint, faction, 1);
  }

  /**
   * Attempt to place a building. Returns true on success.
   * - CC: must own or neutral, no existing CC, can afford, deduct cost, start build timer.
   * - Spawn building: ready CC on hex, no existing building, can afford, instant ready.
   */
  public place(faction: Faction, q: number, r: number, type: BuildingType): boolean {
    const tile = this.grid.get(q, r);
    if (!tile) return false;

    const config = getBuildingConfig(type);

    if (type === "commandCenter") {
      // Must be own or neutral, no existing CC.
      if (tile.owner !== faction && tile.owner !== "neutral") return false;
      if (tile.commandCenter) return false;

      // Check CC cooldown.
      const cd = this.ccCooldown.get(faction) ?? 0;
      if (cd > 0) return false;

      // Check affordability.
      if (!this.economy.canAfford(faction, config.cost)) return false;
      this.economy.spend(faction, config.cost);

      // Claim neutral tile.
      if (tile.owner === "neutral") {
        this.grid.setTileOwner(q, r, faction);
      }

      // Set under construction.
      this.grid.setUnderConstruction(q, r, true);
      const id = makeId();
      const building: Building = {
        id,
        type: "commandCenter",
        owner: faction,
        hp: config.maxHp,
        maxHp: config.maxHp,
        spawnSpeed: "low",
        ready: false,
        buildTimerMs: config.buildTimeMs,
        cooldownTimerMs: 0,
        unitType: null,
      };
      this.buildings.set(id, building);
      this.tileIndex.set(this.grid.key(q, r), id);

      return true;
    }

    // Spawn building: need ready CC, no existing building.
    const ccId = this.tileIndex.get(this.grid.key(q, r));
    if (!ccId) return false;
    const cc = this.buildings.get(ccId);
    if (!cc || cc.type !== "commandCenter" || !cc.ready) return false;
    if (tile.building) return false;
    if (tile.owner !== faction) return false;

    if (!this.economy.canAfford(faction, config.cost)) return false;
    this.economy.spend(faction, config.cost);

    const id = makeId();
    const building: Building = {
      id,
      type,
      owner: faction,
      hp: config.maxHp,
      maxHp: config.maxHp,
      spawnSpeed: "low",
      ready: true,
      buildTimerMs: 0,
      cooldownTimerMs: 0,
      unitType: UNIT_TYPE_FOR_BUILDING[type] ?? null,
    };
    this.buildings.set(id, building);
    this.tileIndex.set(this.grid.key(q, r), id);
    this.grid.setBuilding(q, r, { type, id });

    const maint = getMaintenanceCost(building);
    this.maintenance.register(id, maint, faction, 1);

    return true;
  }

  /** Change spawn speed for a building. Re-registers maintenance. */
  public setSpawnSpeed(buildingId: string, speed: import("../config/GameConfig").SpawnSpeed): void {
    const building = this.buildings.get(buildingId);
    if (!building || building.type === "commandCenter") return;

    building.spawnSpeed = speed;
    const maint = getMaintenanceCost(building);
    this.maintenance.register(building.id, maint, building.owner, 1);
  }

  /** Advance timers each fixed tick. */
  public update(deltaMs: number): void {
    // CC build timers.
    for (const building of this.buildings.values()) {
      if (building.type === "commandCenter" && !building.ready && building.buildTimerMs > 0) {
        building.buildTimerMs -= deltaMs;
        if (building.buildTimerMs <= 0) {
          building.buildTimerMs = 0;
          building.ready = true;
          // Find tile and clear underConstruction, set commandCenter.
          for (const [key, id] of this.tileIndex) {
            if (id === building.id) {
              const [q, r] = key.split(",").map(Number);
              this.grid.setUnderConstruction(q, r, false);
              this.grid.setCommandCenter(q, r, true);
              // Register maintenance now that CC is ready.
              const maint = getMaintenanceCost(building);
              this.maintenance.register(building.id, maint, building.owner, 1);
              break;
            }
          }
        }
      }
    }

    // CC cooldown timers.
    for (const faction of ["friendly", "enemy"] as Faction[]) {
      const cd = this.ccCooldown.get(faction) ?? 0;
      if (cd > 0) {
        this.ccCooldown.set(faction, Math.max(0, cd - deltaMs));
      }
    }
  }

  /** Get the building on a given tile. */
  public getBuildingAt(q: number, r: number): Building | undefined {
    const id = this.tileIndex.get(this.grid.key(q, r));
    return id ? this.buildings.get(id) : undefined;
  }

  /** Get valid building types for a hex. */
  public getBuildableTypes(faction: Faction, q: number, r: number): BuildingType[] {
    const tile = this.grid.get(q, r);
    if (!tile) return [];
    if (tile.isVictory) return [];

    const results: BuildingType[] = [];
    const types: BuildingType[] = ["commandCenter", "infantryBarracks", "tankDivision", "artilleryDivision"];

    for (const type of types) {
      if (this.canPlace(faction, q, r, type)) {
        results.push(type);
      }
    }
    return results;
  }

  private canPlace(faction: Faction, q: number, r: number, type: BuildingType): boolean {
    const tile = this.grid.get(q, r);
    if (!tile) return false;
    const config = BUILDING_CONFIGS[type];

    if (type === "commandCenter") {
      if (tile.owner !== faction && tile.owner !== "neutral") return false;
      if (tile.commandCenter) return false;
      const cd = this.ccCooldown.get(faction) ?? 0;
      if (cd > 0) return false;
      return this.economy.canAfford(faction, config.cost);
    }

    const ccId = this.tileIndex.get(this.grid.key(q, r));
    if (!ccId) return false;
    const cc = this.buildings.get(ccId);
    if (!cc || cc.type !== "commandCenter" || !cc.ready) return false;
    if (tile.building) return false;
    if (tile.owner !== faction) return false;
    return this.economy.canAfford(faction, config.cost);
  }

  /** Remaining CC cooldown in ms for a faction (null if none). */
  public getCoolDownRemaining(faction: Faction): number | null {
    const cd = this.ccCooldown.get(faction) ?? 0;
    return cd > 0 ? cd : null;
  }

  /** Get building by id. */
  public getBuildingById(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  /**
   * Iterate all ready spawn buildings, calling cb with building + hex coords.
   * Used by SpawnManager to enumerate buildings for cadence timers.
   */
  public forEachSpawnBuilding(
    cb: (building: Building & { q: number; r: number }) => void,
  ): void {
    for (const [key, id] of this.tileIndex) {
      const building = this.buildings.get(id);
      if (!building || building.type === "commandCenter" || !building.ready) continue;
      const [q, r] = key.split(",").map(Number);
      cb({ ...building, q, r });
    }
  }

  private getOwnedNonVictoryHexes(faction: Faction) {
    const result: { q: number; r: number }[] = [];
    this.grid.forEach((tile) => {
      if (tile.owner === faction && !tile.isVictory) {
        result.push({ q: tile.q, r: tile.r });
      }
    });
    return result;
  }
}
