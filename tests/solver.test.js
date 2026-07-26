/**
 * The hint solver.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { findBestPlacement } from "../js/solver.js";
import { newGame, piece, setBoard, rowWithGap, gridlock } from "./helpers.js";

test("the solver takes the line clear when one is on offer", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];

  const move = findBestPlacement(game);
  assert.ok(move);
  assert.equal(move.lines, 1);
  assert.deepEqual(move.origin, { row: 0, col: 7 });
});

test("the solver prefers the piece that clears over one that doesn't", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["XX", "XX"]), piece(["X"]), null];

  const move = findBestPlacement(game);
  assert.equal(move.slot, 1, "the single square is the one that completes the row");
  assert.equal(move.lines, 1);
});

test("the solver returns null when nothing fits", () => {
  const game = newGame();
  gridlock(game, []); // no holes at all
  game.tray = [piece(["X"]), piece(["XX"]), null];

  assert.equal(findBestPlacement(game), null);
});

test("the solver skips empty tray slots", () => {
  const game = newGame();
  game.tray = [null, null, piece(["X"])];

  const move = findBestPlacement(game);
  assert.ok(move);
  assert.equal(move.slot, 2);
});

test("every move the solver suggests is legal", () => {
  const game = newGame(11);
  setBoard(game, ["XXX.....", "XX......", "X.......", "XXXXX..."]);

  const move = findBestPlacement(game);
  assert.ok(move);
  assert.equal(game.canPlace(game.tray[move.slot], move.origin.row, move.origin.col), true);
  assert.equal(move.cells.length, game.tray[move.slot].cells.length);
});
