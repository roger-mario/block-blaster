/**
 * The look cycle: what the game looks like, and what earns the next one.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { COLORS } from "../js/config.js";
import { MAX_LEVEL } from "../js/difficulty.js";
import {
  LOOKS,
  SURFACES,
  DEFAULT_LOOK,
  lookById,
  lookIndex,
  lookAt,
  lookFor,
  lookChanges,
  paletteFor,
  remapColour,
} from "../js/looks.js";

const MOTIONS = new Set(["drift", "sway", "rise", "swirl"]);

const REQUIRED_VARS = [
  "--bg", "--surface", "--surface-strong", "--empty-cell", "--board-bg",
  "--text", "--text-dim", "--gold", "--block-gloss",
];

// ---------- the catalogue ----------

test("there are at least as many looks as levels", () => {
  assert.ok(
    LOOKS.length >= MAX_LEVEL,
    `${LOOKS.length} looks for ${MAX_LEVEL} levels — a full run would repeat`
  );
});

test("and headroom past the top of the ladder", () => {
  // Exactly one look per level wrapped back to Midnight for anyone who
  // also cleared the board on the way up, so the reward for a perfect
  // clear was the look they had already been staring at.
  assert.ok(
    LOOKS.length > MAX_LEVEL,
    `${LOOKS.length} looks and ${MAX_LEVEL} levels leaves nothing for a board clear`
  );
});

test("every surface is worn by a look, and drawn by the stylesheet", () => {
  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
  const worn = new Set(LOOKS.map((l) => l.surface));

  for (const surface of SURFACES) {
    assert.ok(worn.has(surface), `${surface} is used by at least one look`);
    assert.ok(
      css.includes(`[data-surface="${surface}"]`),
      `${surface} has its own rules — scenery.js sets the attribute and nothing else would`
    );
  }
});

test("every look is complete and unique", () => {
  const ids = new Set();
  for (const look of LOOKS) {
    assert.ok(look.id, "has an id");
    assert.ok(!ids.has(look.id), `${look.id} is not a duplicate`);
    ids.add(look.id);

    assert.ok(look.name, `${look.id} has a name`);
    assert.ok(look.blurb, `${look.id} has a blurb`);
    assert.ok(SURFACES.includes(look.surface), `${look.id} uses a known surface`);
  }
});

test("every look defines every variable the stylesheet reads", () => {
  for (const look of LOOKS) {
    for (const name of REQUIRED_VARS) {
      assert.ok(look.vars[name], `${look.id} sets ${name}`);
    }
  }
});

test("every look has a full palette of distinct colours", () => {
  for (const look of LOOKS) {
    assert.equal(look.blocks.length, COLORS.length, `${look.id} has a full palette`);
    assert.equal(new Set(look.blocks).size, look.blocks.length, `${look.id} has no duplicates`);
    for (const colour of look.blocks) {
      assert.match(colour, /^#[0-9a-f]{6}$/i, `${look.id}: ${colour} is a hex colour`);
    }
  }
});

test("every look has a soft, complete scenery", () => {
  for (const look of LOOKS) {
    const { motion, blur, haze, tint } = look.scenery;
    assert.ok(MOTIONS.has(motion), `${look.id} uses a known motion`);
    assert.ok(blur >= 55, `${look.id} is blurred enough to have no edge (${blur}px)`);
    assert.match(haze, /gradient/, `${look.id} has a haze gradient`);
    assert.equal(tint.length, 3, `${look.id} has three blob colours`);

    for (const colour of tint) {
      assert.match(colour, /^rgba\(/, `${look.id}: ${colour} is translucent`);
      const alpha = Number(colour.split(",").pop().replace(")", "").trim());
      assert.ok(alpha > 0 && alpha <= 0.3, `${look.id}: alpha ${alpha} stays subtle`);
    }
  }
});

test("consecutive looks are genuinely different, not a nudge", () => {
  // Blocks are always rounded squares now, so the palette and the
  // background have to carry the whole change — and the surface or the
  // motion has to move too, or two looks in a row read as the same world
  // in a different colour.
  for (let i = 1; i < LOOKS.length; i++) {
    const a = LOOKS[i - 1];
    const b = LOOKS[i];

    assert.notEqual(a.blocks.join(), b.blocks.join(), `${a.id} → ${b.id} repaints the blocks`);
    assert.notEqual(a.vars["--bg"], b.vars["--bg"], `${a.id} → ${b.id} repaints the background`);
    assert.ok(
      a.surface !== b.surface || a.scenery.motion !== b.scenery.motion,
      `${a.id} → ${b.id} changes neither the surface nor the motion`
    );
  }
});

test("blocks are always rounded squares", () => {
  for (const look of LOOKS) {
    assert.equal(
      look.shape,
      undefined,
      `${look.id} still carries a shape — the silhouette is fixed in CSS now`
    );
    assert.equal(
      look.vars["--cell-radius"],
      undefined,
      `${look.id} sets its own corner radius; there is one for every look`
    );
  }
});

test("lookById finds them and shrugs at nonsense", () => {
  assert.equal(lookById("midnight").id, "midnight");
  assert.equal(lookById("does-not-exist"), null);
  assert.equal(DEFAULT_LOOK, LOOKS[0]);
});

// ---------- what earns the next one ----------

test("levelling up moves the look on", () => {
  for (let level = 1; level < MAX_LEVEL; level++) {
    assert.ok(lookChanges(level, 0, level + 1, 0), `level ${level} → ${level + 1} changes the look`);
  }
});

test("clearing the board moves the look on", () => {
  for (let clears = 0; clears < 5; clears++) {
    assert.ok(lookChanges(3, clears, 3, clears + 1), `board clear ${clears + 1} changes the look`);
  }
});

test("a level up and a board clear count the same", () => {
  assert.equal(lookFor(4, 0).id, lookFor(1, 3).id, "three clears is worth three levels");
  assert.equal(lookIndex(4, 0), lookIndex(1, 3));
});

test("nothing else moves it", () => {
  assert.equal(lookChanges(5, 2, 5, 2), false, "same state, same look");
});

test("the index is derived, so it can never drift out of step", () => {
  assert.equal(lookIndex(1, 0), 0);
  assert.equal(lookIndex(1, 1), 1);
  assert.equal(lookIndex(2, 0), 1);
  assert.equal(lookIndex(7, 3), 9);
});

test("rubbish input still gives a real look", () => {
  for (const bad of [undefined, null, NaN, -4, "nope"]) {
    assert.ok(LOOKS.includes(lookFor(bad, bad)), `${String(bad)} still resolves`);
  }
  assert.equal(lookIndex(0, 0), 0, "level 0 clamps to the first");
});

test("the cycle wraps rather than running out", () => {
  assert.equal(lookAt(LOOKS.length).id, LOOKS[0].id);
  assert.equal(lookAt(LOOKS.length * 7 + 3).id, LOOKS[3].id);
  assert.ok(LOOKS.includes(lookAt(-5)), "negative indexes wrap forward");
});

test("a long game sees every look before repeating one", () => {
  const seen = new Set();
  for (let i = 0; i < LOOKS.length; i++) seen.add(lookAt(i).id);
  assert.equal(seen.size, LOOKS.length);
});

// ---------- palettes ----------

test("the palette follows the look", () => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    assert.deepEqual(paletteFor(level, 0), lookFor(level, 0).blocks);
  }
});

test("remapColour moves a block to the same slot in the new palette", () => {
  const from = LOOKS[0].blocks;
  const to = LOOKS[1].blocks;

  assert.equal(remapColour(from[2], from, to), to[2]);
  assert.equal(remapColour(from[0], from, to), to[0]);
});

test("remapColour leaves anything it doesn't recognise alone", () => {
  const from = LOOKS[0].blocks;
  const to = LOOKS[1].blocks;

  assert.equal(remapColour("#123456", from, to), "#123456");
  assert.equal(remapColour("#abc", null, to), "#abc");
  assert.equal(remapColour("#abc", from, []), "#abc");
});
