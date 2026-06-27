/**
 * MaintenanceRegistry - tracks recurring per-tick building costs.
 *
 * Empty for now; BuildManager (Milestone 3) will register buildings here as
 * they are placed and unregister them on destruction. The economy reads the
 * aggregate total each tick (RPD: maintenance is recurring per tick while a
 * building exists and scales with spawn speed).
 */

export interface ResourceCost {
  gold: number;
  oil: number;
}

interface MaintenanceEntry extends ResourceCost {
  /** Optional spawn-speed multiplier applied to the base cost (1 = low/none). */
  multiplier: number;
}

export class MaintenanceRegistry {
  private readonly entries = new Map<string, MaintenanceEntry>();

  /** Register or replace a building's recurring maintenance cost. */
  public register(id: string, cost: ResourceCost, multiplier = 1): void {
    this.entries.set(id, { ...cost, multiplier });
  }

  /** Remove a building's maintenance cost (e.g. on destruction). */
  public unregister(id: string): void {
    this.entries.delete(id);
  }

  /** Aggregate per-faction maintenance drain (multiplier applied per entry). */
  public getTotal(): ResourceCost {
    let gold = 0;
    let oil = 0;
    for (const entry of this.entries.values()) {
      gold += entry.gold * entry.multiplier;
      oil += entry.oil * entry.multiplier;
    }
    return { gold, oil };
  }

  public clear(): void {
    this.entries.clear();
  }
}
