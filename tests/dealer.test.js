/**
 * The board-aware dealer: pieces that fit the board you actually have,
 * and a way out when you need one.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE, LEVELS, TRAY_SLOTS } from "../js/config.js";
import { MAX_LEVEL } from "../js/difficulty.js";
import {
  dealTray,
  fillRatio,
  shapeFits,
  shapeClearsLine,
  rescueChance,
  shapeOdds,
} from "../js/dealer/index.js";
import { seededRng, emptyBoard, boardFrom, rowWithGap, gridlock, newGame } from "./helpers.js";

const dot = [[0, 0]];
const domino = [[0, 0], [0, 1]];
const bigSquare = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];

// ---------- probes ----------

test("fillRatio measures how full the board is", () => {
  assert.equal(fillRatio(emptyBoard()), 0);

  const full = emptyBoard().map((row) => row.map(() => "#abc"));
  assert.equal(fillRatio(full), 1);

  const half = boardFrom(Array.from({ length: 4 }, () => "X".repeat(BOARD_SIZE)));
  assert.equal(fillRatio(half), 0.5);
});

test("shapeFits knows what can and can't be placed", () => {
  const board = emptyBoard();
  assert.equal(shapeFits(board, bigSquare), true);

  const game = newGame();
  gridlock(game);
  assert.equal(shapeFits(game.board, dot), true, "the isolated holes take a single square");
  assert.equal(shapeFits(game.board, domino), false, "…but nothing bigger");
  assert.equal(shapeFits(game.board, bigSquare), false);
});

test("shapeClearsLine spots a piece that would finish a row", () => {
  const board = boardFrom([rowWithGap(7)]);
  assert.equal(shapeClearsLine(board, dot), true, "one square completes the row");

  assert.equal(shapeClearsLine(emptyBoard(), dot), false, "nothing to complete on an empty board");
});

test("shapeClearsLine spots a column too", () => {
  const board = emptyBoard();
  for (let r = 0; r < BOARD_SIZE - 1; r++) board[r][3] = "#abc";
  assert.equal(shapeClearsLine(board, dot), true);
});

test("shapeClearsLine needs the piece to actually fit the gap", () => {
  // a row with two gaps that aren't adjacent — a domino can't finish it
  const board = boardFrom(["X.XXX.XX"]);
  assert.equal(shapeClearsLine(board, domino), false);
  assert.equal(shapeClearsLine(board, dot), false, "one square leaves the other gap open");
});

// ---------- rescue pressure ----------

test("a fuller board makes a rescue piece more likely", () => {
  for (const level of [1, 5, MAX_LEVEL]) {
    const empty = rescueChance(level, 0);
    const tight = rescueChance(level, 0.85);
    assert.ok(tight > empty, `level ${level}: ${empty.toFixed(2)} → ${tight.toFixed(2)}`);
    assert.ok(tight <= 1);
  }
});

test("an empty board leaves the level's own odds alone", () => {
  for (const row of LEVELS) {
    assert.equal(rescueChance(row.level, 0), row.clearChance);
  }
});

test("high levels are stingier than low ones at the same pressure", () => {
  assert.ok(rescueChance(1, 0.3) > rescueChance(MAX_LEVEL, 0.3));
});

test("a nearly full board rescues you even at level 10", () => {
  assert.ok(rescueChance(MAX_LEVEL, 1) > 0.95, "at full pressure it's near certain");
});

// ---------- dealing ----------

test("a deal produces the right number of playable pieces", () => {
  const tray = dealTray(TRAY_SLOTS, { level: 1, board: emptyBoard(), rng: seededRng(1) });
  assert.equal(tray.length, TRAY_SLOTS);
  for (const piece of tray) {
    assert.ok(piece.cells.length > 0);
    assert.ok(piece.color);
    assert.ok(piece.name);
    assert.equal(piece.width, Math.max(...piece.cells.map((c) => c[1])) + 1);
  }
});

test("pieces get unique ids so the tray can tell them apart", () => {
  const tray = dealTray(3, { level: 5, board: emptyBoard(), rng: seededRng(2) });
  const ids = new Set(tray.map((p) => p.id));
  assert.equal(ids.size, 3);
});

test("the dealer never hands you a tray where nothing fits", () => {
  // only isolated single squares remain
  const game = newGame();
  gridlock(game);

  for (let seed = 1; seed <= 60; seed++) {
    const tray = dealTray(TRAY_SLOTS, {
      level: MAX_LEVEL,
      board: game.board,
      rng: seededRng(seed),
    });
    assert.ok(
      tray.some((p) => shapeFits(game.board, p.cells)),
      `seed ${seed} dealt a dead tray`
    );
  }
});

test("a tight board gets offered a way to clear a line", () => {
  // seven rows full bar one column, and the last row nearly full:
  // lots of pressure, and a single square would clear a lot
  const rows = Array.from({ length: 7 }, () => rowWithGap(7));
  const board = boardFrom(rows);

  let offered = 0;
  const runs = 60;
  for (let seed = 1; seed <= runs; seed++) {
    const tray = dealTray(TRAY_SLOTS, {
      level: MAX_LEVEL,
      board,
      rng: seededRng(seed * 17),
    });
    if (tray.some((p) => shapeClearsLine(board, p.cells))) offered++;
  }

  assert.ok(
    offered / runs > 0.9,
    `only ${offered}/${runs} tight-board trays offered a clear, even at level 10`
  );
});

test("an easy level offers a clear far more often than pure chance would", () => {
  const board = boardFrom([rowWithGap(7), rowWithGap(7)]);

  let offered = 0;
  const runs = 60;
  for (let seed = 1; seed <= runs; seed++) {
    const tray = dealTray(TRAY_SLOTS, { level: 1, board, rng: seededRng(seed * 31) });
    if (tray.some((p) => shapeClearsLine(board, p.cells))) offered++;
  }

  assert.ok(offered / runs > 0.85, `level 1 only offered a clear ${offered}/${runs} times`);
});

test("an empty board is dealt from the level curve, not the rescue rules", () => {
  // nothing can clear a line on an empty board, so the dealer must not
  // get stuck trying to find one
  const tray = dealTray(TRAY_SLOTS, { level: 1, board: emptyBoard(), rng: seededRng(9) });
  assert.equal(tray.length, TRAY_SLOTS);
});

test("the dealer works without a board at all", () => {
  const tray = dealTray(TRAY_SLOTS, { level: 4, rng: seededRng(4) });
  assert.equal(tray.length, TRAY_SLOTS);
});

test("trays lean toward variety rather than three of the same", () => {
  let identical = 0;
  const runs = 200;
  for (let seed = 1; seed <= runs; seed++) {
    const tray = dealTray(3, { level: 6, board: emptyBoard(), rng: seededRng(seed) });
    if (new Set(tray.map((p) => p.name)).size === 1) identical++;
  }
  assert.ok(identical / runs < 0.02, `${identical}/${runs} trays were three of a kind`);
});

test("a full board can't be rescued, and the dealer doesn't hang trying", () => {
  const full = emptyBoard().map((row) => row.map(() => "#abc"));
  const tray = dealTray(TRAY_SLOTS, { level: 3, board: full, rng: seededRng(6) });
  assert.equal(tray.length, TRAY_SLOTS, "it still deals — the game-over check is elsewhere");
});

// ---------- the odds table the menu shows ----------

test("shapeOdds adds up to 100% and is sorted", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const odds = shapeOdds(level);
    const total = odds.reduce((sum, o) => sum + o.share, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `level ${level} sums to ${total}`);

    for (let i = 1; i < odds.length; i++) {
      assert.ok(odds[i - 1].share >= odds[i].share, "sorted most common first");
    }
  }
});

test("shapeOdds only lists shapes that are actually unlocked", () => {
  const level1 = shapeOdds(1).map((o) => o.shape.name);
  assert.ok(!level1.includes("square-3"));
  assert.ok(level1.includes("domino-h"));
  assert.equal(shapeOdds(MAX_LEVEL).some((o) => o.shape.name === "square-3"), true);
});
