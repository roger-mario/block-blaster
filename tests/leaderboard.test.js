/**
 * The leaderboard and the remembered name.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LEADERBOARD_SIZE, LEADERBOARD_KEY, PLAYER_KEY } from "../js/config.js";
import { remove, write } from "../js/storage.js";
import {
  cleanName,
  getPlayer,
  setPlayer,
  hasPlayer,
  getScores,
  submitScore,
  rankFor,
  clearScores,
  MAX_NAME_LENGTH,
} from "../js/leaderboard.js";

function freshStore() {
  remove(LEADERBOARD_KEY);
  remove(PLAYER_KEY);
}

// ---------- names ----------

test("names are trimmed, capped and stripped of junk", () => {
  assert.equal(cleanName("  Roger  "), "Roger");
  assert.equal(cleanName("a".repeat(50)).length, MAX_NAME_LENGTH);
  assert.equal(cleanName("<script>"), "script");
  assert.equal(cleanName("two   spaces"), "two spaces");
  assert.equal(cleanName(null), "");
  assert.equal(cleanName(undefined), "");
  assert.equal(cleanName(42), "42");
});

test("the name is remembered so it's only ever asked once", () => {
  freshStore();
  assert.equal(hasPlayer(), false);
  assert.equal(getPlayer(), "");

  setPlayer("Roger");
  assert.equal(getPlayer(), "Roger");
  assert.equal(hasPlayer(), true);
});

test("saving an empty name clears it rather than storing blanks", () => {
  freshStore();
  setPlayer("Roger");
  setPlayer("   ");
  assert.equal(hasPlayer(), false);
});

// ---------- recording ----------

test("a score lands on the board and reports its rank", () => {
  freshStore();
  const result = submitScore("Roger", 500, 4);

  assert.ok(result);
  assert.equal(result.rank, 1);
  assert.equal(result.improved, true);
  assert.equal(result.entries.length, 1);
  assert.deepEqual(
    { name: result.entries[0].name, score: result.entries[0].score, level: result.entries[0].level },
    { name: "Roger", score: 500, level: 4 }
  );
});

test("the table is sorted by score, highest first", () => {
  freshStore();
  submitScore("Low", 100);
  submitScore("High", 900);
  submitScore("Mid", 500);

  assert.deepEqual(getScores().map((e) => e.name), ["High", "Mid", "Low"]);
});

test("one player keeps a personal best rather than one row per game", () => {
  freshStore();
  submitScore("Roger", 500);
  submitScore("Roger", 200);
  submitScore("Roger", 900);

  const entries = getScores();
  assert.equal(entries.length, 1, "one row per player");
  assert.equal(entries[0].score, 900, "their best, not their last");
});

test("a worse score is recorded as no improvement", () => {
  freshStore();
  submitScore("Roger", 900);
  const result = submitScore("Roger", 100);

  assert.equal(result.improved, false);
  assert.equal(result.rank, 1);
  assert.equal(getScores()[0].score, 900);
});

test("the same name in different case is the same player", () => {
  freshStore();
  submitScore("Roger", 500);
  submitScore("roger", 700);

  const entries = getScores();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].score, 700);
});

test("the table is capped", () => {
  freshStore();
  for (let i = 1; i <= LEADERBOARD_SIZE + 6; i++) submitScore(`Player${i}`, i * 100);

  const entries = getScores();
  assert.equal(entries.length, LEADERBOARD_SIZE);
  assert.equal(entries[0].score, (LEADERBOARD_SIZE + 6) * 100, "the best survived");
});

test("junk submissions are refused", () => {
  freshStore();
  assert.equal(submitScore("", 500), null, "no name");
  assert.equal(submitScore("Roger", 0), null, "no score");
  assert.equal(submitScore("Roger", -10), null, "negative score");
  assert.equal(submitScore("Roger", NaN), null, "not a number");
  assert.equal(getScores().length, 0);
});

test("rankFor previews where a score would land", () => {
  freshStore();
  submitScore("A", 900);
  submitScore("B", 500);

  assert.equal(rankFor(1000), 1);
  assert.equal(rankFor(700), 2);
  assert.equal(rankFor(100), 3);
});

test("a corrupt or hostile stored table is ignored, not fatal", () => {
  freshStore();
  write(LEADERBOARD_KEY, "{not json");
  assert.deepEqual(getScores(), []);

  write(LEADERBOARD_KEY, JSON.stringify("a string, not a list"));
  assert.deepEqual(getScores(), []);

  write(LEADERBOARD_KEY, JSON.stringify([{ name: "OK", score: 10 }, null, { score: 5 }, "junk"]));
  const entries = getScores();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "OK");
});

test("stored scores are coerced into sane numbers", () => {
  freshStore();
  write(
    LEADERBOARD_KEY,
    JSON.stringify([{ name: "Cheat", score: "999999999", level: "nope" }])
  );
  assert.deepEqual(getScores(), [], "a non-numeric score is dropped, not trusted");
});

test("clearScores empties the table", () => {
  freshStore();
  submitScore("Roger", 500);
  clearScores();
  assert.deepEqual(getScores(), []);
});
