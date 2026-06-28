/**
 * MovementManager - autonomous unit movement toward enemy victory hex.
 * Each tick, moves eligible units one step along their cached A* path.
 * Movement timing is based on the unit's movement stat:
 * infantry (3) → every tick, tank (2) → every 2 ticks, artillery (1) → every 3 ticks.
 * Path caching avoids redundant A* recomputation.
 * 
 * Combat Resolution:
 * - Units cannot enter hexes with enemy units or buildings.
 * - Combat resolves per tick; only proceeds if hex is cleared.
 */

import type { HexGrid } from "../hex/HexGrid";
import { findPath } from "../pathfinding/HexAStar";
import type { UnitManager } from "./UnitManager";
import type { BuildManager } from "../build/BuildManager";
import { CombatResolver } from "../combat/CombatResolver";

type Faction = import("../economy/EconomySystem").Faction;

const ENEMY_FOR: Record<Faction, Faction> = {
  friendly: "enemy",
  enemy: "friendly",
};

export class MovementManager {
  private readonly grid: HexGrid;
  private readonly unitManager: UnitManager;
  private readonly buildManager: BuildManager;
  private readonly combatResolver: CombatResolver;

  /** Cached path per unit id. */
  private readonly pathCache = new Map<string, { q: number; r: number }[]>();

  constructor(grid: HexGrid, unitManager: UnitManager, buildManager: BuildManager, gameSeed: string) {
    this.grid = grid;
    this.unitManager = unitManager;
    this.buildManager = buildManager;
    this.combatResolver = new CombatResolver(gameSeed);
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
      
      // --- COMBAT RESOLUTION INTEGRATION ---
      // If enemy units or buildings on target hex, resolve combat instead of moving
      const enemyUnitsAtNext = this.unitManager
        .getUnitsAt(next.q, next.r)
        .filter((u) => u.owner !== unit.owner);
      const enemyBuildingAtNext = this.buildManager.getBuildingAt(next.q, next.r);

      const hasEnemyUnits = enemyUnitsAtNext.length > 0 ||
        (enemyBuildingAtNext && enemyBuildingAtNext.owner !== unit.owner);

      if (hasEnemyUnits) {
        // Prepare defenders data for combat
        const enemyBuildings = enemyBuildingAtNext
          ? [{ building: enemyBuildingAtNext, faction: enemyBuildingAtNext.owner }]
          : [];

        // Resolve combat for this unit
        const combatResult = this.combatResolver.resolveHexCombat(
          [unit],
          enemyUnitsAtNext,
          enemyBuildings,
          unit.id,
        );

        // Apply damage to attacking unit (defender strikes back)
        for (const damaged of combatResult.attackersDamaged) {
          damaged.unit.hp = damaged.unit.hp - damaged.damage;
        }

        // Remove killed attackers
        for (const deadUnit of combatResult.attackersKilled) {
          deadUnit.hp = 0;
          this.unitManager.removeUnit(deadUnit.id);
        }

        // Apply damage to enemy units
        for (const damaged of combatResult.defendersDamaged) {
          damaged.unit.hp = damaged.unit.hp - damaged.damage;
        }

        // Remove destroyed enemy units
        for (const deadUnit of combatResult.defendersKilled) {
          deadUnit.hp = 0;
          this.unitManager.removeUnit(deadUnit.id);
        }

        // Handle building damage and destruction
        for (const damaged of combatResult.buildingsDamaged) {
          this.buildManager.damageBuilding(damaged.building.id, damaged.damage);
        }

        // If unit survived and hex is clear, proceed with move
        if (combatResult.canEnter && combatResult.enemiesEliminated) {
          // Guard: only move if the attacker is still alive
          if (this.unitManager.getUnit(unit.id)) {
            this.unitManager.moveUnit(unit.id, next.q, next.r);
          }
        }

        // Consume waypoint and recompute path if needed on next tick
        path.shift();
        if (path.length <= 1) {
          this.pathCache.delete(unit.id);
        }

        return; // Skip normal move logic
      }
      
      // --- NORMAL MOVE (no enemy presence) ---
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
