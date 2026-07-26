/**
 * pieces.js — the shapes that can appear in the tray.
 *
 * Every shape carries a `difficulty` from 1 (a single square) to 10 (the
 * full 3×3 block). The difficulty ladder in config.js decides which of
 * them a given level is allowed to hand you, so level 1 only ever sees
 * friendly little shapes and level 10 sees everything.
 *
 * To add a new shape, add another `shape(name, difficulty, [...])` entry.
 * "X" is a block, "." is empty.
 */

import { COLORS } from "./config.js";
import { levelConfig } from "./difficulty.js";

function shape(name, difficulty, rows) {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "X") cells.push([r, c]);
    });
  });
  return { name, difficulty, cells };
}

export const SHAPES = [
  // --- trivial: fit almost anywhere ---
  shape("dot", 1, ["X"]),
  shape("domino-h", 1, ["XX"]),
  shape("domino-v", 1, ["X", "X"]),

  // --- easy ---
  shape("tri-h", 2, ["XXX"]),
  shape("tri-v", 2, ["X", "X", "X"]),
  shape("corner-tl", 2, ["X.", "XX"]),
  shape("corner-tr", 2, [".X", "XX"]),
  shape("corner-bl", 2, ["XX", "X."]),
  shape("corner-br", 2, ["XX", ".X"]),

  // --- comfortable ---
  shape("square-2", 3, ["XX", "XX"]),

  // --- getting long ---
  shape("quad-h", 4, ["XXXX"]),
  shape("quad-v", 4, ["X", "X", "X", "X"]),

  // --- awkward middles ---
  shape("tee-down", 5, ["XXX", ".X."]),
  shape("tee-up", 5, [".X.", "XXX"]),
  shape("tee-right", 5, ["X.", "XX", "X."]),
  shape("tee-left", 5, [".X", "XX", ".X"]),

  // --- fat rectangles ---
  shape("rect-3x2", 6, ["XXX", "XXX"]),
  shape("rect-2x3", 6, ["XX", "XX", "XX"]),

  // --- board-spanning bars ---
  shape("penta-h", 7, ["XXXXX"]),
  shape("penta-v", 7, ["X", "X", "X", "X", "X"]),

  // --- big elbows ---
  shape("ell-tl", 8, ["X..", "X..", "XXX"]),
  shape("ell-tr", 8, ["..X", "..X", "XXX"]),
  shape("ell-bl", 8, ["XXX", "X..", "X.."]),
  shape("ell-br", 8, ["XXX", "..X", "..X"]),

  // --- the ones that ruin boards ---
  shape("ess", 9, [".XX", "XX."]),
  shape("zee", 9, ["XX.", ".XX"]),
  shape("square-3", 10, ["XXX", "XXX", "XXX"]),
];

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

/** Every shape a level is allowed to draw from. Never empty. */
export function shapePoolFor(level) {
  const cfg = levelConfig(level);
  const pool = SHAPES.filter((s) => s.difficulty <= cfg.maxPieceDifficulty);
  return pool.length > 0 ? pool : [SHAPES[0]];
}

/**
 * Picks a shape for the level. `hardBias` tilts the draw toward the
 * harder end of whatever the level allows — at level 1 it's a flat
 * random choice, at level 10 the nasty shapes come up far more often.
 */
export function pickShape(level, rng = Math.random) {
  const cfg = levelConfig(level);
  const pool = shapePoolFor(level);

  const weights = pool.map((s) => 1 + cfg.hardBias * s.difficulty);
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function randomPiece(level = 1, rng = Math.random) {
  const s = pickShape(level, rng);
  const color = COLORS[Math.floor(rng() * COLORS.length) % COLORS.length];
  return makePiece(s.cells, color, { name: s.name, difficulty: s.difficulty });
}

/**
 * Builds a fresh tray.
 *
 * `accepts` lets the caller reject a tray it doesn't like — the game uses
 * it on the easy levels to guarantee at least one piece actually fits, so
 * beginners don't get an instant unwinnable hand.
 */
export function randomTray(count, { level = 1, accepts = null, rng = Math.random, tries = 30 } = {}) {
  let tray = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    tray = Array.from({ length: count }, () => randomPiece(level, rng));
    if (!accepts || accepts(tray)) return tray;
  }
  return tray; // gave it a fair shot; take the last one
}
