/**
 * config.js — every tunable number lives here.
 *
 * If you want to change how the game feels, this is almost always
 * the only file you need to touch.
 */

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
 *   linesToReach     total lines cleared needed to arrive at this level
 *   maxPieceDifficulty  hardest shape that may appear (see pieces.js)
 *   hardBias         0 = all allowed shapes equally likely,
 *                    higher = the awkward ones show up more often
 *   multiplier       every point you earn is scaled by this
 *   guaranteeFit     regenerate the tray until at least one piece fits
 *
 * Early levels hand you friendly little shapes and pay less; later levels
 * throw 3×3 blocks and S-pieces at you and pay a lot more.
 */
export const LEVELS = [
  { level: 1,  linesToReach: 0,   maxPieceDifficulty: 2,  hardBias: 0.0, multiplier: 0.6, guaranteeFit: true },
  { level: 2,  linesToReach: 4,   maxPieceDifficulty: 3,  hardBias: 0.1, multiplier: 0.8, guaranteeFit: true },
  { level: 3,  linesToReach: 10,  maxPieceDifficulty: 4,  hardBias: 0.2, multiplier: 1.0, guaranteeFit: true },
  { level: 4,  linesToReach: 18,  maxPieceDifficulty: 5,  hardBias: 0.3, multiplier: 1.25, guaranteeFit: false },
  { level: 5,  linesToReach: 28,  maxPieceDifficulty: 6,  hardBias: 0.4, multiplier: 1.5, guaranteeFit: false },
  { level: 6,  linesToReach: 40,  maxPieceDifficulty: 7,  hardBias: 0.5, multiplier: 1.8, guaranteeFit: false },
  { level: 7,  linesToReach: 54,  maxPieceDifficulty: 8,  hardBias: 0.6, multiplier: 2.2, guaranteeFit: false },
  { level: 8,  linesToReach: 70,  maxPieceDifficulty: 9,  hardBias: 0.75, multiplier: 2.6, guaranteeFit: false },
  { level: 9,  linesToReach: 88,  maxPieceDifficulty: 10, hardBias: 0.9, multiplier: 3.0, guaranteeFit: false },
  { level: 10, linesToReach: 108, maxPieceDifficulty: 10, hardBias: 1.2, multiplier: 3.5, guaranteeFit: false },
];

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
