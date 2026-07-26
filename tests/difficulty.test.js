/**
 * Feature 2 — the level 1 → 10 difficulty ladder.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS } from "../js/config.js";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  levelConfig,
  levelForLines,
  levelProgress,
  linesToNextLevel,
  multiplierFor,
} from "../js/difficulty.js";
import { SHAPES, shapePoolFor, pickShape, randomTray } from "../js/pieces.js";
import { newGame, piece, setBoard, rowWithGap, seededRng, gridlock } from "./helpers.js";

test("the ladder runs from 1 to 10", () => {
  assert.equal(MIN_LEVEL, 1);
  assert.equal(MAX_LEVEL, 10);
  assert.equal(LEVELS.length, 10);
});

test("each level is harder and pays better than the one before", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    const prev = LEVELS[i - 1];
    const cur = LEVELS[i];
    assert.ok(cur.linesToReach > prev.linesToReach, `level ${cur.level} needs more lines`);
    assert.ok(cur.multiplier > prev.multiplier, `level ${cur.level} pays more`);
    assert.ok(cur.maxPieceDifficulty >= prev.maxPieceDifficulty, `level ${cur.level} allows harder shapes`);
    assert.ok(cur.hardBias >= prev.hardBias, `level ${cur.level} leans harder`);
  }
});

test("early levels pay less than par, late levels pay a premium", () => {
  assert.ok(multiplierFor(1) < 1, "level 1 is a gentle, low-scoring warm-up");
  assert.ok(multiplierFor(MAX_LEVEL) > 3, "level 10 is worth the pain");
});

test("levelForLines lands on the right rung at every threshold", () => {
  for (const row of LEVELS) {
    assert.equal(levelForLines(row.linesToReach), row.level, `exactly at level ${row.level}`);
    if (row.level > MIN_LEVEL) {
      assert.equal(levelForLines(row.linesToReach - 1), row.level - 1, `just short of level ${row.level}`);
    }
  }
});

test("levelForLines clamps at both ends", () => {
  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(-5), 1);
  assert.equal(levelForLines(100000), MAX_LEVEL);
});

test("levelConfig clamps out-of-range input instead of throwing", () => {
  assert.equal(levelConfig(0).level, 1);
  assert.equal(levelConfig(99).level, MAX_LEVEL);
  assert.equal(levelConfig(undefined).level, 1);
});

test("progress runs 0 → 1 inside a level and pins at 1 on level 10", () => {
  assert.equal(levelProgress(0), 0);

  const halfway = (LEVELS[1].linesToReach - LEVELS[0].linesToReach) / 2;
  const mid = levelProgress(halfway);
  assert.ok(mid > 0 && mid < 1);

  assert.equal(levelProgress(LEVELS[MAX_LEVEL - 1].linesToReach), 1);
  assert.equal(levelProgress(99999), 1);
});

test("linesToNextLevel counts down and stops at the top", () => {
  assert.equal(linesToNextLevel(0), LEVELS[1].linesToReach);
  assert.equal(linesToNextLevel(LEVELS[1].linesToReach - 1), 1);
  assert.equal(linesToNextLevel(LEVELS[MAX_LEVEL - 1].linesToReach), 0);
});

test("level 1 only offers the friendliest shapes", () => {
  const pool = shapePoolFor(1);
  assert.ok(pool.length > 0);
  assert.ok(pool.every((s) => s.difficulty <= levelConfig(1).maxPieceDifficulty));
  assert.ok(!pool.some((s) => s.name === "square-3"), "no 3×3 block at level 1");
  assert.ok(!pool.some((s) => s.name === "ess"), "no S-piece at level 1");
});

test("the shape pool only ever grows as levels go up", () => {
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const smaller = shapePoolFor(level - 1);
    const bigger = shapePoolFor(level);
    assert.ok(bigger.length >= smaller.length);
    for (const shape of smaller) {
      assert.ok(bigger.includes(shape), `${shape.name} still available at level ${level}`);
    }
  }
});

test("level 10 can draw every shape, including the 3×3", () => {
  const pool = shapePoolFor(MAX_LEVEL);
  assert.equal(pool.length, SHAPES.length);
  assert.ok(pool.some((s) => s.name === "square-3"));
});

test("hard shapes actually turn up more often at high levels", () => {
  const averageDifficulty = (level) => {
    const rng = seededRng(42);
    let total = 0;
    const draws = 4000;
    for (let i = 0; i < draws; i++) total += pickShape(level, rng).difficulty;
    return total / draws;
  };

  assert.ok(averageDifficulty(MAX_LEVEL) > averageDifficulty(5));
  assert.ok(averageDifficulty(5) > averageDifficulty(1));
});

test("a level-1 tray never contains a shape that level bans", () => {
  const rng = seededRng(7);
  const allowed = new Set(shapePoolFor(1).map((s) => s.name));
  for (let i = 0; i < 200; i++) {
    for (const p of randomTray(3, { level: 1, rng })) {
      assert.ok(allowed.has(p.name), `${p.name} should not appear at level 1`);
    }
  }
});

test("easy levels refuse to deal a tray where nothing fits", () => {
  const game = newGame(3);
  assert.equal(levelConfig(1).guaranteeFit, true);

  // one usable square left; only a dot can go anywhere
  gridlock(game);
  game._refillTray();

  assert.ok(
    game.tray.some((p) => game.anyPlacementExists(p)),
    "the beginner safety net keeps at least one playable piece"
  );
});

test("clearing enough lines levels the game up and pays a bonus", () => {
  const game = newGame();
  const target = LEVELS[1].linesToReach;

  const seen = [];
  game.on("levelup", (payload) => seen.push(payload));

  for (let i = 0; i < target; i++) {
    setBoard(game, [rowWithGap(7)]);
    game.tray = [piece(["X"]), null, null];
    game.place(0, 0, 7);
  }

  assert.equal(game.linesCleared, target);
  assert.equal(game.level, 2);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].level, 2);
  assert.equal(seen[0].previous, 1);
  assert.ok(seen[0].bonus > 0);
});

test("a fresh game drops back to level 1", () => {
  const game = newGame();
  game.level = 7;
  game.linesCleared = 60;
  game.reset();
  assert.equal(game.level, 1);
  assert.equal(game.linesCleared, 0);
});
