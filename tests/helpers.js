/**
 * helpers.js — shared test scaffolding.
 *
 * The rules modules (config, difficulty, scoring, pieces, game, solver)
 * deliberately never touch the DOM, so they run unmodified under Node.
 * Everything here just makes it convenient to hand the game an exact
 * board instead of a random one.
 */

import { BOARD_SIZE } from "../js/config.js";
import { makePiece } from "../js/pieces.js";
import { Game } from "../js/game.js";

/** Small deterministic PRNG, so a failing test fails the same way twice. */
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed = 1) {
  return new Game({ rng: seededRng(seed) });
}

/** Builds a piece from an ASCII drawing: piece(["XX", ".X"]). */
export function piece(rows, color = "#fff") {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "X") cells.push([r, c]);
    });
  });
  return makePiece(cells, color, { name: "test", difficulty: 1 });
}

/**
 * Replaces the board from an ASCII drawing, one string per row.
 * "X" is filled, anything else is empty. Missing rows are left empty.
 */
export function setBoard(game, rows) {
  game.board = Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => (rows[r]?.[c] === "X" ? "#abc" : null))
  );
  return game;
}

/** A row of 8 characters with a gap at `gapCol`. */
export function rowWithGap(gapCol) {
  return Array.from({ length: BOARD_SIZE }, (_, c) => (c === gapCol ? "." : "X")).join("");
}

/**
 * Holes down the diagonal, plus a spare in row 0 and column 0.
 *
 * The diagonal guarantees every row and every column already has a gap,
 * so nothing is sitting complete and waiting to clear. No two holes touch,
 * so nothing bigger than a single square fits. And because row 0 and
 * column 0 each have a second hole, filling (0,0) still clears nothing —
 * which is exactly the dead end a game-over test needs.
 */
export const GRIDLOCK_HOLES = [
  ...Array.from({ length: BOARD_SIZE }, (_, i) => [i, i]),
  [0, 2],
  [2, 0],
];

/** A board where only a single square can be placed, at (0,0). */
export function gridlock(game, holes = GRIDLOCK_HOLES) {
  game.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill("#abc"));
  for (const [r, c] of holes) game.board[r][c] = null;
  return game;
}

export function countFilled(board) {
  return board.flat().filter(Boolean).length;
}

/** Records every event a game emits, so tests can assert on the sequence. */
export function recordEvents(game, names) {
  const log = [];
  for (const name of names) {
    game.on(name, (payload) => log.push({ name, payload }));
  }
  return log;
}
