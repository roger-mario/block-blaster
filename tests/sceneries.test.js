/**
 * The background, and what advances it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MAX_LEVEL } from "../js/difficulty.js";
import {
  SCENERIES,
  DEFAULT_SCENERY,
  sceneryById,
  sceneryForLevel,
  sceneryChanges,
} from "../js/sceneries.js";

const MOTIONS = new Set(["drift", "sway", "rise", "swirl"]);

test("there is one scenery for every level on the ladder", () => {
  assert.equal(SCENERIES.length, MAX_LEVEL);

  const levels = SCENERIES.map((s) => s.level).sort((a, b) => a - b);
  assert.deepEqual(levels, Array.from({ length: MAX_LEVEL }, (_, i) => i + 1));
});

test("every scenery is complete and unique", () => {
  const ids = new Set();
  for (const s of SCENERIES) {
    assert.ok(s.id, "has an id");
    assert.ok(!ids.has(s.id), `${s.id} is not a duplicate`);
    ids.add(s.id);

    assert.ok(s.name, `${s.id} has a name`);
    assert.ok(MOTIONS.has(s.motion), `${s.id} uses a known motion`);
    assert.equal(s.tint.length, 3, `${s.id} has three blob colours`);
    assert.match(s.haze, /gradient/, `${s.id} has a haze gradient`);
  }
});

test("every scenery is blurred enough to have no hard edge", () => {
  for (const s of SCENERIES) {
    assert.ok(s.blur >= 55, `${s.id} is blurred to ${s.blur}px`);
  }
});

test("every tint is translucent — an opaque blob would show its edge", () => {
  for (const s of SCENERIES) {
    for (const colour of s.tint) {
      assert.match(colour, /^rgba\(/, `${s.id}: ${colour} is rgba`);
      const alpha = Number(colour.split(",").pop().replace(")", "").trim());
      assert.ok(alpha > 0 && alpha <= 0.3, `${s.id}: alpha ${alpha} stays subtle`);
    }
  }
});

test("each level gets its own background", () => {
  const seen = new Set();
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const scenery = sceneryForLevel(level);
    assert.equal(scenery.level, level, `level ${level} gets its own`);
    assert.ok(!seen.has(scenery.id), `level ${level} isn't a repeat`);
    seen.add(scenery.id);
  }
});

test("out-of-range levels still get a real background", () => {
  assert.equal(sceneryForLevel(0).level, 1);
  assert.equal(sceneryForLevel(-5).level, 1);
  assert.equal(sceneryForLevel(999).level, MAX_LEVEL);
  assert.equal(sceneryForLevel(undefined), DEFAULT_SCENERY);
  assert.equal(sceneryForLevel(NaN), DEFAULT_SCENERY);
  assert.equal(sceneryForLevel("nonsense"), DEFAULT_SCENERY);
});

test("sceneryById finds them and shrugs at nonsense", () => {
  assert.equal(sceneryById("aurora").id, "aurora");
  assert.equal(sceneryById("does-not-exist"), null);
});

test("every level up changes the background", () => {
  for (let level = 1; level < MAX_LEVEL; level++) {
    assert.equal(sceneryChanges(level, level + 1), true, `${level} → ${level + 1} is visible`);
  }
});

test("staying on the same level doesn't repaint", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    assert.equal(sceneryChanges(level, level), false);
  }
});

test("clamped levels don't fake a change", () => {
  assert.equal(sceneryChanges(MAX_LEVEL, MAX_LEVEL + 4), false, "already at the top");
  assert.equal(sceneryChanges(0, 1), false, "both clamp to level 1");
});
