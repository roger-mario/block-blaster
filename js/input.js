/**
 * input.js — getting a piece from the tray onto the board.
 *
 * One gesture, and only one: press a piece and drag it where you want it.
 * A press that never moves is not a shortcut for anything — it simply
 * puts the piece back — so there is no mode to be in and nothing to
 * explain on screen.
 *
 * Talks to the game only through `previewPlacement` and `place`, so input
 * handling stays completely separate from the rules.
 */

import { FX } from "./config.js";
import { el } from "./dom.js";
import {
  buildPieceElement,
  dragCellSize,
  showPreview,
  clearPreview,
  hideTraySlot,
} from "./render.js";

export class PlacementController {
  /**
   * @param {Game} game
   * @param {{ onDragStart?, onDrop?, onCancel? }} hooks
   */
  constructor(game, hooks = {}) {
    this.game = game;
    this.hooks = hooks;

    this.drag = null;        // set once a press turns into a real drag
    this.pending = null;     // a press we haven't classified yet
    this.frame = null;       // pending requestAnimationFrame id

    this._onMove = this.onMove.bind(this);
    this._onUp = this.onUp.bind(this);
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
      // a few pixels of wobble on press shouldn't count as picking it up
      if (Math.hypot(dx, dy) < FX.tapSlop) return;
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
      // never moved far enough to be a drag — nothing to do
      this.pending = null;
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

  /** Drops whatever is in hand — used when the game state changes underneath. */
  cancel() {
    this.pending = null;
    this._cancelFrame();
    if (this.drag) {
      this.drag.ghost.remove();
      this.drag = null;
    }
    clearPreview();
  }
}
