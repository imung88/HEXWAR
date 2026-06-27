/**
 * EconomySystem - per-faction gold/oil economy (RPD Economy module).
 *
 * Stepped by GameController at a fixed TICK_MS cadence. Each step it:
 *   1. Adds income from controlled resource nodes + victory hexes.
 *   2. Applies border-pressure reductions to resource gain.
 *   3. Deducts aggregate maintenance from the MaintenanceRegistry.
 *
 * Resources never go below zero; unpaid maintenance is reported so the UI can
 * warn (RPD: low resources / unpaid maintenance warnings).
 */

import {
  NODE_INCOME,
  STARTING_RESOURCES,
  VICTORY_INCOME,
} from "../config/GameConfig";
import type { Owner } from "../config/GameConfig";
import type { HexGrid } from "../hex/HexGrid";
import { borderPressureMultiplier } from "../hex/borderPressure";
import type { MaintenanceRegistry } from "./MaintenanceRegistry";

export type Faction = Extract<Owner, "friendly" | "enemy">;

export interface FactionEconomyState {
  gold: number;
  oil: number;
  /** Income per tick (after border-pressure reduction), for income/min display. */
  income: { gold: number; oil: number };
  /** Maintenance drain per tick (pre-clamp), for warnings. */
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
    // Maintenance is a single global registry for now (player faction owns it).
    const maintenanceTotal = this.maintenance.getTotal();

    for (const faction of FACTIONS) {
      const s = this.state[faction];
      const income = this.computeIncome(faction);
      s.income = income;
      s.maintenance = maintenanceTotal;

      s.gold = Math.max(0, s.gold + income.gold - maintenanceTotal.gold);
      s.oil = Math.max(0, s.oil + income.oil - maintenanceTotal.oil);
    }
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

      // Determine base production for this tile.
      let base = { gold: 0, oil: 0 };
      if (tile.isVictory) {
        base = { ...VICTORY_INCOME };
      } else if (tile.node) {
        base = { ...NODE_INCOME[tile.node] };
      } else {
        return;
      }

      // Border-pressure reduction based on opposing neighbors.
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
