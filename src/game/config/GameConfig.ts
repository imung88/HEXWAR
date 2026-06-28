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

export interface ResourceCost {
  gold: number;
  oil: number;
}

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

// ---------------------------------------------------------------------------
// River procedural params (M3)
// ---------------------------------------------------------------------------

/** River path starts/ends in neutral band columns [RIVER_START_Q_MIN, RIVER_END_Q_MAX]. */
export const RIVER_START_Q_MIN = 5;
export const RIVER_END_Q_MAX = 10;

/** r drift per step: one of {-1, 0, +1}. */
export const RIVER_DRIFT_OPTIONS: readonly [-1, 0, 1] = [-1, 0, 1];

/** Probability of an excursion into an adjacent (friendly/enemy) column. */
export const RIVER_EXCURSION_PROB = 0.1;

/** Maximum number of river tiles. */
export const RIVER_MAX_TILES = 14;

// ---------------------------------------------------------------------------
// Resource node params (M3)
// ---------------------------------------------------------------------------

/** Minimum hex distance between any two resource nodes. */
export const NODE_MIN_SPACING = 2;

// ---------------------------------------------------------------------------
// Combat
export const COMBAT_RANDOM_RANGE = 2;           // +/- damage variance
export const COMBAT_INITIATIVE_ORDER = "attack";   // attacker strikes first
export const MIN_DAMAGE = 1;                     // floor for damage

// ---------------------------------------------------------------------------
// Unit configs (M4)
// ---------------------------------------------------------------------------

export type UnitType = "infantry" | "tank" | "artillery";

export interface UnitConfig {
  label: string;
  maxHp: number;
  attack: number;
  defense: number;
  movement: number;
  vision: number;
  color: number;
}

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  infantry: {
    label: "Infantry",
    maxHp: 30,
    attack: 5,
    defense: 2,
    movement: 3,
    vision: 2,
    color: 0x55aa55,
  },
  tank: {
    label: "Tank",
    maxHp: 80,
    attack: 12,
    defense: 6,
    movement: 2,
    vision: 3,
    color: 0x8888cc,
  },
  artillery: {
    label: "Artillery",
    maxHp: 40,
    attack: 15,
    defense: 1,
    movement: 1,
    vision: 4,
    color: 0xcc5555,
  },
};

/** Maximum units allowed on a single hex. */
export const MAX_UNITS_PER_HEX = 10;

/** Global cap per faction. */
export const MAX_UNITS_PER_FACTION = 50;

/** Movement cost multiplier when entering an enemy hex. */
export const ENEMY_HEX_MOVE_COST_MULT = 2;

/** Cadence (ms) for a victory CC auto-spawning infantry. */
export const VICTORY_CC_CADENCE_MS = 60000;

// ---------------------------------------------------------------------------
// Building configs (M3)
// ---------------------------------------------------------------------------

export type SpawnSpeed = "off" | "low" | "high";

export type BuildingType = "commandCenter" | "infantryBarracks" | "tankDivision" | "artilleryDivision";

export interface BuildingTypeConfig {
  label: string;
  cost: ResourceCost;
  maintenanceLow: ResourceCost;
  maintenanceHigh: ResourceCost;
  buildTimeMs: number;
  cooldownMs: number;
  maxHp: number;
  /** Spawn cadence at "low" speed (ms). Infinity = does not spawn. */
  cadenceLowMs: number;
  /** Spawn cadence at "high" speed (ms). Infinity = does not spawn. */
  cadenceHighMs: number;
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  commandCenter: {
    label: "Command Center",
    cost: { gold: 100, oil: 0 },
    maintenanceLow: { gold: 0, oil: 0 },
    maintenanceHigh: { gold: 0, oil: 0 },
    buildTimeMs: 5000,
    cooldownMs: 15000,
    maxHp: 200,
    cadenceLowMs: Infinity,
    cadenceHighMs: Infinity,
  },
  infantryBarracks: {
    label: "Infantry Barracks",
    cost: { gold: 50, oil: 0 },
    maintenanceLow: { gold: 3, oil: 0 },
    maintenanceHigh: { gold: 6, oil: 0 },
    buildTimeMs: 0,
    cooldownMs: 0,
    maxHp: 100,
    cadenceLowMs: 20000,
    cadenceHighMs: 10000,
  },
  tankDivision: {
    label: "Tank Division",
    cost: { gold: 80, oil: 20 },
    maintenanceLow: { gold: 4, oil: 2 },
    maintenanceHigh: { gold: 8, oil: 4 },
    buildTimeMs: 0,
    cooldownMs: 0,
    maxHp: 120,
    cadenceLowMs: 40000,
    cadenceHighMs: 20000,
  },
  artilleryDivision: {
    label: "Artillery Division",
    cost: { gold: 70, oil: 15 },
    maintenanceLow: { gold: 3, oil: 3 },
    maintenanceHigh: { gold: 6, oil: 6 },
    buildTimeMs: 0,
    cooldownMs: 0,
    maxHp: 80,
    cadenceLowMs: 50000,
    cadenceHighMs: 25000,
  },
};

/** Building icon sizes (radius in px) for rendering. */
export const BUILDING_ICON_SIZES = {
  ccGlyphRadius: 0.22,
  spawnBuildingGlyphRadius: 0.18,
};

/** Spawn-speed multiplier lookup: speed → maintenance multiplier applied to maintenanceLow. */
export const SPAWN_SPEED_MULTIPLIER: Record<SpawnSpeed, number> = {
  off: 0,
  low: 1,
  high: 2,
};

// ---------------------------------------------------------------------------
// Building / construction visual colors (M3)
// ---------------------------------------------------------------------------

export const BUILDING_COLORS: Record<string, number> = {
  commandCenter: 0xffd700,
  infantryBarracks: 0x55aa55,
  tankDivision: 0x8888cc,
  artilleryDivision: 0xcc5555,
  underConstruction: 0xffffff,
};
