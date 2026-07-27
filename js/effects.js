/**
 * effects.js — everything that sparkles, pops or shakes.
 *
 * Nothing here affects the game rules, so you can freely add, remove or
 * retune effects without any risk of breaking gameplay.
 */

import { BOARD_SIZE, TIMING, FX, LINE_NAMES } from "./config.js";
import { el, cellEls, cellSize, cellPosition, replayAnimation } from "./dom.js";
import { chooseCelebration, chooseBoardCelebration, shakeLevel } from "./celebrations.js";

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
/**
 * The line-clear sequence.
 *
 * The *choice* of animation isn't made here — celebrations.js decides,
 * from how many lines went and how many clears have already been
 * celebrated. This function draws whichever one it was handed and keeps
 * the parts every celebration shares: the sweep down the line, the score
 * text, the shake.
 *
 * To add a fourth animation: one entry in celebrations.js, one `case`
 * below. Nothing else in the game changes.
 */
let celebrationCounter = 0;

export function playClearFx({ rows, cols, snapshot, lines, points }) {
  const size = cellSize();
  const { celebration, nextCounter } = chooseCelebration(lines, celebrationCounter);
  celebrationCounter = nextCounter;

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

  // bright bar ripping along each completed line — every celebration keeps it
  for (const r of rows) spawnSweep("row", r, size);
  for (const c of cols) spawnSweep("col", c, size);

  // where the clear happened, for the ring and the score text
  let sumR = 0;
  let sumC = 0;
  let count = 0;
  for (const key of delays.keys()) {
    const [r, c] = key.split(",").map(Number);
    if (!snapshot[r][c]) continue;
    sumR += r;
    sumC += c;
    count++;
  }
  const centre = count > 0 ? { row: sumR / count, col: sumC / count } : { row: 3.5, col: 3.5 };

  // `rows`/`cols` matter to any celebration that runs along the line
  playCelebration(celebration.id, { delays, snapshot, centre, size, rows, cols });

  if (count > 0) floatText(`+${points}`, centre.col, centre.row);

  const shake = shakeLevel(lines);
  if (shake === 2) {
    replayAnimation(el.app, "shake-2");
    buzz([18, 40, 28]);
  } else if (shake === 1) {
    replayAnimation(el.app, "shake-1");
    buzz([14, 35, 18]);
  } else {
    buzz(12);
  }
  setTimeout(() => el.app.classList.remove("shake-1", "shake-2"), TIMING.shakeDuration);

  return celebration;
}

/**
 * Draws one named celebration. The registry lives in celebrations.js.
 *
 * Wrapped, because a clear that draws *nothing* is far worse than one that
 * draws the plain animation — a silent failure here looks like the game
 * skipped a beat.
 */
function playCelebration(id, ctx) {
  try {
    return drawCelebration(id, ctx);
  } catch (error) {
    console.error(`celebration "${id}" failed, falling back to shatter:`, error);
    return celebrateShatter(ctx);
  }
}

function drawCelebration(id, ctx) {
  switch (id) {
    case "shockwave":
      return celebrateShockwave(ctx);
    case "ember":
      return celebrateEmber(ctx);
    case "cascade":
      return celebrateCascade(ctx);
    case "prism":
      return celebratePrism(ctx);
    case "nova":
      return celebrateNova(ctx);
    case "shatter":
    default:
      return celebrateShatter(ctx);
  }
}

/** The original: flash white, swell, break into shards. */
function celebrateShatter({ delays, snapshot }) {
  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    spawnGhost(r, c, color, delay);
    if (!REDUCED) spawnShards(r, c, color, delay);
  }
}

/**
 * A ring blasts out of the middle of the clear and the blocks go with it,
 * each thrown along its own line from the centre. The further out a block
 * is, the later it moves, so the wave visibly travels.
 */
function celebrateShockwave({ delays, snapshot, centre, size }) {
  if (!REDUCED) spawnShockRing(centre, size);

  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    const dr = r - centre.row;
    const dc = c - centre.col;
    const distance = Math.hypot(dr, dc);
    // the wave reaches the outer blocks last
    const waveDelay = delay * 0.35 + distance * 26;

    if (REDUCED) {
      spawnGhost(r, c, color, waveDelay);
      continue;
    }

    const angle = Math.atan2(dr, dc);
    const throwBy = size * (1.4 + distance * 0.5);
    spawnBlast(r, c, color, waveDelay, {
      dx: Math.cos(angle) * throwBy,
      dy: Math.sin(angle) * throwBy,
    });
  }
}

/**
 * Blocks lift off the board, turn, and burn away upward. Slower and
 * quieter than the other two — it reads as heat rather than impact.
 */
function celebrateEmber({ delays, snapshot, size }) {
  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    if (REDUCED) {
      spawnGhost(r, c, color, delay);
      continue;
    }
    spawnEmber(r, c, color, delay, size);
  }
}

/**
 * The line gives way underneath itself: every block drops, bouncing and
 * tumbling as it falls off the bottom of the board.
 */
function celebrateCascade({ delays, snapshot, size }) {
  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    if (REDUCED) {
      spawnGhost(r, c, color, delay);
      continue;
    }

    const node = blockNode(r, c, color, "fall", delay);
    node.style.setProperty("--fall", `${size * (5 + Math.random() * 3)}px`);
    node.style.setProperty("--sway", `${(Math.random() - 0.5) * size * 1.4}px`);
    node.style.setProperty("--spin", `${Math.random() * 300 - 150}deg`);
    spawn(node, delay + TIMING.cascadeLife);
  }
}

/**
 * Triples and better. Each block stretches into a beam of its own colour
 * that streaks along the line before it goes.
 */
function celebratePrism({ delays, snapshot, rows, size }) {
  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    if (REDUCED) {
      spawnGhost(r, c, color, delay);
      continue;
    }

    // beams run along whichever axis the line was
    const horizontal = rows.includes(r);
    const node = blockNode(r, c, color, horizontal ? "beam-h" : "beam-v", delay);
    node.style.setProperty("--reach", `${size * (2.5 + Math.random() * 2)}px`);
    spawn(node, delay + TIMING.prismLife);
  }
}

/**
 * The biggest one. Everything rushes to the middle of the clear, holds for
 * a beat, then detonates outward — the only animation with a pause in it,
 * which is what makes it read as the rarest.
 */
function celebrateNova({ delays, snapshot, centre, size }) {
  if (!REDUCED) spawnShockRing(centre, size, "nova-ring");

  for (const [key, delay] of delays) {
    const [r, c] = key.split(",").map(Number);
    const color = snapshot[r][c];
    if (!color) continue;

    if (REDUCED) {
      spawnGhost(r, c, color, delay);
      continue;
    }

    const dr = r - centre.row;
    const dc = c - centre.col;
    const angle = Math.atan2(dr, dc);
    const distance = Math.hypot(dr, dc);

    const node = blockNode(r, c, color, "nova", delay * 0.3);
    // in toward the centre first…
    node.style.setProperty("--inx", `${-dc * size * 0.75}px`);
    node.style.setProperty("--iny", `${-dr * size * 0.75}px`);
    // …then out much further than it came
    node.style.setProperty("--outx", `${Math.cos(angle) * size * (3 + distance)}px`);
    node.style.setProperty("--outy", `${Math.sin(angle) * size * (3 + distance)}px`);
    node.style.setProperty("--spin", `${Math.random() * 400 - 200}deg`);
    spawn(node, delay + TIMING.novaLife);
  }
}

/** A board-sized block element positioned over one cell. */
function blockNode(r, c, color, className, delay) {
  const { x, y, size } = cellPosition(r, c);
  const node = document.createElement("div");
  node.className = className;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.background = color;
  node.style.animationDelay = `${delay}ms`;
  return node;
}

// ---------- category 2: the whole board went ----------

let boardCounter = 0;

/**
 * Emptying the board. Rotates its own pool, and stays silent below the
 * unlock level — see ANIMATION-STRATEGY.md.
 */
export function playBoardClearFx(level) {
  const { celebration, nextCounter } = chooseBoardCelebration(level, boardCounter);
  boardCounter = nextCounter;
  if (!celebration) return null;

  const size = cellSize();
  const centre = { row: (BOARD_SIZE - 1) / 2, col: (BOARD_SIZE - 1) / 2 };

  if (!REDUCED) {
    switch (celebration.id) {
      case "starburst":
        boardStarburst(centre, size);
        break;
      case "implode":
        boardImplode(centre, size);
        break;
      case "bloom":
      default:
        boardBloom(centre, size);
        break;
    }
  }

  replayAnimation(el.board, "board-clear-flash");
  setTimeout(() => el.board.classList.remove("board-clear-flash"), TIMING.boardClearLife);
  buzz([24, 50, 24, 50, 40]);
  return celebration;
}

/** Rings of light opening out across the empty board. */
function boardBloom(centre, size) {
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement("div");
    ring.className = "bloom-ring";
    const diameter = size * (1.6 + i * 0.6);
    ring.style.width = `${diameter}px`;
    ring.style.height = `${diameter}px`;
    ring.style.left = `${(centre.col + 0.5) * size - diameter / 2}px`;
    ring.style.top = `${(centre.row + 0.5) * size - diameter / 2}px`;
    ring.style.animationDelay = `${i * 110}ms`;
    spawn(ring, TIMING.boardClearLife + i * 110);
  }
}

/** Rays firing out from the middle. */
function boardStarburst(centre, size) {
  const rays = 14;
  for (let i = 0; i < rays; i++) {
    const ray = document.createElement("div");
    ray.className = "starburst-ray";
    ray.style.left = `${(centre.col + 0.5) * size}px`;
    ray.style.top = `${(centre.row + 0.5) * size}px`;
    ray.style.setProperty("--angle", `${(360 / rays) * i}deg`);
    ray.style.setProperty("--reach", `${size * (3.5 + Math.random() * 2)}px`);
    ray.style.animationDelay = `${i * 22}ms`;
    spawn(ray, TIMING.boardClearLife);
  }
}

/** Motes rush inward, then the middle bursts. */
function boardImplode(centre, size) {
  const motes = 20;
  for (let i = 0; i < motes; i++) {
    const angle = (Math.PI * 2 * i) / motes;
    const distance = size * (3 + Math.random() * 2);

    const mote = document.createElement("div");
    mote.className = "implode-mote";
    const from = size * 0.34;
    mote.style.width = `${from}px`;
    mote.style.height = `${from}px`;
    mote.style.left = `${(centre.col + 0.5) * size - from / 2 + Math.cos(angle) * distance}px`;
    mote.style.top = `${(centre.row + 0.5) * size - from / 2 + Math.sin(angle) * distance}px`;
    mote.style.setProperty("--tox", `${-Math.cos(angle) * distance}px`);
    mote.style.setProperty("--toy", `${-Math.sin(angle) * distance}px`);
    mote.style.animationDelay = `${Math.random() * 90}ms`;
    spawn(mote, TIMING.boardClearLife);
  }
  spawnShockRing(centre, size, "nova-ring");
}

/** The expanding ring at the heart of a shockwave. */
function spawnShockRing(centre, size, className = "shockring") {
  const ring = document.createElement("div");
  ring.className = className;
  const diameter = size * 2.2;
  ring.style.width = `${diameter}px`;
  ring.style.height = `${diameter}px`;
  ring.style.left = `${(centre.col + 0.5) * size - diameter / 2}px`;
  ring.style.top = `${(centre.row + 0.5) * size - diameter / 2}px`;
  spawn(ring, TIMING.shockwaveLife);
}

/** One block thrown outward by the shockwave. */
function spawnBlast(r, c, color, delay, { dx, dy }) {
  const { x, y, size } = cellPosition(r, c);
  const node = document.createElement("div");
  node.className = "blast";
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.background = color;
  node.style.setProperty("--dx", `${dx}px`);
  node.style.setProperty("--dy", `${dy}px`);
  node.style.setProperty("--spin", `${Math.random() * 240 - 120}deg`);
  node.style.animationDelay = `${delay}ms`;
  spawn(node, delay + TIMING.shockwaveLife);
}

/** One block lifting and burning away. */
function spawnEmber(r, c, color, delay, cell) {
  const { x, y, size } = cellPosition(r, c);
  const node = document.createElement("div");
  node.className = "ember";
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.background = color;
  node.style.setProperty("--rise", `${-cell * (1.6 + Math.random() * 1.4)}px`);
  node.style.setProperty("--drift", `${(Math.random() - 0.5) * cell * 1.1}px`);
  node.style.setProperty("--spin", `${Math.random() * 180 - 90}deg`);
  node.style.animationDelay = `${delay}ms`;
  spawn(node, delay + TIMING.emberLife);
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

/**
 * The Wipe lifeline: the whole board shatters at once, in a wave running
 * out from the middle so it reads as one deliberate act rather than 64
 * separate clears. No score text — a wipe pays nothing.
 */
export function playWipeFx(cells, snapshot) {
  if (cells.length === 0) return;

  const middle = (BOARD_SIZE - 1) / 2;

  for (const [r, c] of cells) {
    const color = snapshot[r][c];
    if (!color) continue;

    const delay = Math.round(Math.hypot(r - middle, c - middle) * TIMING.wipeStagger);
    spawnGhost(r, c, color, delay);
    if (!REDUCED) spawnShards(r, c, color, delay);
  }

  replayAnimation(el.board, "wipe-flash");
  replayAnimation(el.app, "shake-1");
  setTimeout(() => el.app.classList.remove("shake-1"), TIMING.shakeDuration);
  buzz([20, 40, 20]);
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

export function showCombo(text, kind = "combo") {
  el.combo.textContent = text;
  el.combo.className = kind;
  replayAnimation(el.combo, "show");
}

/**
 * A single move can set off several announcements at once (double clear,
 * cross clear, perfect clear, level up). Showing them on top of each
 * other is unreadable, so they queue up and play one after another.
 */
const badgeQueue = [];
let badgeTimer = null;

export function queueBadge(text, kind = "combo") {
  badgeQueue.push({ text, kind });
  if (badgeTimer === null) drainBadges();
}

function drainBadges() {
  const next = badgeQueue.shift();
  if (!next) {
    badgeTimer = null;
    return;
  }
  showCombo(next.text, next.kind);
  badgeTimer = setTimeout(drainBadges, TIMING.badgeGap);
}

export function clearBadges() {
  badgeQueue.length = 0;
  clearTimeout(badgeTimer);
  badgeTimer = null;
}

/** Gold wash over the board when the difficulty ladder ticks up. */
export function playLevelUpFx(level) {
  queueBadge(`LEVEL ${level}!`, "levelup");
  if (!REDUCED) replayAnimation(el.board, "level-flash");
  buzz([12, 30, 12, 30, 24]);
}

/** Quiet, apologetic little pulse — nothing to celebrate about an undo. */
export function playUndoFx() {
  replayAnimation(el.board, "undo-flash");
  buzz(6);
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
  el.board.classList.remove("level-flash", "undo-flash", "wipe-flash", "board-clear-flash");
  clearBadges();
}
