/**
 * The dealer's eyes — reading a grid.
 *
 * These are the measurements every decision in js/dealer/ is built on, so
 * they're tested on boards you can read in the source rather than through
 * the dealer.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE } from "../js/config.js";
import {
  boardHealth,
  concentration,
  filledCount,
  isBoardEmpty,
  openRegions,
  sweepPlan,
} from "../js/dealer/board.js";
import { boardFrom, emptyBoard, rowWithGap } from "./helpers.js";

// ---------- regions ----------

test("openRegions sees one open area on an empty board", () => {
  const regions = openRegions(emptyBoard());
  assert.equal(regions.count, 1);
  assert.equal(regions.largest, BOARD_SIZE * BOARD_SIZE);
  assert.equal(regions.empty, BOARD_SIZE * BOARD_SIZE);
  assert.equal(regions.singles, 0);
});

test("openRegions counts separate pockets, and the dead ones", () => {
  // a wall down column 3 with a single hole punched in the left half
  const board = boardFrom([
    "XXXXXXXX",
    "XXX.XXXX",
    "XXX.XXXX",
    "XXX.XXXX",
    "XXX.XXXX",
    "XXX.XXXX",
    "XXX.XXXX",
    ".XX.XXXX",
  ]);

  const regions = openRegions(board);
  assert.equal(regions.count, 2, "the column and the lone corner");
  assert.equal(regions.largest, 7);
  assert.equal(regions.singles, 1, "the corner takes nothing but a dot");
});

test("openRegions is reusable — its scratch space doesn't leak between calls", () => {
  const board = boardFrom(["XXXXXXX."]);
  const first = openRegions(board);
  for (let i = 0; i < 300; i++) openRegions(board); // roll the generation counter over
  assert.deepEqual(openRegions(board), first);
});

// ---------- concentration ----------

test("concentration rewards blocks gathered into near-complete lines", () => {
  const gathered = boardFrom([rowWithGap(7), rowWithGap(7)]);

  // the same 14 blocks, spread thinly over seven rows and every column
  const smeared = boardFrom([
    "XX......",
    "..XX....",
    "....XX..",
    "......XX",
    "X.X.....",
    "....X.X.",
    ".X.X....",
  ]);

  assert.equal(filledCount(gathered), 14);
  assert.equal(filledCount(smeared), 14);
  assert.ok(
    concentration(gathered) > concentration(smeared),
    `same amount of stuff, much better position: ` +
      `${concentration(smeared).toFixed(3)} → ${concentration(gathered).toFixed(3)}`
  );
});

// ---------- health ----------

test("an emptier board is healthier than a fuller one", () => {
  const light = boardFrom(["XXX....."]);
  const heavy = boardFrom(["XXXXXXX.", "XXXXX...", "XX.X.X.."]);
  assert.ok(boardHealth(light) > boardHealth(heavy));
});

test("holes and scattered pockets cost you", () => {
  // ten blocks in a tidy block, versus ten arranged to strand single cells
  const tidy = boardFrom(["XXXXX...", "XXXXX..."]);
  const holey = boardFrom([
    "X.X.X.X.",
    "XXXXXXXX",
  ]);
  assert.ok(boardHealth(tidy) > boardHealth(holey), "the scattered board is worse to play from");
});

test("clearing a line is the healthiest thing that can happen", () => {
  const before = boardFrom([rowWithGap(7)]);
  const after = emptyBoard();
  assert.ok(boardHealth(after) > boardHealth(before));
});

// ---------- the sweep plan ----------

test("sweepPlan finds the lines that would empty a sparse board", () => {
  const board = boardFrom(["XXXXXXX.", "XXXXXX.."]);
  const plan = sweepPlan(board);

  assert.equal(plan.feasible, true);
  assert.equal(plan.lines, 2);
  assert.ok(plan.rows.has(0) && plan.rows.has(1));
  assert.equal(plan.filled, 13);
});

test("sweepPlan takes columns when that's the cheaper cover", () => {
  const board = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) board[r][2] = "#abc";

  const plan = sweepPlan(board);
  assert.equal(plan.feasible, true);
  assert.equal(plan.lines, 1);
  assert.ok(plan.cols.has(2));
});

test("a board too scattered to cover isn't a sweep opportunity", () => {
  const board = boardFrom([
    "X.......",
    "..X.....",
    "....X...",
    "......X.",
    ".X......",
    "...X....",
  ]);
  const plan = sweepPlan(board);
  assert.equal(plan.feasible, false, "six lines is not 'within reach'");
});

test("an empty board has nothing to sweep", () => {
  const plan = sweepPlan(emptyBoard());
  assert.equal(plan.feasible, false);
  assert.equal(plan.filled, 0);
  assert.equal(isBoardEmpty(emptyBoard()), true);
});
