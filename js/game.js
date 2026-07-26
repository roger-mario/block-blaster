/**
 * game.js — all the rules, and none of the visuals.
 *
 * This file never touches the DOM. That means you can reason about the
 * game (and test it) on its own, and any number of visual or audio
 * modules can listen to its events without tangling into the logic.
 *
 * Events emitted:
 *   reset      {}
 *   place      { slot, piece, origin, cells }
 *   clear      { rows, cols, snapshot, cells, lines, points, combo }
 *   comboBreak {}
 *   score      { score, delta, best, isNewBest }
 *   tray       { tray, refilled }
 *   hint       { slot, origin, cells, clearRows, clearCols, hintsLeft }
 *   gameover   { score, best, isNewBest }
 */

import { BOARD_SIZE, TRAY_SLOTS, SCORING, HINTS_PER_GAME, STORAGE_KEY } from "./config.js";
import { randomTray } from "./pieces.js";
import { Emitter } from "./emitter.js";

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function loadBest() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export class Game extends Emitter {
  constructor() {
    super();
    this.best = loadBest();
    this.reset();
  }

  reset() {
    this.board = emptyBoard();
    this.tray = randomTray(TRAY_SLOTS);
    this.score = 0;
    this.combo = 0;
    this.hintsLeft = HINTS_PER_GAME;
    this.over = false;
    this.emit("reset", {});
    this.emit("tray", { tray: this.tray, refilled: true });
    this.emit("score", { score: 0, delta: 0, best: this.best, isNewBest: false });
  }

  // ---------- queries ----------

  inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  canPlace(piece, originR, originC) {
    if (!piece) return false;
    for (const [dr, dc] of piece.cells) {
      const r = originR + dr;
      const c = originC + dc;
      if (!this.inBounds(r, c) || this.board[r][c]) return false;
    }
    return true;
  }

  /**
   * Look ahead without changing anything.
   * Powers both the drag preview and the hint system.
   */
  previewPlacement(piece, originR, originC) {
    if (!this.canPlace(piece, originR, originC)) {
      return { valid: false, cells: [], clearRows: [], clearCols: [], lines: 0, points: 0 };
    }

    const cells = piece.cells.map(([dr, dc]) => [originR + dr, originC + dc]);

    // simulate the placement on a shallow copy
    const sim = this.board.map((row) => row.slice());
    for (const [r, c] of cells) sim[r][c] = piece.color;

    const { rows: clearRows, cols: clearCols } = findCompletedLines(sim);
    const lines = clearRows.length + clearCols.length;

    return {
      valid: true,
      cells,
      clearRows,
      clearCols,
      lines,
      points: this.pointsForClear(lines, this.combo + 1),
    };
  }

  pointsForClear(lines, comboStep) {
    if (lines === 0) return 0;
    const base = SCORING.pointsPerLine * lines * lines;
    const bonus = comboStep > 1 ? base * SCORING.comboBonusPerStep * (comboStep - 1) : 0;
    return Math.round(base + bonus);
  }

  anyPlacementExists(piece) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.canPlace(piece, r, c)) return true;
      }
    }
    return false;
  }

  isGameOver() {
    const active = this.tray.filter(Boolean);
    if (active.length === 0) return false;
    return !active.some((p) => this.anyPlacementExists(p));
  }

  // ---------- actions ----------

  place(slot, originR, originC) {
    if (this.over) return false;
    const piece = this.tray[slot];
    if (!this.canPlace(piece, originR, originC)) return false;

    const cells = piece.cells.map(([dr, dc]) => [originR + dr, originC + dc]);
    for (const [r, c] of cells) this.board[r][c] = piece.color;

    this.tray[slot] = null;
    this._addScore(cells.length * SCORING.pointsPerCell);
    this.emit("place", { slot, piece, origin: { row: originR, col: originC }, cells });

    this._resolveClears();

    // refill only once the whole tray is spent
    const refilled = this.tray.every((p) => !p);
    if (refilled) this.tray = randomTray(TRAY_SLOTS);
    this.emit("tray", { tray: this.tray, refilled });

    if (this.isGameOver()) {
      this.over = true;
      this.emit("gameover", {
        score: this.score,
        best: this.best,
        isNewBest: this.score >= this.best && this.score > 0,
      });
    }
    return true;
  }

  _resolveClears() {
    const { rows, cols } = findCompletedLines(this.board);
    const lines = rows.length + cols.length;

    if (lines === 0) {
      if (this.combo > 0) this.emit("comboBreak", {});
      this.combo = 0;
      return;
    }

    // keep the colours around so the effects can draw what vanished
    const snapshot = this.board.map((row) => row.slice());
    const cells = [];
    for (const r of rows) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.board[r][c] = null;
        cells.push([r, c]);
      }
    }
    for (const c of cols) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        this.board[r][c] = null;
        cells.push([r, c]);
      }
    }

    this.combo++;
    const points = this.pointsForClear(lines, this.combo);
    this._addScore(points);

    this.emit("clear", {
      rows, cols, snapshot, cells, lines, points, combo: this.combo,
    });
  }

  _addScore(delta) {
    if (delta === 0) return;
    this.score += delta;
    let isNewBest = false;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE_KEY, String(this.best));
      isNewBest = true;
    }
    this.emit("score", { score: this.score, delta, best: this.best, isNewBest });
  }

  /** Spends one hint. Returns the suggestion, or null if none available. */
  useHint(finder) {
    if (this.hintsLeft <= 0 || this.over) return null;
    const move = finder(this);
    if (!move) return null;

    this.hintsLeft--;
    const payload = { ...move, hintsLeft: this.hintsLeft };
    this.emit("hint", payload);
    return payload;
  }
}

/** Finds every fully-filled row and column on a given board. */
export function findCompletedLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((v) => v)) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    if (board.every((row) => row[c])) cols.push(c);
  }
  return { rows, cols };
}
