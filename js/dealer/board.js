/**
 * dealer/board.js — reading a grid.
 *
 * Everything here takes a plain array-of-arrays board (truthy = filled)
 * and returns a number or a small plain object. No Game, no DOM, no
 * colours. These are the eyes of the dealer: if the dealer can't see
 * something about your board, it's because there's no function for it
 * here yet.
 *
 * See DEALER-STRATEGY.md for what these measurements are *for*.
 */

import { BOARD_SIZE, DEALER } from "../config.js";

const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const CELLS = BOARD_SIZE * BOARD_SIZE;

export function filledCount(board) {
  let filled = 0;
  for (const row of board) for (const cell of row) if (cell) filled++;
  return filled;
}

export function fillRatio(board) {
  return filledCount(board) / CELLS;
}

export function isBoardEmpty(board) {
  for (const row of board) for (const cell of row) if (cell) return false;
  return true;
}

/** How many cells are filled in each row and each column. */
export function lineCounts(board) {
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

/**
 * Flood-fills the empty space.
 *
 * The shape of the *gaps* says more about a board than the count of
 * filled cells does. Twelve empty cells in one connected area will take
 * almost any piece; the same twelve split into five pockets will take
 * almost nothing.
 *
 * Returns the number of separate pockets, the biggest one, and how many
 * are too small to be worth anything — `singles` (one cell, only a dot
 * fits) and `tiny` (two or three).
 */
const seen = new Uint8Array(CELLS);
const stack = new Int32Array(CELLS);
let stamp = 0;

export function openRegions(board) {
  // The dealer runs this hundreds of times per tray, so the scratch space
  // is reused and marked with a generation number instead of being
  // reallocated and cleared. Nothing here yields, so there's no reentrancy
  // to worry about — but don't make it async.
  if (++stamp === 255) {
    seen.fill(0);
    stamp = 1;
  }

  let count = 0;
  let largest = 0;
  let singles = 0;
  let tiny = 0;
  let empty = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const start = r * BOARD_SIZE + c;
      if (board[r][c] || seen[start] === stamp) continue;

      let size = 0;
      let top = 0;
      stack[top++] = start;
      seen[start] = stamp;

      while (top > 0) {
        const index = stack[--top];
        const rr = (index / BOARD_SIZE) | 0;
        const cc = index - rr * BOARD_SIZE;
        size++;

        for (const [dr, dc] of NEIGHBOURS) {
          const nr = rr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (board[nr][nc]) continue;
          const next = nr * BOARD_SIZE + nc;
          if (seen[next] === stamp) continue;
          seen[next] = stamp;
          stack[top++] = next;
        }
      }

      count++;
      empty += size;
      if (size > largest) largest = size;
      if (size === 1) singles++;
      else if (size <= 3) tiny++;
    }
  }

  return { count, largest, singles, tiny, empty };
}

/**
 * How tightly the blocks you have are packed into near-complete lines,
 * 0 → 1, averaged over the lines that have anything in them at all.
 *
 * This is what separates "twenty blocks arranged into three rows that are
 * nearly done" from "twenty blocks smeared across the whole grid". Same
 * amount of stuff, completely different position.
 */
export function concentration(board, counts = lineCounts(board)) {
  let total = 0;
  let lines = 0;
  for (const n of counts.rows) {
    if (n > 0) {
      total += (n / BOARD_SIZE) ** 2;
      lines++;
    }
  }
  for (const n of counts.cols) {
    if (n > 0) {
      total += (n / BOARD_SIZE) ** 2;
      lines++;
    }
  }
  return lines > 0 ? total / lines : 0;
}

/**
 * One number for "how good is this board to be playing from".
 *
 * Higher is better. The absolute value means nothing — it's only ever
 * compared against another board, which is why it doesn't need to be
 * normalised to any particular range.
 *
 *   room          space left to work with
 *   concentration blocks gathered into lines that are nearly done
 *   contiguity    the empty space is one area, not confetti
 *   singles/tiny  pockets too small to take a real piece — dead space
 */
export function boardHealth(board) {
  const w = DEALER.health;
  const regions = openRegions(board);
  const room = regions.empty / CELLS;
  const contiguity = regions.empty > 0 ? regions.largest / regions.empty : 1;

  return (
    w.room * room +
    w.concentration * concentration(board) +
    w.contiguity * contiguity -
    w.hole * regions.singles -
    w.tiny * regions.tiny
  );
}

/**
 * The rows and columns that, if they all cleared, would empty the board.
 *
 * Greedy set cover — take the line covering the most remaining blocks,
 * repeat. It isn't guaranteed minimal, and it doesn't need to be: we only
 * care whether the answer is *small*, because a small answer means a
 * whole-board clear is genuinely within reach and the dealer should start
 * offering pieces that finish those exact lines.
 *
 * `feasible` is false on an empty board (nothing to sweep) and on a board
 * whose blocks are too scattered to cover in `DEALER.sweepMaxLines`.
 */
export function sweepPlan(board) {
  let remaining = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) remaining.push([r, c]);
    }
  }

  const filled = remaining.length;
  const rows = new Set();
  const cols = new Set();

  while (remaining.length > 0 && rows.size + cols.size < DEALER.sweepMaxLines) {
    const rowCover = Array(BOARD_SIZE).fill(0);
    const colCover = Array(BOARD_SIZE).fill(0);
    for (const [r, c] of remaining) {
      rowCover[r]++;
      colCover[c]++;
    }

    let bestCount = 0;
    let bestIndex = -1;
    let bestIsRow = true;
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (rowCover[i] > bestCount) {
        bestCount = rowCover[i];
        bestIndex = i;
        bestIsRow = true;
      }
    }
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (colCover[i] > bestCount) {
        bestCount = colCover[i];
        bestIndex = i;
        bestIsRow = false;
      }
    }
    if (bestIndex < 0) break;

    if (bestIsRow) {
      rows.add(bestIndex);
      remaining = remaining.filter(([r]) => r !== bestIndex);
    } else {
      cols.add(bestIndex);
      remaining = remaining.filter(([, c]) => c !== bestIndex);
    }
  }

  return {
    rows,
    cols,
    filled,
    lines: rows.size + cols.size,
    feasible: filled > 0 && remaining.length === 0,
  };
}
