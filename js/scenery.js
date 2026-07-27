/**
 * scenery.js — paints whatever looks.js decided.
 *
 * The DOM half of the look framework. looks.js says *which* look is in
 * force and what earns the next one; this file is the only thing that
 * knows how a look reaches the page, which is: write the look's custom
 * properties onto `:root`, set a data attribute for the block surface,
 * and let the stylesheet do the rest.
 *
 * That's why a new look needs no CSS at all — it's a data change in
 * looks.js and nothing else.
 */

import { LOOKS as LOOK_TIMING } from "./config.js";
import { el } from "./dom.js";
import { lookFor, paletteFor } from "./looks.js";

let current = null;
const listeners = new Set();

export function currentLook() {
  return current;
}

/**
 * Called with {from, to} palettes when the look changes under a game in
 * progress, so main.js can recolour blocks already on the board.
 */
export function onLookChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

/**
 * Writes a look onto the document.
 *
 * `animate` turns the slow transitions on for the length of the swap and
 * then takes them off again. They can't live in the stylesheet
 * permanently: the drag preview is a `box-shadow`, and a half-second
 * transition on it makes every square you drag across smear behind your
 * finger.
 */
export function applyLook(look, { animate = false } = {}) {
  if (!look) return null;
  if (current && current.id === look.id) return look;

  const previous = current;
  const root = document.documentElement;

  if (animate) root.classList.add("look-swap");

  for (const [name, value] of Object.entries(look.vars)) {
    root.style.setProperty(name, value);
  }
  const [one, two, three] = look.scenery.tint;
  root.style.setProperty("--scenery-1", one);
  root.style.setProperty("--scenery-2", two);
  root.style.setProperty("--scenery-3", three);
  root.style.setProperty("--scenery-haze", look.scenery.haze);
  root.style.setProperty("--scenery-blur", `${look.scenery.blur}px`);

  root.dataset.look = look.id;
  root.dataset.surface = look.surface;
  root.dataset.motion = look.scenery.motion;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", look.vars["--bg"] ?? "#0f1122");

  if (animate && el.scenery) {
    el.scenery.classList.remove("swap");
    void el.scenery.offsetWidth; // restart the fade
    el.scenery.classList.add("swap");
  }

  if (animate) {
    setTimeout(() => {
      root.classList.remove("look-swap");
      el.scenery?.classList.remove("swap");
    }, LOOK_TIMING.swapMs);
  }

  current = look;
  if (previous) notify(previous.blocks, look.blocks, look);
  return look;
}

function notify(from, to, look) {
  for (const handler of [...listeners]) {
    try {
      handler({ from, to, look });
    } catch (error) {
      console.error("look change handler failed:", error);
    }
  }
}

/** Paints the look a game state has earned. */
export function applyLookFor(level, boardClears, options = {}) {
  return applyLook(lookFor(level, boardClears), options);
}

/**
 * A level up or a board clear: swap the look with the full cross-fade.
 * Returns the new look, or null if this didn't actually move the cycle on.
 */
export function advanceLook(level, boardClears) {
  const next = lookFor(level, boardClears);
  if (current && current.id === next.id) return null;
  return applyLook(next, { animate: true });
}

/** The palette in force right now. */
export function currentPalette() {
  return current?.blocks ?? paletteFor(1, 0);
}

// ---------- the notice ----------

let noticeTimer = null;

/** The pill that names the new look. */
export function announceLook(look, kind = "New look") {
  if (!look || !el.themeNotice) return null;

  el.themeNoticeKind.textContent = kind;
  el.themeNoticeName.textContent = look.name;
  el.themeNoticeBlurb.textContent = look.blurb;

  const dot = el.themeNotice.querySelector(".dot");
  if (dot) {
    dot.style.background = `linear-gradient(135deg, ${look.blocks[0]}, ${look.blocks[3] ?? look.blocks[1]})`;
  }

  el.themeNotice.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.themeNotice.classList.remove("show"), LOOK_TIMING.noticeMs);
  return look;
}

/** Boot: paint the starting look before anything else draws. */
export function initScenery(level = 1, boardClears = 0) {
  return applyLookFor(level, boardClears);
}
