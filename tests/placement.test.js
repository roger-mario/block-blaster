/**
 * Feature 1 — tap a piece, tap the board.
 *
 * The DOM half lives in input.js, but all the arithmetic that decides
 * *where* a tap puts a piece is in game.js, and that's what matters.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { FX } from "../js/config.js";
import { newGame, piece, setBoard, countFilled } from "./helpers.js";

test("a single square lands exactly where you tapped", () => {
  const game = newGame();
  const origin = game.centerOrigin(piece(["X"]), 3, 5);
  assert.deepEqual(origin, { row: 3, col: 5 });
});

test("a bigger piece is centred on the square you tapped", () => {
  const game = newGame();

  // 3×3: the tapped square should end up in the middle
  const big = game.centerOrigin(piece(["XXX", "XXX", "XXX"]), 4, 4);
  assert.deepEqual(big, { row: 3, col: 3 });

  // 1×4 bar: centred horizontally, biased left on the even split
  const bar = game.centerOrigin(piece(["XXXX"]), 2, 4);
  assert.deepEqual(bar, { row: 2, col: 3 });

  // 2×3 rectangle
  const rect = game.centerOrigin(piece(["XXX", "XXX"]), 5, 5);
  assert.deepEqual(rect, { row: 5, col: 4 });
});

test("tapping open space places the piece centred on the tap", () => {
  const game = newGame();
  const square = piece(["XX", "XX"]);
  assert.deepEqual(game.snapOrigin(square, 4, 4), { row: 4, col: 4 });
});

test("a tap near the edge slides the piece back onto the board", () => {
  const game = newGame();
  const bar = piece(["XXXXX"]);

  // tapping the far right column can't fit a 5-bar centred there
  const origin = game.snapOrigin(bar, 0, 7);
  assert.ok(origin, "it finds somewhere legal instead of giving up");
  assert.equal(game.canPlace(bar, origin.row, origin.col), true);
  assert.ok(origin.col + bar.width <= 8);
});

test("a tap one square off snaps to the nearest legal spot", () => {
  const game = newGame();
  // block the exact centred landing spot, leave its neighbours free
  game.board[4][4] = "#abc";

  const dot = piece(["X"]);
  const origin = game.snapOrigin(dot, 4, 4);

  assert.ok(origin);
  assert.equal(game.canPlace(dot, origin.row, origin.col), true);
  const distance = Math.max(Math.abs(origin.row - 4), Math.abs(origin.col - 4));
  assert.equal(distance, 1, "it moved by a single square, not further");
});

test("the snap gives up rather than dumping a piece far away", () => {
  const game = newGame();
  // fill everything except one corner, well outside the snap radius
  game.board = game.board.map((row) => row.map(() => "#abc"));
  game.board[7][7] = null;

  const dot = piece(["X"]);
  assert.equal(game.snapOrigin(dot, 0, 0), null, "a tap top-left doesn't teleport to the corner");
  assert.ok(game.snapOrigin(dot, 7, 7), "tapping the free square still works");
});

test("the snap radius is honoured", () => {
  const game = newGame();
  game.board = game.board.map((row) => row.map(() => "#abc"));
  game.board[0][3] = null;

  const dot = piece(["X"]);
  assert.equal(game.snapOrigin(dot, 0, 0, 1), null, "three squares away is too far for radius 1");
  assert.ok(game.snapOrigin(dot, 0, 0, 3), "…but fine for radius 3");
  assert.ok(FX.snapRadius >= 1, "the shipped radius forgives at least one square");
});

test("snapping never returns a spot the piece can't legally occupy", () => {
  const game = newGame();
  setBoard(game, ["XXXX....", "XXXX....", "XXXX...."]);

  const square = piece(["XX", "XX"]);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const origin = game.snapOrigin(square, row, col);
      if (origin) {
        assert.equal(
          game.canPlace(square, origin.row, origin.col),
          true,
          `snap for tap ${row},${col} must be legal`
        );
      }
    }
  }
});

test("snapOrigin on a null piece is harmless", () => {
  const game = newGame();
  assert.equal(game.snapOrigin(null, 0, 0), null);
});

test("tap placement and drag placement reach the same game state", () => {
  const tapped = newGame();
  const dragged = newGame();
  const square = () => piece(["XX", "XX"]);

  tapped.tray = [square(), null, null];
  dragged.tray = [square(), null, null];

  const origin = tapped.snapOrigin(tapped.tray[0], 4, 4);
  tapped.place(0, origin.row, origin.col);
  dragged.place(0, 4, 4); // a drag hands over the top-left corner directly

  assert.equal(countFilled(tapped.board), 4);
  assert.equal(tapped.score, dragged.score);
  assert.equal(JSON.stringify(tapped.board), JSON.stringify(dragged.board));
});
