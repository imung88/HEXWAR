/**
 * HexGrid - logic-only axial hex grid (the RPD HexGrid module seed).
 *
 * Holds tile state (owner, river, resource node, victory flag), neighbor
 * queries, and match-start generation (owner banding, diagonal river, seeded
 * resource-node placement, victory hexes). No PixiJS dependency.
 */

import {
  FRIENDLY_Q_MAX,
  GAME_SEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  NODE_COUNTS,
  NEUTRAL_Q_MAX,
  RIVER_HALF_WIDTH,
} from "../config/GameConfig";
import type { NodeType, Owner } from "../config/GameConfig";
import { randomSeeded, randomShuffle } from "../../engine/utils/random";

export interface Tile {
  q: number;
  r: number;
  owner: Owner;
  river: boolean;
  node: NodeType | null;
  isVictory: boolean;
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

  constructor(width: number = MAP_WIDTH, height: number = MAP_HEIGHT) {
    this.width = width;
    this.height = height;
  }

  /** Generate the match-start state: owners, river, resource nodes, victory hexes. */
  public initMatch(): void {
    this.tiles.clear();
    this.generateOwners();
    this.generateRiver();
    this.placeVictoryHexes();
    this.placeResourceNodes();
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
        });
      }
    }
  }

  /** Diagonal river band: tiles where |q - r| <= RIVER_HALF_WIDTH. */
  private generateRiver(): void {
    this.forEach((tile) => {
      if (Math.abs(tile.q - tile.r) <= RIVER_HALF_WIDTH) {
        tile.river = true;
      }
    });
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

    // Prefer non-river tiles.
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
   * Place resource nodes using seeded RNG for reproducibility.
   * Candidates exclude victory hexes; one node per tile, spread across
   * friendly/neutral/enemy controlled hexes.
   */
  private placeResourceNodes(): void {
    const random = randomSeeded(GAME_SEED);

    const candidates: Tile[] = [];
    this.forEach((tile) => {
      if (!tile.isVictory) candidates.push(tile);
    });
    randomShuffle(candidates, random);

    let idx = 0;
    (Object.keys(NODE_COUNTS) as NodeType[]).forEach((type) => {
      let remaining = NODE_COUNTS[type];
      while (remaining > 0 && idx < candidates.length) {
        const tile = candidates[idx++];
        if (!tile) break;
        // Skip river-adjacent clash: allow nodes on river tiles too (RPD doesn't forbid).
        tile.node = type;
        remaining--;
      }
    });
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

  /** Set a tile's owner and return the tile (used by later gameplay modules). */
  public setTileOwner(q: number, r: number, owner: Owner): Tile | undefined {
    const tile = this.get(q, r);
    if (tile) tile.owner = owner;
    return tile;
  }

  public forEach(cb: (tile: Tile) => void): void {
    this.tiles.forEach(cb);
  }
}
