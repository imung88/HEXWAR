/**
 * HexGrid - logic-only axial hex grid.
 *
 * Holds tile state (owner, river, resource node, victory flag, building state),
 * neighbor queries, and match-start generation (owner banding, procedural river,
 * seeded resource-node placement, victory hexes). No PixiJS dependency.
 */

import {
  ENEMY_HEX_MOVE_COST_MULT,
  FRIENDLY_Q_MAX,
  GAME_SEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  NODE_COUNTS,
  NODE_MIN_SPACING,
  NEUTRAL_Q_MAX,
  RIVER_DRIFT_OPTIONS,
  RIVER_END_Q_MAX,
  RIVER_EXCURSION_PROB,
  RIVER_MAX_TILES,
  RIVER_START_Q_MIN,
} from "../config/GameConfig";
import type { BuildingType, NodeType, Owner } from "../config/GameConfig";
import { hexDistance } from "./hexMath";
import { randomInt, randomSeeded, randomShuffle } from "../../engine/utils/random";

export interface Tile {
  q: number;
  r: number;
  owner: Owner;
  river: boolean;
  node: NodeType | null;
  isVictory: boolean;
  commandCenter: boolean;
  building: BuildingRef | null;
  underConstruction: boolean;
}

export interface BuildingRef {
  type: BuildingType;
  id: string;
}

/** Six axial neighbor directions (pointy-top). */
const NEIGHBOR_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export type HexTapPayload = { q: number; r: number };

export class HexGrid {
  public readonly width: number;
  public readonly height: number;
  private readonly tiles = new Map<string, Tile>();
  private matchSeed = "";

  constructor(width: number = MAP_WIDTH, height: number = MAP_HEIGHT) {
    this.width = width;
    this.height = height;
  }

  public getMatchSeed(): string {
    return this.matchSeed;
  }

  /** Generate the match-start state: owners, river, resource nodes, victory hexes. */
  public initMatch(seed: string = GAME_SEED): void {
    this.matchSeed = seed;
    this.tiles.clear();
    this.generateOwners();
    this.generateRiver(seed);
    this.placeVictoryHexes();
    this.placeResourceNodes(seed);
  }

  /** Owner banding by column q per config thresholds. */
  private generateOwners(): void {
    for (let r = 0; r < this.height; r++) {
      for (let q = 0; q < this.width; q++) {
        const owner: Owner =
          q <= FRIENDLY_Q_MAX
            ? "friendly"
            : q <= NEUTRAL_Q_MAX
              ? "neutral"
              : "enemy";
        this.tiles.set(this.key(q, r), {
          q,
          r,
          owner,
          river: false,
          node: null,
          isVictory: false,
          commandCenter: false,
          building: null,
          underConstruction: false,
        });
      }
    }
  }

  /**
   * Procedural winding river path from left-neutral column to right-neutral
   * column. Clears any existing river tiles first to ensure idempotency.
   */
  private generateRiver(seed: string): void {
    const random = randomSeeded(seed);

    // Clear previous river.
    this.forEach((tile) => {
      tile.river = false;
    });

    const startR = randomInt(1, this.height - 2, random);
    let q = RIVER_START_Q_MIN;
    let r = startR;
    let placed = 0;

    while (placed < RIVER_MAX_TILES && q <= RIVER_END_Q_MAX) {
      if (this.inBounds(q, r)) {
        const tile = this.get(q, r);
        if (tile) {
          tile.river = true;
          placed++;
        }
      }

      // Step to next column.
      q++;

      // Drift r.
      const drift = RIVER_DRIFT_OPTIONS[randomInt(0, 2, random)];
      r = Math.max(0, Math.min(this.height - 1, r + drift));

      // Rare excursion into adjacent friendly/enemy column.
      if (random() < RIVER_EXCURSION_PROB) {
        const excursionDq = random() < 0.5 ? -1 : 1;
        const excursionQ = q + excursionDq;
        if (this.inBounds(excursionQ, r)) {
          const excursionTile = this.get(excursionQ, r);
          if (excursionTile) {
            excursionTile.river = true;
            placed++;
          }
        }
      }
    }
  }

  /**
   * Place one victory hex per faction in the back column, off the river if
   * possible. Friendly back column q=0, enemy back column q=width-1.
   */
  private placeVictoryHexes(): void {
    this.placeVictory(0, "friendly");
    this.placeVictory(this.width - 1, "enemy");
  }

  private placeVictory(col: number, owner: Owner): void {
    const midR = Math.floor(this.height / 2);
    const candidates = [midR, midR - 1, midR + 1, midR - 2, midR + 2].filter(
      (r) => r >= 0 && r < this.height,
    );

    const preferred = candidates.find((r) => {
      const t = this.get(col, r);
      return t && !t.river;
    });
    const chosen = preferred ?? candidates[0];

    const tile = this.get(col, chosen);
    if (tile) {
      tile.isVictory = true;
      tile.owner = owner;
      tile.node = null;
    }
  }

  /**
   * Place resource nodes using per-match seed for reproducibility.
   * Balanced regional allocation: candidates per region proportional to
   * non-victory tile count, min hex distance >= NODE_MIN_SPACING.
   */
  private placeResourceNodes(seed: string): void {
    const random = randomSeeded(seed);

    const regions: Owner[] = ["friendly", "neutral", "enemy"];
    const regionTiles: Record<Owner, Tile[]> = {
      friendly: [],
      neutral: [],
      enemy: [],
    };

    this.forEach((tile) => {
      if (!tile.isVictory) {
        regionTiles[tile.owner].push(tile);
      }
    });

    const totalNodes = Object.values(NODE_COUNTS).reduce((a, b) => a + b, 0);
    const totalNonVictory = Object.values(regionTiles).reduce((a, b) => a + b.length, 0);

    // Compute per-region node counts proportional to region size.
    const regionNodeCounts: Record<Owner, number> = { friendly: 0, neutral: 0, enemy: 0 };
    let allocated = 0;
    for (const region of regions) {
      const ratio = totalNonVictory > 0 ? regionTiles[region].length / totalNonVictory : 1 / 3;
      regionNodeCounts[region] = Math.round(ratio * totalNodes);
      allocated += regionNodeCounts[region];
    }

    // Adjust rounding error into neutral.
    regionNodeCounts.neutral += totalNodes - allocated;

    // Build a global shuffled pool of node types.
    const nodePool: NodeType[] = [];
    for (const type of Object.keys(NODE_COUNTS) as NodeType[]) {
      for (let i = 0; i < NODE_COUNTS[type]; i++) {
        nodePool.push(type);
      }
    }
    randomShuffle(nodePool, random);

    let poolIdx = 0;
    const placed: { q: number; r: number }[] = [];

    for (const region of regions) {
      const candidates = [...regionTiles[region]];
      randomShuffle(candidates, random);
      let count = regionNodeCounts[region];

      for (const tile of candidates) {
        if (count <= 0) break;

        // Enforce minimum spacing.
        const tooClose = placed.some(
          (p) => hexDistance(tile.q, tile.r, p.q, p.r) < NODE_MIN_SPACING,
        );
        if (tooClose) continue;

        tile.node = nodePool[poolIdx++] ?? "town";
        placed.push({ q: tile.q, r: tile.r });
        count--;
      }
    }
  }

  public key(q: number, r: number): string {
    return `${q},${r}`;
  }

  public get(q: number, r: number): Tile | undefined {
    return this.tiles.get(this.key(q, r));
  }

  public inBounds(q: number, r: number): boolean {
    return q >= 0 && q < this.width && r >= 0 && r < this.height;
  }

  /** Return in-bounds neighbor tiles. */
  public neighbors(q: number, r: number): Tile[] {
    const result: Tile[] = [];
    for (const [dq, dr] of NEIGHBOR_DIRS) {
      const tile = this.get(q + dq, r + dr);
      if (tile) result.push(tile);
    }
    return result;
  }

  /**
   * Count neighbors owned by the opposing faction (foundation for the RPD
   * border-pressure mechanic). Returns 0 for neutral tiles.
   */
  public borderPressureCount(q: number, r: number): number {
    const tile = this.get(q, r);
    if (!tile || tile.owner === "neutral") return 0;

    const opposing: Owner = tile.owner === "friendly" ? "enemy" : "friendly";
    return this.neighbors(q, r).filter((n) => n.owner === opposing).length;
  }

  /** Movement cost for entering a hex: 1 for friendly/neutral, ENEMY_HEX_MOVE_COST_MULT for enemy. */
  public getMovementCost(q: number, r: number): number {
    const tile = this.get(q, r);
    if (!tile) return ENEMY_HEX_MOVE_COST_MULT;
    return tile.owner === "enemy" ? ENEMY_HEX_MOVE_COST_MULT : 1;
  }

  /** Set a tile's owner and return the tile. */
  public setTileOwner(q: number, r: number, owner: Owner): Tile | undefined {
    const tile = this.get(q, r);
    if (tile) tile.owner = owner;
    return tile;
  }

  /** Set command-center flag on a tile. */
  public setCommandCenter(q: number, r: number, value: boolean): Tile | undefined {
    const tile = this.get(q, r);
    if (tile) tile.commandCenter = value;
    return tile;
  }

  /** Set under-construction flag on a tile. */
  public setUnderConstruction(q: number, r: number, value: boolean): Tile | undefined {
    const tile = this.get(q, r);
    if (tile) tile.underConstruction = value;
    return tile;
  }

  /** Set the building reference on a tile. */
  public setBuilding(q: number, r: number, ref: BuildingRef | null): Tile | undefined {
    const tile = this.get(q, r);
    if (tile) tile.building = ref;
    return tile;
  }

  public forEach(cb: (tile: Tile) => void): void {
    this.tiles.forEach(cb);
  }

  /** Find the victory hex for a given owner faction, or null. */
  public getVictoryHex(owner: Owner): { q: number; r: number } | null {
    for (const tile of this.tiles.values()) {
      if (tile.isVictory && tile.owner === owner) {
        return { q: tile.q, r: tile.r };
      }
    }
    return null;
  }
}
