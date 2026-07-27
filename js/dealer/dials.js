/**
 * dealer/dials.js — the two knobs difficulty actually turns.
 *
 * Difficulty is not "worse pieces". It's how hard the dealer works on
 * your behalf (generosity) and how often it hands you a way out (rescue).
 * They're kept apart on purpose: a late-game board should be hard to
 * *manage*, not hard to *escape*.
 *
 * DEALER-STRATEGY.md explains the reasoning; this file is the maths.
 */

import { DEALER } from "../config.js";
import { levelConfig, MIN_LEVEL, MAX_LEVEL } from "../difficulty.js";

/**
 * How much the dealer is on your side, 1 → 0.12 across the ladder.
 *
 * At 1 it hunts for the pieces that leave your board in the best shape.
 * At 0.5 it's indifferent and the level's flavour curve decides. Below
 * that it starts leaning the other way.
 */
export function generosity(level) {
  const clamped = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level || MIN_LEVEL)));
  const span = Math.max(1, MAX_LEVEL - MIN_LEVEL);
  const t = (clamped - MIN_LEVEL) / span;
  return 1 - (1 - DEALER.generosityFloor) * Math.pow(t, DEALER.generosityCurve);
}

/**
 * Generosity as an exponent on the board evaluation.
 *
 * Positive prefers the pieces that help; negative prefers the ones that
 * don't. The two halves are deliberately not symmetrical — leaning
 * *against* you is scaled far more gently, because in a game with no
 * rotation a dealer that always hands over the single worst piece isn't
 * difficult, it's a rigged deck. The asymmetry is a curve rather than a
 * clamp so the top five levels still differ from each other.
 */
export function evaluationBias(level) {
  const lean = 2 * generosity(level) - 1;
  return lean >= 0 ? DEALER.biasStrength * lean : DEALER.spiteStrength * lean;
}

/**
 * How often the tray is guaranteed to contain a piece that can finish a
 * line right now. The level's own odds, pushed toward certainty by how
 * full your board is.
 */
export function rescueChance(level, pressure) {
  const base = levelConfig(level).clearChance;
  const push = Math.pow(Math.min(1, Math.max(0, pressure)), DEALER.rescuePower);
  return base + (1 - base) * push;
}

/**
 * How often the tray is guaranteed to be playable all the way through in
 * some order. Certain early; at the top of the ladder the risk that a
 * tray boxes you in is part of the difficulty — though the separate
 * "something fits" floor still means you're never handed a dead hand.
 */
export function sequenceGuarantee(level) {
  return DEALER.sequenceFloor + (1 - DEALER.sequenceFloor) * generosity(level);
}
