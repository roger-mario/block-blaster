/**
 * config.js — every tunable number lives here.
 *
 * If you want to change how the game feels, this is almost always
 * the only file you need to touch.
 */

/** Shown in the menu. Bump it whenever you ship — and add a CHANGELOG entry. */
export const APP_VERSION = "0.1.0";

export const BOARD_SIZE = 8;
export const TRAY_SLOTS = 3;

/**
 * Lifelines — three of them, one use each per game, in the spirit of the
 * quiz show. They are deliberately not interchangeable: two of them are
 * only unlocked for part of the ladder, so *when* you spend one matters
 * as much as which.
 *
 *   maxLevel  the lifeline stops being offered above this level
 *   minLevel  the lifeline is locked until this level
 *
 * The order here is the order they appear on screen.
 */
export const LIFELINES = [
  {
    id: "undo",
    icon: "↩",
    label: "Rewind",
    tip: "Take back your last move",
    maxLevel: 5,
  },
  {
    id: "shuffle",
    icon: "🔀",
    label: "Shuffle",
    tip: "Swap the pieces you were dealt",
  },
  {
    id: "wipe",
    icon: "💥",
    label: "Wipe",
    tip: "Sweep the whole board clean",
    minLevel: 5,
  },
];

/** Lifelines keyed by id, for the lookups game.js does. */
export const LIFELINE_BY_ID = Object.fromEntries(LIFELINES.map((l) => [l.id, l]));

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
  wipeStagger: 14,    // ms between blocks vanishing when the board is wiped
  tipDuration: 1700,  // how long a tapped lifeline shows its label
  shakeDuration: 460,
  badgeGap: 900,      // ms between stacked bonus badges
};

export const FX = {
  shardsPerCell: 4,   // lower this if it ever feels sluggish on an old phone

  // ----- drag feel -----
  // The piece has to clear your fingertip on a phone, but a mouse cursor
  // is a single point, so lifting it there just makes the piece float
  // away from the pointer for no reason.
  dragLift: 58,       // px above your finger (touch)
  dragLiftMouse: 0,   // px above the cursor (mouse / trackpad)
  tapSlop: 8,         // px of movement before a tap becomes a drag
  dragScale: 1.06,    // the piece swells slightly when you pick it up
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
export const PLAYER_ID_KEY = "blockdrop-player-id";

/** How many entries the leaderboard keeps. */
export const LEADERBOARD_SIZE = 10;

/**
 * The shared leaderboard.
 *
 * `endpoint` is a serverless route in this same project (api/scores.js), so
 * there's no cross-origin request and no key in the client. If it isn't
 * reachable — no database configured, offline, running off a file:// path —
 * the game silently falls back to the on-device board and carries on.
 */
export const LEADERBOARD_API = {
  endpoint: "/api/scores",
  timeoutMs: 4000,   // don't let a hanging request stall the game-over screen
  onlineSize: 25,    // how many rows the shared board shows
};
