/**
 * celebrations.js — which animation plays when a line goes.
 *
 * The catalogue and the choosing live here; the drawing lives in
 * effects.js, keyed by these ids. That split is the point of the whole
 * thing: adding a fourth celebration means one entry here and one `case`
 * there, and nothing else in the game has to know.
 *
 * Two rules shape the choice, both aimed at the same feeling:
 *
 *   escalation  a single line always gets the plain shatter. The louder
 *               animations are reserved for a double or better, so a big
 *               clear looks different from a small one rather than just
 *               bigger.
 *   rotation    consecutive big clears cycle through the eligible
 *               animations instead of repeating one. Variety you notice
 *               without ever wondering what triggered it.
 *
 * Pure functions — no DOM, no timers, no randomness. The rotation is a
 * counter, so a given sequence of clears always produces the same
 * sequence of animations, which is what makes it testable.
 */

/**
 * `minLines` is the smallest clear that may use this animation.
 * The order here is the order the rotation walks.
 */
export const CELEBRATIONS = [
  {
    id: "shatter",
    name: "Shatter",
    blurb: "Blocks flash white and break apart",
    minLines: 1,
  },
  {
    id: "shockwave",
    name: "Shockwave",
    blurb: "A ring blasts out and throws the blocks with it",
    minLines: 2,
  },
  {
    id: "ember",
    name: "Embers",
    blurb: "Blocks lift, turn and burn away upward",
    minLines: 2,
  },
  {
    id: "cascade",
    name: "Cascade",
    blurb: "The line gives way and falls, bouncing as it goes",
    minLines: 2,
  },
  // ---- reserved for a triple or better ----
  {
    id: "prism",
    name: "Prism",
    blurb: "Each block splits into a beam of its own colour",
    minLines: 3,
  },
  {
    id: "nova",
    name: "Nova",
    blurb: "The whole line collapses inward, then detonates",
    minLines: 3,
  },
];

/**
 * Category 2: emptying the entire board.
 *
 * The rarest thing in a normal game, so it gets the loudest animations —
 * and they are locked until BOARD_CLEAR_MIN_LEVEL. Clearing a nearly
 * empty board on level 1 isn't an achievement, and spending the best
 * animation on it would cheapen the real thing.
 */
export const BOARD_CLEAR_MIN_LEVEL = 2;

export const BOARD_CELEBRATIONS = [
  {
    id: "bloom",
    name: "Bloom",
    blurb: "Rings of light open out across the empty board",
  },
  {
    id: "starburst",
    name: "Starburst",
    blurb: "Rays fire out from the middle",
  },
  {
    id: "implode",
    name: "Implode",
    blurb: "Everything rushes to the centre, then bursts",
  },
];

export const DEFAULT_CELEBRATION = CELEBRATIONS[0];

export function celebrationById(id) {
  return CELEBRATIONS.find((c) => c.id === id) ?? null;
}

/** Everything allowed to play for a clear of this size. Never empty. */
export function eligibleFor(lines) {
  const count = Number.isFinite(lines) ? lines : 0;
  const allowed = CELEBRATIONS.filter((c) => count >= c.minLines);
  return allowed.length > 0 ? allowed : [DEFAULT_CELEBRATION];
}

/**
 * Picks the animation for this clear and returns the counter to use next
 * time. The caller owns the counter, so nothing in here is stateful.
 *
 * @param {number} lines    rows + columns going in this clear
 * @param {number} counter  how many clears have been celebrated so far
 * @returns {{celebration: object, nextCounter: number}}
 */
export function chooseCelebration(lines, counter = 0) {
  const allowed = eligibleFor(lines);
  const safe = Number.isFinite(counter) && counter >= 0 ? Math.floor(counter) : 0;

  return {
    celebration: allowed[safe % allowed.length],
    // Only advance when there was a real choice to make. Otherwise a run
    // of single-line clears would silently spin the counter and decide
    // which animation your next double gets.
    nextCounter: allowed.length > 1 ? safe + 1 : safe,
  };
}

/**
 * Whether a board clear is loud enough to celebrate yet.
 * Below the threshold the line-clear animation carries the moment alone.
 */
export function boardClearUnlocked(level) {
  const n = Number(level);
  return Number.isFinite(n) && n >= BOARD_CLEAR_MIN_LEVEL;
}

/**
 * Picks the board-clear animation, rotating the same way the line ones do.
 * Returns null below the unlock level, which the caller reads as "don't
 * play one".
 *
 * @returns {{celebration: object|null, nextCounter: number}}
 */
export function chooseBoardCelebration(level, counter = 0) {
  const safe = Number.isFinite(counter) && counter >= 0 ? Math.floor(counter) : 0;
  if (!boardClearUnlocked(level)) return { celebration: null, nextCounter: safe };

  return {
    celebration: BOARD_CELEBRATIONS[safe % BOARD_CELEBRATIONS.length],
    nextCounter: safe + 1,
  };
}

/**
 * How hard the screen shakes, 0–2. Kept here next to the choosing so the
 * whole "how big did that feel" question is answered in one file.
 */
export function shakeLevel(lines) {
  if (lines >= 3) return 2;
  if (lines >= 2) return 1;
  return 0;
}
