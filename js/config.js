/**
 * config.js — every tunable number lives here.
 *
 * If you want to change how the game feels, this is almost always
 * the only file you need to touch.
 */

/** Shown in the menu. Bump it whenever you ship — and add a CHANGELOG entry. */
export const APP_VERSION = "0.4.1";

/**
 * The look — palette, block shape, block surface and scenery, all at once.
 *
 * It used to rotate on the calendar, every three days. That was the wrong
 * hook: it changes when you *aren't* playing, so you never see it happen,
 * and it has nothing to do with how well you're doing. Now a look is
 * earned. It advances on two events and only those:
 *
 *   levelling up
 *   clearing the whole board
 *
 * Both are moments you already feel; the look change is the reward
 * attached to them. See js/looks.js.
 */
export const LOOKS = {
  noticeMs: 2600,   // how long the "new look" pill stays up
  swapMs: 700,      // the cross-fade, and how long transitions stay enabled
};

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
    icon: "⏪",
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
    icon: "🧹",
    label: "Wipe",
    tip: "Sweep the whole board clean",
    minLevel: 5,
  },
  {
    id: "joker",
    icon: "🃏",
    label: "Joker",
    tip: "Double points, harder pieces",
    // An opening-only gamble: take the level-20 dealer early in exchange
    // for double score, and climb out of the slow levels faster. It stops
    // paying the moment you reach level 6, which is also when the button
    // disappears — so it can't be used to inflate a late-game score.
    maxLevel: 5,
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

  jokerBoost: 2,          // everything doubles while the 🃏 Joker is running
};

/**
 * Difficulty ladder, level 1 → 20.
 *
 * The rungs get further apart as you climb: 4 lines to reach level 2, but
 * 102 to get from 19 to 20. The first six levels are exactly where they
 * always were, so the opening still feels quick — everything past that is
 * where the extra 10 levels went.
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
  { level: 1,  linesToReach: 0,    multiplier: 0.6,   clearChance: 0.90, guaranteeFit: true },
  { level: 2,  linesToReach: 4,    multiplier: 0.8,   clearChance: 0.85, guaranteeFit: true },
  { level: 3,  linesToReach: 10,   multiplier: 1.0,   clearChance: 0.80, guaranteeFit: true },
  { level: 4,  linesToReach: 18,   multiplier: 1.25,  clearChance: 0.74, guaranteeFit: true },
  { level: 5,  linesToReach: 28,   multiplier: 1.5,   clearChance: 0.68, guaranteeFit: true },
  { level: 6,  linesToReach: 40,   multiplier: 1.8,   clearChance: 0.62, guaranteeFit: true },
  { level: 7,  linesToReach: 55,   multiplier: 2.1,   clearChance: 0.57, guaranteeFit: true },
  { level: 8,  linesToReach: 73,   multiplier: 2.4,   clearChance: 0.52, guaranteeFit: true },
  { level: 9,  linesToReach: 94,   multiplier: 2.8,   clearChance: 0.48, guaranteeFit: true },
  { level: 10, linesToReach: 119,  multiplier: 3.2,   clearChance: 0.44, guaranteeFit: true },
  { level: 11, linesToReach: 148,  multiplier: 3.6,   clearChance: 0.41, guaranteeFit: true },
  { level: 12, linesToReach: 182,  multiplier: 4.1,   clearChance: 0.38, guaranteeFit: true },
  { level: 13, linesToReach: 221,  multiplier: 4.6,   clearChance: 0.36, guaranteeFit: true },
  { level: 14, linesToReach: 266,  multiplier: 5.2,   clearChance: 0.34, guaranteeFit: true },
  { level: 15, linesToReach: 318,  multiplier: 5.8,   clearChance: 0.32, guaranteeFit: true },
  { level: 16, linesToReach: 378,  multiplier: 6.5,   clearChance: 0.30, guaranteeFit: true },
  { level: 17, linesToReach: 447,  multiplier: 7.2,   clearChance: 0.29, guaranteeFit: true },
  { level: 18, linesToReach: 526,  multiplier: 8.0,   clearChance: 0.28, guaranteeFit: true },
  { level: 19, linesToReach: 616,  multiplier: 8.8,   clearChance: 0.27, guaranteeFit: true },
  { level: 20, linesToReach: 718,  multiplier: 10.0,  clearChance: 0.25, guaranteeFit: true },
];

/**
 * How the tray is dealt — see `js/dealer/` and DEALER-STRATEGY.md.
 *
 * The premise: there are no easy or hard shapes, only shapes that are
 * easy or hard *on the board in front of you*. So the dealer scores every
 * unlocked shape against the grid you actually have, and difficulty is
 * how hard it works on your behalf — not which shapes it may reach for.
 */
export const DEALER = {
  // ---- the difficulty dial: how much the dealer helps you build ----
  generosityFloor: 0.12, // where generosity lands at the top of the ladder
  generosityCurve: 0.85, // <1 spends the drop early, >1 saves it for late
  biasStrength: 5,       // how hard full generosity leans toward helping you
  spiteStrength: 2.2,    // …and how much more gently it ever leans the other way
  flavourPull: 0.5,      // exponent on the pieces.js level curve: a nudge, not a rule

  // ---- the rescue dial: how often you're handed a way out ----
  rescuePower: 1.2,      // exponent on board pressure; lower = kinder sooner
  sequenceFloor: 0.55,   // odds the whole tray is guaranteed playable, at level 20
  repairTries: 6,        // alternatives tried per slot when repairing a stuck tray
  solveBudget: 4000,     // search nodes before the sequence check gives up and says yes

  // ---- challenge rounds: the level-20 dealer, visiting early ----
  // A challenge drags generosity down toward its floor and the rescue odds
  // down toward the top of the ladder's. What it never does is make a tray
  // unplayable: any tray dealt under challenge has its sequence guarantee
  // forced to certain, so it is always hard *and* always solvable.
  gauntletEvery: 20,        // trays between challenge rounds — one round = one tray
  gauntletChallenge: 1,     // how far a challenge round drags the dials down, 0 → 1
  jokerChallenge: 0.45,     // …and how far the Joker does, for as long as it runs
  challengeClearChance: 0.25, // the rescue odds a full challenge falls back to

  /**
   * How much of a challenge lands on the *rescue* dial rather than the
   * generosity one.
   *
   * Below 1 on purpose. A challenge round lasts one tray, so taking the
   * free rescue away with it is a fair spike. The Joker runs for dozens
   * of trays, and at full bite it doesn't make the opening harder — it
   * makes it *slower*, because you level up on lines cleared and it had
   * quietly halved how often you could clear one. Measured: 100 moves to
   * level 6 instead of 90, which is the exact opposite of the point.
   *
   * Difficulty belongs on the help dial. See DEALER-STRATEGY.md.
   */
  challengeRescueBite: 0.5,

  // ---- what the dealer values, once it's decided how much to help ----
  clearPull: 2.0,        // × per line a piece can finish right now
  multiPull: 2.5,        // extra for a piece that can take two lines at once
  sweepPull: 2.2,        // extra for finishing a line a whole-board clear needs
  perfectPull: 6,        // extra for a piece that can empty the board outright
  helpFloor: 0.35,       // clearing bonuses never fall below this, at any level
  crowdPenalty: 0.45,    // × weight for repeating a shape already in the tray
  flexibility: 0.12,     // how much "this piece has lots of homes" is worth
  flexibleAt: 24,        // …and how many placements counts as lots

  /**
   * Credit for the cells a piece actually puts down, per cell.
   *
   * Without this the dealer has a systematic bias toward the smallest
   * piece on offer, and it isn't a taste — it's an accounting error.
   * `health.room` measures how much space is left, so a 5-cell piece is
   * charged five cells of "damage" for doing five cells of work while a
   * single square is charged one. Comparing the two boards afterwards is
   * not comparing like with like.
   *
   * Set a little above `health.room` so the correction lands slightly on
   * the side of pieces that get something done — which is the whole point
   * of a game about completing lines.
   */
  substance: 1.35,

  // ---- reading a board (boardHealth) ----
  health: {
    room: 1.2,           // space left to work with
    concentration: 0.9,  // blocks gathered into lines that are nearly done
    contiguity: 0.7,     // empty space in one area rather than confetti
    hole: 0.09,          // per one-cell pocket — only a dot will ever fill it
    tiny: 0.05,          // per two- or three-cell pocket
  },
  sweepMaxLines: 4,      // a whole-board clear needing more lines than this isn't "in reach"
  healthProbes: 9,      // placements per shape measured properly rather than ranked cheaply
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
  shockwaveLife: 720, // expanding ring on a shockwave celebration
  cascadeLife: 900,   // blocks falling off the bottom of the board
  prismLife: 620,     // colour beams streaking along the line
  novaLife: 1000,     // collapse-then-detonate, the rarest one
  boardClearLife: 1400, // the whole-board celebration
  sceneryFade: 900,   // cross-fade when the background changes on level up
  emberLife: 1150,    // how long an ember drifts before it burns out
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
