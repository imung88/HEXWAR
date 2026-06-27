/**
 * Border-pressure reduction helper (RPD mechanic).
 *
 * If a friendly hex is bordered by enemy hexes on multiple sides, its spawn and
 * resource gain are reduced. The reduction table lives in GameConfig so this
 * helper stays logic-only and is reused by both income and (later) spawn
 * cadence.
 */

import { BORDER_PRESSURE_REDUCTION } from "../config/GameConfig";

/**
 * Returns the resource/spawn multiplier (1 = no reduction) for a tile given the
 * number of opposing-faction neighbors it borders.
 *
 *   3 neighbors -> 0.8  (-20%)
 *   4 neighbors -> 0.7  (-30%)
 *   5 neighbors -> 0.5  (-50%)
 *   otherwise   -> 1.0  (no reduction)
 */
export function borderPressureMultiplier(enemyNeighborCount: number): number {
  for (const entry of BORDER_PRESSURE_REDUCTION) {
    if (enemyNeighborCount >= entry.neighbors) {
      return entry.multiplier;
    }
  }
  return 1;
}
