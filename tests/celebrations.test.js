/**
 * Which clear animation plays, and when.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CELEBRATIONS,
  DEFAULT_CELEBRATION,
  celebrationById,
  eligibleFor,
  chooseCelebration,
  shakeLevel,
  BOARD_CELEBRATIONS,
  BOARD_CLEAR_MIN_LEVEL,
  boardClearUnlocked,
  chooseBoardCelebration,
} from "../js/celebrations.js";

/** Replays a run of clears the way effects.js does, carrying the counter. */
function run(lineCounts) {
  let counter = 0;
  return lineCounts.map((lines) => {
    const { celebration, nextCounter } = chooseCelebration(lines, counter);
    counter = nextCounter;
    return celebration.id;
  });
}

// ---------- the catalogue ----------

test("every celebration is complete and unique", () => {
  const ids = new Set();
  for (const c of CELEBRATIONS) {
    assert.ok(c.id, "has an id");
    assert.ok(!ids.has(c.id), `${c.id} is not a duplicate`);
    ids.add(c.id);

    assert.ok(c.name, `${c.id} has a name`);
    assert.ok(c.blurb, `${c.id} has a blurb`);
    assert.ok(Number.isInteger(c.minLines) && c.minLines >= 1, `${c.id} has a sane minLines`);
  }
});

test("at least one celebration works for a single line", () => {
  assert.ok(CELEBRATIONS.some((c) => c.minLines === 1), "otherwise a single clear has nothing");
  assert.equal(DEFAULT_CELEBRATION.minLines, 1);
});

test("celebrationById finds them and shrugs at nonsense", () => {
  assert.equal(celebrationById("shatter").id, "shatter");
  assert.equal(celebrationById("fireworks"), null);
});

// ---------- eligibility ----------

test("a single line only gets the plain one", () => {
  const allowed = eligibleFor(1);
  assert.equal(allowed.length, 1);
  assert.equal(allowed[0].id, "shatter");
});

test("a double unlocks the louder animations", () => {
  assert.ok(eligibleFor(2).length > 1, "a double has a choice to make");
  assert.ok(eligibleFor(2).some((c) => c.id === "shockwave"));
});

test("eligibility only ever grows with the size of the clear", () => {
  for (let lines = 2; lines <= 6; lines++) {
    const smaller = eligibleFor(lines - 1);
    const bigger = eligibleFor(lines);
    assert.ok(bigger.length >= smaller.length, `${lines} lines allows at least as much`);
    for (const c of smaller) assert.ok(bigger.includes(c), `${c.id} still allowed at ${lines}`);
  }
});

test("nonsense line counts still return something playable", () => {
  assert.deepEqual(eligibleFor(0), [DEFAULT_CELEBRATION]);
  assert.deepEqual(eligibleFor(-3), [DEFAULT_CELEBRATION]);
  assert.deepEqual(eligibleFor(undefined), [DEFAULT_CELEBRATION]);
  assert.deepEqual(eligibleFor(NaN), [DEFAULT_CELEBRATION]);
});

// ---------- the rotation ----------

test("consecutive big clears cycle instead of repeating", () => {
  const size = eligibleFor(2).length;
  const played = run(Array(size + 1).fill(2));

  assert.equal(
    new Set(played.slice(0, size)).size,
    size,
    "every animation in the pool before any repeat"
  );
  assert.equal(played[size], played[0], "then it comes back round");
});

test("a run of single clears always looks the same", () => {
  assert.deepEqual(run([1, 1, 1, 1]), ["shatter", "shatter", "shatter", "shatter"]);
});

test("single clears don't spin the counter and steal your next double", () => {
  const withoutSingles = run([2, 2]);
  const withSingles = run([1, 1, 2, 1, 1, 2]).filter((id, i) => [2, 5].includes(i));

  assert.deepEqual(
    withSingles,
    withoutSingles,
    "the doubles rotate the same either way"
  );
});

test("the counter is what makes it deterministic", () => {
  const first = chooseCelebration(3, 0);
  const again = chooseCelebration(3, 0);
  assert.equal(first.celebration.id, again.celebration.id);
  assert.equal(first.nextCounter, 1);
});

test("a rubbish counter is treated as the start, not a crash", () => {
  for (const bad of [undefined, null, NaN, -5, 2.7, "3"]) {
    const { celebration, nextCounter } = chooseCelebration(2, bad);
    assert.ok(celebration.id, `counter ${String(bad)} still picked something`);
    assert.ok(Number.isInteger(nextCounter) && nextCounter >= 0);
  }
});

test("the counter never runs out of range", () => {
  const { celebration } = chooseCelebration(3, 1_000_003);
  assert.ok(CELEBRATIONS.includes(celebration));
});

test("every celebration gets used over a long run of big clears", () => {
  const played = new Set(run(Array(30).fill(3)));
  for (const c of eligibleFor(3)) {
    assert.ok(played.has(c.id), `${c.id} came up`);
  }
});

// ---------- shake ----------

test("the screen shakes harder the more lines go", () => {
  assert.equal(shakeLevel(1), 0);
  assert.equal(shakeLevel(2), 1);
  assert.equal(shakeLevel(3), 2);
  assert.equal(shakeLevel(5), 2, "capped at the top");
});

// ---------- category 2: the whole board went ----------

test("every board celebration is complete and unique", () => {
  const ids = new Set();
  for (const c of BOARD_CELEBRATIONS) {
    assert.ok(c.id && c.name && c.blurb, `${c.id} is filled in`);
    assert.ok(!ids.has(c.id), `${c.id} is not a duplicate`);
    ids.add(c.id);
  }
});

test("a board clear stays silent below the unlock level", () => {
  for (let level = 0; level < BOARD_CLEAR_MIN_LEVEL; level++) {
    const { celebration, nextCounter } = chooseBoardCelebration(level, 0);
    assert.equal(celebration, null, `level ${level} plays nothing`);
    assert.equal(nextCounter, 0, "and doesn't burn a slot in the rotation");
  }
});

test("from the unlock level it fires and rotates", () => {
  let counter = 0;
  const played = [];
  for (let i = 0; i < BOARD_CELEBRATIONS.length + 1; i++) {
    const { celebration, nextCounter } = chooseBoardCelebration(BOARD_CLEAR_MIN_LEVEL, counter);
    counter = nextCounter;
    played.push(celebration.id);
  }

  assert.equal(
    new Set(played.slice(0, BOARD_CELEBRATIONS.length)).size,
    BOARD_CELEBRATIONS.length,
    "every one before a repeat"
  );
  assert.equal(played.at(-1), played[0], "then round again");
});

test("boardClearUnlocked draws the line in the right place", () => {
  assert.equal(boardClearUnlocked(BOARD_CLEAR_MIN_LEVEL - 1), false);
  assert.equal(boardClearUnlocked(BOARD_CLEAR_MIN_LEVEL), true);
  assert.equal(boardClearUnlocked(10), true);
  assert.equal(boardClearUnlocked(undefined), false);
  assert.equal(boardClearUnlocked(NaN), false);
});

test("a rubbish counter can't break the board rotation", () => {
  for (const bad of [undefined, null, NaN, -9, "2"]) {
    const { celebration } = chooseBoardCelebration(5, bad);
    assert.ok(BOARD_CELEBRATIONS.includes(celebration));
  }
});

// ---------- the tiering the strategy doc promises ----------

test("a triple unlocks animations a double never sees", () => {
  const double = eligibleFor(2).map((c) => c.id);
  const triple = eligibleFor(3).map((c) => c.id);

  assert.ok(triple.length > double.length, "there is a tier above a double");
  for (const id of ["prism", "nova"]) {
    assert.ok(!double.includes(id), `${id} is not on offer for a double`);
    assert.ok(triple.includes(id), `${id} is reserved for a triple`);
  }
});
