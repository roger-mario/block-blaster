/**
 * dealer/evaluate.js — scoring one shape against one board.
 *
 * This is the module that replaces "difficulty: 8". A shape has no value
 * of its own; it has a value *on this board*, and that value is the best
 * thing it can do here:
 *
 *   how healthy a board its best placement leaves behind
 *   how many lines it can finish right now
 *   whether it finishes one of the lines a whole-board sweep needs
 *   whether it can empty the board outright
 *   how many choices it gives you
 *
 * Measuring board health for every legal placement of every shape is more
 * work than a phone should be doing between moves, so placements are first
 * ranked cheaply (lines completed, then sweep progress, then contact) and
 * only the top `DEALER.healthProbes` are simulated properly. The ordering
 * heuristic is good enough that the real best placement is essentially
 * always in that shortlist.
 */

import { BOARD_SIZE, DEALER } from "../config.js";
import { shapeWeightAt } from "../pieces.js";
import { boardHealth, isBoardEmpty, lineCounts, sweepPlan } from "./board.js";
import { completedBy, contactAt, placementsFor, simulate } from "./placement.js";

const CELLS = BOARD_SIZE * BOARD_SIZE;

/** Does this placement finish a line the sweep plan is counting on? */
function hitsSweep(sweep, completed) {
  if (!sweep.feasible) return false;
  return (
    completed.rows.some((r) => sweep.rows.has(r)) ||
    completed.cols.some((c) => sweep.cols.has(c))
  );
}

/**
 * What this shape can do on this board.
 *
 * `raw` is the board-management value alone — health gain, credit for the
 * cells the piece actually puts down, and a little for flexibility. Line
 * clearing is deliberately *not* folded into it: the two are weighted
 * separately in compose.js so that a high level can stop helping you
 * build without also refusing to let you clear.
 *
 * The cell credit is not a preference for big pieces, it's a correction.
 * See `DEALER.substance`.
 */
export function evaluateShape(board, shape, context) {
  const { base, counts, sweep, level } = context;
  const cells = shape.cells;
  const flavour = shapeWeightAt(shape, level);
  const spots = placementsFor(board, cells);

  const evaluation = {
    shape,
    flavour,
    fits: spots.length > 0,
    spots: spots.length,
    bestLines: 0,
    sweepHit: false,
    perfect: false,
    gain: 0,
    raw: 0,
    value: 0,
    bestBoard: null,
    bestOrigin: null,
  };

  if (spots.length === 0) return evaluation;

  // ---- rank every placement cheaply ----
  const ranked = spots.map(([r, c]) => {
    const completed = completedBy(counts, cells, r, c);
    const sweepHit = hitsSweep(sweep, completed);
    if (completed.lines > evaluation.bestLines) evaluation.bestLines = completed.lines;
    if (sweepHit) evaluation.sweepHit = true;
    return {
      r,
      c,
      rank: completed.lines * 100 + (sweepHit ? 40 : 0) + contactAt(board, cells, r, c),
    };
  });
  ranked.sort((a, b) => b.rank - a.rank);

  // ---- and measure the promising ones properly ----
  let bestHealth = -Infinity;
  for (const spot of ranked.slice(0, DEALER.healthProbes)) {
    const played = simulate(board, cells, spot.r, spot.c);
    if (played.lines > 0 && isBoardEmpty(played.board)) evaluation.perfect = true;

    const health = boardHealth(played.board);
    if (health > bestHealth) {
      bestHealth = health;
      evaluation.bestBoard = played.board;
      evaluation.bestOrigin = [spot.r, spot.c];
    }
  }

  evaluation.gain = bestHealth - base;
  evaluation.raw =
    evaluation.gain +
    DEALER.substance * (cells.length / CELLS) +
    DEALER.flexibility * Math.min(1, spots.length / DEALER.flexibleAt);

  return evaluation;
}

/**
 * Evaluates every shape in the pool against one board, then normalises
 * `raw` into `value` across the shapes that actually fit.
 *
 * The normalisation is the point: it makes 0 the worst option available
 * on *this* board and 1 the best, so the generosity exponent in
 * compose.js means the same thing on an empty board as it does on a board
 * with two squares left. Without it, "prefer the good pieces" would be a
 * strong instruction early and a meaningless one late.
 */
export function evaluatePool(board, shapes, { level }) {
  const context = {
    base: boardHealth(board),
    counts: lineCounts(board),
    sweep: sweepPlan(board),
    level,
  };

  const entries = shapes.map((shape) => evaluateShape(board, shape, context));

  let lo = Infinity;
  let hi = -Infinity;
  for (const entry of entries) {
    if (!entry.fits) continue;
    if (entry.raw < lo) lo = entry.raw;
    if (entry.raw > hi) hi = entry.raw;
  }

  const span = hi - lo;
  for (const entry of entries) {
    entry.value = entry.fits && span > 1e-9 ? (entry.raw - lo) / span : 0.5;
  }

  return entries;
}
