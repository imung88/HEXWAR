/**
 * Hexwar single tuning file.
 *
 * All numeric knobs live here so they can be adjusted without touching logic.
 */

/** Pixel radius of a single hex (center to vertex). */
export const HEX_SIZE = 40;

/** Hex map dimensions in axial coordinates (rhombus layout). */
export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 10;

/** Reproducible seed for match-start resource node placement. */
export const GAME_SEED = "hexwar-demo";

/** Economy tick interval in milliseconds (placeholder for GameController). */
export const TICK_MS = 1000;

export type Owner = "friendly" | "neutral" | "enemy";

export type NodeType = "town" | "city" | "oilField";

/** Tile owner fill colors. */
export const OWNER_COLORS: Record<Owner, number> = {
  friendly: 0x4a90e2,
  enemy: 0xe25555,
  neutral: 0x888888,
};

/** River overlay tint. */
export const RIVER_COLOR = 0x2a6fb5;

/** Victory hex border color. */
export const VICTORY_BORDER_COLOR = 0xffd24a;

/** Resource node marker colors. */
export const NODE_COLORS: Record<NodeType, number> = {
  town: 0x8fd14f,
  city: 0xf5c542,
  oilField: 0x666666,
};

/**
 * Owner banding thresholds (columns q).
 * - q <= FRIENDLY_Q_MAX            => friendly
 * - FRIENDLY_Q_MAX < q <= NEUTRAL_Q_MAX => neutral
 * - q > NEUTRAL_Q_MAX              => enemy
 *
 * With MAP_WIDTH = 15: friendly q 0..4 (5 cols), enemy q 11..14 (4 cols).
 * Tune so friendly/enemy counts are equal.
 */
export const FRIENDLY_Q_MAX = 4;
export const NEUTRAL_Q_MAX = 10;

/** River band half-width. River tiles satisfy |q - r| <= RIVER_HALF_WIDTH. */
export const RIVER_HALF_WIDTH = 1;

/** Number of each resource node type to place at match start. */
export const NODE_COUNTS: Record<NodeType, number> = {
  town: 4,
  city: 2,
  oilField: 4,
};

/** Per-tick income produced by each resource node type (RPD: town=small gold, city=large gold, oilField=medium oil). */
export const NODE_INCOME: Record<NodeType, { gold: number; oil: number }> = {
  town: { gold: 5, oil: 0 },
  city: { gold: 15, oil: 0 },
  oilField: { gold: 0, oil: 8 },
};

/** Per-tick income from a victory hex (RPD: very low gold + very low oil). */
export const VICTORY_INCOME = { gold: 1, oil: 1 };

/**
 * Border-pressure resource reduction (RPD).
 * Lookup by enemy-neighbor count via `borderPressureCount`; entries below the
 * threshold yield no reduction. Built as a list so the same helper can later
 * reduce spawn cadence uniformly.
 */
export const BORDER_PRESSURE_REDUCTION: ReadonlyArray<{
  neighbors: number;
  multiplier: number;
}> = [
  { neighbors: 3, multiplier: 0.8 }, // -20%
  { neighbors: 4, multiplier: 0.7 }, // -30%
  { neighbors: 5, multiplier: 0.5 }, // -50%
];

/** Starting resources per faction at match start. */
export const STARTING_RESOURCES = { gold: 200, oil: 100 };

/** UI colors shared across top bar, tooltip, legend. */
export const UI_COLORS = {
  panelBg: 0x1a1a1a,
  panelBorder: 0x3a3a3a,
  textPrimary: 0xffffff,
  textSecondary: 0xbbbbbb,
  gold: 0xf5c542,
  oil: 0x666666,
  selectionRing: 0xffff00,
  hoverRing: 0xffffff,
  friendly: 0x4a90e2,
  enemy: 0xe25555,
  neutral: 0x888888,
};

/** Name of the runtime-installed bitmap font used for HUD text. */
export const HUD_FONT_NAME = "HexwarHUD";
