/**
 * difficulty.js — the level 1 → 10 ladder.
 *
 * One idea, in one place: how far you've got decides both which shapes
 * you're handed and how much everything is worth.
 *
 * Progress is measured in *lines cleared*, not score — otherwise the
 * later multipliers would rocket you up the ladder without you actually
 * playing any better.
 *
 * This module is pure maths. It touches nothing else, which makes the
 * whole difficulty curve easy to re-tune and easy to test.
 */

import { LEVELS } from "./config.js";

export const MIN_LEVEL = LEVELS[0].level;
export const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

/** The tuning row for a level, clamped to the ends of the ladder. */
export function levelConfig(level) {
  const clamped = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level || MIN_LEVEL)));
  return LEVELS.find((l) => l.level === clamped) ?? LEVELS[0];
}

/** Which level you're on after clearing `linesCleared` lines in total. */
export function levelForLines(linesCleared) {
  let level = MIN_LEVEL;
  for (const row of LEVELS) {
    if (linesCleared >= row.linesToReach) level = row.level;
  }
  return level;
}

/** Everything you earn is scaled by this. */
export function multiplierFor(level) {
  return levelConfig(level).multiplier;
}

/**
 * How far through the current level you are, 0 → 1.
 * Level 10 is the end of the ladder, so it always reads as full.
 */
export function levelProgress(linesCleared) {
  const level = levelForLines(linesCleared);
  if (level >= MAX_LEVEL) return 1;

  const current = levelConfig(level).linesToReach;
  const next = levelConfig(level + 1).linesToReach;
  const span = next - current;
  if (span <= 0) return 1;

  return Math.min(1, Math.max(0, (linesCleared - current) / span));
}

/** Lines still needed before the next level. 0 once you're at level 10. */
export function linesToNextLevel(linesCleared) {
  const level = levelForLines(linesCleared);
  if (level >= MAX_LEVEL) return 0;
  return levelConfig(level + 1).linesToReach - linesCleared;
}
