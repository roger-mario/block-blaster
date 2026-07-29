/**
 * Lifelines — three of them, one use each per game, two of them only
 * unlocked for part of the difficulty ladder.
 *
 *   Rewind   take back the last move, levels 1–5 only
 *   Shuffle  re-deal the pieces still in the tray, any level
 *   Wipe     clear the whole board, level 5 and up
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LIFELINES } from "../js/config.js";
import { newGame, piece, setBoard, rowWithGap, countFilled, gridlock } from "./helpers.js";

/** Drops the game onto a given rung of the ladder without playing to it. */
function atLevel(game, level) {
  game.level = level;
  return game;
}

// ---------- the pot ----------

test("a game starts with every lifeline unspent", () => {
  const game = newGame();
  for (const spec of LIFELINES) {
    assert.equal(game.lifelineUsed[spec.id], false, `${spec.id} is unspent`);
  }
  assert.equal(game.lifelineStatuses().length, LIFELINES.length);
});

test("rewind is offered only once there is a move to take back", () => {
  const game = newGame();
  assert.equal(game.canUndo(), false);
  assert.equal(game.lifelineStatus("undo").reason, "Nothing to take back");
  assert.equal(game.undo(), false);

  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  assert.equal(game.canUndo(), true);
});

test("a reset hands all three lifelines back", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  game.undo();
  assert.equal(game.lifelineUsed.undo, true);

  game.reset();
  for (const spec of LIFELINES) {
    assert.equal(game.lifelineUsed[spec.id], false, `${spec.id} is back`);
  }
  assert.equal(game.canUndo(), false, "…but there is nothing to rewind to yet");
});

test("every lifeline announces itself when it is spent", () => {
  const game = newGame();
  const seen = [];
  game.on("lifelines", (payload) => seen.push(payload));

  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  assert.equal(seen.at(-1).used.undo, false);

  game.undo();
  assert.equal(seen.at(-1).used.undo, true);
  assert.equal(seen.at(-1).statuses.find((s) => s.id === "undo").available, false);
});

test("useLifeline refuses an unknown id rather than throwing", () => {
  const game = newGame();
  assert.equal(game.useLifeline("teleport"), false);
  assert.equal(game.canUseLifeline("teleport"), false);
});

// ---------- rewind ----------

test("rewind puts the board, tray and score back exactly as they were", () => {
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

test("rewind rolls back a clear, the combo and the lines counter", () => {
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

test("rewind is gone for the rest of the game once it is used", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  assert.equal(game.undo(), true);

  game.place(1, 4, 4);
  assert.equal(game.canUndo(), false, "a second rewind is not on offer");
  assert.equal(game.undo(), false);
  assert.equal(countFilled(game.board), 1, "the board did not move");
  assert.equal(game.lifelineStatus("undo").reason, "Already used");
});

test("rewind is locked above level 5", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  atLevel(game, 6).place(0, 0, 0);

  assert.equal(game.canUndo(), false);
  assert.equal(game.lifelineStatus("undo").reason, "Gone after level 5");
  assert.equal(game.undo(), false);
  assert.equal(countFilled(game.board), 1, "the move stands");
  assert.equal(game.lifelineUsed.undo, false, "a refused rewind is not spent");
});

test("rewind still works at level 5 itself", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  atLevel(game, 5).place(0, 0, 0);

  assert.equal(game.undo(), true);
  assert.equal(countFilled(game.board), 0);
});

test("rewind is withdrawn once the game is over", () => {
  const game = newGame();
  gridlock(game);
  game.tray = [piece(["X"]), piece(["XX"]), null];

  game.place(0, 0, 0);
  assert.equal(game.over, true);

  // it used to un-kill you from the Game Over screen. A lifeline is a
  // decision you take with the board in front of you, not an offer you
  // accept at the end — only Wipe survives that.
  assert.equal(game.canUndo(), false, "the fatal move is not handed back");
  assert.equal(game.lifelineStatus("undo").reason, "Too late — the game is over");
  assert.equal(game.undo(), false);
  assert.equal(game.over, true, "still over");
  assert.ok(game.board[0][0], "and the fatal move stands");
});

// ---------- shuffle ----------

test("shuffle re-deals the pieces still in the tray", () => {
  const game = newGame();
  const before = game.tray.map((p) => p.id);

  assert.equal(game.useLifeline("shuffle"), true);
  assert.equal(game.tray.length, 3);
  assert.ok(game.tray.every(Boolean), "three slots, three pieces");
  assert.notDeepEqual(game.tray.map((p) => p.id), before, "they are new pieces");
});

test("shuffle only refills the slots you have not used", () => {
  const game = newGame();
  game.tray = [piece(["X"]), null, piece(["X"])];

  assert.equal(game.useLifeline("shuffle"), true);
  assert.ok(game.tray[0], "slot 0 was re-dealt");
  assert.equal(game.tray[1], null, "the spent slot stays empty");
  assert.ok(game.tray[2], "slot 2 was re-dealt");
});

test("shuffle announces which slots changed", () => {
  const game = newGame();
  game.tray = [piece(["X"]), null, piece(["X"])];

  let event = null;
  game.on("shuffle", (payload) => (event = payload));

  game.useLifeline("shuffle");
  assert.deepEqual(event.slots, [0, 2]);
});

test("shuffle is refused with an empty tray, and is not spent", () => {
  const game = newGame();
  game.tray = [null, null, null];

  assert.equal(game.canUseLifeline("shuffle"), false);
  assert.equal(game.lifelineStatus("shuffle").reason, "No pieces to swap");
  assert.equal(game.shuffleTray(), false);
  assert.equal(game.lifelineUsed.shuffle, false);
});

test("shuffle works at any level, but only once", () => {
  const game = newGame();
  atLevel(game, 9);

  assert.equal(game.useLifeline("shuffle"), true);
  assert.equal(game.canUseLifeline("shuffle"), false);
  assert.equal(game.useLifeline("shuffle"), false);
});

test("shuffle drops the rewind snapshot — a new deal is a fresh position", () => {
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  game.place(0, 0, 0);
  assert.equal(game.canUndo(), true);

  game.useLifeline("shuffle");
  assert.equal(game.canUndo(), false);
  assert.equal(game.lifelineStatus("undo").reason, "Nothing to take back");
});

test("shuffle cannot deal you back out of game over", () => {
  const game = newGame();
  gridlock(game); // only a single square fits, at (0,0)
  game.tray = [piece(["XXX"]), null, null];
  const before = game.tray.map((p) => p?.id ?? null);
  game.over = true;

  assert.equal(game.useLifeline("shuffle"), false);
  assert.equal(game.lifelineStatus("shuffle").reason, "Too late — the game is over");
  assert.deepEqual(game.tray.map((p) => p?.id ?? null), before, "the tray stands");
  assert.equal(game.lifelineUsed.shuffle, false, "and it is still yours to spend next game");
});

// ---------- wipe ----------

test("wipe is locked below level 5", () => {
  const game = newGame();
  setBoard(game, ["XXXX...."]);

  assert.equal(game.canUseLifeline("wipe"), false);
  assert.equal(game.lifelineStatus("wipe").reason, "Unlocks at level 5");
  assert.equal(game.wipeBoard(), false);
  assert.equal(countFilled(game.board), 4, "the board is untouched");
  assert.equal(game.lifelineUsed.wipe, false);
});

test("wipe clears the whole board from level 5, and scores nothing", () => {
  const game = newGame();
  setBoard(game, ["XXXX....", "XX......", "X..X...."]);
  atLevel(game, 5);

  const scoreBefore = game.score;
  const linesBefore = game.linesCleared;

  assert.equal(game.useLifeline("wipe"), true);
  assert.equal(countFilled(game.board), 0);
  assert.equal(game.score, scoreBefore, "a wipe is a rescue, not a clear");
  assert.equal(game.linesCleared, linesBefore, "and it does not move the ladder");
});

test("wipe hands the effects the colours it removed", () => {
  const game = newGame();
  setBoard(game, ["XX......"]);
  atLevel(game, 6);

  let event = null;
  game.on("wipe", (payload) => (event = payload));

  game.useLifeline("wipe");
  assert.deepEqual(event.cells, [[0, 0], [0, 1]]);
  assert.ok(event.snapshot[0][0], "the colour survived for the animation");
  assert.equal(game.board[0][0], null, "…but the real cell is empty");
});

test("wipe is refused on an already-empty board", () => {
  const game = newGame();
  atLevel(game, 7);

  assert.equal(game.canUseLifeline("wipe"), false);
  assert.equal(game.lifelineStatus("wipe").reason, "The board is already clear");
  assert.equal(game.lifelineUsed.wipe, false);
});

test("wipe can be used only once", () => {
  const game = newGame();
  setBoard(game, ["XX......"]);
  atLevel(game, 5);

  assert.equal(game.useLifeline("wipe"), true);
  setBoard(game, ["XX......"]);
  assert.equal(game.canUseLifeline("wipe"), false);
  assert.equal(game.lifelineStatus("wipe").reason, "Already used");
});

test("wipe rescues you from game over", () => {
  const game = newGame();
  gridlock(game);
  atLevel(game, 5);
  game.tray = [piece(["XXX"]), null, null];
  game.over = true;

  let revived = null;
  game.on("revive", (payload) => (revived = payload));

  assert.equal(game.useLifeline("wipe"), true);
  assert.equal(game.over, false, "an empty board always has room");
  assert.equal(revived.reason, "wipe");
});

test("wipe breaks the combo — you did not earn those clears", () => {
  const game = newGame();
  setBoard(game, ["XX......"]);
  atLevel(game, 5);
  game.combo = 3;

  game.useLifeline("wipe");
  assert.equal(game.combo, 0);
});

// ---------- what a finished game still offers ----------

test("exactly one lifeline is marked as a rescue, and it is the wipe", () => {
  const rescues = LIFELINES.filter((spec) => spec.rescue).map((spec) => spec.id);
  assert.deepEqual(rescues, ["wipe"]);
});

test("game over withdraws every lifeline except the rescue", () => {
  const game = newGame();
  gridlock(game);
  atLevel(game, 5);
  game.tray = [piece(["XXX"]), null, null];
  game.over = true;

  for (const spec of LIFELINES) {
    const status = game.lifelineStatus(spec.id);
    assert.equal(
      status.available,
      !!spec.rescue,
      `${spec.id} is ${spec.rescue ? "" : "not "}on offer once the game is over`
    );
    if (!spec.rescue) assert.equal(status.reason, "Too late — the game is over");
  }
});

test("the ordinary reason for being locked wins over the game-over one", () => {
  // "Already used" is the more useful thing to read: it says the lifeline
  // is gone for the rest of the game, not just gone from this screen.
  const game = newGame();
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];
  game.place(0, 0, 0);
  game.undo();

  game.over = true;
  assert.equal(game.lifelineStatus("undo").reason, "Already used");
});

test("the lifeline row is repainted before the game over screen reads it", () => {
  // The Game Over screen renders straight from the last `lifelines`
  // event, so one emitted while `over` was still false would offer a
  // rewind the rules have already taken away.
  const game = newGame();
  gridlock(game);
  game.tray = [piece(["X"]), piece(["XX"]), null];

  const order = [];
  let atGameOver = null;
  game.on("lifelines", ({ statuses }) => {
    order.push("lifelines");
    atGameOver = statuses;
  });
  game.on("gameover", () => order.push("gameover"));

  game.place(0, 0, 0);

  assert.deepEqual(order.slice(-2), ["lifelines", "gameover"]);
  assert.equal(atGameOver.find((s) => s.id === "undo").available, false);
});
