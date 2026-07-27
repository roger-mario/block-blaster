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
 *   lifelines  { used, statuses }
 *   undo       { level }
 *   shuffle    { tray, slots }
 *   wipe       { snapshot, cells }
 *   revive     { reason }
 *   gameover   { score, best, isNewBest, level }
 */

import {
  BOARD_SIZE,
  TRAY_SLOTS,
  LIFELINES,
  LIFELINE_BY_ID,
  STORAGE_KEY,
} from "./config.js";
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
    this.over = false;
    this._undo = null;

    // one use each, per game — see LIFELINES in config.js
    this.lifelineUsed = Object.fromEntries(LIFELINES.map((l) => [l.id, false]));

    // shown in the menu; purely informational
    this.stats = { piecesPlaced: 0, bestCombo: 0, clears: 0, perfectClears: 0 };

    this._refillTray();

    this.emit("reset", {});
    this.emit("tray", { tray: this.tray, refilled: true });
    this.emit("score", { score: 0, delta: 0, best: this.best, isNewBest: false });
    this._emitLifelines();
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
   * Look ahead without changing anything. Powers the drag preview.
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

    // a fresh move means Rewind has something to take back again
    this._emitLifelines();

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

  /**
   * Restyles every block already on the board and in the tray.
   *
   * Purely cosmetic — colours carry no meaning in the rules — but a theme
   * switch that only restyled *future* pieces would leave the board half
   * in the old palette, which reads as a bug.
   */
  recolour(mapColour) {
    if (typeof mapColour !== "function") return;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c]) this.board[r][c] = mapColour(this.board[r][c]);
      }
    }
    for (const piece of this.tray) {
      if (piece) piece.color = mapColour(piece.color);
    }
    // the undo snapshot has to move with it, or a rewind repaints the past
    if (this._undo) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this._undo.board[r][c]) this._undo.board[r][c] = mapColour(this._undo.board[r][c]);
        }
      }
      for (const piece of this._undo.tray) {
        if (piece) piece.color = mapColour(piece.color);
      }
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

  // ---------- lifelines: three of them, one use each ----------

  /**
   * Why a lifeline is or isn't on offer right now.
   *
   * The UI renders straight from this, so the reason a button is dark is
   * decided here in the rules rather than guessed at in the markup.
   */
  lifelineStatus(id) {
    const spec = LIFELINE_BY_ID[id];
    if (!spec) return { id, used: false, available: false, reason: "No such lifeline" };

    const base = { id, label: spec.label, icon: spec.icon, used: this.lifelineUsed[id] };
    const no = (reason) => ({ ...base, available: false, reason });

    if (base.used) return no("Already used");
    if (spec.maxLevel != null && this.level > spec.maxLevel) {
      return no(`Gone after level ${spec.maxLevel}`);
    }
    if (spec.minLevel != null && this.level < spec.minLevel) {
      return no(`Unlocks at level ${spec.minLevel}`);
    }

    if (id === "undo" && this._undo === null) return no("Nothing to take back");
    if (id === "shuffle" && !this.tray.some(Boolean)) return no("No pieces to swap");
    if (id === "wipe" && this.isBoardEmpty()) return no("The board is already clear");

    return { ...base, available: true, reason: spec.tip };
  }

  /** Every lifeline's status, in the order they're shown. */
  lifelineStatuses() {
    return LIFELINES.map((spec) => this.lifelineStatus(spec.id));
  }

  canUseLifeline(id) {
    return this.lifelineStatus(id).available;
  }

  /** Spends a lifeline by id. Returns false if it wasn't on offer. */
  useLifeline(id) {
    if (!this.canUseLifeline(id)) return false;
    if (id === "undo") return this.undo();
    if (id === "shuffle") return this.shuffleTray();
    if (id === "wipe") return this.wipeBoard();
    return false;
  }

  /** Kept for readability at the call sites: "is Rewind on offer?" */
  canUndo() {
    return this.canUseLifeline("undo");
  }

  /**
   * Rewind — takes back the last placement, and only the last one.
   *
   * Locked away above level 5: by then you're expected to live with your
   * mistakes, and Wipe has taken over as the way out.
   */
  undo() {
    if (!this.canUseLifeline("undo")) return false;

    this._restore(this._undo);
    this._undo = null;
    this.lifelineUsed.undo = true;

    this.emit("undo", { level: this.level });
    this.emit("tray", { tray: this.tray, refilled: false });
    this.emit("score", {
      score: this.score,
      delta: 0,
      best: this.best,
      isNewBest: false,
    });
    this._settleLifeline("undo");
    return true;
  }

  /**
   * Shuffle — deals fresh pieces into the slots you haven't used yet.
   *
   * Only the filled slots are re-dealt, so shuffling with one piece left
   * hands you one piece, not a whole new tray.
   */
  shuffleTray() {
    if (!this.canUseLifeline("shuffle")) return false;

    const slots = this.tray.reduce((list, p, i) => (p ? [...list, i] : list), []);
    const fresh = dealTray(slots.length, {
      level: this.level,
      board: this.board,
      rng: this.rng,
    });

    slots.forEach((slot, i) => {
      this.tray[slot] = fresh[i];
    });

    this.lifelineUsed.shuffle = true;
    // the rewind snapshot holds the *old* tray, so keeping it would quietly
    // undo the shuffle as well — a new deal is a fresh position
    this._undo = null;

    this.emit("shuffle", { tray: this.tray, slots });
    this.emit("tray", { tray: this.tray, refilled: true });
    this._settleLifeline("shuffle");
    return true;
  }

  /**
   * Wipe — clears every block off the board.
   *
   * No points: this is a rescue, not a clear. Locked until level 5, where
   * Rewind runs out and the board starts to bite.
   */
  wipeBoard() {
    if (!this.canUseLifeline("wipe")) return false;

    const snapshot = this.board.map((row) => row.slice());
    const cells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c]) cells.push([r, c]);
      }
    }

    this.board = emptyBoard();
    this.combo = 0;
    this.lifelineUsed.wipe = true;
    this._undo = null; // nothing sensible to rewind to across a wipe

    this.emit("wipe", { snapshot, cells });
    this._settleLifeline("wipe");
    return true;
  }

  /**
   * A lifeline can end a game (a shuffle that fits nowhere) or save one
   * (a wipe from the Game Over screen), so the verdict is recomputed
   * after every one of them.
   */
  _settleLifeline(id) {
    const over = this.isGameOver();

    if (this.over && !over) {
      this.over = false;
      this.emit("revive", { reason: id });
    } else if (!this.over && over) {
      this.over = true;
      this.emit("gameover", {
        score: this.score,
        best: this.best,
        isNewBest: this.score >= this.best && this.score > 0,
        level: this.level,
        canUndo: this.canUndo(),
      });
    }

    this._emitLifelines();
  }

  _emitLifelines() {
    this.emit("lifelines", {
      used: { ...this.lifelineUsed },
      statuses: this.lifelineStatuses(),
    });
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
