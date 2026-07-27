/**
 * pieces.js — the shapes, and how often each one turns up.
 *
 * Every shape owns an appearance curve rather than being gated by a
 * single "hardest allowed" number. That's what lets the mix actually
 * change as you climb instead of just getting a bigger grab-bag:
 *
 *   from    the first level this shape can appear at all
 *   peak    the level where it reaches its full weight
 *   fade    the level it starts becoming rarer again
 *   floor   how rare it gets once faded, as a fraction of its weight
 *   weight  its pull relative to every other shape
 *
 * So dominoes are everywhere at level 1 and nearly gone by level 8, the
 * 5-bars arrive at level 5 and stay generous forever, and the S/Z pieces
 * show up late and stay rare because they're the ones that wreck boards.
 *
 * As of 0.4.0 this curve is a *prior*, not the decision. The dealer scores
 * every shape against the board you actually have and the curve only
 * nudges the result (see DEALER-STRATEGY.md), so read these numbers as
 * pacing and variety rather than as difficulty:
 *
 *   `from` gates a shape until a level, so the vocabulary of the game
 *   grows as you play and level 1 isn't handed a 3×3 block.
 *   `weight` keeps a level's mix recognisable instead of collapsing onto
 *   whatever the evaluator happens to like most.
 *   `difficulty` is a label for humans reading the table. Nothing reads
 *   it to make a decision.
 */

import { BOARD_SIZE } from "./config.js";
import { MAX_LEVEL } from "./difficulty.js";

function shape(name, difficulty, curve, rows) {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "X") cells.push([r, c]);
    });
  });
  return {
    name,
    difficulty,
    cells,
    size: cells.length,
    from: curve.from ?? 1,
    peak: curve.peak ?? curve.from ?? 1,
    fade: curve.fade ?? MAX_LEVEL,
    floor: curve.floor ?? 1,
    weight: curve.weight ?? 1,
  };
}

export const SHAPES = [
  // ---- the rescue piece ----------------------------------------------
  // Always available, deliberately never common: a tray full of single
  // squares makes the game trivial rather than fun.
  shape("dot", 1, { from: 1, peak: 1, fade: 3, floor: 0.5, weight: 0.55 }, ["X"]),

  // ---- level 1-2 bread and butter, mostly gone by level 8 -------------
  shape("domino-h", 1, { from: 1, peak: 1, fade: 3, floor: 0.25, weight: 1.5 }, ["XX"]),
  shape("domino-v", 1, { from: 1, peak: 1, fade: 3, floor: 0.25, weight: 1.5 }, ["X", "X"]),

  shape("tri-h", 2, { from: 1, peak: 2, fade: 5, floor: 0.4, weight: 1.4 }, ["XXX"]),
  shape("tri-v", 2, { from: 1, peak: 2, fade: 5, floor: 0.4, weight: 1.4 }, ["X", "X", "X"]),

  // Corners stay useful forever — they tuck into gaps nothing else fits.
  shape("corner-tl", 2, { from: 1, peak: 2, fade: 7, floor: 0.6, weight: 1.1 }, ["X.", "XX"]),
  shape("corner-tr", 2, { from: 1, peak: 2, fade: 7, floor: 0.6, weight: 1.1 }, [".X", "XX"]),
  shape("corner-bl", 2, { from: 1, peak: 2, fade: 7, floor: 0.6, weight: 1.1 }, ["XX", "X."]),
  shape("corner-br", 2, { from: 1, peak: 2, fade: 7, floor: 0.6, weight: 1.1 }, ["XX", ".X"]),

  // ---- the workhorses: never fade --------------------------------------
  shape("square-2", 3, { from: 2, peak: 3, weight: 1.2 }, ["XX", "XX"]),
  shape("quad-h", 4, { from: 3, peak: 4, weight: 1.15 }, ["XXXX"]),
  shape("quad-v", 4, { from: 3, peak: 4, weight: 1.15 }, ["X", "X", "X", "X"]),

  // ---- the long bars ---------------------------------------------------
  // These arrive early-ish and stay the most common thing on the board.
  // Half a row in one move is the most satisfying piece in the game, and
  // they were far too rare before.
  shape("penta-h", 7, { from: 4, peak: 5, weight: 1.6 }, ["XXXXX"]),
  shape("penta-v", 7, { from: 4, peak: 5, weight: 1.6 }, ["X", "X", "X", "X", "X"]),

  // ---- the L/J tetrominoes: a 3-bar with a nub ------------------------
  // The most useful "fill an awkward corner" piece there is, and the game
  // didn't have them. `jay-*` stand a 3 tall, `hook-*` lay it flat; the
  // suffix says where the nub sits.
  shape("jay-bl", 4, { from: 3, peak: 5, weight: 0.7 }, [".X", ".X", "XX"]),
  shape("jay-br", 4, { from: 3, peak: 5, weight: 0.7 }, ["X.", "X.", "XX"]),
  shape("jay-tl", 4, { from: 3, peak: 5, weight: 0.7 }, ["XX", ".X", ".X"]),
  shape("jay-tr", 4, { from: 3, peak: 5, weight: 0.7 }, ["XX", "X.", "X."]),

  shape("hook-tl", 4, { from: 3, peak: 5, weight: 0.7 }, ["X..", "XXX"]),
  shape("hook-tr", 4, { from: 3, peak: 5, weight: 0.7 }, ["..X", "XXX"]),
  shape("hook-bl", 4, { from: 3, peak: 5, weight: 0.7 }, ["XXX", "X.."]),
  shape("hook-br", 4, { from: 3, peak: 5, weight: 0.7 }, ["XXX", "..X"]),

  // ---- awkward middles -------------------------------------------------
  shape("tee-down", 5, { from: 4, peak: 5, weight: 0.85 }, ["XXX", ".X."]),
  shape("tee-up", 5, { from: 4, peak: 5, weight: 0.85 }, [".X.", "XXX"]),
  shape("tee-right", 5, { from: 4, peak: 5, weight: 0.85 }, ["X.", "XX", "X."]),
  shape("tee-left", 5, { from: 4, peak: 5, weight: 0.85 }, [".X", "XX", ".X"]),

  // ---- fat rectangles --------------------------------------------------
  shape("rect-3x2", 6, { from: 5, peak: 6, weight: 0.9 }, ["XXX", "XXX"]),
  shape("rect-2x3", 6, { from: 5, peak: 6, weight: 0.9 }, ["XX", "XX", "XX"]),

  // ---- big elbows ------------------------------------------------------
  shape("ell-tl", 8, { from: 6, peak: 7, weight: 0.7 }, ["X..", "X..", "XXX"]),
  shape("ell-tr", 8, { from: 6, peak: 7, weight: 0.7 }, ["..X", "..X", "XXX"]),
  shape("ell-bl", 8, { from: 6, peak: 7, weight: 0.7 }, ["XXX", "X..", "X.."]),
  shape("ell-br", 8, { from: 6, peak: 7, weight: 0.7 }, ["XXX", "..X", "..X"]),

  // ---- the plus: reaches a cross-shaped pocket nothing else does -------
  shape("plus", 6, { from: 5, peak: 7, weight: 0.6 }, [".X.", "XXX", ".X."]),

  // ---- the board-wreckers: late and deliberately rare -------------------
  shape("ess", 9, { from: 7, peak: 9, weight: 0.45 }, [".XX", "XX."]),
  shape("zee", 9, { from: 7, peak: 9, weight: 0.45 }, ["XX.", ".XX"]),
  shape("square-3", 10, { from: 7, peak: 10, weight: 0.4 }, ["XXX", "XXX", "XXX"]),

  // ---- and the diagonals: cells that don't even touch each other -------
  // Cheap, awkward, and now and then the only thing that fits two holes
  // the rest of the vocabulary can't reach at once.
  shape("diag-2a", 7, { from: 6, peak: 9, weight: 0.4 }, ["X.", ".X"]),
  shape("diag-2b", 7, { from: 6, peak: 9, weight: 0.4 }, [".X", "X."]),
  shape("diag-3a", 10, { from: 9, peak: 12, weight: 0.3 }, ["X..", ".X.", "..X"]),
  shape("diag-3b", 10, { from: 9, peak: 12, weight: 0.3 }, ["..X", ".X.", "X.."]),
];

/**
 * How likely this shape is at this level, before the board is considered.
 * Zero means "not unlocked yet".
 */
export function shapeWeightAt(shape, level) {
  if (level < shape.from) return 0;

  let scale = 1;

  // ramping in: a shape's first level or two are a taste, not a flood
  if (level < shape.peak) {
    const span = shape.peak - shape.from;
    scale = span > 0 ? 0.45 + 0.55 * ((level - shape.from) / span) : 1;
  } else if (level > shape.fade) {
    // fading out: decay toward its floor across the rest of the ladder
    const span = Math.max(1, MAX_LEVEL - shape.fade);
    const gone = Math.min(1, (level - shape.fade) / span);
    scale = 1 - (1 - shape.floor) * gone;
  }

  return shape.weight * scale;
}

let nextPieceId = 1;

/** Builds a piece object with its measured bounding box. */
export function makePiece(cells, color, { name = "custom", difficulty = 1 } = {}) {
  return {
    id: nextPieceId++,
    name,
    difficulty,
    cells,
    color,
    width: Math.max(...cells.map((c) => c[1])) + 1,
    height: Math.max(...cells.map((c) => c[0])) + 1,
  };
}

export function pieceFromShape(shape, color) {
  return makePiece(shape.cells, color, { name: shape.name, difficulty: shape.difficulty });
}

/** Every shape unlocked at this level. Never empty. */
export function shapePoolFor(level) {
  const pool = SHAPES.filter((s) => shapeWeightAt(s, level) > 0);
  return pool.length > 0 ? pool : [SHAPES[0]];
}

/** Picks one shape using the level curve alone (no board awareness). */
export function pickShape(level, rng = Math.random) {
  const pool = shapePoolFor(level);
  const weights = pool.map((s) => shapeWeightAt(s, level));
  return weightedPick(pool, weights, rng) ?? pool[pool.length - 1];
}

/** Draws one item from `items` in proportion to `weights`. */
export function weightedPick(items, weights, rng = Math.random) {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return null;

  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Sanity guard: no shape may be wider or taller than the board. */
export function shapeFitsBoard(shape) {
  const width = Math.max(...shape.cells.map((c) => c[1])) + 1;
  const height = Math.max(...shape.cells.map((c) => c[0])) + 1;
  return width <= BOARD_SIZE && height <= BOARD_SIZE;
}
