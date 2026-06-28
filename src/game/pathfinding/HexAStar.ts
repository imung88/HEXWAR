/**
 * HexAStar - hex-adapted A* pathfinding.
 *
 * Pure logic, no PixiJS dependency. Movement cost is 1 per friendly/neutral
 * hex and ENEMY_HEX_MOVE_COST_MULT for enemy hexes. Heuristic uses
 * hexDistance (admissible).
 */

import type { HexGrid } from "../hex/HexGrid";
import { hexDistance } from "../hex/hexMath";

interface AStarNode {
  q: number;
  r: number;
  g: number;
  f: number;
  parent: AStarNode | null;
}

function key(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Find the shortest path from (startQ, startR) to (goalQ, goalR) on the hex
 * grid. Returns the path as an array of {q,r} from start to goal (inclusive),
 * or null if no path exists.
 */
export function findPath(
  grid: HexGrid,
  startQ: number,
  startR: number,
  goalQ: number,
  goalR: number,
): { q: number; r: number }[] | null {
  const openSet = new Map<string, AStarNode>();
  const closedSet = new Set<string>();

  const startKey = key(startQ, startR);
  const goalKey = key(goalQ, goalR);

  const startNode: AStarNode = {
    q: startQ,
    r: startR,
    g: 0,
    f: hexDistance(startQ, startR, goalQ, goalR),
    parent: null,
  };
  openSet.set(startKey, startNode);

  while (openSet.size > 0) {
    // Find node with lowest f in open set.
    let current: AStarNode | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node;
      }
    }
    if (!current) break;

    const currentKey = key(current.q, current.r);
    if (currentKey === goalKey) {
      return reconstructPath(current);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of grid.neighbors(current.q, current.r)) {
      const nKey = key(neighbor.q, neighbor.r);
      if (closedSet.has(nKey)) continue;

      const moveCost = grid.getMovementCost(neighbor.q, neighbor.r);
      const tentativeG = current.g + moveCost;

      const existing = openSet.get(nKey);
      if (existing && tentativeG >= existing.g) continue;

      const node: AStarNode = {
        q: neighbor.q,
        r: neighbor.r,
        g: tentativeG,
        f: tentativeG + hexDistance(neighbor.q, neighbor.r, goalQ, goalR),
        parent: current,
      };
      openSet.set(nKey, node);
    }
  }

  return null;
}

function reconstructPath(node: AStarNode): { q: number; r: number }[] {
  const path: { q: number; r: number }[] = [];
  let current: AStarNode | null = node;
  while (current) {
    path.push({ q: current.q, r: current.r });
    current = current.parent;
  }
  path.reverse();
  return path;
}
