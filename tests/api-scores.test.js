/**
 * The server side of the shared leaderboard.
 *
 * This is the trust boundary — anything the client sends is a stranger's
 * input, so the validation here is what actually protects the board. The
 * client applies the same rules first, but only as a courtesy.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { cleanName, validId, validSubmission, buildBoard } from "../api/scores.js";

// ---------- names ----------

test("names are cleaned the same way as on the client", () => {
  assert.equal(cleanName("  Roger  "), "Roger");
  // brackets stripped, then truncated at the 14-character cap
  assert.equal(cleanName("<script>alert(1)</script>"), "scriptalert(1)");
  assert.equal(cleanName("many    spaces"), "many spaces");
  assert.equal(cleanName(null), "");
});

test("a name is capped, however long it arrives", () => {
  assert.equal(cleanName("x".repeat(500)).length, 14);
});

// ---------- ids ----------

test("only id-shaped strings are accepted", () => {
  assert.equal(validId("f81d4fae-7dec-11d0-a765-00a0c91e6bf6"), true);
  assert.equal(validId("0123456789abcdef"), true);

  assert.equal(validId("short"), false, "too short");
  assert.equal(validId("x".repeat(200)), false, "too long");
  assert.equal(validId("../../etc/passwd"), false, "path characters");
  assert.equal(validId("player one"), false, "spaces");
  assert.equal(validId(null), false);
  assert.equal(validId(12345678), false, "must be a string");
});

// ---------- submissions ----------

const good = {
  playerId: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  name: "Roger",
  score: 1500,
  level: 6,
};

test("a well-formed submission is accepted and normalised", () => {
  const entry = validSubmission(good);
  assert.deepEqual(entry, { ...good, score: 1500, level: 6 });
});

test("a submission without a usable name is refused", () => {
  assert.equal(validSubmission({ ...good, name: "" }), null);
  assert.equal(validSubmission({ ...good, name: "   " }), null);
  assert.equal(validSubmission({ ...good, name: null }), null);
});

test("a submission without a valid id is refused", () => {
  assert.equal(validSubmission({ ...good, playerId: "nope" }), null);
  assert.equal(validSubmission({ ...good, playerId: undefined }), null);
});

test("impossible scores are refused", () => {
  assert.equal(validSubmission({ ...good, score: 0 }), null);
  assert.equal(validSubmission({ ...good, score: -100 }), null);
  assert.equal(validSubmission({ ...good, score: "abc" }), null);
  assert.equal(validSubmission({ ...good, score: Infinity }), null);
  assert.equal(validSubmission({ ...good, score: 999_999_999 }), null, "above the ceiling");
});

test("a score is rounded rather than stored as a fraction", () => {
  assert.equal(validSubmission({ ...good, score: 1500.7 }).score, 1501);
});

test("the level is clamped to the real ladder", () => {
  assert.equal(validSubmission({ ...good, level: 99 }).level, 10);
  assert.equal(validSubmission({ ...good, level: -5 }).level, 1);
  assert.equal(validSubmission({ ...good, level: "abc" }).level, 1);
  assert.equal(validSubmission({ ...good, level: undefined }).level, 1);
});

test("a non-object body is refused rather than crashing", () => {
  assert.equal(validSubmission(null), null);
  assert.equal(validSubmission(undefined), null);
  assert.equal(validSubmission("a string"), null);
  assert.equal(validSubmission(42), null);
});

// ---------- reading the board back ----------

test("a Redis flat reply is turned into ranked rows", () => {
  const ranked = ["id-aaaa-1111", "900", "id-bbbb-2222", "500"];
  const players = [
    "id-aaaa-1111",
    JSON.stringify({ name: "Ada", level: 9, at: 111 }),
    "id-bbbb-2222",
    JSON.stringify({ name: "Grace", level: 6, at: 222 }),
  ];

  const board = buildBoard(ranked, players);
  assert.equal(board.length, 2);
  assert.deepEqual(board[0], {
    playerId: "id-aaaa-1111",
    name: "Ada",
    score: 900,
    level: 9,
    at: 111,
  });
  assert.equal(board[1].name, "Grace");
});

test("a player with no metadata still appears, just anonymous", () => {
  const board = buildBoard(["id-cccc-3333", "400"], []);
  assert.equal(board.length, 1);
  assert.equal(board[0].name, "anon");
  assert.equal(board[0].score, 400);
});

test("one corrupt record doesn't take the whole board down", () => {
  const ranked = ["id-aaaa-1111", "900", "id-bbbb-2222", "500"];
  const players = ["id-aaaa-1111", "{not json", "id-bbbb-2222", JSON.stringify({ name: "Grace" })];

  const board = buildBoard(ranked, players);
  assert.equal(board.length, 2);
  assert.equal(board[0].name, "anon", "the broken one degrades");
  assert.equal(board[1].name, "Grace", "the good one is untouched");
});

test("stored names are cleaned on the way out too", () => {
  const players = ["id-aaaa-1111", JSON.stringify({ name: "<b>Ada</b>", level: 3 })];
  const board = buildBoard(["id-aaaa-1111", "100"], players);
  assert.equal(board[0].name, "bAda/b", "no angle brackets reach the page");
});

test("an empty board is empty, not a crash", () => {
  assert.deepEqual(buildBoard([], []), []);
  assert.deepEqual(buildBoard(null ?? [], null ?? []), []);
});
