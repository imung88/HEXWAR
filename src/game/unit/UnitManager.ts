/**
 * UnitManager - logic-only storage for all units on the battlefield.
 *
 * No display objects. Provides queries by hex, faction, and global cap checks.
 * Owned and stepped by GameController.
 */

import { MAX_UNITS_PER_HEX, MAX_UNITS_PER_FACTION } from "../config/GameConfig";
import type { Faction } from "../economy/EconomySystem";
import type { Unit } from "./Unit";

export class UnitManager {
  private readonly units = new Map<string, Unit>();

  public addUnit(unit: Unit): string {
    this.units.set(unit.id, unit);
    return unit.id;
  }

  public removeUnit(id: string): void {
    this.units.delete(id);
  }

  public getUnit(id: string): Unit | undefined {
    return this.units.get(id);
  }

  public getUnitsAt(q: number, r: number): Unit[] {
    const result: Unit[] = [];
    for (const u of this.units.values()) {
      if (u.q === q && u.r === r) result.push(u);
    }
    return result;
  }

  public getUnitsByFaction(faction: Faction): Unit[] {
    const result: Unit[] = [];
    for (const u of this.units.values()) {
      if (u.owner === faction) result.push(u);
    }
    return result;
  }

  public getFactionUnitCount(faction: Faction): number {
    let count = 0;
    for (const u of this.units.values()) {
      if (u.owner === faction) count++;
    }
    return count;
  }

  public canSpawn(faction: Faction): boolean {
    return this.getFactionUnitCount(faction) < MAX_UNITS_PER_FACTION;
  }

  public canSpawnAt(q: number, r: number): boolean {
    return this.getUnitsAt(q, r).length < MAX_UNITS_PER_HEX;
  }

  public moveUnit(id: string, toQ: number, toR: number): void {
    const unit = this.units.get(id);
    if (unit) {
      unit.q = toQ;
      unit.r = toR;
    }
  }

  public forEach(cb: (unit: Unit) => void): void {
    this.units.forEach(cb);
  }
}
