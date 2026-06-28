/**
 * MaintenanceRegistry - tracks recurring per-tick building costs.
 *
 * Each entry is keyed by building id and carries an owner faction.
 * EconomySystem reads per-faction totals each tick to prevent cross-faction drain.
 */

import type { ResourceCost } from "../config/GameConfig";
import type { Faction } from "./EconomySystem";

export type { ResourceCost };

interface MaintenanceEntry extends ResourceCost {
  owner: Faction;
  /** Spawn-speed multiplier applied to the base cost (0 = off, 1 = low, 2 = high). */
  multiplier: number;
}

export class MaintenanceRegistry {
  private readonly entries = new Map<string, MaintenanceEntry>();

  /** Register or replace a building's recurring maintenance cost. */
  public register(id: string, cost: ResourceCost, owner: Faction, multiplier = 1): void {
    this.entries.set(id, { ...cost, owner, multiplier });
  }

  /** Remove a building's maintenance cost (e.g. on destruction). */
  public unregister(id: string): void {
    this.entries.delete(id);
  }

  /** Aggregate per-faction maintenance drain (multiplier applied per entry). */
  public getTotal(owner: Faction): ResourceCost {
    let gold = 0;
    let oil = 0;
    for (const entry of this.entries.values()) {
      if (entry.owner !== owner) continue;
      gold += entry.gold * entry.multiplier;
      oil += entry.oil * entry.multiplier;
    }
    return { gold, oil };
  }

  public clear(): void {
    this.entries.clear();
  }
}
