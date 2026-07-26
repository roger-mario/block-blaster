/**
 * input.js — getting a piece from the tray onto the board.
 *
 * Two ways to play, and you can switch between them mid-game without
 * thinking about it:
 *
 *   drag   press a piece and move — the old behaviour, unchanged
 *   tap    tap a piece to pick it up, then tap the board to drop it
 *
 * The two are told apart by distance: a press that never moves more than
 * `FX.tapSlop` pixels is a tap, anything further becomes a drag. So the
 * same gesture you always used still works, and a plain tap now does
 * something useful instead of nothing.
 *
 * Talks to the game only through `canPlace` / `snapOrigin` /
 * `previewPlacement` / `place`, so input handling stays completely
 * separate from the rules.
 */

import { BOARD_SIZE, FX } from "./config.js";
import { el } from "./dom.js";
import {
  buildPieceElement,
  dragCellSize,
  showPreview,
  clearPreview,
  hideTraySlot,
  markSelectedSlot,
  flashInvalidDrop,
} from "./render.js";

export class PlacementController {
  /**
   * @param {Game} game
   * @param {{ onDragStart?, onDrop?, onCancel?, onSelect?, onReject? }} hooks
   */
  constructor(game, hooks = {}) {
    this.game = game;
    this.hooks = hooks;

    this.drag = null;        // set once a press turns into a real drag
    this.pending = null;     // a press we haven't classified yet
    this.frame = null;       // pending requestAnimationFrame id
    this.selectedSlot = null;

    this._onMove = this.onMove.bind(this);
    this._onUp = this.onUp.bind(this);

    this._attachBoard();
  }

  // ---------- tray press ----------

  /** Called by render.js for every pointerdown on a tray slot. */
  start(slot, event) {
    if (this.drag || this.pending || this.game.over) return;
    const piece = this.game.tray[slot];
    if (!piece) return;

    event.preventDefault();

    this.pending = {
      slot,
      piece,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
    };

    window.addEventListener("pointermove", this._onMove, { passive: true });
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);
  }

  onMove(event) {
    if (this.pending) {
      const dx = event.clientX - this.pending.startX;
      const dy = event.clientY - this.pending.startY;
      if (Math.hypot(dx, dy) < FX.tapSlop) return; // still could be a tap
      this._beginDrag(event);
    }
    if (!this.drag) return;

    // Don't touch the DOM here. Pointer events can fire several times per
    // frame — on a 120Hz screen with coalesced events, many times — and
    // doing layout work on each one is what made dragging feel heavy.
    // Record the position and let one rAF callback do the work per frame.
    this.drag.pointerX = event.clientX;
    this.drag.pointerY = event.clientY;
    this._scheduleFrame();
  }

  _scheduleFrame() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.drag) this._moveDrag();
    });
  }

  _cancelFrame() {
    if (this.frame === null) return;
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  onUp(event) {
    window.removeEventListener("pointermove", this._onMove, { passive: true });
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    this._cancelFrame();

    if (this.pending) {
      // never moved far enough to be a drag → treat it as a tap
      const { slot } = this.pending;
      this.pending = null;
      this._toggleSelection(slot);
      return;
    }

    if (!this.drag) return;

    // settle on the very last pointer position rather than the last frame's
    if (event && typeof event.clientX === "number") {
      this.drag.pointerX = event.clientX;
      this.drag.pointerY = event.clientY;
      this._moveDrag();
    }

    const { slot, target, ghost } = this.drag;
    ghost.remove();
    this.drag = null;
    clearPreview();

    if (target) {
      this.game.place(slot, target.row, target.col);
      this.hooks.onDrop?.(slot);
    } else {
      this.hooks.onCancel?.(slot);
    }
  }

  // ---------- dragging ----------

  _beginDrag(event) {
    const { slot, piece, pointerType } = this.pending;
    this.pending = null;
    this.clearSelection();

    const blockPx = dragCellSize();
    const ghost = buildPieceElement(piece, blockPx);
    ghost.classList.add("drag-ghost");
    el.dragLayer.appendChild(ghost);

    // A fingertip covers the piece, so it has to sit above your thumb. A
    // mouse cursor is a single point and lifting there just makes the
    // piece drift away from the pointer for no reason.
    const lift = pointerType === "mouse" ? FX.dragLiftMouse : FX.dragLift;

    // The board's rect is read once per drag instead of on every frame.
    // It can only change on resize, which ends the drag anyway.
    this.drag = {
      slot,
      piece,
      ghost,
      blockPx,
      lift,
      target: null,
      boardRect: el.board.getBoundingClientRect(),
      pointerX: event.clientX,
      pointerY: event.clientY,
      lastRow: null,
      lastCol: null,
      lastValid: null,
    };

    // Pointer capture keeps the drag alive if your finger leaves the
    // window or crosses another element mid-move.
    try {
      event.target?.setPointerCapture?.(event.pointerId);
    } catch {
      /* not supported, or the pointer is already gone — harmless */
    }

    this.hooks.onDragStart?.(slot);
    hideTraySlot(slot);
    this._moveDrag(); // draw at the pickup point immediately, no blank frame
  }

  /** Grid square the dragged piece's top-left corner is currently over. */
  originAt(clientX, clientY) {
    const { piece, blockPx, lift, boardRect } = this.drag;
    const x = clientX - (piece.width * blockPx) / 2 - boardRect.left;
    const y = clientY - lift - (piece.height * blockPx) / 2 - boardRect.top;
    return {
      row: Math.round(y / blockPx),
      col: Math.round(x / blockPx),
    };
  }

  /**
   * One update, once per frame.
   *
   * Two things keep this cheap: the ghost moves with `transform`, which the
   * compositor handles without laying the page out again, and the board
   * preview is only redrawn when the piece actually crosses into a
   * different square. Repainting 64 cells on every pointer event was most
   * of what made this feel sluggish.
   */
  _moveDrag() {
    const { ghost, piece, blockPx, lift, pointerX, pointerY } = this.drag;

    const x = pointerX - (piece.width * blockPx) / 2;
    const y = pointerY - lift - (piece.height * blockPx) / 2;
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${FX.dragScale})`;

    const origin = this.originAt(pointerX, pointerY);
    if (origin.row === this.drag.lastRow && origin.col === this.drag.lastCol) return;

    this.drag.lastRow = origin.row;
    this.drag.lastCol = origin.col;

    const preview = this.game.previewPlacement(piece, origin.row, origin.col);
    this.drag.target = preview.valid ? origin : null;

    const willClear = preview.valid && preview.lines > 0;
    if (willClear !== this.drag.lastValid) {
      ghost.classList.toggle("will-clear-ghost", willClear);
      this.drag.lastValid = willClear;
    }

    showPreview(preview, piece, origin);
  }

  // ---------- tap to select, tap to place ----------

  _toggleSelection(slot) {
    if (this.selectedSlot === slot) {
      this.clearSelection();
    } else {
      this.select(slot);
    }
  }

  select(slot) {
    if (!this.game.tray[slot] || this.game.over) return;
    this.selectedSlot = slot;
    markSelectedSlot(slot);
    clearPreview();
    this.hooks.onSelect?.(slot);
  }

  clearSelection() {
    if (this.selectedSlot === null) return;
    this.selectedSlot = null;
    markSelectedSlot(null);
    clearPreview();
  }

  /** Re-applies the highlight after the tray has been redrawn. */
  refreshSelection() {
    if (this.selectedSlot === null) return;
    if (!this.game.tray[this.selectedSlot]) {
      this.clearSelection();
      return;
    }
    markSelectedSlot(this.selectedSlot);
  }

  get selectedPiece() {
    return this.selectedSlot === null ? null : this.game.tray[this.selectedSlot];
  }

  /** Board square under a screen point, or null if the point is outside. */
  cellFromPoint(clientX, clientY) {
    const rect = el.board.getBoundingClientRect();
    if (rect.width === 0) return null;

    const size = rect.width / BOARD_SIZE;
    const col = Math.floor((clientX - rect.left) / size);
    const row = Math.floor((clientY - rect.top) / size);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return { row, col };
  }

  _attachBoard() {
    // hover preview — mouse only, but harmless everywhere else
    el.board.addEventListener("pointermove", (event) => {
      if (this.drag || this.selectedSlot === null) return;
      if (event.pointerType === "touch") return;
      this._previewAt(event.clientX, event.clientY);
    });

    el.board.addEventListener("pointerleave", () => {
      if (this.selectedSlot !== null && !this.drag) clearPreview();
    });

    el.board.addEventListener("pointerup", (event) => {
      if (this.drag || this.pending || this.selectedSlot === null) return;
      this.placeAt(event.clientX, event.clientY);
    });

    // tapping anywhere that isn't the board or the tray puts the piece back
    document.addEventListener("pointerdown", (event) => {
      if (this.selectedSlot === null) return;
      if (el.board.contains(event.target) || el.tray.contains(event.target)) return;
      this.clearSelection();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.clearSelection();
    });
  }

  _previewAt(clientX, clientY) {
    const piece = this.selectedPiece;
    const cell = this.cellFromPoint(clientX, clientY);
    if (!piece || !cell) {
      clearPreview();
      return null;
    }

    const origin = this.game.snapOrigin(piece, cell.row, cell.col) ??
      this.game.centerOrigin(piece, cell.row, cell.col);

    showPreview(this.game.previewPlacement(piece, origin.row, origin.col), piece, origin);
    return origin;
  }

  /**
   * The whole point of feature 1: one tap on the board drops the selected
   * piece. `snapOrigin` forgives a square or two of imprecision, so you
   * don't have to hit the exact top-left corner with a fingertip.
   */
  placeAt(clientX, clientY) {
    const piece = this.selectedPiece;
    const slot = this.selectedSlot;
    const cell = this.cellFromPoint(clientX, clientY);
    if (!piece || !cell) return false;

    const origin = this.game.snapOrigin(piece, cell.row, cell.col);
    if (!origin) {
      clearPreview();
      flashInvalidDrop();
      this.hooks.onReject?.(slot);
      return false;
    }

    this.clearSelection();
    const placed = this.game.place(slot, origin.row, origin.col);
    if (placed) this.hooks.onDrop?.(slot);
    return placed;
  }
}
