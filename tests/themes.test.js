/**
 * The theme framework: what the look is, and when it changes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { THEME_ROTATION, COLORS } from "../js/config.js";
import { remove } from "../js/storage.js";
import {
  THEMES,
  DEFAULT_THEME,
  ROTATION_EPOCH,
  themeById,
  daysSinceEpoch,
  rotationIndex,
  scheduledTheme,
  daysUntilRotation,
  activeTheme,
  activePalette,
  consumeThemeChange,
  remapColour,
} from "../js/themes.js";

const DAY = 24 * 60 * 60 * 1000;
const dayN = (n) => new Date(ROTATION_EPOCH + n * DAY + 6 * 60 * 60 * 1000);

function freshStore() {
  remove(THEME_ROTATION.seenKey);
}

// ---------- the catalogue ----------

test("every theme is complete and internally consistent", () => {
  const required = Object.keys(DEFAULT_THEME.vars);
  const ids = new Set();

  for (const theme of THEMES) {
    assert.ok(theme.id, "has an id");
    assert.ok(!ids.has(theme.id), `${theme.id} is not a duplicate`);
    ids.add(theme.id);

    assert.ok(theme.name, `${theme.id} has a name`);
    assert.ok(theme.blurb, `${theme.id} has a blurb`);

    // a theme missing a variable would leave the previous theme's colour
    // stranded on the page, which is worse than looking wrong
    for (const key of required) {
      assert.ok(key in theme.vars, `${theme.id} sets ${key}`);
      assert.match(String(theme.vars[key]), /\S/, `${theme.id}'s ${key} isn't blank`);
    }
    assert.equal(
      Object.keys(theme.vars).length,
      required.length,
      `${theme.id} sets exactly the same variables as the others`
    );

    assert.equal(theme.blocks.length, COLORS.length, `${theme.id} has a full block palette`);
    for (const colour of theme.blocks) {
      assert.match(colour, /^#[0-9a-f]{6}$/i, `${theme.id}: ${colour} is a hex colour`);
    }
  }
});

test("every theme names a block surface, and none has sharp corners", () => {
  const surfaces = new Set(["gloss", "candy", "gem", "bubble"]);
  for (const theme of THEMES) {
    assert.ok(surfaces.has(theme.blockStyle), `${theme.id} uses a known block surface`);

    const radius = parseFloat(theme.vars["--cell-radius"]);
    assert.ok(radius >= 8, `${theme.id}'s corners are soft (${radius}px)`);
  }
});

test("themeById finds themes and shrugs at nonsense", () => {
  assert.equal(themeById("midnight").id, "midnight");
  assert.equal(themeById("does-not-exist"), null);
  assert.equal(themeById(undefined), null);
});

// ---------- the rotation ----------

test("day counting is anchored to the fixed epoch", () => {
  assert.equal(daysSinceEpoch(new Date(ROTATION_EPOCH)), 0);
  assert.equal(daysSinceEpoch(dayN(5)), 5);
  assert.equal(daysSinceEpoch(dayN(-3)), -3);
  assert.equal(daysSinceEpoch(new Date("nonsense")), 0, "an invalid date doesn't throw");
});

test("the theme holds for the whole period, then moves on", () => {
  const period = THEME_ROTATION.periodDays;

  for (let day = 0; day < period; day++) {
    assert.equal(rotationIndex(dayN(day), period), 0, `day ${day} is still the first theme`);
  }
  assert.equal(rotationIndex(dayN(period), period), 1, "the next period is the next theme");
  assert.equal(rotationIndex(dayN(period * 2), period), 2);
});

test("the rotation wraps round the catalogue forever", () => {
  const period = THEME_ROTATION.periodDays;
  const full = THEMES.length * period;

  assert.equal(rotationIndex(dayN(full), period), 0, "back to the start");
  assert.equal(rotationIndex(dayN(full * 7 + period), period), 1, "still in step much later");
});

test("dates before the epoch still land on a real theme", () => {
  for (let day = -30; day < 0; day++) {
    const index = rotationIndex(dayN(day));
    assert.ok(index >= 0 && index < THEMES.length, `day ${day} gave index ${index}`);
  }
});

test("everyone on the same day sees the same theme", () => {
  const morning = new Date(ROTATION_EPOCH + 4 * DAY + 1 * 60 * 60 * 1000);
  const evening = new Date(ROTATION_EPOCH + 4 * DAY + 23 * 60 * 60 * 1000);
  assert.equal(scheduledTheme(morning).id, scheduledTheme(evening).id);
});

test("the countdown to the next look is always within the period", () => {
  const period = THEME_ROTATION.periodDays;
  for (let day = 0; day < period * 3; day++) {
    const left = daysUntilRotation(dayN(day), period);
    assert.ok(left >= 1 && left <= period, `day ${day} said ${left} days left`);
  }
  assert.equal(daysUntilRotation(dayN(0), period), period, "a fresh period has the full run");
  assert.equal(daysUntilRotation(dayN(period - 1), period), 1, "the last day says one");
});

test("the theme actually changes when the countdown runs out", () => {
  const period = THEME_ROTATION.periodDays;
  const lastDay = dayN(period - 1);
  const nextDay = dayN(period);
  assert.notEqual(scheduledTheme(lastDay).id, scheduledTheme(nextDay).id);
});

// ---------- no picker, by design ----------

test("the theme is whatever the calendar says, with no way to override it", () => {
  freshStore();
  for (let day = 0; day < THEMES.length * THEME_ROTATION.periodDays; day++) {
    assert.equal(
      activeTheme(dayN(day)).id,
      scheduledTheme(dayN(day)).id,
      `day ${day} follows the rotation`
    );
  }
});

test("the block palette follows the scheduled theme", () => {
  freshStore();
  for (let day = 0; day < THEMES.length * THEME_ROTATION.periodDays; day += THEME_ROTATION.periodDays) {
    assert.deepEqual(activePalette(dayN(day)), scheduledTheme(dayN(day)).blocks);
  }
});

test("every theme's palette is a full set of usable colours", () => {
  for (const theme of THEMES) {
    assert.equal(theme.blocks.length, COLORS.length);
    assert.equal(new Set(theme.blocks).size, theme.blocks.length, `${theme.id} has no duplicates`);
  }
});

// ---------- the "new look" notice ----------

test("a first visit is not announced as a change", () => {
  freshStore();
  assert.equal(consumeThemeChange(dayN(0)), null, "nothing to compare against yet");
});

test("a rotation since your last visit is announced exactly once", () => {
  freshStore();
  consumeThemeChange(dayN(0)); // records what you saw

  const later = dayN(THEME_ROTATION.periodDays);
  const announced = consumeThemeChange(later);
  assert.ok(announced, "the new look is announced");
  assert.equal(announced.id, scheduledTheme(later).id);

  assert.equal(consumeThemeChange(later), null, "and not announced again");
});

test("coming back inside the same period says nothing", () => {
  freshStore();
  consumeThemeChange(dayN(0));
  assert.equal(consumeThemeChange(dayN(THEME_ROTATION.periodDays - 1)), null);
});



// ---------- recolouring an in-progress board ----------

test("a colour moves to the same slot in the new palette", () => {
  const from = ["#aaa111", "#bbb222", "#ccc333"];
  const to = ["#111aaa", "#222bbb", "#333ccc"];

  assert.equal(remapColour("#aaa111", from, to), "#111aaa");
  assert.equal(remapColour("#ccc333", from, to), "#333ccc");
});

test("a colour that isn't from the old palette is left alone", () => {
  assert.equal(remapColour("#ff00ff", ["#aaa111"], ["#111aaa"]), "#ff00ff");
});

test("remapping survives junk input rather than blanking a block", () => {
  assert.equal(remapColour("#abc", null, ["#123456"]), "#abc");
  assert.equal(remapColour("#abc", ["#abc"], []), "#abc");
  assert.equal(remapColour("#abc", ["#abc"], null), "#abc");
});

test("every real theme pair remaps cleanly in both directions", () => {
  for (const a of THEMES) {
    for (const b of THEMES) {
      for (const colour of a.blocks) {
        const moved = remapColour(colour, a.blocks, b.blocks);
        assert.ok(b.blocks.includes(moved), `${a.id} → ${b.id} kept ${colour} in palette`);
        assert.equal(
          remapColour(moved, b.blocks, a.blocks),
          colour,
          `${a.id} → ${b.id} → ${a.id} is a round trip`
        );
      }
    }
  }
});
