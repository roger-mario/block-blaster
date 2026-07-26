/**
 * The core rules: placing, clearing, combos and game over.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE, TRAY_SLOTS } from "../js/config.js";
import { findCompletedLines } from "../js/game.js";
import {
  newGame,
  piece,
  setBoard,
  rowWithGap,
  countFilled,
  recordEvents,
  gridlock,
} from "./helpers.js";

test("a fresh game starts empty, at level 1, with a full tray", () => {
  const game = newGame();
  assert.equal(countFilled(game.board), 0);
  assert.equal(game.score, 0);
  assert.equal(game.level, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.linesCleared, 0);
  assert.equal(game.tray.length, TRAY_SLOTS);
  assert.ok(game.tray.every(Boolean));
});

test("canPlace rejects out-of-bounds and occupied squares", () => {
  const game = newGame();
  const bar = piece(["XXXX"]);

  assert.equal(game.canPlace(bar, 0, 0), true);
  assert.equal(game.canPlace(bar, 0, 5), false, "runs off the right edge");
  assert.equal(game.canPlace(bar, -1, 0), false, "above the board");
  assert.equal(game.canPlace(bar, BOARD_SIZE, 0), false, "below the board");

  game.board[0][2] = "#abc";
  assert.equal(game.canPlace(bar, 0, 0), false, "overlaps a filled square");
});

test("placing fills exactly the piece's squares and empties the slot", () => {
  const game = newGame();
  // a full tray, so the "all three spent" refill doesn't fire
  game.tray = [piece(["XX", "X."]), piece(["X"]), piece(["X"])];

  assert.equal(game.place(0, 3, 4), true);
  assert.equal(game.board[3][4], "#fff");
  assert.equal(game.board[3][5], "#fff");
  assert.equal(game.board[4][4], "#fff");
  assert.equal(game.board[4][5], null);
  assert.equal(countFilled(game.board), 3);
  assert.equal(game.tray[0], null);
});

test("an illegal placement changes nothing and returns false", () => {
  const game = newGame();
  game.tray = [piece(["XXXXX"]), null, null];

  assert.equal(game.place(0, 0, 6), false);
  assert.equal(countFilled(game.board), 0);
  assert.ok(game.tray[0], "the piece stays in the tray");
});

test("completing a row clears it and scores", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];

  const events = recordEvents(game, ["clear"]);
  game.place(0, 0, 7);

  assert.equal(events.length, 1);
  assert.deepEqual(events[0].payload.rows, [0]);
  assert.deepEqual(events[0].payload.cols, []);
  assert.equal(countFilled(game.board), 0);
  assert.ok(game.score > 0);
  assert.equal(game.linesCleared, 1);
});

test("completing a column clears it", () => {
  const game = newGame();
  const rows = Array.from({ length: BOARD_SIZE }, (_, r) => (r === 7 ? "" : "X"));
  setBoard(game, rows);
  game.tray = [piece(["X"]), null, null];

  const events = recordEvents(game, ["clear"]);
  game.place(0, 7, 0);

  assert.deepEqual(events[0].payload.cols, [0]);
  assert.deepEqual(events[0].payload.rows, []);
  assert.equal(countFilled(game.board), 0);
});

test("a row and a column can clear in the same move", () => {
  const game = newGame();
  // row 0 and column 0 are both full apart from the square where they
  // meet, so a single block finishes them both at once
  for (let c = 1; c < BOARD_SIZE; c++) game.board[0][c] = "#abc";
  for (let r = 1; r < BOARD_SIZE; r++) game.board[r][0] = "#abc";

  game.tray = [piece(["X"]), null, null];
  const events = recordEvents(game, ["clear", "bonus"]);
  game.place(0, 0, 0);

  const clear = events.find((e) => e.name === "clear");
  assert.deepEqual(clear.payload.rows, [0]);
  assert.deepEqual(clear.payload.cols, [0]);
  assert.equal(clear.payload.lines, 2);
  assert.ok(events.some((e) => e.name === "bonus" && e.payload.type === "cross"));
});

test("clearing the whole board fires the perfect-clear bonus", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];

  const events = recordEvents(game, ["bonus"]);
  game.place(0, 0, 7);

  assert.ok(game.isBoardEmpty());
  assert.ok(events.some((e) => e.payload.type === "perfect"), "perfect clear awarded");
});

test("a clear that leaves blocks behind is not a perfect clear", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7), "XX"]);
  game.tray = [piece(["X"]), null, null];

  const events = recordEvents(game, ["bonus"]);
  game.place(0, 0, 7);

  assert.equal(countFilled(game.board), 2);
  assert.equal(events.filter((e) => e.payload.type === "perfect").length, 0);
});

test("combos build on consecutive clears and break on a quiet move", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7), rowWithGap(7)]);
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 7);
  assert.equal(game.combo, 1);

  game.place(1, 1, 7); // the second almost-complete row
  assert.equal(game.combo, 2);

  const breaks = recordEvents(game, ["comboBreak"]);
  game.place(2, 5, 5); // clears nothing
  assert.equal(game.combo, 0);
  assert.equal(breaks.length, 1);
});

test("the tray only refills once all three pieces are gone", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  const firstIds = game.tray.map((p) => p.id);

  game.place(0, 0, 0);
  assert.equal(game.tray[1].id, firstIds[1], "untouched slots keep their piece");
  assert.equal(game.tray[0], null);

  game.place(1, 0, 2);
  game.place(2, 0, 4);
  assert.ok(game.tray.every(Boolean), "a fresh tray arrives");
  assert.ok(game.tray.every((p) => !firstIds.includes(p.id)));
});

test("game over fires when nothing in the tray fits anywhere", () => {
  const game = newGame();
  gridlock(game);
  game.tray = [piece(["X"]), piece(["XX"]), null];

  const events = recordEvents(game, ["gameover"]);
  game.place(0, 0, 0); // the last single square a dot can use

  assert.equal(game.over, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.level, game.level);
});

test("placement is refused once the game is over", () => {
  const game = newGame();
  game.over = true;
  game.tray = [piece(["X"]), null, null];
  assert.equal(game.place(0, 0, 0), false);
});

test("findCompletedLines spots full rows and columns", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (let c = 0; c < BOARD_SIZE; c++) board[2][c] = "#abc";
  for (let r = 0; r < BOARD_SIZE; r++) board[r][5] = "#abc";

  const { rows, cols } = findCompletedLines(board);
  assert.deepEqual(rows, [2]);
  assert.deepEqual(cols, [5]);
});

test("previewPlacement never mutates the board", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  const before = JSON.stringify(game.board);

  const preview = game.previewPlacement(piece(["X"]), 0, 7);
  assert.equal(preview.valid, true);
  assert.equal(preview.lines, 1);
  assert.ok(preview.points > 0);
  assert.equal(JSON.stringify(game.board), before);
});
