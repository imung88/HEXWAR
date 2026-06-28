/**
 * CombatResolver - handles combat resolution when units attempt to enter enemy-occupied hexes.
 * Implements RPD specification: units cannot enter hexes with enemy units/buildings; they must fight instead.
 *
 * Priority order: fight enemy units first, then attack enemy buildings.
 * Damage formula: max(1, attacker.attack - defender.defense + random(-2, 2))
 * Both sides deal damage simultaneously; combat resolves per tick.
 */

import { randomSeeded } from "../../engine/utils/random";
import { COMBAT_RANDOM_RANGE, MIN_DAMAGE } from "../config/GameConfig";
import type { Faction } from "../economy/EconomySystem";
import type { Unit } from "../unit/Unit";
import type { Building } from "../build/BuildingTypes";

/** Result for a single engagement between two units */
export interface EngagementResult {
  attackerDamageReceived: number;
  attackerKilled: boolean;
  attackerRemainingHp: number;
  defenderDamageReceived: number;
  defenderKilled: boolean;
  defenderRemainingHp: number;
}

/** Result for a single unit attacking a building */
export interface BuildingEngagementResult {
  damageDealt: number;
  buildingDestroyed: boolean;
  buildingRemainingHp: number;
}

/** Complete result when resolving all combat on a hex */
export interface HexCombatResult {
  /** Whether the attacking unit(s) can now enter the hex */
  canEnter: boolean;
  /** Whether all enemies (units + buildings) are eliminated */
  enemiesEliminated: boolean;
  /** Attacker casualties */
  attackersDamaged: { unit: Unit; damage: number }[];
  attackersKilled: Unit[];
  /** Defender casualties */
  defendersDamaged: { unit: Unit; damage: number }[];
  defendersKilled: Unit[];
  /** Building casualties */
  buildingsDamaged: { building: Building; damage: number }[];
  buildingsDestroyed: Building[];
}

/** Orders units by attack descending */
function sortByAttackDesc(units: Unit[]): Unit[] {
  return [...units].sort((a, b) => b.attack - a.attack);
}

/** Cap damage to minimum and handle random variance */
function calculateDamage(attack: number, defense: number, randomFn: () => number): number {
  const variance = randomFn() * (COMBAT_RANDOM_RANGE * 2) - COMBAT_RANDOM_RANGE;
  const rawDamage = attack - defense + Math.floor(variance);
  return Math.max(MIN_DAMAGE, Math.floor(rawDamage));
}

export class CombatResolver {
  private readonly seed: string;

  constructor(gameSeed: string) {
    this.seed = gameSeed;
  }

  /**
   * Resolve combat between a pair of units (both sides deal damage).
   * Returns damage received by each side.
   */
  public resolveUnitPairCombat(
    attacker: Unit,
    defender: Unit,
    random: () => number,
  ): EngagementResult {
    // Attacker strikes defender
    const defenderDamage = calculateDamage(attacker.attack, defender.defense, random);
    const defenderNewHp = defender.hp - defenderDamage;
    const defenderKilled = defenderNewHp <= 0;

    // Defender strikes attacker back
    const attackerDamage = calculateDamage(defender.attack, attacker.defense, random);
    const attackerNewHp = attacker.hp - attackerDamage;
    const attackerKilled = attackerNewHp <= 0;

    return {
      attackerDamageReceived: attackerDamage,
      attackerKilled,
      attackerRemainingHp: Math.max(0, attackerNewHp),
      defenderDamageReceived: defenderDamage,
      defenderKilled,
      defenderRemainingHp: Math.max(0, defenderNewHp),
    };
  }

  /** Resolve combat between a unit and an enemy building */
  public resolveBuildingCombat(
    attacker: Unit,
    building: Building,
    random: () => number,
  ): BuildingEngagementResult {
    // Buildings have no defense stat per RPD
    const damage = calculateDamage(attacker.attack, 0, random);
    const newHp = building.hp - damage;
    const destroyed = newHp <= 0;

    return {
      damageDealt: damage,
      buildingDestroyed: destroyed,
      buildingRemainingHp: Math.max(0, newHp),
    };
  }

  /**
   * Resolve all combat that occurs when a unit tries to enter a hex.
   * Returns whether the unit can safely enter the hex (all enemies defeated).
   */
  public resolveHexCombat(
    attackers: Unit[],
    defenders: Unit[],
    enemyBuildings: { building: Building; faction: Faction }[],
    resolveId: string = "default",
  ): HexCombatResult {
    const random = randomSeeded(`${this.seed}-combat-${resolveId}`);
    const result: HexCombatResult = {
      canEnter: false,
      enemiesEliminated: false,
      attackersDamaged: [],
      attackersKilled: [],
      defendersDamaged: [],
      defendersKilled: [],
      buildingsDamaged: [],
      buildingsDestroyed: [],
    };

    // If no defenders and no buildings, can enter immediately
    if (defenders.length === 0 && enemyBuildings.length === 0) {
      result.canEnter = true;
      result.enemiesEliminated = true;
      return result;
    }

    // Sort both sides by attack descending
    const sortedAttackers = sortByAttackDesc(attackers);
    const sortedDefenders = sortByAttackDesc(defenders);

    const maxPairs = Math.min(sortedAttackers.length, sortedDefenders.length);

    // Track which attackers survived (for building attacks)
    const attackerAlive = new Map<Unit, boolean>();
    for (const a of sortedAttackers) attackerAlive.set(a, true);

    // Combat Phase 1: Unit vs Unit (paired 1v1, highest attack first)
    for (let i = 0; i < maxPairs; i++) {
      const attacker = sortedAttackers[i];
      const defender = sortedDefenders[i];

      const engagement = this.resolveUnitPairCombat(attacker, defender, random);

      // Apply damage to attacker
      if (engagement.attackerKilled) {
        result.attackersKilled.push(attacker);
        attackerAlive.set(attacker, false);
      } else {
        result.attackersDamaged.push({ unit: attacker, damage: engagement.attackerDamageReceived });
      }

      // Apply damage to defender
      if (engagement.defenderKilled) {
        result.defendersKilled.push(defender);
      } else {
        result.defendersDamaged.push({ unit: defender, damage: engagement.defenderDamageReceived });
      }
    }

    // Combat Phase 2: Attack buildings with alive attackers that didn't get paired
    // (excess attackers) plus paired attackers if all defenders are killed
    const allDefendersKilled = result.defendersKilled.length === sortedDefenders.length;
    const aliveUnpairedAttackers = sortedAttackers.filter(
      (a, idx) => idx >= maxPairs && attackerAlive.get(a),
    );
    const alivePausedAttackers = allDefendersKilled
      ? sortedAttackers.filter((a, idx) => idx < maxPairs && attackerAlive.get(a))
      : [];
    const allAliveAttackers = [...aliveUnpairedAttackers, ...alivePausedAttackers];

    const buildingsToAttack = enemyBuildings.slice();

    for (const attacker of allAliveAttackers) {
      if (buildingsToAttack.length === 0) break;

      const buildingEntry = buildingsToAttack.shift()!;
      const building = buildingEntry.building;

      const engagement = this.resolveBuildingCombat(attacker, building, random);
      result.buildingsDamaged.push({ building, damage: engagement.damageDealt });

      if (engagement.buildingDestroyed) {
        result.buildingsDestroyed.push(building);
      }
    }

    // Determine if hex is clear
    const allDefendersDead = result.defendersKilled.length === defenders.length;
    const allBuildingsDestroyed = result.buildingsDestroyed.length === enemyBuildings.length;

    if (allDefendersDead && allBuildingsDestroyed) {
      result.canEnter = true;
      result.enemiesEliminated = true;
    }

    return result;
  }
}