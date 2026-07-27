/**
 * themes.js — the look of the game, and when it changes.
 *
 * The idea worth stealing from Block Blast: the scenery and the blocks
 * change, but *rarely*. A look that changed every game would be noise; one
 * that holds for a few days becomes something you notice coming back to.
 * So the theme is picked from the calendar, not at random — everyone
 * playing on the same day sees the same one, and it rotates on a fixed
 * period.
 *
 * This file is pure data and pure arithmetic. Nothing here touches the
 * DOM, which is what lets the dealer ask it for a block palette and the
 * tests ask it what the theme will be six weeks from now.
 * `scenery.js` is the half that paints it.
 *
 * ## Adding a theme
 *
 * Append to THEMES. Every theme needs the same `vars` keys and seven
 * `blocks` colours; there's a test that enforces both, so a half-finished
 * theme fails the suite rather than shipping a half-styled page.
 */

import { COLORS, THEME_ROTATION } from "./config.js";
import { readString, write } from "./storage.js";

/**
 * Day zero for the rotation. Fixed forever — moving it would reshuffle
 * which theme every past day had.
 */
export const ROTATION_EPOCH = Date.UTC(2026, 0, 5);

const DAY_MS = 24 * 60 * 60 * 1000;

export const THEMES = [
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Glassy blocks, deep blue",
    blockStyle: "gloss",
    vars: {
      "--bg": "#0f1122",
      "--surface": "rgba(255, 255, 255, 0.05)",
      "--surface-strong": "rgba(255, 255, 255, 0.09)",
      "--empty-cell": "rgba(255, 255, 255, 0.04)",
      "--board-bg": "rgba(255, 255, 255, 0.06)",
      "--text": "#ffffff",
      "--text-dim": "rgba(255, 255, 255, 0.45)",
      "--gold": "#ffd23f",
      "--cell-radius": "9px",
      "--block-gloss": "rgba(255, 255, 255, 0.26)",
    },
    blocks: ["#f28c40", "#4da6f2", "#73cc66", "#f26673", "#b380f2", "#fac54d", "#59cccc"],
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "Fat candy blocks, warm dusk",
    blockStyle: "candy",
    vars: {
      "--bg": "#1b0f1e",
      "--surface": "rgba(255, 220, 200, 0.06)",
      "--surface-strong": "rgba(255, 220, 200, 0.11)",
      "--empty-cell": "rgba(255, 210, 190, 0.05)",
      "--board-bg": "rgba(255, 200, 170, 0.07)",
      "--text": "#fff4ec",
      "--text-dim": "rgba(255, 235, 220, 0.48)",
      "--gold": "#ffb057",
      "--cell-radius": "15px",
      "--block-gloss": "rgba(255, 255, 255, 0.34)",
    },
    blocks: ["#ff8f5e", "#ff6b9d", "#ffc861", "#c86bff", "#ff5f6d", "#7ad0ff", "#ffe28a"],
  },
  {
    id: "forest",
    name: "Forest",
    blurb: "Cut gemstones, deep green",
    blockStyle: "gem",
    vars: {
      "--bg": "#0b1a14",
      "--surface": "rgba(200, 255, 220, 0.05)",
      "--surface-strong": "rgba(200, 255, 220, 0.10)",
      "--empty-cell": "rgba(190, 255, 215, 0.045)",
      "--board-bg": "rgba(180, 255, 210, 0.06)",
      "--text": "#eefff4",
      "--text-dim": "rgba(220, 255, 235, 0.45)",
      "--gold": "#9ee86b",
      "--cell-radius": "8px",
      "--block-gloss": "rgba(255, 255, 255, 0.2)",
    },
    blocks: ["#7fd45f", "#3fa9a0", "#d4c95f", "#5f9fd4", "#d4785f", "#a95fd4", "#5fd4a0"],
  },
  {
    id: "neon",
    name: "Neon",
    blurb: "Glowing bubbles, electric",
    blockStyle: "bubble",
    vars: {
      "--bg": "#08080f",
      "--surface": "rgba(255, 255, 255, 0.07)",
      "--surface-strong": "rgba(255, 255, 255, 0.13)",
      // near-black backgrounds swallow a low-contrast grid, so the empty
      // cells have to work harder here than on the lighter themes
      "--empty-cell": "rgba(150, 210, 255, 0.10)",
      "--board-bg": "rgba(120, 190, 255, 0.06)",
      "--text": "#ffffff",
      "--text-dim": "rgba(255, 255, 255, 0.42)",
      "--gold": "#00f0ff",
      "--cell-radius": "12px",
      "--block-gloss": "rgba(255, 255, 255, 0.5)",
    },
    blocks: ["#00f0ff", "#ff2f9c", "#b14dff", "#3dff7a", "#ffe600", "#ff6b2f", "#00b3ff"],
  },
];

export const DEFAULT_THEME = THEMES[0];

/** A theme by id, or null. */
export function themeById(id) {
  return THEMES.find((t) => t.id === id) ?? null;
}

// ---------- the rotation ----------

/** Whole days from the fixed epoch to `date`. Can be negative. */
export function daysSinceEpoch(date = new Date()) {
  const time = date instanceof Date ? date.getTime() : Number(date);
  if (!Number.isFinite(time)) return 0;
  return Math.floor((time - ROTATION_EPOCH) / DAY_MS);
}

/** Which slot in the rotation `date` falls in. Always 0…THEMES.length-1. */
export function rotationIndex(date = new Date(), period = THEME_ROTATION.periodDays) {
  const days = daysSinceEpoch(date);
  const slot = Math.floor(days / Math.max(1, period));
  // JS % keeps the sign, so dates before the epoch would go negative
  return ((slot % THEMES.length) + THEMES.length) % THEMES.length;
}

/** The theme the calendar says it is, ignoring any manual choice. */
export function scheduledTheme(date = new Date()) {
  return THEMES[rotationIndex(date)];
}

/** Whole days until the scheduled theme changes. Always 1…period. */
export function daysUntilRotation(date = new Date(), period = THEME_ROTATION.periodDays) {
  const span = Math.max(1, period);
  const days = daysSinceEpoch(date);
  const into = ((days % span) + span) % span;
  return span - into;
}

/**
 * The theme in force. Driven by the calendar and nothing else — there is
 * deliberately no picker. The look is something the game does *to* you on
 * a schedule; letting it be chosen turns a small event into a setting,
 * and then nobody ever sees the other three.
 */
export function activeTheme(date = new Date()) {
  return scheduledTheme(date);
}

/** The block palette to deal pieces from. */
export function activePalette(date = new Date()) {
  const blocks = activeTheme(date).blocks;
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : COLORS;
}

/**
 * The same slot in a different palette.
 *
 * Palettes are parallel lists, so a block that was the third colour of one
 * theme becomes the third colour of the next. Anything that isn't from the
 * old palette is left exactly as it was rather than guessed at.
 */
export function remapColour(colour, from, to) {
  if (!Array.isArray(from) || !Array.isArray(to) || to.length === 0) return colour;
  const index = from.indexOf(colour);
  return index === -1 ? colour : to[index % to.length];
}

// ---------- "there's a new look" ----------

/**
 * True the first time the player opens the game after the scheduled theme
 * has moved on — the one moment worth interrupting them for. Records what
 * it saw, so it only ever fires once per rotation.
 *
 * Returns null when there's nothing to announce.
 */
export function consumeThemeChange(date = new Date()) {
  const current = scheduledTheme(date);
  const seen = readString(THEME_ROTATION.seenKey, "");

  if (seen === current.id) return null;

  write(THEME_ROTATION.seenKey, current.id);
  // Nothing seen before means this is a first visit, not a change.
  return seen === "" ? null : current;
}
