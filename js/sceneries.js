/**
 * sceneries.js — the background, and what advances it.
 *
 * Category 3 in ANIMATION-STRATEGY.md. The scenery is tied to your
 * **level**, not the calendar and not a setting: it's the only visual
 * proof that you're getting further than last time, so reaching level 7
 * has to *look* like level 7.
 *
 * Ten of them, one per level. Deliberately not the player's choice — a
 * picker would turn a reward into a settings screen.
 *
 * Every one obeys the same rule: **nothing sharp**. Big blurs, soft
 * radial falloff, and a vignette over the top, so no layer ever meets the
 * edge of the screen with a visible line.
 *
 * Pure data and pure lookup — no DOM. `scenery.js` paints it.
 */

import { MAX_LEVEL } from "./difficulty.js";

/**
 *   tint    the three blob colours, back to front
 *   motion  which drift keyframes the blobs use
 *   haze    an overall wash sitting behind the blobs
 *   blur    px of blur on each blob — higher is softer and vaguer
 */
export const SCENERIES = [
  {
    id: "still",
    name: "Still",
    level: 1,
    motion: "drift",
    blur: 60,
    haze: "radial-gradient(120% 90% at 50% 0%, rgba(60, 90, 160, 0.20), transparent 70%)",
    tint: ["rgba(77, 166, 242, 0.20)", "rgba(120, 130, 220, 0.16)", "rgba(89, 204, 204, 0.12)"],
  },
  {
    id: "tide",
    name: "Tide",
    level: 2,
    motion: "sway",
    blur: 64,
    haze: "radial-gradient(120% 90% at 30% 10%, rgba(40, 120, 160, 0.22), transparent 72%)",
    tint: ["rgba(60, 190, 220, 0.22)", "rgba(70, 130, 230, 0.18)", "rgba(120, 220, 200, 0.14)"],
  },
  {
    id: "grove",
    name: "Grove",
    level: 3,
    motion: "rise",
    blur: 66,
    haze: "radial-gradient(130% 100% at 60% 100%, rgba(50, 140, 90, 0.22), transparent 70%)",
    tint: ["rgba(90, 210, 130, 0.22)", "rgba(60, 170, 150, 0.16)", "rgba(180, 220, 90, 0.13)"],
  },
  {
    id: "dusk",
    name: "Dusk",
    level: 4,
    motion: "drift",
    blur: 70,
    haze: "radial-gradient(120% 90% at 50% 100%, rgba(180, 70, 90, 0.20), transparent 72%)",
    tint: ["rgba(255, 140, 90, 0.22)", "rgba(230, 90, 140, 0.18)", "rgba(140, 70, 190, 0.16)"],
  },
  {
    id: "aurora",
    name: "Aurora",
    level: 5,
    motion: "swirl",
    blur: 74,
    haze: "radial-gradient(140% 100% at 50% 0%, rgba(60, 200, 170, 0.20), transparent 74%)",
    tint: ["rgba(80, 240, 190, 0.22)", "rgba(120, 140, 250, 0.18)", "rgba(200, 120, 240, 0.15)"],
  },
  {
    id: "ember",
    name: "Ember",
    level: 6,
    motion: "rise",
    blur: 72,
    haze: "radial-gradient(130% 100% at 50% 100%, rgba(200, 90, 40, 0.22), transparent 70%)",
    tint: ["rgba(255, 150, 60, 0.24)", "rgba(230, 80, 60, 0.18)", "rgba(255, 210, 110, 0.14)"],
  },
  {
    id: "orbit",
    name: "Orbit",
    level: 7,
    motion: "swirl",
    blur: 68,
    haze: "radial-gradient(120% 100% at 50% 50%, rgba(80, 70, 190, 0.22), transparent 72%)",
    tint: ["rgba(140, 120, 255, 0.24)", "rgba(90, 190, 255, 0.18)", "rgba(220, 130, 255, 0.15)"],
  },
  {
    id: "bloom",
    name: "Bloom",
    level: 8,
    motion: "sway",
    blur: 76,
    haze: "radial-gradient(130% 100% at 40% 20%, rgba(220, 90, 160, 0.22), transparent 74%)",
    tint: ["rgba(255, 130, 200, 0.24)", "rgba(180, 120, 255, 0.18)", "rgba(255, 190, 120, 0.14)"],
  },
  {
    id: "prism",
    name: "Prism",
    level: 9,
    motion: "swirl",
    blur: 70,
    haze: "radial-gradient(140% 100% at 50% 0%, rgba(120, 90, 220, 0.24), transparent 74%)",
    tint: ["rgba(0, 220, 255, 0.24)", "rgba(255, 90, 200, 0.20)", "rgba(180, 255, 120, 0.16)"],
  },
  {
    id: "summit",
    name: "Summit",
    level: 10,
    motion: "rise",
    blur: 78,
    haze: "radial-gradient(140% 110% at 50% 0%, rgba(255, 190, 80, 0.24), transparent 76%)",
    tint: ["rgba(255, 215, 90, 0.26)", "rgba(255, 130, 90, 0.20)", "rgba(150, 200, 255, 0.16)"],
  },
];

export const DEFAULT_SCENERY = SCENERIES[0];

export function sceneryById(id) {
  return SCENERIES.find((s) => s.id === id) ?? null;
}

/**
 * The scenery for a level. Clamped at both ends, so an out-of-range level
 * still gets a real background rather than nothing.
 */
export function sceneryForLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return DEFAULT_SCENERY;

  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.round(n)));
  return SCENERIES.find((s) => s.level === clamped) ?? SCENERIES[Math.min(clamped, SCENERIES.length) - 1] ?? DEFAULT_SCENERY;
}

/** Does levelling up from `from` to `to` actually change the background? */
export function sceneryChanges(from, to) {
  return sceneryForLevel(from).id !== sceneryForLevel(to).id;
}
