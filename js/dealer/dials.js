/**
 * dealer/dials.js — the two knobs difficulty actually turns.
 *
 * Difficulty is not "worse pieces". It's how hard the dealer works on
 * your behalf (generosity) and how often it hands you a way out (rescue).
 * They're kept apart on purpose: a late-game board should be hard to
 * *manage*, not hard to *escape*.
 *
 * Both knobs take a `challenge` from 0 to 1 on top of the level. A
 * challenge doesn't add a new kind of difficulty — it drags the level's
 * own dials down toward the top of the ladder, so a challenge round at
 * level 2 is simply the level-20 dealer paying an early visit. Two things
 * use it: the periodic challenge round, and the 🃏 Joker.
 *
 * What a challenge never does is make a tray unplayable — see
 * `sequenceGuarantee`. DEALER-STRATEGY.md explains the reasoning; this
 * file is the maths.
 */

import { DEALER } from "../config.js";
import { levelConfig, MIN_LEVEL, MAX_LEVEL } from "../difficulty.js";

const clamp01 = (n) => Math.min(1, Math.max(0, n || 0));

/**
 * How much the dealer is on your side, 1 → 0.12 across the ladder.
 *
 * At 1 it hunts for the pieces that leave your board in the best shape.
 * At 0.5 it's indifferent and the level's flavour curve decides. Below
 * that it starts leaning the other way.
 */
export function generosity(level, challenge = 0) {
  const clamped = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level || MIN_LEVEL)));
  const span = Math.max(1, MAX_LEVEL - MIN_LEVEL);
  const t = (clamped - MIN_LEVEL) / span;
  const base = 1 - (1 - DEALER.generosityFloor) * Math.pow(t, DEALER.generosityCurve);

  // a challenge pulls generosity the rest of the way toward the floor
  return base - clamp01(challenge) * (base - DEALER.generosityFloor);
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
export function evaluationBias(level, challenge = 0) {
  const lean = 2 * generosity(level, challenge) - 1;
  return lean >= 0 ? DEALER.biasStrength * lean : DEALER.spiteStrength * lean;
}

/**
 * How often the tray is guaranteed to contain a piece that can finish a
 * line right now. The level's own odds, pushed toward certainty by how
 * full your board is — and pulled back toward the top of the ladder's
 * stingy odds by a challenge.
 *
 * A challenge only lands on this dial at `challengeRescueBite` strength,
 * never in full. You climb the ladder on lines cleared, so taking the
 * rescue away doesn't make the game harder so much as slower, and slower
 * is the one thing none of this is trying to be.
 */
export function rescueChance(level, pressure, challenge = 0) {
  const own = levelConfig(level).clearChance;
  const c = clamp01(challenge) * DEALER.challengeRescueBite;
  const base = own + c * (DEALER.challengeClearChance - own);
  const push = Math.pow(clamp01(pressure), DEALER.rescuePower);
  return base + (1 - base) * push;
}

/**
 * How often the tray is guaranteed to be playable all the way through in
 * some order. Certain early; at the top of the ladder the risk that a
 * tray boxes you in is part of the difficulty — though the separate
 * "something fits" floor still means you're never handed a dead hand.
 *
 * A challenge round is the exception and always gets the full guarantee.
 * The point of one is a tray you have to think about, not a tray you
 * can't play: hard and solvable, never hard and hopeless.
 */
export function sequenceGuarantee(level, challenge = 0) {
  if (clamp01(challenge) > 0) return 1;
  return DEALER.sequenceFloor + (1 - DEALER.sequenceFloor) * generosity(level);
}
