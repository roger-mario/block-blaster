/**
 * scoring.js — every point the game hands out is calculated here.
 *
 * Pure functions only: give them numbers, get numbers back. No board, no
 * DOM, no state. That keeps the reward curve in one readable place and
 * makes it trivial to test.
 *
 * The shape of the reward system:
 *
 *   placing a piece   small, guaranteed, keeps something happening
 *   clearing lines    lines² — so a double is worth far more than 2×
 *   combos            +50% per consecutive clearing move, capped
 *   cross clear       a row and a column in the same move
 *   perfect clear     you emptied the entire board
 *   flawless tray     all three pieces of one tray each cleared a line
 *   level up          a lump sum scaled by the level you reached
 *
 * Everything above is finally multiplied by the level multiplier, so the
 * same move is worth ~6× more at level 10 than at level 1 — and again by
 * `boost`, which is 2 while the 🃏 Joker is running and 1 the rest of the
 * time. Every function here takes it, because a bonus the Joker didn't
 * double would just look like a bug.
 *
 * The boost is applied *after* rounding, deliberately. Fold it in before
 * and a 1-cell placement at level 1 is round(0.6) = 1 either way — the
 * button says "double points" and the score doesn't move. Multiplying the
 * rounded number means doubled is exactly doubled, every time.
 */

import { SCORING, BONUS_NAMES } from "./config.js";
import { multiplierFor } from "./difficulty.js";

/** How much a combo streak inflates a clear. Step 1 = no bonus. */
export function comboMultiplier(comboStep) {
  const step = Math.min(Math.max(comboStep || 1, 1), SCORING.maxComboStep);
  return 1 + SCORING.comboBonusPerStep * (step - 1);
}

/** Points for dropping a piece, before anything clears. */
export function placementPoints(cellCount, level = 1, boost = 1) {
  return Math.round(cellCount * SCORING.pointsPerCell * multiplierFor(level)) * boost;
}

/**
 * Points for the lines a move takes out.
 * `lines` is rows + cols; squaring it is what makes multi-clears exciting.
 */
export function clearPoints(lines, comboStep = 1, level = 1, boost = 1) {
  if (!lines || lines <= 0) return 0;
  const base = SCORING.pointsPerLine * lines * lines;
  return Math.round(base * comboMultiplier(comboStep) * multiplierFor(level)) * boost;
}

/**
 * The extra rewards a single clearing move can trigger.
 *
 * @param {{rows: number[], cols: number[], boardEmpty: boolean, flawlessTray: boolean, level: number, boost: number}} ctx
 * @returns {{type: string, label: string, points: number}[]}
 */
export function clearBonuses({
  rows = [],
  cols = [],
  boardEmpty = false,
  flawlessTray = false,
  level = 1,
  boost = 1,
}) {
  const mult = multiplierFor(level);
  const scale = (points) => Math.round(points * mult) * boost;
  const bonuses = [];

  if (rows.length > 0 && cols.length > 0) {
    bonuses.push({
      type: "cross",
      label: BONUS_NAMES.cross,
      points: scale(SCORING.crossClearBonus),
    });
  }

  if (boardEmpty) {
    bonuses.push({
      type: "perfect",
      label: BONUS_NAMES.perfect,
      points: scale(SCORING.perfectClearBonus),
    });
  }

  if (flawlessTray) {
    bonuses.push({
      type: "flawlessTray",
      label: BONUS_NAMES.flawlessTray,
      points: scale(SCORING.flawlessTrayBonus),
    });
  }

  return bonuses;
}

/** The lump sum for reaching a new level. */
export function levelUpBonus(newLevel, boost = 1) {
  return Math.round(SCORING.levelUpBonus * newLevel) * boost;
}
