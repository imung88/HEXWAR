/**
 * Unit - pure data entity for a single unit on the battlefield.
 *
 * No PixiJS dependency. Created via factory; stored in UnitManager.
 */

import { UNIT_CONFIGS } from "../config/GameConfig";
import type { UnitType } from "../config/GameConfig";
import type { Faction } from "../economy/EconomySystem";

let nextUnitId = 1;

export interface Unit {
  id: string;
  type: UnitType;
  owner: Faction;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  movement: number;
  vision: number;
  /** Countdown in ticks until this unit can move again. */
  moveTimer: number;
}

export function createUnit(type: UnitType, owner: Faction, q: number, r: number): Unit {
  const cfg = UNIT_CONFIGS[type];
  return {
    id: `u${nextUnitId++}`,
    type,
    owner,
    q,
    r,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    attack: cfg.attack,
    defense: cfg.defense,
    movement: cfg.movement,
    vision: cfg.vision,
    moveTimer: 0,
  };
}
