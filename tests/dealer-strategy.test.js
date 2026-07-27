/**
 * The dealer's judgement — the part that replaced "difficulty: 8".
 *
 * The claim this release makes is that there are no easy or hard shapes,
 * only shapes that are easy or hard on the board in front of you. These
 * tests are that claim, written down.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE, TRAY_SLOTS } from "../js/config.js";
import { MAX_LEVEL, MIN_LEVEL } from "../js/difficulty.js";
import { SHAPES } from "../js/pieces.js";
import { evaluatePool, evaluateShape } from "../js/dealer/evaluate.js";
import { boardHealth, lineCounts, sweepPlan } from "../js/dealer/board.js";
import { playableInSomeOrder, placementsFor } from "../js/dealer/placement.js";
import { composeTray } from "../js/dealer/compose.js";
import { dealTray, evaluationBias, generosity, sequenceGuarantee } from "../js/dealer/index.js";
import { boardFrom, emptyBoard, gridlock, newGame, rowWithGap, seededRng } from "./helpers.js";

const byName = (name) => SHAPES.find((s) => s.name === name);

function contextFor(board, level) {
  return {
    base: boardHealth(board),
    counts: lineCounts(board),
    sweep: sweepPlan(board),
    level,
  };
}

const evaluate = (board, name, level = MAX_LEVEL) =>
  evaluateShape(board, byName(name), contextFor(board, level));

// ---------- the premise ----------

test("the same shape is worth different things on different boards", () => {
  // `value` is a shape's standing among everything else available on this
  // particular board — which is the only sense in which a shape has a
  // value at all.
  const rank = (board, name) =>
    evaluatePool(board, SHAPES, { level: MAX_LEVEL }).find((e) => e.shape.name === name);

  // a row three from complete, with a clean lane to drop a 5-bar into
  const welcoming = rank(boardFrom(["XXX.....", "XXXXXXX."]), "penta-h");

  // the same number of blocks, arranged so a long bar just makes a mess
  const hostile = rank(
    boardFrom([
      "X.X.X.X.",
      "........",
      "X.X.X.X.",
      "........",
      "..X.X...",
    ]),
    "penta-h"
  );

  assert.ok(welcoming.fits && hostile.fits, "it can be placed on both");
  assert.ok(
    welcoming.value > hostile.value,
    `the 5-bar is not a "hard piece": ${hostile.value.toFixed(2)} → ${welcoming.value.toFixed(2)}`
  );
});

test("a single square is the best piece in the game when a row needs exactly one", () => {
  const board = boardFrom([rowWithGap(7)]);
  const entries = evaluatePool(board, SHAPES, { level: MAX_LEVEL });
  const dot = entries.find((e) => e.shape.name === "dot");

  assert.equal(dot.bestLines, 1, "it finishes the row");
  assert.equal(dot.perfect, true, "…and that empties the board");
});

test("a shape that fits nowhere scores nothing and is never drafted", () => {
  const game = newGame();
  gridlock(game); // only isolated single cells remain

  const entries = evaluatePool(game.board, SHAPES, { level: MAX_LEVEL });
  const big = entries.find((e) => e.shape.name === "square-3");
  const dot = entries.find((e) => e.shape.name === "dot");

  assert.equal(big.fits, false);
  assert.equal(big.spots, 0);
  assert.equal(dot.fits, true);
});

test("evaluation is normalised, so the dials mean the same thing on any board", () => {
  for (const board of [emptyBoard(), boardFrom(["XXXXXXX.", "XX.XX..."])]) {
    const fitting = evaluatePool(board, SHAPES, { level: MAX_LEVEL }).filter((e) => e.fits);
    assert.ok(fitting.length > 1);
    for (const entry of fitting) {
      assert.ok(entry.value >= 0 && entry.value <= 1, `${entry.shape.name} is in range`);
    }
    assert.ok(Math.max(...fitting.map((e) => e.value)) === 1);
    assert.ok(Math.min(...fitting.map((e) => e.value)) === 0);
  }
});

test("the evaluator spots a piece that would empty the whole board", () => {
  // one row left, three cells short, and a 3-bar finishes it
  const board = boardFrom(["XXXXX..."]);
  const tri = evaluate(board, "tri-h");
  assert.equal(tri.perfect, true);

  const domino = evaluate(board, "domino-h");
  assert.equal(domino.perfect, false, "two cells leaves one behind");
});

// ---------- the dials ----------

test("generosity falls the whole way up the ladder", () => {
  for (let level = MIN_LEVEL + 1; level <= MAX_LEVEL; level++) {
    assert.ok(
      generosity(level) < generosity(level - 1),
      `level ${level} is less generous than ${level - 1}`
    );
  }
  assert.equal(generosity(MIN_LEVEL), 1);
  assert.ok(generosity(MAX_LEVEL) < 0.2);
});

test("the dealer goes from helpful to indifferent to mildly awkward", () => {
  assert.ok(evaluationBias(1) > 4, "level 1 leans hard on your side");
  assert.ok(Math.abs(evaluationBias(10)) < 1, "the middle of the ladder is roughly neutral");
  assert.ok(evaluationBias(MAX_LEVEL) < 0, "the top stops doing you favours");
});

test("but it is never as spiteful as it is generous", () => {
  assert.ok(
    Math.abs(evaluationBias(MAX_LEVEL)) < evaluationBias(MIN_LEVEL) / 2,
    "a dealer that always hands over the worst piece is rigged, not hard"
  );
});

test("the top of the ladder still has somewhere left to go", () => {
  // the old clamp made levels 16-20 identical, which wasted the last five rungs
  for (const level of [16, 17, 18, 19, 20]) {
    assert.ok(evaluationBias(level) < evaluationBias(level - 1), `level ${level} moved`);
  }
});

test("the sequence guarantee is certain early and a real risk late", () => {
  assert.equal(sequenceGuarantee(MIN_LEVEL), 1);
  assert.ok(sequenceGuarantee(MAX_LEVEL) > 0.5, "still more likely than not");
  assert.ok(sequenceGuarantee(MAX_LEVEL) < 0.7, "…but no longer a promise");
});

// ---------- playing a tray out ----------

test("playableInSomeOrder finds an order that works", () => {
  const board = emptyBoard();
  const shapes = [byName("square-3").cells, byName("penta-h").cells, byName("dot").cells];
  assert.equal(playableInSomeOrder(board, shapes).playable, true);
});

test("playableInSomeOrder catches a tray that only *looks* playable", () => {
  // Row 0 and column 0 are empty, so nothing on this board is one move
  // from clearing — and neither strip is two cells wide, so neither takes
  // a 2×2. That leaves exactly one 2×2 pocket, at rows 3-4, columns 3-4.
  //
  // Two 2×2 blocks: each fits the board as it stands, and the second has
  // nowhere to go once the first is down. This is the case the old
  // per-piece check couldn't see.
  const board = boardFrom([
    "........",
    ".XXXXXXX",
    ".XXXXXXX",
    ".XX..XXX",
    ".XX..XXX",
    ".XXXXXXX",
    ".XXXXXXX",
    ".XXXXXXX",
  ]);
  const square = byName("square-2").cells;

  assert.equal(placementsFor(board, square).length, 1, "exactly one home for it");
  assert.equal(playableInSomeOrder(board, [square]).playable, true);
  assert.equal(
    playableInSomeOrder(board, [square, square]).playable,
    false,
    "…but not twice, and filling it clears nothing"
  );
});

test("the sequence search fails open rather than stalling the game", () => {
  // a budget of one node can't prove anything, so it must not claim a
  // tray is dead on the strength of having given up
  const board = emptyBoard();
  const shapes = [byName("square-3").cells, byName("square-3").cells, byName("square-3").cells];
  const verdict = playableInSomeOrder(board, shapes, 1);
  assert.equal(verdict.playable, true);
  assert.equal(verdict.exhausted, true);
});

// ---------- composing a tray ----------

test("a composed tray is playable all the way through, at the levels that promise it", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const rng = seededRng(seed * 13);
    const board = boardFrom([
      "XXXX....",
      "XX.XXX..",
      "XXXXXX..",
      "X.XX....",
    ]);
    const tray = dealTray(TRAY_SLOTS, { level: 1, board, rng });
    assert.ok(
      playableInSomeOrder(board, tray.map((p) => p.cells)).playable,
      `seed ${seed} dealt a tray that can't be played out at level 1`
    );
  }
});

test("the tray is built against the board it will be played on", () => {
  // Dealing without a board is the honest control: same level, same
  // curve, no eyes. Measured over crowded boards, where the difference
  // between looking and guessing is the difference between a move and a
  // shrug.
  const rng = seededRng(4242);
  const crowdedBoard = () => {
    const rows = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      let row = "";
      for (let c = 0; c < BOARD_SIZE; c++) row += rng() < 0.72 ? "X" : ".";
      rows.push(row);
    }
    return boardFrom(rows);
  };

  let aware = 0;
  let blind = 0;
  const runs = 150;
  for (let seed = 1; seed <= runs; seed++) {
    const board = crowdedBoard();
    const fits = (piece) => placementsFor(board, piece.cells).length > 0;
    aware += dealTray(TRAY_SLOTS, { level: MAX_LEVEL, board, rng }).filter(fits).length;
    blind += dealTray(TRAY_SLOTS, { level: MAX_LEVEL, rng }).filter(fits).length;
  }

  const total = runs * TRAY_SLOTS;
  assert.ok(
    aware / total > 1.5 * (blind / total),
    `board-aware dealt ${((aware / total) * 100).toFixed(0)}% playable pieces, ` +
      `board-blind ${((blind / total) * 100).toFixed(0)}%`
  );
});

test("whatever it deals, the first piece always has somewhere to go", () => {
  // Later slots are judged against the board an earlier piece would
  // leave, so they may be pieces that only fit *after* you play well —
  // that's the point. The piece in your hand right now is not allowed to
  // be one of those.
  const board = boardFrom([
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
    "XXXXXX..",
  ]);

  for (let seed = 1; seed <= 150; seed++) {
    const tray = dealTray(TRAY_SLOTS, { level: MAX_LEVEL, board, rng: seededRng(seed * 19) });
    assert.ok(
      tray.some((p) => placementsFor(board, p.cells).length > 0),
      `seed ${seed} dealt a tray with nothing to play`
    );
  }
});

test("later slots are judged on the board the earlier ones would leave", () => {
  // Exactly one 3×3 pocket. Two 3×3 blocks would be a dead second piece,
  // so the look-ahead has to notice the first one fills the hole.
  const board = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (r >= 5 && c >= 5) continue;
      board[r][c] = "#abc";
    }
  }

  let doubled = 0;
  const runs = 80;
  for (let seed = 1; seed <= runs; seed++) {
    const shapes = composeTray(TRAY_SLOTS, {
      level: MAX_LEVEL,
      board,
      rng: seededRng(seed * 29),
    });
    if (shapes.filter((s) => s.name === "square-3").length > 1) doubled++;
  }

  assert.equal(doubled, 0, `${doubled}/${runs} trays contained two 3×3 blocks for one 3×3 hole`);
});

test("a board within reach of a full clear is offered the pieces to do it", () => {
  // one row, three cells short of complete — and clearing it empties the board
  const board = boardFrom(["XXXXX..."]);

  let offered = 0;
  const runs = 120;
  for (let seed = 1; seed <= runs; seed++) {
    const tray = dealTray(TRAY_SLOTS, { level: 1, board, rng: seededRng(seed * 11) });
    if (tray.some((p) => p.name === "tri-h" || p.cells.length === 3)) offered++;
  }

  assert.ok(
    offered / runs > 0.6,
    `only ${offered}/${runs} trays offered a piece that could sweep the board`
  );
});

test("the whole-board bonus fades as the ladder climbs", () => {
  const board = boardFrom(["XXXXX..."]);

  const sweepRate = (level) => {
    let offered = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      const tray = dealTray(TRAY_SLOTS, { level, board, rng: seededRng(seed * 23) });
      if (tray.some((p) => p.cells.length === 3 && p.width === 3)) offered++;
    }
    return offered / runs;
  };

  assert.ok(
    sweepRate(1) > sweepRate(MAX_LEVEL),
    "a perfect clear should be handed to you early and earned late"
  );
});
