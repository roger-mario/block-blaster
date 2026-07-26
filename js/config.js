/**
 * config.js — every tunable number lives here.
 *
 * If you want to change how the game feels, this is almost always
 * the only file you need to touch.
 */

/** Shown in the menu. Bump it whenever you ship. */
export const APP_VERSION = "0.0.3";

export const BOARD_SIZE = 8;
export const TRAY_SLOTS = 3;

/**
 * Hints and undos share one budget. Spend all three on hints, all three
 * on undos, or mix them — it's the player's call.
 */
export const ASSISTS_PER_GAME = 3;

export const COLORS = [
  "#f28c40", // orange
  "#4da6f2", // blue
  "#73cc66", // green
  "#f26673", // red
  "#b380f2", // purple
  "#fac54d", // yellow
  "#59cccc", // teal
];

export const SCORING = {
  pointsPerCell: 1,       // for simply placing a block
  pointsPerLine: 10,      // multiplied by lines² so multi-clears pay off
  comboBonusPerStep: 0.5, // +50% for each consecutive clearing move
  maxComboStep: 10,       // combo multiplier stops growing past this

  // ----- the "interesting stuff" bonuses -----
  crossClearBonus: 40,    // a row and a column go in the same move
  perfectClearBonus: 300, // the whole board ends up empty
  flawlessTrayBonus: 150, // every piece in one tray cleared at least one line
  levelUpBonus: 50,       // × the level you just reached
};

/**
 * Difficulty ladder, level 1 → 10.
 *
 *   linesToReach  total lines cleared needed to arrive at this level
 *   multiplier    every point you earn is scaled by this
 *   clearChance   how often the tray is guaranteed to contain a piece that
 *                 can complete a line right now (before board pressure is
 *                 taken into account — see DEALER)
 *   guaranteeFit  never deal a tray where nothing fits at all
 *
 * *Which* shapes turn up is no longer decided here — each shape owns its
 * own appearance curve in pieces.js, so a shape can arrive at level 3,
 * peak at level 5 and fade away again by level 9.
 */
export const LEVELS = [
  { level: 1,  linesToReach: 0,   multiplier: 0.6,  clearChance: 0.90, guaranteeFit: true },
  { level: 2,  linesToReach: 4,   multiplier: 0.8,  clearChance: 0.85, guaranteeFit: true },
  { level: 3,  linesToReach: 10,  multiplier: 1.0,  clearChance: 0.80, guaranteeFit: true },
  { level: 4,  linesToReach: 18,  multiplier: 1.25, clearChance: 0.70, guaranteeFit: true },
  { level: 5,  linesToReach: 28,  multiplier: 1.5,  clearChance: 0.62, guaranteeFit: true },
  { level: 6,  linesToReach: 40,  multiplier: 1.8,  clearChance: 0.55, guaranteeFit: true },
  { level: 7,  linesToReach: 54,  multiplier: 2.2,  clearChance: 0.48, guaranteeFit: true },
  { level: 8,  linesToReach: 70,  multiplier: 2.6,  clearChance: 0.42, guaranteeFit: true },
  { level: 9,  linesToReach: 88,  multiplier: 3.0,  clearChance: 0.36, guaranteeFit: true },
  { level: 10, linesToReach: 108, multiplier: 3.5,  clearChance: 0.30, guaranteeFit: true },
];

/**
 * How the tray is dealt (see dealer.js).
 *
 * The dealer looks at the board you actually have, not just your level.
 * Two knobs matter most:
 *
 *   rescuePower  how hard a filling board pushes the odds of a
 *                line-clearing piece back up. At full pressure even
 *                level 10 nearly always offers you a way out.
 *   fitBoost     shapes that can be placed somewhere are preferred over
 *                shapes that can't fit anywhere at all.
 */
export const DEALER = {
  rescuePower: 1.5,     // exponent on board pressure; lower = kinder sooner
  fitBoost: 6,          // × weight for a shape that fits the current board
  clearBoost: 2.5,      // × weight again if it can finish a line right now
  crowdPenalty: 0.55,   // × weight for repeating a shape already in the tray
  maxDealAttempts: 12,
};

export const TIMING = {
  clearStagger: 24,   // ms between each block popping in a cleared line
  ghostLife: 560,     // how long a clearing block's ghost lives
  shardLife: 1100,    // max lifetime of a flying shard
  placeStagger: 22,   // ms between blocks popping in when you place a piece
  boardSyncDelay: 60, // delay before the real cells are hidden behind the fx
  hintDuration: 3200, // how long a hint stays lit up
  shakeDuration: 460,
  badgeGap: 900,      // ms between stacked bonus badges
};

export const FX = {
  shardsPerCell: 4,   // lower this if it ever feels sluggish on an old phone
  dragLift: 70,       // px the dragged piece floats above your finger
  tapSlop: 10,        // px of movement before a tap becomes a drag
  snapRadius: 2,      // how far a tap-to-place may search for a legal spot
};

/** Labels shown for multi-line clears. */
export const LINE_NAMES = {
  2: "Double!",
  3: "Triple!",
  4: "Quad!",
  5: "INSANE!",
};

/** Labels for the bonus events emitted by game.js. */
export const BONUS_NAMES = {
  cross: "CROSS CLEAR!",
  perfect: "PERFECT CLEAR!",
  flawlessTray: "FLAWLESS TRAY!",
  levelUp: "LEVEL UP!",
};

export const STORAGE_KEY = "blockdrop-best";
export const LEADERBOARD_KEY = "blockdrop-leaderboard";
export const PLAYER_KEY = "blockdrop-player";

/** How many entries the leaderboard keeps. */
export const LEADERBOARD_SIZE = 10;
