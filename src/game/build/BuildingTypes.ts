/**
 * BuildingTypes - type definitions and config lookup for the build system.
 */

import {
  BUILDING_CONFIGS,
  SPAWN_SPEED_MULTIPLIER,
} from "../config/GameConfig";
import type {
  BuildingType,
  BuildingTypeConfig,
  ResourceCost,
  SpawnSpeed,
  UnitType,
} from "../config/GameConfig";
import type { Faction } from "../economy/EconomySystem";

export type { BuildingType, SpawnSpeed };

export interface Building {
  id: string;
  type: BuildingType;
  owner: Faction;
  hp: number;
  maxHp: number;
  spawnSpeed: SpawnSpeed;
  ready: boolean;
  /** Remaining build time in ms (only when under construction). */
  buildTimerMs: number;
  /** Remaining cooldown in ms (only for command centers after destruction). */
  cooldownTimerMs: number;
  /** Unit type spawned by this building (null for CCs). */
  unitType: UnitType | null;
}

/** Look up the static config for a building type. */
export function getBuildingConfig(type: BuildingType): BuildingTypeConfig {
  return BUILDING_CONFIGS[type];
}

/** Compute the per-tick maintenance cost for a building given its spawn speed. */
export function getMaintenanceCost(building: Building): ResourceCost {
  const config = getBuildingConfig(building.type);
  const mult = SPAWN_SPEED_MULTIPLIER[building.spawnSpeed];
  // Blend between low and high based on multiplier.
  if (mult === 0) return { gold: 0, oil: 0 };
  if (mult >= 2) {
    return {
      gold: config.maintenanceHigh.gold,
      oil: config.maintenanceHigh.oil,
    };
  }
  return {
    gold: config.maintenanceLow.gold,
    oil: config.maintenanceLow.oil,
  };
}
