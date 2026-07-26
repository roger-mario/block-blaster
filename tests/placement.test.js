/**
 * Placement — dragging, and only dragging.
 *
 * A drag hands the game the top-left corner of the piece directly: there
 * is no snapping and no forgiveness radius any more, because there is no
 * tap-to-place to be imprecise on your behalf. What's left to check is
 * that the game accepts exactly the drops it should and nothing else.
 *
 * The pixel-to-square arithmetic lives in input.js, which needs a DOM.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE } from "../js/config.js";
import { newGame, piece, setBoard, countFilled } from "./helpers.js";

test("a drop lands on the exact square it was dropped on", () => {
  const game = newGame();
  game.tray = [piece(["XX", "XX"]), null, null];

  assert.equal(game.place(0, 4, 4), true);
  assert.deepEqual(
    [game.board[4][4], game.board[4][5], game.board[5][4], game.board[5][5]].map(Boolean),
    [true, true, true, true]
  );
  assert.equal(countFilled(game.board), 4);
});

test("a drop that runs off the edge is refused, and changes nothing", () => {
  const game = newGame();
  game.tray = [piece(["XXXXX"]), null, null];

  assert.equal(game.place(0, 0, 5), false, "five wide from column 5 overhangs");
  assert.equal(countFilled(game.board), 0);
  assert.ok(game.tray[0], "the piece is still in the tray");
});

test("a drop onto occupied squares is refused", () => {
  const game = newGame();
  setBoard(game, ["....X..."]);
  game.tray = [piece(["XXX"]), null, null];

  assert.equal(game.place(0, 0, 2), false, "it would cross the filled square");
  assert.equal(game.place(0, 0, 4), false, "…and this starts on top of it");
  assert.equal(game.place(0, 1, 0), true, "the row below is clear");
});

test("canPlace agrees with place on every square of the board", () => {
  const rows = ["XXXX....", "XX......"];
  const reference = newGame();
  setBoard(reference, rows);
  const bar = piece(["XX"]);

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const legal = reference.canPlace(bar, row, col);

      const probe = newGame();
      setBoard(probe, rows);
      probe.tray = [piece(["XX"]), null, null];

      assert.equal(
        probe.place(0, row, col),
        legal,
        `place and canPlace disagree at ${row},${col}`
      );
    }
  }
});

test("the drag preview reports what the drop would actually do", () => {
  const game = newGame();
  // a row with a single gap at column 7
  setBoard(game, ["XXXXXXX."]);
  const dot = piece(["X"]);

  const filling = game.previewPlacement(dot, 0, 7);
  assert.equal(filling.valid, true);
  assert.equal(filling.lines, 1, "it would complete the row");
  assert.deepEqual(filling.clearRows, [0]);
  assert.ok(filling.points > 0);

  const blocked = game.previewPlacement(dot, 0, 0);
  assert.equal(blocked.valid, false);
  assert.equal(blocked.lines, 0);
  assert.equal(blocked.points, 0);
});

test("previewing does not touch the board", () => {
  const game = newGame();
  const before = JSON.stringify(game.board);

  game.previewPlacement(piece(["XX", "XX"]), 3, 3);
  assert.equal(JSON.stringify(game.board), before);
});

test("a piece cannot be dropped once the game is over", () => {
  const game = newGame();
  game.tray = [piece(["X"]), null, null];
  game.over = true;

  assert.equal(game.place(0, 0, 0), false);
  assert.equal(countFilled(game.board), 0);
});
