/**
 * EconomySystem - per-faction gold/oil economy.
 *
 * Stepped by GameController at a fixed TICK_MS cadence. Each step it:
 *   1. Adds income from controlled resource nodes + victory hexes.
 *   2. Applies border-pressure reductions to resource gain.
 *   3. Deducts per-faction maintenance from the MaintenanceRegistry.
 *
 * Resources never go below zero; unpaid maintenance is reported so the UI can
 * warn.
 */

import {
  NODE_INCOME,
  STARTING_RESOURCES,
  VICTORY_INCOME,
} from "../config/GameConfig";
import type { Owner, ResourceCost } from "../config/GameConfig";
import type { HexGrid } from "../hex/HexGrid";
import { borderPressureMultiplier } from "../hex/borderPressure";
import type { MaintenanceRegistry } from "./MaintenanceRegistry";

export type Faction = Extract<Owner, "friendly" | "enemy">;

export interface FactionEconomyState {
  gold: number;
  oil: number;
  income: { gold: number; oil: number };
  maintenance: { gold: number; oil: number };
}

const FACTIONS: Faction[] = ["friendly", "enemy"];

export class EconomySystem {
  private readonly grid: HexGrid;
  private readonly maintenance: MaintenanceRegistry;

  private readonly state: Record<Faction, FactionEconomyState> = {
    friendly: {
      gold: STARTING_RESOURCES.gold,
      oil: STARTING_RESOURCES.oil,
      income: { gold: 0, oil: 0 },
      maintenance: { gold: 0, oil: 0 },
    },
    enemy: {
      gold: STARTING_RESOURCES.gold,
      oil: STARTING_RESOURCES.oil,
      income: { gold: 0, oil: 0 },
      maintenance: { gold: 0, oil: 0 },
    },
  };

  constructor(grid: HexGrid, maintenance: MaintenanceRegistry) {
    this.grid = grid;
    this.maintenance = maintenance;
  }

  /** Advance the economy by one fixed tick. */
  public update(): void {
    for (const faction of FACTIONS) {
      const s = this.state[faction];
      const income = this.computeIncome(faction);
      const maint = this.maintenance.getTotal(faction);

      s.income = income;
      s.maintenance = maint;

      s.gold = Math.max(0, s.gold + income.gold - maint.gold);
      s.oil = Math.max(0, s.oil + income.oil - maint.oil);
    }
  }

  /** Check whether a faction can afford a given cost. */
  public canAfford(faction: Faction, cost: ResourceCost): boolean {
    const s = this.state[faction];
    return s.gold >= cost.gold && s.oil >= cost.oil;
  }

  /** Atomically check canAfford and deduct cost. Returns true if successful. */
  public spend(faction: Faction, cost: ResourceCost): boolean {
    if (!this.canAfford(faction, cost)) return false;
    const s = this.state[faction];
    s.gold -= cost.gold;
    s.oil -= cost.oil;
    return true;
  }

  /**
   * Compute per-tick income for a faction from controlled tiles, applying
   * border-pressure reductions per the RPD.
   */
  private computeIncome(faction: Faction): { gold: number; oil: number } {
    let gold = 0;
    let oil = 0;

    this.grid.forEach((tile) => {
      if (tile.owner !== faction) return;

      let base = { gold: 0, oil: 0 };
      if (tile.isVictory) {
        base = { ...VICTORY_INCOME };
      } else if (tile.node) {
        base = { ...NODE_INCOME[tile.node] };
      } else {
        return;
      }

      const enemyNeighbors = this.grid.borderPressureCount(tile.q, tile.r);
      const mult = borderPressureMultiplier(enemyNeighbors);

      gold += base.gold * mult;
      oil += base.oil * mult;
    });

    return { gold, oil };
  }

  public getState(faction: Faction): FactionEconomyState {
    return this.state[faction];
  }
}
