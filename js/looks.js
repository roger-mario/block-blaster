/**
 * looks.js — what the game looks like, and what earns you the next one.
 *
 * Replaces the old themes.js + sceneries.js split. Those were two axes on
 * two different clocks: blocks rotated on the calendar every three days,
 * scenery advanced with your level. The calendar half was the wrong idea —
 * it changes while you *aren't* playing, so you never see it happen, and
 * it has nothing to do with how you're doing.
 *
 * One axis now, and it's earned. A look advances on exactly two events:
 *
 *   levelling up
 *   clearing the whole board
 *
 * and every advance changes the background, the palette and the surface
 * the blocks are made of. A small shift would read as a rendering glitch;
 * the point is that you look up and the game is somewhere else.
 *
 * Blocks are always **rounded squares**. Varying the silhouette too —
 * hexagons, diamonds, capsules — was tried and pulled: it fought the
 * clear animations, which draw rounded squares whatever the look, and the
 * scenery and palette already carry the change on their own.
 *
 * Pure data and pure lookup. No DOM — `scenery.js` paints it.
 *
 * ## Adding a look
 *
 * Append to LOOKS. Every one needs the same `vars` keys, seven `blocks`
 * colours, a `surface` from the list below, and a scenery block. Tests
 * enforce all of it, so a half-finished look fails the suite rather than
 * shipping a half-styled page.
 */

import { COLORS } from "./config.js";

/** What a block is made of. See the `[data-surface]` rules. */
export const SURFACES = ["gloss", "candy", "gem", "bubble", "matte", "neon"];

const look = (id, name, blurb, surface, vars, blocks, scenery) => ({
  id, name, blurb, surface, vars, blocks, scenery,
});

export const LOOKS = [
  look("midnight", "Midnight", "Glassy blocks under a deep blue sky", "gloss",
    { "--bg": "#0f1122", "--surface": "rgba(255,255,255,0.05)", "--surface-strong": "rgba(255,255,255,0.09)",
      "--empty-cell": "rgba(255,255,255,0.05)", "--board-bg": "rgba(255,255,255,0.06)",
      "--text": "#ffffff", "--text-dim": "rgba(255,255,255,0.45)", "--gold": "#ffd23f", "--block-gloss": "rgba(255,255,255,0.26)" },
    ["#f28c40", "#4da6f2", "#73cc66", "#f26673", "#b380f2", "#fac54d", "#59cccc"],
    { motion: "drift", blur: 62, haze: "radial-gradient(120% 90% at 50% 0%, rgba(60,90,160,0.22), transparent 70%)",
      tint: ["rgba(77,166,242,0.20)", "rgba(120,130,220,0.16)", "rgba(89,204,204,0.12)"] }),

  look("bubblegum", "Bubblegum", "Glossy bubbles, candy pink", "bubble",
    { "--bg": "#1d0f22", "--surface": "rgba(255,220,240,0.06)", "--surface-strong": "rgba(255,220,240,0.12)",
      "--empty-cell": "rgba(255,210,240,0.06)", "--board-bg": "rgba(255,200,235,0.07)",
      "--text": "#fff2fa", "--text-dim": "rgba(255,230,245,0.48)", "--gold": "#ff9ad5", "--block-gloss": "rgba(255,255,255,0.45)" },
    ["#ff6bb5", "#ff9de0", "#7ad0ff", "#ffe28a", "#b98cff", "#6bffc4", "#ff8f6b"],
    { motion: "sway", blur: 70, haze: "radial-gradient(130% 100% at 40% 20%, rgba(220,90,180,0.24), transparent 74%)",
      tint: ["rgba(255,130,210,0.24)", "rgba(180,120,255,0.18)", "rgba(255,190,140,0.14)"] }),

  look("grove", "Grove", "Cut gemstones in a green wood", "gem",
    { "--bg": "#08170f", "--surface": "rgba(200,255,220,0.05)", "--surface-strong": "rgba(200,255,220,0.11)",
      "--empty-cell": "rgba(190,255,215,0.06)", "--board-bg": "rgba(180,255,210,0.06)",
      "--text": "#eefff4", "--text-dim": "rgba(220,255,235,0.45)", "--gold": "#9ee86b", "--block-gloss": "rgba(255,255,255,0.24)" },
    ["#7fd45f", "#3fa9a0", "#d4c95f", "#5f9fd4", "#d4785f", "#a95fd4", "#5fd4a0"],
    { motion: "rise", blur: 66, haze: "radial-gradient(130% 100% at 60% 100%, rgba(50,150,90,0.24), transparent 70%)",
      tint: ["rgba(90,210,130,0.22)", "rgba(60,170,150,0.16)", "rgba(180,220,90,0.14)"] }),

  look("arcade", "Arcade", "Electric blocks on black", "neon",
    { "--bg": "#06060d", "--surface": "rgba(255,255,255,0.07)", "--surface-strong": "rgba(255,255,255,0.13)",
      "--empty-cell": "rgba(150,210,255,0.10)", "--board-bg": "rgba(120,190,255,0.05)",
      "--text": "#ffffff", "--text-dim": "rgba(255,255,255,0.42)", "--gold": "#00f0ff", "--block-gloss": "rgba(255,255,255,0.55)" },
    ["#00f0ff", "#ff2f9c", "#b14dff", "#3dff7a", "#ffe600", "#ff6b2f", "#00b3ff"],
    { motion: "swirl", blur: 60, haze: "radial-gradient(120% 100% at 50% 50%, rgba(80,70,190,0.24), transparent 72%)",
      tint: ["rgba(0,240,255,0.20)", "rgba(255,0,170,0.18)", "rgba(140,0,255,0.16)"] }),

  look("dusk", "Dusk", "Soft and sugary at sundown", "candy",
    { "--bg": "#1b0f16", "--surface": "rgba(255,220,200,0.06)", "--surface-strong": "rgba(255,220,200,0.12)",
      "--empty-cell": "rgba(255,210,190,0.06)", "--board-bg": "rgba(255,200,170,0.07)",
      "--text": "#fff4ec", "--text-dim": "rgba(255,235,220,0.48)", "--gold": "#ffb057", "--block-gloss": "rgba(255,255,255,0.36)" },
    ["#ff8f5e", "#ff6b9d", "#ffc861", "#c86bff", "#ff5f6d", "#7ad0ff", "#ffe28a"],
    { motion: "drift", blur: 72, haze: "radial-gradient(120% 90% at 50% 100%, rgba(190,70,90,0.22), transparent 72%)",
      tint: ["rgba(255,140,90,0.24)", "rgba(230,90,140,0.18)", "rgba(140,70,190,0.16)"] }),

  look("frost", "Frost", "Pale and chalky, cold light", "matte",
    { "--bg": "#0a1420", "--surface": "rgba(220,240,255,0.06)", "--surface-strong": "rgba(220,240,255,0.12)",
      "--empty-cell": "rgba(200,230,255,0.07)", "--board-bg": "rgba(190,225,255,0.05)",
      "--text": "#f2fbff", "--text-dim": "rgba(220,240,255,0.46)", "--gold": "#8fe8ff", "--block-gloss": "rgba(255,255,255,0.2)" },
    ["#8fd6ff", "#b8e6f5", "#7fb2d9", "#c9d8ff", "#9ee0d4", "#dfe9f5", "#6f9fd0"],
    { motion: "sway", blur: 74, haze: "radial-gradient(130% 100% at 50% 0%, rgba(90,150,210,0.22), transparent 74%)",
      tint: ["rgba(140,200,255,0.22)", "rgba(190,225,255,0.16)", "rgba(110,160,220,0.14)"] }),

  look("magma", "Magma", "Molten stones, hot underneath", "gem",
    { "--bg": "#1a0806", "--surface": "rgba(255,200,160,0.06)", "--surface-strong": "rgba(255,200,160,0.12)",
      "--empty-cell": "rgba(255,180,140,0.07)", "--board-bg": "rgba(255,160,110,0.06)",
      "--text": "#fff0e6", "--text-dim": "rgba(255,220,200,0.46)", "--gold": "#ff8c42", "--block-gloss": "rgba(255,255,255,0.3)" },
    ["#ff5f2e", "#ffa33d", "#ffd166", "#d7263d", "#f45b69", "#ff7b54", "#c1440e"],
    { motion: "rise", blur: 68, haze: "radial-gradient(130% 100% at 50% 100%, rgba(210,80,30,0.26), transparent 70%)",
      tint: ["rgba(255,140,50,0.24)", "rgba(220,60,50,0.20)", "rgba(255,200,90,0.14)"] }),

  look("orbit", "Orbit", "Smooth glass adrift in deep space", "gloss",
    { "--bg": "#080a1c", "--surface": "rgba(210,220,255,0.06)", "--surface-strong": "rgba(210,220,255,0.12)",
      "--empty-cell": "rgba(190,205,255,0.07)", "--board-bg": "rgba(170,190,255,0.05)",
      "--text": "#f0f3ff", "--text-dim": "rgba(210,220,255,0.45)", "--gold": "#a89bff", "--block-gloss": "rgba(255,255,255,0.32)" },
    ["#8c7bff", "#5fc9ff", "#c47bff", "#7bffd4", "#ffd66b", "#ff7bab", "#6b8bff"],
    { motion: "swirl", blur: 70, haze: "radial-gradient(120% 100% at 50% 40%, rgba(80,70,200,0.24), transparent 72%)",
      tint: ["rgba(140,120,255,0.24)", "rgba(90,190,255,0.18)", "rgba(220,130,255,0.15)"] }),

  look("citrus", "Citrus", "Fruit-bright, sharp and sweet", "candy",
    { "--bg": "#141a06", "--surface": "rgba(240,255,190,0.06)", "--surface-strong": "rgba(240,255,190,0.12)",
      "--empty-cell": "rgba(230,255,170,0.07)", "--board-bg": "rgba(220,255,150,0.06)",
      "--text": "#fbffe8", "--text-dim": "rgba(240,255,210,0.48)", "--gold": "#d8ff4f", "--block-gloss": "rgba(255,255,255,0.42)" },
    ["#ffd60a", "#9ae62b", "#ff9f1c", "#4ecdc4", "#ff6b35", "#c1f24a", "#ffe66d"],
    { motion: "sway", blur: 66, haze: "radial-gradient(130% 100% at 40% 10%, rgba(180,210,40,0.22), transparent 72%)",
      tint: ["rgba(200,240,60,0.22)", "rgba(255,190,40,0.18)", "rgba(90,220,180,0.14)"] }),

  look("obsidian", "Obsidian", "Black glass, barely lit", "gloss",
    { "--bg": "#050507", "--surface": "rgba(255,255,255,0.05)", "--surface-strong": "rgba(255,255,255,0.11)",
      "--empty-cell": "rgba(220,220,235,0.08)", "--board-bg": "rgba(200,200,230,0.04)",
      "--text": "#f5f5fa", "--text-dim": "rgba(230,230,245,0.42)", "--gold": "#c0c8ff", "--block-gloss": "rgba(255,255,255,0.4)" },
    ["#6c7ae0", "#9d8df1", "#4f5d99", "#c2c9ff", "#7a86b8", "#5b4e8c", "#8fa0d9"],
    { motion: "drift", blur: 64, haze: "radial-gradient(120% 100% at 50% 20%, rgba(70,70,120,0.22), transparent 74%)",
      tint: ["rgba(110,120,220,0.20)", "rgba(160,140,240,0.16)", "rgba(80,90,160,0.14)"] }),

  look("coral", "Coral", "Warm reef, soft-edged tiles", "candy",
    { "--bg": "#12161f", "--surface": "rgba(255,225,220,0.06)", "--surface-strong": "rgba(255,225,220,0.12)",
      "--empty-cell": "rgba(255,215,210,0.07)", "--board-bg": "rgba(255,200,195,0.06)",
      "--text": "#fff3f1", "--text-dim": "rgba(255,230,225,0.47)", "--gold": "#ff8fa3", "--block-gloss": "rgba(255,255,255,0.34)" },
    ["#ff8fa3", "#ffb3c1", "#4ecdc4", "#ffd6a5", "#a0c4ff", "#bdb2ff", "#ffc6ff"],
    { motion: "rise", blur: 72, haze: "radial-gradient(130% 100% at 50% 90%, rgba(220,110,130,0.22), transparent 72%)",
      tint: ["rgba(255,150,170,0.22)", "rgba(90,210,200,0.18)", "rgba(160,190,255,0.15)"] }),

  look("voltage", "Voltage", "Charged and humming", "neon",
    { "--bg": "#0a0612", "--surface": "rgba(230,210,255,0.07)", "--surface-strong": "rgba(230,210,255,0.13)",
      "--empty-cell": "rgba(210,180,255,0.09)", "--board-bg": "rgba(190,150,255,0.05)",
      "--text": "#f8f2ff", "--text-dim": "rgba(230,215,255,0.44)", "--gold": "#e0ff2f", "--block-gloss": "rgba(255,255,255,0.6)" },
    ["#e0ff2f", "#ff29a8", "#7b2fff", "#29ffd0", "#ff6f2f", "#2f9bff", "#c8ff29"],
    { motion: "swirl", blur: 58, haze: "radial-gradient(120% 100% at 50% 60%, rgba(120,40,200,0.26), transparent 72%)",
      tint: ["rgba(224,255,47,0.18)", "rgba(255,41,168,0.20)", "rgba(123,47,255,0.18)"] }),

  look("mono", "Mono", "One colour, many shades", "matte",
    { "--bg": "#101014", "--surface": "rgba(255,255,255,0.06)", "--surface-strong": "rgba(255,255,255,0.12)",
      "--empty-cell": "rgba(255,255,255,0.07)", "--board-bg": "rgba(255,255,255,0.05)",
      "--text": "#ffffff", "--text-dim": "rgba(255,255,255,0.45)", "--gold": "#e8e8ee", "--block-gloss": "rgba(255,255,255,0.22)" },
    ["#f2f2f7", "#c7c7d1", "#9a9aa8", "#70707f", "#dedee6", "#adadb9", "#85858f"],
    { motion: "drift", blur: 70, haze: "radial-gradient(120% 100% at 50% 30%, rgba(150,150,170,0.16), transparent 74%)",
      tint: ["rgba(200,200,220,0.16)", "rgba(150,150,175,0.14)", "rgba(240,240,250,0.10)"] }),

  look("meadow", "Meadow", "Fresh green, long grass", "candy",
    { "--bg": "#0d1a0b", "--surface": "rgba(220,255,200,0.06)", "--surface-strong": "rgba(220,255,200,0.12)",
      "--empty-cell": "rgba(210,255,190,0.07)", "--board-bg": "rgba(200,255,180,0.06)",
      "--text": "#f3fff0", "--text-dim": "rgba(225,255,215,0.47)", "--gold": "#b6ff6b", "--block-gloss": "rgba(255,255,255,0.34)" },
    ["#a8e063", "#56ab2f", "#f7ff8a", "#4fc3a1", "#e8f88a", "#7bc950", "#c3f584"],
    { motion: "sway", blur: 68, haze: "radial-gradient(130% 100% at 40% 95%, rgba(80,170,60,0.24), transparent 72%)",
      tint: ["rgba(140,225,100,0.22)", "rgba(80,190,150,0.16)", "rgba(230,255,140,0.14)"] }),

  look("velvet", "Velvet", "Deep red gems on dark cloth", "gem",
    { "--bg": "#150408", "--surface": "rgba(255,200,210,0.06)", "--surface-strong": "rgba(255,200,210,0.12)",
      "--empty-cell": "rgba(255,180,195,0.07)", "--board-bg": "rgba(255,150,175,0.05)",
      "--text": "#fff0f3", "--text-dim": "rgba(255,215,225,0.45)", "--gold": "#ff6b8a", "--block-gloss": "rgba(255,255,255,0.28)" },
    ["#c9184a", "#ff4d6d", "#a4133c", "#ff8fa3", "#800f2f", "#ffb3c1", "#e01e5a"],
    { motion: "rise", blur: 70, haze: "radial-gradient(130% 100% at 50% 100%, rgba(170,20,60,0.26), transparent 70%)",
      tint: ["rgba(255,70,110,0.22)", "rgba(140,20,60,0.20)", "rgba(255,150,180,0.14)"] }),

  look("lagoon", "Lagoon", "Smooth bubbles in warm water", "bubble",
    { "--bg": "#04161c", "--surface": "rgba(200,250,255,0.06)", "--surface-strong": "rgba(200,250,255,0.12)",
      "--empty-cell": "rgba(180,245,255,0.07)", "--board-bg": "rgba(160,240,255,0.05)",
      "--text": "#eafcff", "--text-dim": "rgba(210,250,255,0.46)", "--gold": "#5fe8d0", "--block-gloss": "rgba(255,255,255,0.44)" },
    ["#2ec4b6", "#5fe8d0", "#3da5d9", "#7fffd4", "#48cae4", "#90e0ef", "#26a69a"],
    { motion: "sway", blur: 74, haze: "radial-gradient(130% 100% at 50% 10%, rgba(40,170,180,0.24), transparent 74%)",
      tint: ["rgba(60,220,210,0.22)", "rgba(70,170,220,0.18)", "rgba(140,240,255,0.14)"] }),

  look("amber", "Amber", "Honey-coloured stones", "gem",
    { "--bg": "#1a1206", "--surface": "rgba(255,235,190,0.06)", "--surface-strong": "rgba(255,235,190,0.12)",
      "--empty-cell": "rgba(255,225,170,0.07)", "--board-bg": "rgba(255,215,150,0.06)",
      "--text": "#fff8ea", "--text-dim": "rgba(255,240,215,0.47)", "--gold": "#ffc94b", "--block-gloss": "rgba(255,255,255,0.3)" },
    ["#ffb703", "#fb8500", "#ffd166", "#e07a5f", "#f4a261", "#e9c46a", "#d68c45"],
    { motion: "drift", blur: 66, haze: "radial-gradient(130% 100% at 50% 80%, rgba(200,140,30,0.24), transparent 72%)",
      tint: ["rgba(255,190,60,0.22)", "rgba(230,130,40,0.18)", "rgba(255,230,140,0.14)"] }),

  look("iris", "Iris", "Violet glass, quiet and even", "gloss",
    { "--bg": "#0e0818", "--surface": "rgba(225,210,255,0.06)", "--surface-strong": "rgba(225,210,255,0.12)",
      "--empty-cell": "rgba(210,190,255,0.08)", "--board-bg": "rgba(195,170,255,0.05)",
      "--text": "#f6f0ff", "--text-dim": "rgba(228,215,255,0.45)", "--gold": "#c299ff", "--block-gloss": "rgba(255,255,255,0.3)" },
    ["#9d4edd", "#c77dff", "#7b2cbf", "#e0aaff", "#5a189a", "#b185db", "#8338ec"],
    { motion: "swirl", blur: 72, haze: "radial-gradient(120% 100% at 50% 30%, rgba(110,50,190,0.24), transparent 74%)",
      tint: ["rgba(160,80,230,0.22)", "rgba(200,130,255,0.18)", "rgba(110,60,200,0.15)"] }),

  look("signal", "Signal", "Flat colour, high contrast", "matte",
    { "--bg": "#0d0d0d", "--surface": "rgba(255,255,255,0.06)", "--surface-strong": "rgba(255,255,255,0.12)",
      "--empty-cell": "rgba(255,255,255,0.08)", "--board-bg": "rgba(255,255,255,0.04)",
      "--text": "#ffffff", "--text-dim": "rgba(255,255,255,0.44)", "--gold": "#ff3b30", "--block-gloss": "rgba(255,255,255,0.24)" },
    ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#5ac8fa", "#af52de", "#ff2d55"],
    { motion: "rise", blur: 62, haze: "radial-gradient(120% 100% at 50% 50%, rgba(90,90,90,0.18), transparent 74%)",
      tint: ["rgba(255,60,50,0.16)", "rgba(255,200,0,0.14)", "rgba(60,200,90,0.14)"] }),

  look("summit", "Summit", "Gold at the top of the ladder", "neon",
    { "--bg": "#140f04", "--surface": "rgba(255,240,200,0.07)", "--surface-strong": "rgba(255,240,200,0.14)",
      "--empty-cell": "rgba(255,235,180,0.09)", "--board-bg": "rgba(255,225,150,0.06)",
      "--text": "#fffaf0", "--text-dim": "rgba(255,245,220,0.5)", "--gold": "#ffd700", "--block-gloss": "rgba(255,255,255,0.55)" },
    ["#ffd700", "#ffed4e", "#ff9500", "#fff3b0", "#e8a317", "#ffdd57", "#f6c700"],
    { motion: "swirl", blur: 76, haze: "radial-gradient(140% 110% at 50% 0%, rgba(255,190,60,0.28), transparent 76%)",
      tint: ["rgba(255,215,90,0.26)", "rgba(255,140,60,0.20)", "rgba(255,245,180,0.16)"] }),
];

export const DEFAULT_LOOK = LOOKS[0];

export function lookById(id) {
  return LOOKS.find((l) => l.id === id) ?? null;
}

// ---------- what earns the next one ----------

/**
 * How far through the cycle you are.
 *
 * Both a level up and a board clear move it on by one, which is the whole
 * rule: `(level - 1) + boardClears`. Deriving it rather than storing a
 * counter means it can't drift out of step with the game, and undo gets
 * the right look back for free.
 */
export function lookIndex(level = 1, boardClears = 0) {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const clears = Number.isFinite(boardClears) ? Math.max(0, Math.floor(boardClears)) : 0;
  return lvl - 1 + clears;
}

/** The look at a point in the cycle. Wraps, so it never runs out. */
export function lookAt(index) {
  const n = Number.isFinite(index) ? Math.floor(index) : 0;
  return LOOKS[((n % LOOKS.length) + LOOKS.length) % LOOKS.length];
}

/** The look for a game state. */
export function lookFor(level = 1, boardClears = 0) {
  return lookAt(lookIndex(level, boardClears));
}

/** Did this change actually move the look on? */
export function lookChanges(fromLevel, fromClears, toLevel, toClears) {
  return lookFor(fromLevel, fromClears).id !== lookFor(toLevel, toClears).id;
}

/** The block palette to deal pieces from. */
export function paletteFor(level = 1, boardClears = 0) {
  const blocks = lookFor(level, boardClears).blocks;
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : COLORS;
}

/**
 * The same slot in a different palette.
 *
 * Palettes are parallel lists, so a block that was the third colour of one
 * look becomes the third colour of the next. Anything not from the old
 * palette is left alone rather than guessed at.
 */
export function remapColour(colour, from, to) {
  if (!Array.isArray(from) || !Array.isArray(to) || to.length === 0) return colour;
  const index = from.indexOf(colour);
  return index === -1 ? colour : to[index % to.length];
}
