/**
 * dealer.js — decides which three pieces you get next.
 *
 * The old version drew three shapes at random from whatever the level
 * allowed, which produces two bad moments over and over:
 *
 *   - a tray of pieces that don't fit anywhere, which isn't difficulty,
 *     it's just a coin flip you lost
 *   - a board one square from a clear and three pieces that can't touch it
 *
 * So the dealer looks at the board you actually have. Shapes that fit get
 * a heavy boost, shapes that can finish a line right now get another, and
 * the fuller your board the more likely it is that at least one piece is
 * a genuine way out. That "rescue pressure" is what keeps a tight board
 * tense instead of hopeless.
 *
 * None of this makes the game easier at the top end: the *other* two
 * slots still come from the level's own shape curve, which by level 10
 * is mostly 5-bars, big elbows and 3×3 blocks.
 *
 * Pure functions over a plain board array — no Game, no DOM, so the whole
 * thing is testable on its own.
 */

import { BOARD_SIZE, COLORS, DEALER, TRAY_SLOTS } from "./config.js";
import { levelConfig } from "./difficulty.js";
import { SHAPES, shapeWeightAt, shapePoolFor, pieceFromShape, weightedPick } from "./pieces.js";

// ---------- board probes ----------

export function fillRatio(board) {
  let filled = 0;
  for (const row of board) for (const cell of row) if (cell) filled++;
  return filled / (BOARD_SIZE * BOARD_SIZE);
}

function lineCounts(board) {
  const rows = Array(BOARD_SIZE).fill(0);
  const cols = Array(BOARD_SIZE).fill(0);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) {
        rows[r]++;
        cols[c]++;
      }
    }
  }
  return { rows, cols };
}

function canPlaceAt(board, cells, originR, originC) {
  for (const [dr, dc] of cells) {
    const r = originR + dr;
    const c = originC + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c]) return false;
  }
  return true;
}

/** Can this shape go anywhere at all? */
export function shapeFits(board, cells) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlaceAt(board, cells, r, c)) return true;
    }
  }
  return false;
}

/**
 * Is there a placement of this shape that completes a row or column
 * on the board as it stands right now?
 */
export function shapeClearsLine(board, cells, counts = lineCounts(board)) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!canPlaceAt(board, cells, r, c)) continue;

      const addedRows = new Map();
      const addedCols = new Map();
      for (const [dr, dc] of cells) {
        const rr = r + dr;
        const cc = c + dc;
        addedRows.set(rr, (addedRows.get(rr) ?? 0) + 1);
        addedCols.set(cc, (addedCols.get(cc) ?? 0) + 1);
      }

      for (const [rr, added] of addedRows) {
        if (counts.rows[rr] + added === BOARD_SIZE) return true;
      }
      for (const [cc, added] of addedCols) {
        if (counts.cols[cc] + added === BOARD_SIZE) return true;
      }
    }
  }
  return false;
}

// ---------- weighting ----------

/**
 * How much a filling board pushes the odds of a rescue piece back up.
 * An empty board leaves the level's own chance alone; a nearly full one
 * drives it toward certainty whatever the level says.
 */
export function rescueChance(level, pressure) {
  const base = levelConfig(level).clearChance;
  const push = Math.pow(Math.min(1, Math.max(0, pressure)), DEALER.rescuePower);
  return base + (1 - base) * push;
}

/**
 * The weight of every unlocked shape for this board, before any pieces
 * have been drawn. Exported because the menu draws the same numbers as
 * a "what turns up at this level" table.
 */
export function shapeWeights(level, board = null) {
  const pool = shapePoolFor(level);
  const counts = board ? lineCounts(board) : null;

  return pool.map((shape) => {
    let weight = shapeWeightAt(shape, level);
    let fits = true;
    let clears = false;

    if (board) {
      fits = shapeFits(board, shape.cells);
      if (fits) {
        weight *= DEALER.fitBoost;
        clears = shapeClearsLine(board, shape.cells, counts);
        if (clears) weight *= DEALER.clearBoost;
      }
    }
    return { shape, weight, fits, clears };
  });
}

// ---------- dealing ----------

function pickColor(rng) {
  return COLORS[Math.floor(rng() * COLORS.length) % COLORS.length];
}

/**
 * Deals a fresh tray for this board and level.
 *
 * @param {number} count
 * @param {{level:number, board:string[][], rng?:Function}} options
 */
export function dealTray(count = TRAY_SLOTS, { level = 1, board = null, rng = Math.random } = {}) {
  const cfg = levelConfig(level);
  const entries = shapeWeights(level, board);

  // ---- draw, discouraging duplicates so the tray has some variety ----
  const drawn = [];
  const used = new Map();

  for (let i = 0; i < count; i++) {
    const weights = entries.map(({ shape, weight }) => {
      const repeats = used.get(shape.name) ?? 0;
      return weight * Math.pow(DEALER.crowdPenalty, repeats);
    });
    const choice = weightedPick(entries, weights, rng) ?? entries[0];
    drawn.push(choice);
    used.set(choice.shape.name, (used.get(choice.shape.name) ?? 0) + 1);
  }

  if (board) {
    ensureSomethingFits(drawn, entries, cfg, rng);
    ensureAWayOut(drawn, entries, level, board, rng);
  }

  return drawn.map(({ shape }) => pieceFromShape(shape, pickColor(rng)));
}

/**
 * A tray where nothing fits isn't a hard level, it's a lost coin flip.
 * If the draw produced one, swap a slot for something playable.
 */
function ensureSomethingFits(drawn, entries, cfg, rng) {
  if (!cfg.guaranteeFit) return;
  if (drawn.some((entry) => entry.fits)) return;

  const fitting = entries.filter((entry) => entry.fits);
  if (fitting.length === 0) return; // genuinely nothing fits — that's game over

  const replacement = weightedPick(fitting, fitting.map((e) => e.weight), rng);
  if (replacement) drawn[drawn.length - 1] = replacement;
}

/**
 * Feature 4: make sure there's usually a way to actually clean up.
 *
 * If the roll says so and no drawn piece can finish a line, swap one in
 * that can. The odds come from the level, raised by how full the board
 * is — so an early level almost always offers an out, and even level 10
 * does once you're in real trouble.
 */
function ensureAWayOut(drawn, entries, level, board, rng) {
  if (drawn.some((entry) => entry.clears)) return;
  if (rng() > rescueChance(level, fillRatio(board))) return;

  const clearing = entries.filter((entry) => entry.clears);
  if (clearing.length === 0) return; // no shape can finish a line right now

  const replacement = weightedPick(clearing, clearing.map((e) => e.weight), rng);
  if (!replacement) return;

  // overwrite the least useful slot rather than always the same one
  let worst = 0;
  for (let i = 1; i < drawn.length; i++) {
    if (!drawn[i].fits && drawn[worst].fits) worst = i;
  }
  drawn[worst] = replacement;
}

/**
 * Relative frequencies at a level, as percentages, for the menu.
 * Board-independent — this is the level curve, not the live deal.
 */
export function shapeOdds(level) {
  const entries = shapeWeights(level, null).filter((e) => e.weight > 0);
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  return entries
    .map(({ shape, weight }) => ({ shape, share: total > 0 ? weight / total : 0 }))
    .sort((a, b) => b.share - a.share);
}

export { SHAPES };
