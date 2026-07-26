/**
 * config.js — every tunable number lives here.
 *
 * If you want to change how the game feels, this is almost always
 * the only file you need to touch.
 */

export const BOARD_SIZE = 8;
export const TRAY_SLOTS = 3;
export const HINTS_PER_GAME = 3;

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
};

export const TIMING = {
  clearStagger: 24,   // ms between each block popping in a cleared line
  ghostLife: 560,     // how long a clearing block's ghost lives
  shardLife: 1100,    // max lifetime of a flying shard
  placeStagger: 22,   // ms between blocks popping in when you place a piece
  boardSyncDelay: 60, // delay before the real cells are hidden behind the fx
  hintDuration: 3200, // how long a hint stays lit up
  shakeDuration: 460,
};

export const FX = {
  shardsPerCell: 4,   // lower this if it ever feels sluggish on an old phone
  dragLift: 70,       // px the dragged piece floats above your finger
};

/** Labels shown for multi-line clears. */
export const LINE_NAMES = {
  2: "Double!",
  3: "Triple!",
  4: "Quad!",
  5: "INSANE!",
};

export const STORAGE_KEY = "blockdrop-best";
