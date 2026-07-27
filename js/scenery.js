/**
 * scenery.js — paints the theme and the background.
 *
 * The DOM half of two separate axes (see ANIMATION-STRATEGY.md):
 *
 *   theme    palette, block shape and block surface. Rotates on the
 *            calendar — the same for everyone on the same day.
 *   scenery  the background. Advances on **level up**, so getting further
 *            visibly looks different. Not a setting, not a choice.
 *
 * Both reach the page the same way: write custom properties onto `:root`
 * and let the stylesheet do the rest. Every colour in styles.css already
 * reads a variable, so neither axis needs any CSS of its own.
 */

import { THEME_ROTATION, TIMING } from "./config.js";
import { el } from "./dom.js";
import { activeTheme, activePalette, consumeThemeChange } from "./themes.js";
import { sceneryForLevel, sceneryChanges } from "./sceneries.js";

let currentTheme_ = null;
let currentScenery = null;
const listeners = new Set();

export function currentTheme() {
  return currentTheme_;
}

export function currentScenerySpec() {
  return currentScenery;
}

/**
 * Called with {from, to} palettes whenever the theme changes under a game
 * in progress, so main.js can restyle blocks already on the board.
 */
export function onThemeChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

// ---------- the theme ----------

export function applyTheme(theme) {
  if (!theme) return null;

  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.id;
  // the block surface is a rendering treatment rather than a colour, so it
  // gets its own attribute for the stylesheet to hang selectors on
  root.dataset.block = theme.blockStyle ?? "gloss";

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.vars["--bg"] ?? "#0f1122");

  currentTheme_ = theme;
  return theme;
}

export function refreshTheme(date = new Date()) {
  const before = activePalette();
  const theme = applyTheme(activeTheme(date));
  const after = activePalette();

  if (before.join() !== after.join()) notify(before, after, theme);
  return theme;
}

function notify(from, to, theme) {
  for (const handler of [...listeners]) {
    try {
      handler({ from, to, theme });
    } catch (error) {
      console.error("theme change handler failed:", error);
    }
  }
}

// ---------- the scenery ----------

/**
 * Paints the background for a level.
 *
 * `animate` cross-fades rather than cutting, which is what makes a level
 * up feel like the world changing rather than a repaint.
 */
export function applyScenery(level, { animate = false } = {}) {
  const scenery = sceneryForLevel(level);
  if (!scenery) return null;
  if (currentScenery && currentScenery.id === scenery.id) return scenery;

  const root = document.documentElement;
  const [one, two, three] = scenery.tint;
  root.style.setProperty("--scenery-1", one);
  root.style.setProperty("--scenery-2", two);
  root.style.setProperty("--scenery-3", three);
  root.style.setProperty("--scenery-haze", scenery.haze);
  root.style.setProperty("--scenery-blur", `${scenery.blur}px`);
  root.dataset.motion = scenery.motion;

  if (animate && el.scenery) {
    el.scenery.classList.remove("swap");
    void el.scenery.offsetWidth; // restart the fade
    el.scenery.classList.add("swap");
    setTimeout(() => el.scenery?.classList.remove("swap"), TIMING.sceneryFade);
  }

  currentScenery = scenery;
  return scenery;
}

/**
 * Level up: swap the background. Returns the new scenery, or null when
 * this level didn't actually change it.
 */
export function advanceScenery(previousLevel, level) {
  if (!sceneryChanges(previousLevel, level)) return null;
  return applyScenery(level, { animate: true });
}

// ---------- the notice ----------

export function announceThemeChange(date = new Date()) {
  const theme = consumeThemeChange(date);
  if (!theme || !el.themeNotice) return null;
  showNotice("New look", theme.name, theme.blurb, theme.blocks);
  return theme;
}

/** The same pill, reused when the background advances. */
export function announceScenery(scenery) {
  if (!scenery || !el.themeNotice) return null;
  showNotice("New scenery", scenery.name, `Level ${scenery.level}`, scenery.tint);
  return scenery;
}

let noticeTimer = null;

function showNotice(kind, name, blurb, colours) {
  el.themeNoticeKind.textContent = kind;
  el.themeNoticeName.textContent = name;
  el.themeNoticeBlurb.textContent = blurb;

  const dot = el.themeNotice.querySelector(".dot");
  if (dot && colours?.length) {
    dot.style.background = `linear-gradient(135deg, ${colours[0]}, ${colours[1] ?? colours[0]})`;
  }

  el.themeNotice.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => el.themeNotice.classList.remove("show"),
    THEME_ROTATION.noticeMs
  );
}

/** Boot: theme and background painted before anything else draws. */
export function initScenery(level = 1) {
  refreshTheme();
  applyScenery(level);
  setTimeout(() => announceThemeChange(), 600);
}
