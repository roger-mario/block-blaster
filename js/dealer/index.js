/**
 * dealer/index.js — decides which three pieces you get next.
 *
 * The public face of the dealer. Everything the rest of the game needs is
 * `dealTray`; the rest of this component is exported because the tests
 * and the console poke at it, and because the next version of this idea
 * will want to.
 *
 * The short version of how it works — the long one is in
 * DEALER-STRATEGY.md:
 *
 *   There are no easy or hard shapes. There are only shapes that are easy
 *   or hard *on the board in front of you*. So every unlocked shape is
 *   scored against the grid you actually have — where it can go, what
 *   board it leaves behind, what it can clear, whether it moves you toward
 *   emptying the whole thing — and difficulty is how hard the dealer
 *   works on your behalf, not which shapes it's allowed to reach for.
 *
 * Pure functions over a plain board array. No Game, no DOM.
 */

import { TRAY_SLOTS } from "../config.js";
import { paletteFor } from "../looks.js";
import { SHAPES, pickShape, pieceFromShape, shapeWeightAt, shapePoolFor } from "../pieces.js";
import { composeTray, guardTray } from "./compose.js";

/**
 * Block colours come from the active theme, not a fixed list, so a theme
 * change restyles the pieces as well as the page.
 */
function pickColor(rng, level, boardClears) {
  const palette = paletteFor(level, boardClears);
  return palette[Math.floor(rng() * palette.length) % palette.length];
}

/**
 * Deals a fresh tray for this board and level.
 *
 * Without a board there's nothing to read, so it falls back to the level
 * curve alone — that path exists for tooling, not for play.
 *
 * @param {number} count
 * @param {{level:number, board:string[][], rng?:Function, boardClears?:number}} options
 */
export function dealTray(
  count = TRAY_SLOTS,
  { level = 1, board = null, rng = Math.random, boardClears = 0 } = {}
) {
  const shapes = board
    ? guardTray(composeTray(count, { level, board, rng }), { level, board, rng })
    : Array.from({ length: count }, () => pickShape(level, rng));

  return shapes.map((shape) => pieceFromShape(shape, pickColor(rng, level, boardClears)));
}

/**
 * Relative frequencies of the level curve, as percentages.
 *
 * Board-independent by design: this is the *flavour* prior — which shapes
 * are unlocked and how the mix is textured — not what the dealer will
 * actually hand you, which depends entirely on your grid.
 */
export function shapeOdds(level) {
  const entries = shapePoolFor(level)
    .map((shape) => ({ shape, weight: shapeWeightAt(shape, level) }))
    .filter((entry) => entry.weight > 0);

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries
    .map(({ shape, weight }) => ({ shape, share: total > 0 ? weight / total : 0 }))
    .sort((a, b) => b.share - a.share);
}

export { SHAPES };
export { composeTray, guardTray } from "./compose.js";
export { generosity, evaluationBias, rescueChance, sequenceGuarantee } from "./dials.js";
export {
  boardHealth,
  concentration,
  fillRatio,
  filledCount,
  isBoardEmpty,
  lineCounts,
  openRegions,
  sweepPlan,
} from "./board.js";
export {
  canPlaceAt,
  completedBy,
  contactAt,
  placementsFor,
  playableInSomeOrder,
  shapeClearsLine,
  shapeFits,
  simulate,
} from "./placement.js";
export { evaluatePool, evaluateShape } from "./evaluate.js";
