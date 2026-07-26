/**
 * solver.js — works out a good move to suggest when the player taps Hint.
 *
 * It tries every piece in every legal position and scores each one:
 *   - clearing lines is worth a lot
 *   - snug placements (touching walls or existing blocks) are preferred
 *   - leaving single-cell holes is penalised
 *
 * Tweak the WEIGHTS below to make the hints more or less aggressive.
 */

import { BOARD_SIZE } from "./config.js";

const WEIGHTS = {
  linesCleared: 1000, // clearing beats everything else
  contact: 12,        // each piece edge touching a wall or a block
  holeCreated: -25,   // each empty cell left completely surrounded
  rowProgress: 2,     // partial progress toward completing lines
};

const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * Counts how many edges of the placed piece touch a wall or a filled cell.
 * High contact = tucked in neatly instead of stranded in open space.
 */
function contactScore(board, cells) {
  const placed = new Set(cells.map(([r, c]) => `${r},${c}`));
  let contact = 0;

  for (const [r, c] of cells) {
    for (const [dr, dc] of NEIGHBOURS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
        contact++; // touching a wall counts
      } else if (board[nr][nc] && !placed.has(`${nr},${nc}`)) {
        contact++;
      }
    }
  }
  return contact;
}

/** Empty cells with no empty neighbour are dead space. */
function countHoles(board) {
  let holes = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) continue;
      const open = NEIGHBOURS.some(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !board[nr][nc];
      });
      if (!open) holes++;
    }
  }
  return holes;
}

/** How close the board is to completing lines, ignoring already-full ones. */
function progressScore(board) {
  let progress = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    const filled = board[r].filter(Boolean).length;
    if (filled < BOARD_SIZE) progress += filled;
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let filled = 0;
    for (let r = 0; r < BOARD_SIZE; r++) if (board[r][c]) filled++;
    if (filled < BOARD_SIZE) progress += filled;
  }
  return progress;
}

/**
 * Returns the best move available, or null if nothing fits.
 * Shape: { slot, origin: {row, col}, cells, clearRows, clearCols, lines }
 */
export function findBestPlacement(game) {
  let best = null;
  let bestScore = -Infinity;

  const holesBefore = countHoles(game.board);

  game.tray.forEach((piece, slot) => {
    if (!piece) return;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const preview = game.previewPlacement(piece, row, col);
        if (!preview.valid) continue;

        // simulate so we can measure the resulting board
        const sim = game.board.map((r) => r.slice());
        for (const [r, c] of preview.cells) sim[r][c] = piece.color;
        for (const r of preview.clearRows) for (let c = 0; c < BOARD_SIZE; c++) sim[r][c] = null;
        for (const c of preview.clearCols) for (let r = 0; r < BOARD_SIZE; r++) sim[r][c] = null;

        const score =
          preview.lines * WEIGHTS.linesCleared +
          contactScore(game.board, preview.cells) * WEIGHTS.contact +
          Math.max(0, countHoles(sim) - holesBefore) * WEIGHTS.holeCreated +
          progressScore(sim) * WEIGHTS.rowProgress;

        if (score > bestScore) {
          bestScore = score;
          best = {
            slot,
            piece,
            origin: { row, col },
            cells: preview.cells,
            clearRows: preview.clearRows,
            clearCols: preview.clearCols,
            lines: preview.lines,
          };
        }
      }
    }
  });

  return best;
}
