/**
 * Feature 4 — one pot of three assists, spent on hints or on undo, and an
 * undo that only ever goes back a single step.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ASSISTS_PER_GAME } from "../js/config.js";
import { findBestPlacement } from "../js/solver.js";
import { newGame, piece, setBoard, rowWithGap, countFilled, gridlock } from "./helpers.js";

test("a game starts with three assists and nothing to undo", () => {
  const game = newGame();
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME);
  assert.equal(game.canUndo(), false, "there is no move to take back yet");
  assert.equal(game.undo(), false);
});

test("undo puts the board, tray and score back exactly as they were", () => {
  const game = newGame();
  game.tray = [piece(["XX", "XX"]), piece(["X"]), piece(["X"])];

  const boardBefore = JSON.stringify(game.board);
  const trayBefore = game.tray.map((p) => p?.id ?? null);
  const scoreBefore = game.score;

  game.place(0, 2, 2);
  assert.equal(countFilled(game.board), 4);
  assert.ok(game.score > scoreBefore);

  assert.equal(game.undo(), true);
  assert.equal(JSON.stringify(game.board), boardBefore);
  assert.deepEqual(game.tray.map((p) => p?.id ?? null), trayBefore);
  assert.equal(game.score, scoreBefore);
});

test("undo rolls back a clear, the combo and the lines counter", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];

  const filledBefore = countFilled(game.board);
  game.place(0, 0, 7);
  assert.equal(game.combo, 1);
  assert.equal(game.linesCleared, 1);

  game.undo();
  assert.equal(countFilled(game.board), filledBefore, "the cleared row is back");
  assert.equal(game.combo, 0);
  assert.equal(game.linesCleared, 0);
  assert.equal(game.score, 0);
});

test("undo costs one assist", () => {
  const game = newGame();
  game.tray = [piece(["X"]), null, null];
  game.place(0, 0, 0);

  game.undo();
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME - 1);
});

test("undo only ever goes back one step", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  game.place(1, 2, 2);
  assert.equal(countFilled(game.board), 2);

  assert.equal(game.undo(), true);
  assert.equal(countFilled(game.board), 1, "the second move is gone");

  assert.equal(game.canUndo(), false, "the first move is not on offer");
  assert.equal(game.undo(), false);
  assert.equal(countFilled(game.board), 1, "the board did not move again");
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME - 1, "a refused undo is free");
});

test("undo becomes available again after the next placement", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  game.undo();
  assert.equal(game.canUndo(), false);

  game.place(1, 4, 4);
  assert.equal(game.canUndo(), true, "a fresh move can be taken back");
});

test("hints and undo draw on the same three assists", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  assert.ok(game.useHint(findBestPlacement));
  assert.equal(game.assistsLeft, 2);

  assert.equal(game.undo(), true);
  assert.equal(game.assistsLeft, 1, "the undo came out of the same pot");
});

test("spending all three on hints leaves nothing for undo", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);

  for (let i = 0; i < ASSISTS_PER_GAME; i++) {
    assert.ok(game.useHint(findBestPlacement), `hint ${i + 1} works`);
  }
  assert.equal(game.assistsLeft, 0);
  assert.equal(game.useHint(findBestPlacement), null, "no fourth hint");
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false, "no undo either — the pot is empty");
});

test("using a hint after a move does not hand back an assist on undo", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  game.useHint(findBestPlacement);
  game.undo();

  assert.equal(game.assistsLeft, 1, "hint + undo = two assists spent");
});

test("undo can rescue you from game over", () => {
  const game = newGame();
  gridlock(game);
  game.tray = [piece(["X"]), piece(["XX"]), null];

  game.place(0, 0, 0);
  assert.equal(game.over, true);

  assert.equal(game.canUndo(), true, "the fatal move is still on offer");
  assert.equal(game.undo(), true);
  assert.equal(game.over, false, "you're back in the game");
  assert.equal(game.board[0][0], null);
});

test("a reset refills the assist pot and forgets the undo", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  game.undo();
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME - 1);

  game.reset();
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME);
  assert.equal(game.canUndo(), false);
});

test("undo and hint both announce the assists left", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  const seen = [];
  game.on("assists", (p) => seen.push(p));

  game.place(0, 0, 0);
  assert.equal(seen.at(-1).canUndo, true);

  game.useHint(findBestPlacement);
  assert.equal(seen.at(-1).assistsLeft, 2);

  game.undo();
  assert.equal(seen.at(-1).assistsLeft, 1);
  assert.equal(seen.at(-1).canUndo, false);
});

test("a hint points at a legal move in the tray", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];

  const hint = game.useHint(findBestPlacement);
  assert.ok(hint);
  assert.equal(hint.slot, 0);
  assert.equal(game.canPlace(game.tray[hint.slot], hint.origin.row, hint.origin.col), true);
  assert.equal(hint.assistsLeft, ASSISTS_PER_GAME - 1);
});

test("a hint is refused once the game is over", () => {
  const game = newGame();
  game.over = true;
  assert.equal(game.useHint(findBestPlacement), null);
  assert.equal(game.assistsLeft, ASSISTS_PER_GAME, "nothing was spent");
});
