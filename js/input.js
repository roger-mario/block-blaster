/**
 * input.js — dragging pieces from the tray onto the board.
 *
 * Talks to the game only through `canPlace` / `previewPlacement` / `place`,
 * so touch handling stays completely separate from the rules.
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

export class DragController {
  /**
   * @param {Game} game
   * @param {{ onDragStart?: Function, onDrop?: Function, onCancel?: Function }} hooks
   */
  constructor(game, hooks = {}) {
    this.game = game;
    this.hooks = hooks;
    this.state = null;

    // bound once so add/removeEventListener always match
    this._onMove = this.onMove.bind(this);
    this._onUp = this.onUp.bind(this);
  }

  start(slot, event) {
    if (this.state || this.game.over) return;
    const piece = this.game.tray[slot];
    if (!piece) return;

    event.preventDefault();

    const blockPx = dragCellSize();
    const ghost = buildPieceElement(piece, blockPx);
    ghost.classList.add("drag-ghost");
    el.dragLayer.appendChild(ghost);

    this.state = { slot, piece, ghost, blockPx, target: null };
    this.hooks.onDragStart?.(slot);
    hideTraySlot(slot);

    this.onMove(event);
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);
  }

  /** Grid square the piece's top-left corner is currently over. */
  originAt(clientX, clientY) {
    const { piece, blockPx } = this.state;
    const rect = el.board.getBoundingClientRect();
    const x = clientX - (piece.width * blockPx) / 2 - rect.left;
    const y = clientY - FX.dragLift - (piece.height * blockPx) / 2 - rect.top;
    return {
      row: Math.round(y / blockPx),
      col: Math.round(x / blockPx),
    };
  }

  onMove(event) {
    if (!this.state) return;
    const { ghost, piece, blockPx } = this.state;

    ghost.style.left = `${event.clientX - (piece.width * blockPx) / 2}px`;
    ghost.style.top = `${event.clientY - FX.dragLift - (piece.height * blockPx) / 2}px`;

    const origin = this.originAt(event.clientX, event.clientY);
    const preview = this.game.previewPlacement(piece, origin.row, origin.col);

    this.state.target = preview.valid ? origin : null;
    ghost.classList.toggle("will-clear-ghost", preview.valid && preview.lines > 0);

    showPreview(preview, piece, origin);
  }

  onUp() {
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    if (!this.state) return;

    const { slot, target, ghost } = this.state;
    ghost.remove();
    this.state = null;
    clearPreview();

    if (target) {
      this.game.place(slot, target.row, target.col);
      this.hooks.onDrop?.(slot);
    } else {
      this.hooks.onCancel?.(slot);
    }
  }
}
