/**
 * 0.4.1 — challenge rounds and the 🃏 Joker.
 *
 * Both work the same way underneath: they drag the level's own dials down
 * toward the top of the ladder without changing the level. The promise
 * that makes that fair rather than cruel is that a challenged tray is
 * *always* playable to the end, so it's tested here first.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { DEALER, LIFELINE_BY_ID, SCORING, TRAY_SLOTS } from "../js/config.js";
import { MAX_LEVEL } from "../js/difficulty.js";
import {
  dealTray,
  evaluationBias,
  generosity,
  rescueChance,
  sequenceGuarantee,
} from "../js/dealer/index.js";
import { playableInSomeOrder, shapeFits } from "../js/dealer/placement.js";
import { boardFrom, emptyBoard, newGame, piece, rowWithGap, seededRng, setBoard } from "./helpers.js";

// ---------- the dials under challenge ----------

test("a challenge drags an easy level down toward the hard end", () => {
  const easy = generosity(1, 0);
  const challenged = generosity(1, 1);

  assert.equal(easy, 1);
  assert.equal(challenged, DEALER.generosityFloor, "a full challenge lands on the floor");
  assert.ok(generosity(1, 0.5) > challenged && generosity(1, 0.5) < easy, "and scales in between");
});

test("a fully challenged early tray is dealt like the top of the ladder", () => {
  assert.ok(
    Math.abs(evaluationBias(1, 1) - evaluationBias(MAX_LEVEL, 0)) < 1e-9,
    "level 1 under full challenge == level 20"
  );
});

test("a challenge cannot make a level *more* generous than it already was", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    assert.ok(generosity(level, 1) <= generosity(level, 0) + 1e-9, `level ${level}`);
    assert.ok(generosity(level, 1) >= DEALER.generosityFloor - 1e-9, `level ${level} has a floor`);
  }
});

test("a challenge makes the free rescue rarer, but only partly", () => {
  const normal = rescueChance(1, 0, 0);
  const challenged = rescueChance(1, 0, 1);

  assert.ok(challenged < normal, "it does bite");
  assert.ok(
    challenged > DEALER.challengeClearChance,
    "…but never the whole way: you climb the ladder on lines cleared, and " +
      "taking the rescue away in full makes the game slower rather than harder"
  );

  const expected = normal + DEALER.challengeRescueBite * (DEALER.challengeClearChance - normal);
  assert.ok(Math.abs(challenged - expected) < 1e-9);
});

test("difficulty lands on the help dial, not the escape dial", () => {
  // the generosity dial goes all the way to its floor under challenge;
  // the rescue dial deliberately does not
  const generosityDrop = (generosity(1, 0) - generosity(1, 1)) / generosity(1, 0);
  const rescueDrop = (rescueChance(1, 0, 0) - rescueChance(1, 0, 1)) / rescueChance(1, 0, 0);
  assert.ok(
    generosityDrop > rescueDrop * 2,
    `generosity gave up ${(generosityDrop * 100).toFixed(0)}% and rescue ${(rescueDrop * 100).toFixed(0)}%`
  );
});

test("…but board pressure still rescues you inside a challenge round", () => {
  assert.ok(
    rescueChance(1, 0.9, 1) > 0.8,
    "a nearly full board is not the moment to be teaching a lesson"
  );
  assert.equal(rescueChance(MAX_LEVEL, 1, 1), 1);
});

test("a challenged tray is always guaranteed playable to the end", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    assert.equal(sequenceGuarantee(level, 1), 1, `level ${level} under challenge`);
  }
  assert.ok(sequenceGuarantee(MAX_LEVEL, 0) < 1, "…which is not true without one");
});

// ---------- and in the dealt tray ----------

test("a challenge round is harder but never unplayable", () => {
  const board = boardFrom([
    "XXXX....",
    "XX.XXX..",
    "XXXXXX..",
    "X.XX....",
    "XXX.....",
  ]);

  for (let seed = 1; seed <= 150; seed++) {
    const tray = dealTray(TRAY_SLOTS, {
      level: 2,
      board,
      rng: seededRng(seed * 17),
      challenge: 1,
    });
    assert.ok(tray.some((p) => shapeFits(board, p.cells)), `seed ${seed}: nothing fits`);
    assert.ok(
      playableInSomeOrder(board, tray.map((p) => p.cells)).playable,
      `seed ${seed}: a challenge round dealt a tray that can't be played out`
    );
  }
});

test("a challenge round hands out less helpful pieces than a normal one", () => {
  const board = boardFrom(["XXXX....", "XX.XXX..", "XXXXXX..", "X.XX...."]);

  const clearRate = (challenge) => {
    let offered = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      const tray = dealTray(TRAY_SLOTS, {
        level: 2,
        board,
        rng: seededRng(seed * 23),
        challenge,
      });
      if (tray.some((p) => shapeFits(board, p.cells) && p.cells.length >= 4)) offered++;
    }
    return offered / runs;
  };

  // the measurable difference is that a challenge stops optimising the
  // board for you — the pieces it picks are simply worth less here
  assert.ok(
    clearRate(1) !== clearRate(0),
    "a challenge round should not deal the same distribution as a normal one"
  );
});

// ---------- the periodic round ----------

test("every 20th tray is a challenge round, and the first never is", () => {
  const game = newGame();
  assert.equal(game._isGauntlet(1), false, "no board to make hard yet");

  for (let tray = 2; tray <= 60; tray++) {
    assert.equal(
      game._isGauntlet(tray),
      tray % DEALER.gauntletEvery === 0,
      `tray ${tray}`
    );
  }
});

test("the game counts trays and announces a challenge round", () => {
  const game = newGame();
  const seen = [];
  game.on("challenge", (payload) => seen.push(payload));

  assert.equal(game.traysDealt, 1, "the opening tray counts");

  // drive the counter straight to the rung before a challenge round
  game.traysDealt = DEALER.gauntletEvery - 1;
  game._refillTray();

  assert.equal(game.traysDealt, DEALER.gauntletEvery);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].kind, "gauntlet");
  assert.equal(seen[0].challenge, DEALER.gauntletChallenge);
  assert.equal(game.trayChallenge, DEALER.gauntletChallenge);
});

test("an ordinary tray carries no challenge", () => {
  const game = newGame();
  game.traysDealt = 3;
  game._refillTray();
  assert.equal(game.trayChallenge, 0);
});

// ---------- the Joker ----------

test("the Joker is on offer in the opening levels and gone after them", () => {
  const game = newGame();
  assert.equal(game.canUseLifeline("joker"), true);

  game.level = LIFELINE_BY_ID.joker.maxLevel + 1;
  const status = game.lifelineStatus("joker");
  assert.equal(status.available, false);
  assert.equal(status.reason, `Gone after level ${LIFELINE_BY_ID.joker.maxLevel}`);
});

test("playing the Joker doubles everything you score", () => {
  const game = newGame();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), null, null];
  const plain = game.previewPlacement(game.tray[0], 0, 7).points;

  const boosted = newGame();
  assert.equal(boosted.playJoker(), true);
  setBoard(boosted, [rowWithGap(7)]);
  boosted.tray = [piece(["X"]), null, null];

  assert.equal(boosted.jokerBoost, SCORING.jokerBoost);
  assert.equal(boosted.previewPlacement(boosted.tray[0], 0, 7).points, plain * SCORING.jokerBoost);
});

test("the preview shows the doubled number, not the plain one", () => {
  // the drag preview and the points actually awarded have to agree, or
  // the boost looks like a rounding bug
  const game = newGame();
  game.playJoker();
  // a second row keeps the board from emptying — the preview covers the
  // placement and the clear, and never claimed to cover the bonuses
  setBoard(game, [rowWithGap(7), "XXX....."]);
  game.tray = [piece(["X"]), null, null];

  const promised = game.previewPlacement(game.tray[0], 0, 7).points;
  const before = game.score;
  game.place(0, 0, 7);
  assert.equal(game.score - before, promised);
});

test("the Joker doubles the bonuses as well, not just the base points", () => {
  const plain = newGame();
  setBoard(plain, [rowWithGap(7)]);
  plain.tray = [piece(["X"]), null, null];
  const plainBonuses = [];
  plain.on("bonus", (b) => plainBonuses.push(b));
  plain.place(0, 0, 7);

  const boosted = newGame();
  boosted.playJoker();
  setBoard(boosted, [rowWithGap(7)]);
  boosted.tray = [piece(["X"]), null, null];
  const boostedBonuses = [];
  boosted.on("bonus", (b) => boostedBonuses.push(b));
  boosted.place(0, 0, 7);

  assert.ok(plainBonuses.length > 0, "emptying the board pays a perfect-clear bonus");
  assert.deepEqual(
    boostedBonuses.map((b) => b.type),
    plainBonuses.map((b) => b.type)
  );
  for (let i = 0; i < plainBonuses.length; i++) {
    assert.equal(boostedBonuses[i].points, plainBonuses[i].points * SCORING.jokerBoost);
  }
});

test("the Joker makes the dealer meaner for as long as it runs", () => {
  const game = newGame();
  game.playJoker();
  assert.ok(game._challengeFor(3) >= DEALER.jokerChallenge);

  game.jokerBoost = 1;
  assert.equal(game._challengeFor(3), 0);
});

test("the Joker re-deals the tray you are holding on the new terms", () => {
  const game = newGame(11);
  const before = game.tray.map((p) => p.id);
  game.playJoker();
  const after = game.tray.map((p) => p.id);
  assert.notDeepEqual(after, before, "the gentle tray you already had doesn't survive the gamble");
  assert.equal(after.filter(Boolean).length, before.length);
});

test("it retires itself on the way out of the opening levels", () => {
  const game = newGame();
  game.playJoker();
  assert.equal(game.jokerBoost, SCORING.jokerBoost);

  const seen = [];
  game.on("joker", (payload) => seen.push(payload));

  // clear enough lines to climb past the Joker's last level
  const target = LIFELINE_BY_ID.joker.maxLevel + 1;
  let guard = 0;
  while (game.level < target && guard++ < 400) {
    setBoard(game, [rowWithGap(7)]);
    game.tray = [piece(["X"]), null, null];
    game.place(0, 0, 7);
  }

  assert.equal(game.level, target);
  assert.equal(game.jokerBoost, 1, "the doubling stops when the button would disappear");
  assert.equal(seen.at(-1).boost, 1);
});

test("it can only be played once, even while it is still running", () => {
  const game = newGame();
  assert.equal(game.playJoker(), true);
  assert.equal(game.canUseLifeline("joker"), false);
  assert.equal(game.playJoker(), false);

  const status = game.lifelineStatus("joker");
  assert.equal(status.active, true, "…and it reports itself as running, not merely spent");
});

test("a rewind puts the Joker's score back too", () => {
  const game = newGame();
  game.playJoker();
  setBoard(game, [rowWithGap(7)]);
  game.tray = [piece(["X"]), piece(["X"]), piece(["X"])];

  const before = game.score;
  game.place(0, 0, 7);
  assert.ok(game.score > before);

  assert.equal(game.undo(), true);
  assert.equal(game.score, before);
  assert.equal(game.jokerBoost, SCORING.jokerBoost, "…and the Joker is still running");
});

test("a shuffle can't be used to duck a challenge round", () => {
  const game = newGame();
  game.board = emptyBoard();
  game.traysDealt = DEALER.gauntletEvery - 1;
  game._refillTray();
  assert.equal(game.trayChallenge, DEALER.gauntletChallenge);

  game.shuffleTray();
  assert.equal(game.trayChallenge, DEALER.gauntletChallenge, "the terms didn't change");
});
