/**
 * The leaderboard: the on-device board, the shared one, and the fallback
 * between them.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LEADERBOARD_SIZE, LEADERBOARD_KEY, PLAYER_KEY, PLAYER_ID_KEY } from "../js/config.js";
import { remove, write } from "../js/storage.js";
import {
  cleanName,
  getPlayer,
  setPlayer,
  hasPlayer,
  getPlayerId,
  localScores,
  recordLocal,
  localRank,
  clearLocal,
  loadBoard,
  recordScore,
  isOnline,
  _setOnline,
  MAX_NAME_LENGTH,
} from "../js/leaderboard.js";

function freshStore() {
  remove(LEADERBOARD_KEY);
  remove(PLAYER_KEY);
  remove(PLAYER_ID_KEY);
  _setOnline(null);
}

/** Swaps in a fake `fetch` for one test and puts the real one back after. */
function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return run();
  } finally {
    globalThis.fetch = original;
  }
}

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

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

// ---------- player id ----------

test("a player id is minted once and then reused", () => {
  freshStore();
  const first = getPlayerId();
  assert.match(first, /^[0-9a-f-]{8,64}$/i);
  assert.equal(getPlayerId(), first, "stable across calls");
});

test("a corrupt player id is replaced rather than trusted", () => {
  freshStore();
  write(PLAYER_ID_KEY, "not a valid id!!");
  const id = getPlayerId();
  assert.match(id, /^[0-9a-f-]{8,64}$/i);
});

test("the id survives a name change, so renaming doesn't split your row", () => {
  freshStore();
  setPlayer("Roger");
  const id = getPlayerId();

  recordLocal("Roger", 500, 3);
  setPlayer("Mario");
  recordLocal("Mario", 900, 5);

  const entries = localScores();
  assert.equal(entries.length, 1, "still one row");
  assert.equal(entries[0].name, "Mario", "under the new name");
  assert.equal(entries[0].score, 900);
  assert.equal(entries[0].playerId, id);
});

// ---------- the local board ----------

test("a score lands on the local board and reports its rank", () => {
  freshStore();
  setPlayer("Roger");
  const result = recordLocal("Roger", 500, 4);

  assert.ok(result);
  assert.equal(result.rank, 1);
  assert.equal(result.improved, true);
  assert.equal(result.online, false);
  assert.equal(result.entries[0].score, 500);
  assert.equal(result.entries[0].level, 4);
});

test("the table is sorted by score, highest first", () => {
  freshStore();
  recordLocal("Low", 100);
  write(PLAYER_ID_KEY, "aaaaaaaa-1111-2222-3333-444444444444");
  recordLocal("High", 900);
  write(PLAYER_ID_KEY, "bbbbbbbb-1111-2222-3333-444444444444");
  recordLocal("Mid", 500);

  assert.deepEqual(localScores().map((e) => e.name), ["High", "Mid", "Low"]);
});

test("one player keeps a personal best rather than one row per game", () => {
  freshStore();
  recordLocal("Roger", 500);
  recordLocal("Roger", 200);
  recordLocal("Roger", 900);

  const entries = localScores();
  assert.equal(entries.length, 1, "one row per player");
  assert.equal(entries[0].score, 900, "their best, not their last");
});

test("a worse score is recorded as no improvement", () => {
  freshStore();
  recordLocal("Roger", 900);
  const result = recordLocal("Roger", 100);

  assert.equal(result.improved, false);
  assert.equal(result.rank, 1);
  assert.equal(localScores()[0].score, 900);
});

test("the table is capped", () => {
  freshStore();
  for (let i = 1; i <= LEADERBOARD_SIZE + 6; i++) {
    write(PLAYER_ID_KEY, `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, "0")}`);
    recordLocal(`Player${i}`, i * 100);
  }

  const entries = localScores();
  assert.equal(entries.length, LEADERBOARD_SIZE);
  assert.equal(entries[0].score, (LEADERBOARD_SIZE + 6) * 100, "the best survived");
});

test("junk submissions are refused", () => {
  freshStore();
  assert.equal(recordLocal("", 500), null, "no name");
  assert.equal(recordLocal("Roger", 0), null, "no score");
  assert.equal(recordLocal("Roger", -10), null, "negative score");
  assert.equal(recordLocal("Roger", NaN), null, "not a number");
  assert.equal(localScores().length, 0);
});

test("localRank previews where a score would land", () => {
  freshStore();
  write(PLAYER_ID_KEY, "aaaaaaaa-1111-2222-3333-444444444444");
  recordLocal("A", 900);
  write(PLAYER_ID_KEY, "bbbbbbbb-1111-2222-3333-444444444444");
  recordLocal("B", 500);

  assert.equal(localRank(1000), 1);
  assert.equal(localRank(700), 2);
  assert.equal(localRank(100), 3);
});

test("a corrupt or hostile stored table is ignored, not fatal", () => {
  freshStore();
  write(LEADERBOARD_KEY, "{not json");
  assert.deepEqual(localScores(), []);

  write(LEADERBOARD_KEY, JSON.stringify("a string, not a list"));
  assert.deepEqual(localScores(), []);

  write(LEADERBOARD_KEY, JSON.stringify([{ name: "OK", score: 10 }, null, { score: 5 }, "junk"]));
  const entries = localScores();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "OK");
});

test("stored scores are coerced into sane numbers", () => {
  freshStore();
  write(LEADERBOARD_KEY, JSON.stringify([{ name: "Cheat", score: "999999999", level: "nope" }]));
  assert.deepEqual(localScores(), [], "a non-numeric score is dropped, not trusted");
});

test("clearLocal empties the table", () => {
  freshStore();
  recordLocal("Roger", 500);
  clearLocal();
  assert.deepEqual(localScores(), []);
});

// ---------- the shared board ----------

test("loadBoard uses the shared board when it answers", async () => {
  freshStore();
  const board = [{ playerId: "abc123de", name: "Ada", score: 4000, level: 8, at: 1 }];

  const result = await withFetch(
    async () => jsonResponse({ online: true, scores: board }),
    () => loadBoard()
  );

  assert.equal(result.online, true);
  assert.equal(result.scores.length, 1);
  assert.equal(result.scores[0].name, "Ada");
  assert.equal(isOnline(), true);
});

test("loadBoard falls back to the local board when the API is down", async () => {
  freshStore();
  recordLocal("Roger", 700, 5);

  const result = await withFetch(
    async () => {
      throw new Error("network down");
    },
    () => loadBoard()
  );

  assert.equal(result.online, false);
  assert.equal(result.scores[0].name, "Roger");
  assert.equal(isOnline(), false);
});

test("a 503 with no database is treated as offline, not as an error", async () => {
  freshStore();
  recordLocal("Roger", 300);

  const result = await withFetch(
    async () => jsonResponse({ online: false, reason: "no database configured" }, false, 503),
    () => loadBoard()
  );

  assert.equal(result.online, false);
  assert.equal(result.scores[0].name, "Roger", "the local board stands in");
});

test("recordScore posts the player id, name, score and level", async () => {
  freshStore();
  setPlayer("Roger");
  const id = getPlayerId();
  let sent = null;

  const result = await withFetch(
    async (_url, options) => {
      sent = JSON.parse(options.body);
      return jsonResponse({ online: true, rank: 2, improved: true, scores: [] });
    },
    () => recordScore(1500, 6)
  );

  assert.deepEqual(sent, { playerId: id, name: "Roger", score: 1500, level: 6 });
  assert.equal(result.online, true);
  assert.equal(result.rank, 2);
});

test("recordScore still writes locally even when it goes through online", async () => {
  freshStore();
  setPlayer("Roger");

  await withFetch(
    async () => jsonResponse({ online: true, rank: 1, improved: true, scores: [] }),
    () => recordScore(2200, 7)
  );

  assert.equal(localScores()[0].score, 2200, "the local board is a mirror, not a fallback only");
});

test("a failed submission still keeps the score on this device", async () => {
  freshStore();
  setPlayer("Roger");

  const result = await withFetch(
    async () => {
      throw new Error("offline");
    },
    () => recordScore(800, 4)
  );

  assert.equal(result.online, false);
  assert.equal(result.rank, 1);
  assert.equal(localScores()[0].score, 800);
});

test("recordScore does nothing without a name or a score", async () => {
  freshStore();
  assert.equal(await recordScore(500, 3), null, "no name set");

  setPlayer("Roger");
  assert.equal(await recordScore(0, 1), null, "no score");
  assert.equal(await recordScore(NaN, 1), null, "not a number");
});

test("a hostile API response can't inject junk rows", async () => {
  freshStore();
  const nasty = [
    { playerId: "abc123de", name: "<img src=x>", score: 100, level: 3 },
    { name: "", score: 500 },
    { name: "NoScore" },
    "not an object",
    null,
  ];

  const result = await withFetch(
    async () => jsonResponse({ online: true, scores: nasty }),
    () => loadBoard()
  );

  assert.equal(result.scores.length, 1, "only the one usable row survives");
  assert.equal(result.scores[0].name, "img src=x", "angle brackets stripped");
});
