/**
 * MovementManager - autonomous unit movement toward enemy victory hex.
 *
 * Each tick, moves eligible units one step along their cached A* path.
 * Movement timing is based on the unit's movement stat:
 *   infantry (3) → every tick, tank (2) → every 2 ticks, artillery (1) → every 3 ticks.
 * Path caching avoids redundant A* recomputation.
 */

import type { HexGrid } from "../hex/HexGrid";
import { findPath } from "../pathfinding/HexAStar";
import type { UnitManager } from "./UnitManager";

type Faction = import("../economy/EconomySystem").Faction;

const ENEMY_FOR: Record<Faction, Faction> = {
  friendly: "enemy",
  enemy: "friendly",
};

export class MovementManager {
  private readonly grid: HexGrid;
  private readonly unitManager: UnitManager;

  /** Cached path per unit id. */
  private readonly pathCache = new Map<string, { q: number; r: number }[]>();

  constructor(grid: HexGrid, unitManager: UnitManager) {
    this.grid = grid;
    this.unitManager = unitManager;
  }

  /** Advance all units by one tick. */
  public update(tickCount: number): void {
    this.unitManager.forEach((unit) => {
      // Movement interval: 4 - movement (infantry=1, tank=2, artillery=3).
      const interval = 4 - unit.movement;
      if (tickCount % interval !== 0) return;

      // Find or reuse cached path.
      let path = this.pathCache.get(unit.id);

      // Invalidate cache if unit has moved from path[0].
      if (path && path.length > 0) {
        if (path[0].q !== unit.q || path[0].r !== unit.r) {
          path = undefined;
        }
      }

      if (!path) {
        const enemy = ENEMY_FOR[unit.owner];
        const goal = this.grid.getVictoryHex(enemy);
        if (!goal) return;
        if (unit.q === goal.q && unit.r === goal.r) return;

        const found = findPath(this.grid, unit.q, unit.r, goal.q, goal.r);
        if (!found || found.length <= 1) return;
        path = found;
        this.pathCache.set(unit.id, path);
      }

      // Already at the goal?
      const goal = path[path.length - 1];
      if (unit.q === goal.q && unit.r === goal.r) {
        this.pathCache.delete(unit.id);
        return;
      }

      // Next step is path[1] (path[0] is current position).
      const next = path[1];
      if (this.unitManager.canSpawnAt(next.q, next.r)) {
        this.unitManager.moveUnit(unit.id, next.q, next.r);
        // Remove consumed waypoint; recompute if path is now stale.
        path.shift();
        if (path.length <= 1) {
          this.pathCache.delete(unit.id);
        }
      }
    });
  }
}
