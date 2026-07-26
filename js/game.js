/**
 * game.js — all the rules, and none of the visuals.
 *
 * This file never touches the DOM. That means you can reason about the
 * game (and test it) on its own, and any number of visual or audio
 * modules can listen to its events without tangling into the logic.
 *
 * Events emitted:
 *   reset      {}
 *   place      { slot, piece, origin, cells, points }
 *   clear      { rows, cols, snapshot, cells, lines, points, combo }
 *   bonus      { type, label, points }
 *   levelup    { level, previous, multiplier, bonus }
 *   comboBreak {}
 *   score      { score, delta, best, isNewBest }
 *   tray       { tray, refilled }
 *   hint       { slot, origin, cells, clearRows, clearCols, assistsLeft }
 *   assists    { assistsLeft, canUndo }
 *   undo       { assistsLeft }
 *   gameover   { score, best, isNewBest, level }
 */

import { BOARD_SIZE, TRAY_SLOTS, ASSISTS_PER_GAME, STORAGE_KEY, FX } from "./config.js";
import { dealTray } from "./dealer.js";
import {
  levelForLines,
  levelConfig,
  multiplierFor,
  levelProgress as computeLevelProgress,
} from "./difficulty.js";
import { placementPoints, clearPoints, clearBonuses, levelUpBonus } from "./scoring.js";
import { readNumber, write } from "./storage.js";
import { Emitter } from "./emitter.js";

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export class Game extends Emitter {
  /** `rng` is injectable so tests can run the game deterministically. */
  constructor({ rng = Math.random } = {}) {
    super();
    this.rng = rng;
    this.best = readNumber(STORAGE_KEY, 0);
    this.reset();
  }

  reset() {
    this.board = emptyBoard();
    this.score = 0;
    this.combo = 0;
    this.linesCleared = 0;
    this.level = 1;
    this.assistsLeft = ASSISTS_PER_GAME;
    this.over = false;
    this._undo = null;

    // shown in the menu; purely informational
    this.stats = { piecesPlaced: 0, bestCombo: 0, clears: 0, perfectClears: 0 };

    this._refillTray();

    this.emit("reset", {});
    this.emit("tray", { tray: this.tray, refilled: true });
    this.emit("score", { score: 0, delta: 0, best: this.best, isNewBest: false });
    this.emit("assists", { assistsLeft: this.assistsLeft, canUndo: false });
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

  /** How much every point is currently worth. */
  get multiplier() {
    return multiplierFor(this.level);
  }

  /** 0 → 1 through the current level, for the header progress bar. */
  get levelProgress() {
    return computeLevelProgress(this.linesCleared);
  }

  /**
   * Look ahead without changing anything.
   * Powers the drag preview, the tap preview and the hint system.
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
      points:
        placementPoints(cells.length, this.level) +
        clearPoints(lines, this.combo + 1, this.level),
    };
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

  // ---------- tap to place ----------

  /**
   * Where the piece's top-left corner goes if you want it centred on the
   * square you tapped. Pure arithmetic — no legality check.
   */
  centerOrigin(piece, row, col) {
    return {
      row: row - Math.floor((piece.height - 1) / 2),
      col: col - Math.floor((piece.width - 1) / 2),
    };
  }

  /**
   * The legal origin closest to the square you tapped, or null if nothing
   * within `radius` works.
   *
   * Tapping means you can't be as precise as dragging, so the game meets
   * you halfway: it tries the centred position first and then spirals
   * outward a square at a time.
   */
  snapOrigin(piece, row, col, radius = FX.snapRadius) {
    if (!piece) return null;
    const centre = this.centerOrigin(piece, row, col);

    for (let ring = 0; ring <= radius; ring++) {
      let bestAtRing = null;
      let bestDistance = Infinity;

      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          // only the outer edge of this ring — inner ones were done already
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;

          const origin = { row: centre.row + dr, col: centre.col + dc };
          if (!this.canPlace(piece, origin.row, origin.col)) continue;

          // among equals prefer the true nearest, so the snap feels honest
          const distance = dr * dr + dc * dc;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestAtRing = origin;
          }
        }
      }
      if (bestAtRing) return bestAtRing;
    }
    return null;
  }

  // ---------- actions ----------

  place(slot, originR, originC) {
    if (this.over) return false;
    const piece = this.tray[slot];
    if (!this.canPlace(piece, originR, originC)) return false;

    this._undo = this._snapshot();

    const cells = piece.cells.map(([dr, dc]) => [originR + dr, originC + dc]);
    for (const [r, c] of cells) this.board[r][c] = piece.color;

    this.tray[slot] = null;
    this.trayPlacements++;
    this.stats.piecesPlaced++;

    const points = placementPoints(cells.length, this.level);
    this._addScore(points);
    this.emit("place", { slot, piece, origin: { row: originR, col: originC }, cells, points });

    this._resolveClears();

    // refill only once the whole tray is spent
    const refilled = this.tray.every((p) => !p);
    if (refilled) this._refillTray();
    this.emit("tray", { tray: this.tray, refilled });

    this.emit("assists", { assistsLeft: this.assistsLeft, canUndo: this.canUndo() });

    if (this.isGameOver()) {
      this.over = true;
      this.emit("gameover", {
        score: this.score,
        best: this.best,
        isNewBest: this.score >= this.best && this.score > 0,
        level: this.level,
        canUndo: this.canUndo(),
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
    this.trayClears++;
    this.stats.clears++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);

    const points = clearPoints(lines, this.combo, this.level);
    this._addScore(points);

    this.emit("clear", { rows, cols, snapshot, cells, lines, points, combo: this.combo });

    // ----- the extras -----
    const bonuses = clearBonuses({
      rows,
      cols,
      boardEmpty: this.isBoardEmpty(),
      flawlessTray: this.trayPlacements === TRAY_SLOTS && this.trayClears === TRAY_SLOTS,
      level: this.level,
    });
    for (const bonus of bonuses) {
      this._addScore(bonus.points);
      if (bonus.type === "perfect") this.stats.perfectClears++;
      this.emit("bonus", bonus);
    }

    // ----- difficulty ladder -----
    this.linesCleared += lines;
    const nextLevel = levelForLines(this.linesCleared);
    if (nextLevel > this.level) {
      const previous = this.level;
      this.level = nextLevel;
      const bonus = levelUpBonus(nextLevel);
      this._addScore(bonus);
      this.emit("levelup", {
        level: nextLevel,
        previous,
        multiplier: levelConfig(nextLevel).multiplier,
        bonus,
      });
    }
  }

  isBoardEmpty() {
    return this.board.every((row) => row.every((cell) => !cell));
  }

  /**
   * The dealer reads the board, not just the level — see dealer.js. That's
   * what stops a tray of pieces that fit nowhere, and what makes a nearly
   * full board hand you a way out.
   */
  _refillTray() {
    this.tray = dealTray(TRAY_SLOTS, {
      level: this.level,
      board: this.board,
      rng: this.rng,
    });
    this.trayPlacements = 0;
    this.trayClears = 0;
  }

  _addScore(delta) {
    if (!delta) return;
    this.score += delta;
    let isNewBest = false;
    if (this.score > this.best) {
      this.best = this.score;
      write(STORAGE_KEY, this.best);
      isNewBest = true;
    }
    this.emit("score", { score: this.score, delta, best: this.best, isNewBest });
  }

  // ---------- assists: 3 per game, spend them however you like ----------

  /** Spends one assist on a hint. Returns the suggestion, or null. */
  useHint(finder) {
    if (this.assistsLeft <= 0 || this.over) return null;
    const move = finder(this);
    if (!move) return null;

    this.assistsLeft--;
    const payload = { ...move, assistsLeft: this.assistsLeft };
    this.emit("hint", payload);
    this.emit("assists", { assistsLeft: this.assistsLeft, canUndo: this.canUndo() });
    return payload;
  }

  /** One step back is available, and you can afford it. */
  canUndo() {
    return this._undo !== null && this.assistsLeft > 0;
  }

  /**
   * Takes back the last placement — and only the last one. The snapshot
   * is dropped afterwards, so you can never rewind two moves in a row.
   * Costs one assist, out of the same pot as the hints.
   */
  undo() {
    if (!this.canUndo()) return false;

    this._restore(this._undo);
    this._undo = null;
    this.assistsLeft--;

    this.emit("undo", { assistsLeft: this.assistsLeft, level: this.level });
    this.emit("tray", { tray: this.tray, refilled: false });
    this.emit("score", {
      score: this.score,
      delta: 0,
      best: this.best,
      isNewBest: false,
    });
    this.emit("assists", { assistsLeft: this.assistsLeft, canUndo: false });
    return true;
  }

  _snapshot() {
    return {
      board: this.board.map((row) => row.slice()),
      tray: this.tray.slice(),
      score: this.score,
      best: this.best,
      combo: this.combo,
      linesCleared: this.linesCleared,
      level: this.level,
      trayPlacements: this.trayPlacements,
      trayClears: this.trayClears,
      over: this.over,
      stats: { ...this.stats },
    };
  }

  _restore(state) {
    this.board = state.board.map((row) => row.slice());
    this.tray = state.tray.slice();
    this.score = state.score;
    this.best = state.best;
    this.combo = state.combo;
    this.linesCleared = state.linesCleared;
    this.level = state.level;
    this.trayPlacements = state.trayPlacements;
    this.trayClears = state.trayClears;
    this.over = state.over;
    this.stats = { ...state.stats };
    write(STORAGE_KEY, this.best);
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
