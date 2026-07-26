/**
 * The per-shape appearance curves — which pieces turn up, and when.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_SIZE } from "../js/config.js";
import { MAX_LEVEL } from "../js/difficulty.js";
import { SHAPES, shapeWeightAt, shapePoolFor, pickShape, shapeFitsBoard } from "../js/pieces.js";
import { seededRng } from "./helpers.js";

const byName = (name) => SHAPES.find((s) => s.name === name);

/** How often each shape comes up over many draws at one level. */
function sample(level, draws = 20000, seed = 5) {
  const rng = seededRng(seed);
  const counts = new Map();
  for (let i = 0; i < draws; i++) {
    const name = pickShape(level, rng).name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    share: (name) => (counts.get(name) ?? 0) / draws,
    counts,
  };
}

test("every shape is well formed and fits on the board", () => {
  const names = new Set();
  for (const shape of SHAPES) {
    assert.ok(shape.cells.length > 0, `${shape.name} has cells`);
    assert.ok(shapeFitsBoard(shape), `${shape.name} fits in ${BOARD_SIZE}×${BOARD_SIZE}`);
    assert.ok(!names.has(shape.name), `${shape.name} is not a duplicate`);
    names.add(shape.name);

    // normalised: something must touch row 0 and column 0
    assert.ok(shape.cells.some(([r]) => r === 0), `${shape.name} touches the top`);
    assert.ok(shape.cells.some(([, c]) => c === 0), `${shape.name} touches the left`);
  }
});

test("every shape has a sane curve", () => {
  for (const shape of SHAPES) {
    assert.ok(shape.from >= 1 && shape.from <= MAX_LEVEL, `${shape.name} unlocks on the ladder`);
    assert.ok(shape.peak >= shape.from, `${shape.name} peaks at or after it unlocks`);
    assert.ok(shape.fade >= shape.peak, `${shape.name} fades at or after it peaks`);
    assert.ok(shape.weight > 0, `${shape.name} has weight`);
    assert.ok(shape.floor > 0 && shape.floor <= 1, `${shape.name} never vanishes entirely`);
  }
});

test("a shape has no weight before it unlocks, and some after", () => {
  for (const shape of SHAPES) {
    if (shape.from > 1) {
      assert.equal(shapeWeightAt(shape, shape.from - 1), 0, `${shape.name} is absent before ${shape.from}`);
    }
    for (let level = shape.from; level <= MAX_LEVEL; level++) {
      assert.ok(shapeWeightAt(shape, level) > 0, `${shape.name} is available at ${level}`);
    }
  }
});

test("a shape ramps in, holds, then fades", () => {
  const domino = byName("domino-h");
  assert.ok(shapeWeightAt(domino, 1) > shapeWeightAt(domino, MAX_LEVEL), "dominoes thin out");

  const tri = byName("tri-h");
  assert.ok(
    shapeWeightAt(tri, tri.peak) > shapeWeightAt(tri, tri.from),
    "a shape is rarer on the level it first appears"
  );

  const ess = byName("ess");
  assert.ok(shapeWeightAt(ess, ess.peak) > shapeWeightAt(ess, ess.from), "S-pieces ease in");
});

test("the pool only grows, and level 10 has everything", () => {
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const smaller = shapePoolFor(level - 1);
    const bigger = shapePoolFor(level);
    for (const shape of smaller) {
      assert.ok(bigger.includes(shape), `${shape.name} is still around at ${level}`);
    }
  }
  assert.equal(shapePoolFor(MAX_LEVEL).length, SHAPES.length);
});

// ---- the actual complaints this rework was meant to fix ----

test("level 1 is not a flood of single squares", () => {
  const { share } = sample(1);
  assert.ok(share("dot") < 0.12, `dots were ${(share("dot") * 100).toFixed(1)}% of level 1 draws`);
});

test("the 5-bars are common once they arrive, not a rarity", () => {
  const penta = byName("penta-h");
  assert.ok(penta.from <= 5, "5-bars arrive by level 5");

  const { share } = sample(8);
  const bars = share("penta-h") + share("penta-v");
  assert.ok(bars > 0.12, `5-bars were only ${(bars * 100).toFixed(1)}% of level 8 draws`);
});

test("tiny pieces stop dominating as you climb", () => {
  const small = (level) => {
    const { share } = sample(level);
    return share("dot") + share("domino-h") + share("domino-v");
  };

  const early = small(1);
  const late = small(MAX_LEVEL);
  assert.ok(late < early / 2, `small pieces went ${early.toFixed(2)} → ${late.toFixed(2)}`);
  assert.ok(late > 0, "…but never disappear completely, they're the way out of a tight board");
});

test("the board-wreckers stay rare even at level 10", () => {
  const { share } = sample(MAX_LEVEL);
  const nasty = share("ess") + share("zee") + share("square-3");
  assert.ok(nasty < 0.2, `S/Z/3×3 were ${(nasty * 100).toFixed(1)}% of level 10 draws`);
  assert.ok(nasty > 0.02, "…but they do show up");
});

test("the average piece gets bigger as the level climbs", () => {
  const averageSize = (level) => {
    const rng = seededRng(3);
    let total = 0;
    const draws = 8000;
    for (let i = 0; i < draws; i++) total += pickShape(level, rng).size;
    return total / draws;
  };

  const sizes = [1, 3, 5, 7, MAX_LEVEL].map(averageSize);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(sizes[i] > sizes[i - 1], `average size grew: ${sizes.map((s) => s.toFixed(2))}`);
  }
});

test("no single shape ever dominates a level", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const { counts } = sample(level, 6000, level);
    const top = Math.max(...counts.values()) / 6000;
    assert.ok(top < 0.35, `one shape was ${(top * 100).toFixed(0)}% of level ${level}`);
  }
});
