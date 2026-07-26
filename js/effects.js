/**
 * effects.js — everything that sparkles, pops or shakes.
 *
 * Nothing here affects the game rules, so you can freely add, remove or
 * retune effects without any risk of breaking gameplay.
 */

import { BOARD_SIZE, TIMING, FX, LINE_NAMES } from "./config.js";
import { el, cellEls, cellSize, cellPosition, replayAnimation } from "./dom.js";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds a node to the fx layer and removes it again after `life` ms. */
function spawn(node, life) {
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), life);
}

export function buzz(pattern) {
  if (REDUCED || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported — ignore */
  }
}

// ---------- placing a piece ----------

/**
 * The little reward for every single placement: blocks pop in as a wave
 * spreading from where you dropped them, a ring pulses outward, and a
 * small +N drifts up.
 */
export function playPlaceFx(cells, color, points) {
  if (cells.length === 0) return;

  // centre of the piece, in grid coordinates
  const cr = cells.reduce((sum, [r]) => sum + r, 0) / cells.length;
  const cc = cells.reduce((sum, [, c]) => sum + c, 0) / cells.length;

  // blocks pop outward from the centre of the piece
  for (const [r, c] of cells) {
    const dist = Math.hypot(r - cr, c - cc);
    const cell = cellEls[r][c];
    cell.style.setProperty("--pop-delay", `${Math.round(dist * TIMING.placeStagger)}ms`);
    replayAnimation(cell, "pop");
  }

  if (!REDUCED) {
    const size = cellSize();
    const ring = document.createElement("div");
    ring.className = "ripple";
    const diameter = size * 1.6;
    ring.style.width = `${diameter}px`;
    ring.style.height = `${diameter}px`;
    ring.style.left = `${(cc + 0.5) * size - diameter / 2}px`;
    ring.style.top = `${(cr + 0.5) * size - diameter / 2}px`;
    ring.style.borderColor = color;
    spawn(ring, 620);
  }

  if (points > 0) {
    floatText(`+${points}`, cc, cr, { small: true });
  }

  buzz(8);
}

// ---------- clearing lines ----------

/**
 * The full line-clear sequence: sweep bars, staggered shatter, shards,
 * floating score and a screen shake sized to how many lines went.
 */
export function playClearFx({ rows, cols, snapshot, lines, points }) {
  const size = cellSize();
  const delays = new Map(); // "r,c" -> ms, so the clear ripples along the line

  const register = (r, c, delay) => {
    const key = `${r},${c}`;
    delays.set(key, Math.min(delays.get(key) ?? Infinity, delay));
  };

  for (const r of rows) {
    for (let c = 0; c < BOARD_SIZE; c++) register(r, c, c * TIMING.clearStagger);
  }
  for (const c of cols) {
    for (let r = 0; r < BOARD_SIZE; r++) register(r, c, r * TIMING.clearStagger);
  }

  // bright bar ripping along each completed line
  for (const r of rows) spawnSweep("row", r, size);
  for (const c of cols) spawnSweep("col", c, size);

  let sumR = 0;
  let sumC = 0;
  let count = 0;

  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    sumR += r;
    sumC += c;
    count++;

    spawnGhost(r, c, color, delay);
    if (!REDUCED) spawnShards(r, c, color, delay);
  }

  if (count > 0) {
    floatText(`+${points}`, sumC / count, sumR / count);
  }

  if (lines >= 3) {
    replayAnimation(el.app, "shake-2");
    buzz([18, 40, 28]);
  } else if (lines >= 2) {
    replayAnimation(el.app, "shake-1");
    buzz([14, 35, 18]);
  } else {
    buzz(12);
  }
  setTimeout(() => el.app.classList.remove("shake-1", "shake-2"), TIMING.shakeDuration);
}

function spawnSweep(kind, index, size) {
  const bar = document.createElement("div");
  bar.className = `sweep ${kind}`;
  if (kind === "row") {
    const { y, size: thickness } = cellPosition(index, 0);
    bar.style.left = "0px";
    bar.style.top = `${y}px`;
    bar.style.width = "100%";
    bar.style.height = `${thickness}px`;
  } else {
    const { x, size: thickness } = cellPosition(0, index);
    bar.style.top = "0px";
    bar.style.left = `${x}px`;
    bar.style.height = "100%";
    bar.style.width = `${thickness}px`;
  }
  spawn(bar, 450);
}

function spawnGhost(r, c, color, delay) {
  const { x, y, size } = cellPosition(r, c);
  const ghost = document.createElement("div");
  ghost.className = "ghost";
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  ghost.style.background = color;
  ghost.style.setProperty("--spin", `${Math.random() * 90 - 45}deg`);
  ghost.style.animationDelay = `${delay}ms`;
  spawn(ghost, delay + TIMING.ghostLife);
}

function spawnShards(r, c, color, delay) {
  const { x, y, size } = cellPosition(r, c);
  for (let i = 0; i < FX.shardsPerCell; i++) {
    const shard = document.createElement("div");
    shard.className = "shard";
    const shardSize = size * (0.18 + Math.random() * 0.2);
    const angle = (Math.PI * 2 * i) / FX.shardsPerCell + Math.random() * 1.1;
    const distance = size * (1.1 + Math.random() * 1.9);

    shard.style.width = `${shardSize}px`;
    shard.style.height = `${shardSize}px`;
    shard.style.left = `${x + size / 2 - shardSize / 2}px`;
    shard.style.top = `${y + size / 2 - shardSize / 2}px`;
    shard.style.background = color;
    shard.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    shard.style.setProperty("--dy", `${Math.sin(angle) * distance + size * 1.5}px`);
    shard.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    shard.style.setProperty("--life", `${0.55 + Math.random() * 0.45}s`);
    shard.style.animationDelay = `${delay}ms`;
    spawn(shard, delay + TIMING.shardLife);
  }
}

/** Floating "+N" text at a grid position. */
export function floatText(text, gridCol, gridRow, { small = false } = {}) {
  const size = cellSize();
  const node = document.createElement("div");
  node.className = "float-score" + (small ? " small" : "");
  node.textContent = text;
  node.style.left = `${(gridCol + 0.5) * size}px`;
  node.style.top = `${(gridRow + 0.5) * size}px`;
  spawn(node, small ? 750 : 1000);
}

// ---------- header feedback ----------

export function bumpScore() {
  replayAnimation(el.score, "bump");
}

export function bumpBest() {
  replayAnimation(el.best, "bump");
}

export function showCombo(text) {
  el.combo.textContent = text;
  replayAnimation(el.combo, "show");
}

/** Chooses the right celebratory word for a clear. */
export function comboLabel({ lines, combo }) {
  if (combo > 1) return `COMBO x${combo}`;
  if (lines >= 5) return LINE_NAMES[5];
  return LINE_NAMES[lines] ?? null;
}

export function clearAllFx() {
  el.fx.innerHTML = "";
  el.app.classList.remove("shake-1", "shake-2");
}
