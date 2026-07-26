/**
 * Feature 3 — the reward system.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SCORING } from "../js/config.js";
import {
  comboMultiplier,
  placementPoints,
  clearPoints,
  clearBonuses,
  levelUpBonus,
} from "../js/scoring.js";
import { MAX_LEVEL } from "../js/difficulty.js";
import { newGame, piece, setBoard, rowWithGap, recordEvents } from "./helpers.js";

test("placing pays per cell, scaled by the level", () => {
  const easy = placementPoints(4, 1);
  const hard = placementPoints(4, MAX_LEVEL);
  assert.ok(easy > 0);
  assert.ok(hard > easy, "the same piece is worth more at level 10");
});

test("multi-line clears grow with the square of the line count", () => {
  const one = clearPoints(1, 1, 3);
  const two = clearPoints(2, 1, 3);
  const three = clearPoints(3, 1, 3);

  assert.equal(two, one * 4);
  assert.equal(three, one * 9);
  assert.ok(two > one * 2, "a double beats two singles");
});

test("no lines means no clear points", () => {
  assert.equal(clearPoints(0, 5, 10), 0);
  assert.equal(clearPoints(undefined, 1, 1), 0);
});

test("combos add 50% a step and then stop growing", () => {
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(2), 1 + SCORING.comboBonusPerStep);
  assert.equal(comboMultiplier(3), 1 + SCORING.comboBonusPerStep * 2);

  const capped = comboMultiplier(SCORING.maxComboStep);
  assert.equal(comboMultiplier(SCORING.maxComboStep + 50), capped, "the cap holds");
});

test("a longer combo is worth more for the same clear", () => {
  assert.ok(clearPoints(1, 4, 1) > clearPoints(1, 1, 1));
});

test("bonuses fire only when they've been earned", () => {
  const none = clearBonuses({ rows: [1], cols: [], level: 1 });
  assert.deepEqual(none, []);

  const cross = clearBonuses({ rows: [1], cols: [2], level: 1 });
  assert.deepEqual(cross.map((b) => b.type), ["cross"]);

  const everything = clearBonuses({
    rows: [1],
    cols: [2],
    boardEmpty: true,
    flawlessTray: true,
    level: 1,
  });
  assert.deepEqual(everything.map((b) => b.type), ["cross", "perfect", "flawlessTray"]);
  assert.ok(everything.every((b) => b.points > 0 && b.label));
});

test("bonuses scale with the level too", () => {
  const [low] = clearBonuses({ rows: [1], cols: [2], level: 1 });
  const [high] = clearBonuses({ rows: [1], cols: [2], level: MAX_LEVEL });
  assert.ok(high.points > low.points);
});

test("the level-up lump sum grows with the level reached", () => {
  assert.ok(levelUpBonus(5) > levelUpBonus(2));
  assert.equal(levelUpBonus(2), SCORING.levelUpBonus * 2);
});

test("the same clear scores more at a higher level", () => {
  const scoreAtLevel = (level) => {
    const game = newGame();
    game.level = level;
    setBoard(game, [rowWithGap(7)]);
    game.tray = [piece(["X"]), null, null];
    game.place(0, 0, 7);
    return game.score;
  };

  assert.ok(scoreAtLevel(8) > scoreAtLevel(1), "level 8 pays more than level 1");
});

test("clearing a line with all three tray pieces earns the flawless-tray bonus", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7), rowWithGap(7), rowWithGap(7)]);
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  const events = recordEvents(game, ["bonus"]);

  game.place(0, 0, 7);
  assert.equal(events.filter((e) => e.payload.type === "flawlessTray").length, 0);

  game.place(1, 1, 7);
  assert.equal(events.filter((e) => e.payload.type === "flawlessTray").length, 0);

  game.place(2, 2, 7);
  assert.equal(
    events.filter((e) => e.payload.type === "flawlessTray").length,
    1,
    "awarded once, on the third clearing placement"
  );
});

test("one wasted piece costs you the flawless-tray bonus", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7), rowWithGap(7)]);
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  const events = recordEvents(game, ["bonus"]);
  game.place(0, 0, 7); // clears
  game.place(1, 5, 5); // clears nothing
  game.place(2, 1, 7); // clears

  assert.equal(events.filter((e) => e.payload.type === "flawlessTray").length, 0);
});

test("the tray counters reset with each new tray", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  game.place(1, 0, 2);
  game.place(2, 0, 4);

  assert.equal(game.trayPlacements, 0);
  assert.equal(game.trayClears, 0);
});

test("every bonus that fires also lands in the score", () => {
  const game = newGame();
  for (let c = 1; c < 8; c++) game.board[0][c] = "#abc";
  for (let r = 1; r < 8; r++) game.board[r][0] = "#abc";
  game.tray = [piece(["X"]), null, null];

  const events = recordEvents(game, ["bonus"]);
  game.place(0, 0, 0);

  const bonusTotal = events.reduce((sum, e) => sum + e.payload.points, 0);
  assert.ok(bonusTotal > 0);
  assert.ok(game.score >= bonusTotal, "the bonuses are part of the running score");
});
