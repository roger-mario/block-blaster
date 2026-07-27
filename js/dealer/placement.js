/**
 * dealer/placement.js — where a shape can go, and what happens when it does.
 *
 * `cells` throughout is a shape's normalised offset list, `[[dr, dc], …]`,
 * exactly as it comes off a SHAPES entry or a live piece.
 */

import { BOARD_SIZE, DEALER } from "../config.js";
import { lineCounts } from "./board.js";

const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const FILL = "#";

export function canPlaceAt(board, cells, originR, originC) {
  for (const [dr, dc] of cells) {
    const r = originR + dr;
    const c = originC + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c]) return false;
  }
  return true;
}

/** Every legal origin for this shape. Empty means it fits nowhere. */
export function placementsFor(board, cells) {
  const spots = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlaceAt(board, cells, r, c)) spots.push([r, c]);
    }
  }
  return spots;
}

/** Can this shape go anywhere at all? Cheaper than counting the spots. */
export function shapeFits(board, cells) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlaceAt(board, cells, r, c)) return true;
    }
  }
  return false;
}

/**
 * How many edges of the placed piece would touch a wall or an existing
 * block. Used only to rank placements cheaply before spending real work
 * measuring board health on the promising ones — a piece tucked against
 * something is almost always a better placement than one stranded in open
 * space.
 */
export function contactAt(board, cells, originR, originC) {
  let contact = 0;

  // The piece's own cells are empty on `board` — it hasn't been placed —
  // so a filled neighbour is always something else.
  for (const [dr, dc] of cells) {
    const r = originR + dr;
    const c = originC + dc;
    for (const [nr, nc] of NEIGHBOURS) {
      const rr = r + nr;
      const cc = c + nc;
      if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) contact++;
      else if (board[rr][cc]) contact++;
    }
  }
  return contact;
}

/**
 * Which rows and columns this placement would complete, worked out from
 * the board's line counts instead of by simulating — cheap enough to run
 * over every legal placement of every shape.
 */
const addedRows = new Int8Array(BOARD_SIZE);
const addedCols = new Int8Array(BOARD_SIZE);
const touchedRows = [];
const touchedCols = [];

export function completedBy(counts, cells, originR, originC) {
  // Scratch space again — this runs once per legal placement of every
  // shape in the pool, which is thousands of times per tray.
  touchedRows.length = 0;
  touchedCols.length = 0;

  for (const [dr, dc] of cells) {
    const r = originR + dr;
    const c = originC + dc;
    if (addedRows[r] === 0) touchedRows.push(r);
    if (addedCols[c] === 0) touchedCols.push(c);
    addedRows[r]++;
    addedCols[c]++;
  }

  const rows = [];
  const cols = [];
  for (const r of touchedRows) {
    if (counts.rows[r] + addedRows[r] === BOARD_SIZE) rows.push(r);
    addedRows[r] = 0;
  }
  for (const c of touchedCols) {
    if (counts.cols[c] + addedCols[c] === BOARD_SIZE) cols.push(c);
    addedCols[c] = 0;
  }
  return { rows, cols, lines: rows.length + cols.length };
}

/** Is there any placement of this shape that finishes a line right now? */
export function shapeClearsLine(board, cells, counts = lineCounts(board)) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!canPlaceAt(board, cells, r, c)) continue;
      if (completedBy(counts, cells, r, c).lines > 0) return true;
    }
  }
  return false;
}

/**
 * Plays a shape and resolves any lines it completes, returning the board
 * that would result. The original is untouched.
 */
export function simulate(board, cells, originR, originC) {
  const next = board.map((row) => row.slice());
  for (const [dr, dc] of cells) next[originR + dr][originC + dc] = FILL;

  const rows = [];
  const cols = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!next[r][c]) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!next[r][c]) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }

  for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) next[r][c] = null;
  for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) next[r][c] = null;

  return { board: next, rows, cols, lines: rows.length + cols.length };
}

/**
 * Can this whole tray be played out, in *some* order?
 *
 * This is the question the old dealer never asked. Checking each piece
 * against the board as it stands now isn't enough: the second piece may
 * fit today's board and have nowhere to go once the first one is down.
 *
 * Depth-first over (which piece next) × (where it goes), resolving lines
 * as it goes, stopping at the first order that works. The search is
 * bounded — a board tangled enough to exhaust the budget is one where the
 * answer is genuinely hard, and in that case we **fail open** and call it
 * playable. A dealer that stalls the game to prove a point is worse than
 * one that occasionally deals a tray you have to think about.
 */
export function playableInSomeOrder(board, shapes, budget = DEALER.solveBudget) {
  let nodes = 0;
  let exhausted = false;

  function search(current, remaining) {
    if (remaining.length === 0) return true;

    for (let i = 0; i < remaining.length; i++) {
      // identical shapes lead to identical searches
      if (remaining.findIndex((cells) => cells === remaining[i]) !== i) continue;

      const cells = remaining[i];
      const rest = remaining.filter((_, j) => j !== i);
      for (const [r, c] of placementsFor(current, cells)) {
        if (++nodes > budget) {
          exhausted = true;
          return false;
        }
        if (search(simulate(current, cells, r, c).board, rest)) return true;
      }
    }
    return false;
  }

  const playable = search(board, shapes);
  return { playable: playable || exhausted, exhausted };
}
