/**
 * render.js — turns game state into what you see on screen.
 *
 * Deliberately "dumb": it draws whatever it's told to draw and holds no
 * game rules of its own.
 */

import { BOARD_SIZE, FX } from "./config.js";
import { el, cellEls, cellSize } from "./dom.js";

// ---------- board ----------

export function renderBoard(board) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = cellEls[r][c];
      const color = board[r][c];
      if (color) {
        cell.classList.add("filled");
        cell.style.background = color;
      } else {
        cell.classList.remove("filled");
        cell.style.background = "";
      }
    }
  }
}

// ---------- drag preview ----------

const PREVIEW_CLASSES = ["preview-ok", "preview-bad", "will-clear", "will-clear-new"];

export function clearPreview() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      cellEls[r][c].classList.remove(...PREVIEW_CLASSES);
    }
  }
  el.board.classList.remove("clear-imminent");
}

/**
 * Shows where the dragged piece would land.
 *
 * When the placement would complete lines, every cell in those lines
 * lights up so you can see the clear coming before you let go.
 */
export function showPreview(preview, piece, origin) {
  clearPreview();

  const { row, col } = origin;
  const valid = preview.valid;

  // the squares the piece itself would occupy
  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      cellEls[r][c].classList.add(valid ? "preview-ok" : "preview-bad");
    }
  }

  if (!valid || preview.lines === 0) return;

  // highlight every line that would dissolve
  const inPiece = new Set(preview.cells.map(([r, c]) => `${r},${c}`));
  const markLine = (r, c) => {
    const cell = cellEls[r][c];
    cell.classList.add(inPiece.has(`${r},${c}`) ? "will-clear-new" : "will-clear");
  };

  for (const r of preview.clearRows) for (let c = 0; c < BOARD_SIZE; c++) markLine(r, c);
  for (const c of preview.clearCols) for (let r = 0; r < BOARD_SIZE; r++) markLine(r, c);

  el.board.classList.add("clear-imminent");
}

// ---------- hint ----------

let hintTimer = null;

export function showHint(hint, durationMs) {
  clearHint();

  for (const [r, c] of hint.cells) {
    cellEls[r][c].classList.add("hint-cell");
  }
  const slotEl = el.tray.children[hint.slot];
  if (slotEl) slotEl.classList.add("hint-slot");

  hintTimer = setTimeout(clearHint, durationMs);
}

export function clearHint() {
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      cellEls[r][c].classList.remove("hint-cell");
    }
  }
  for (const slot of el.tray.children) slot.classList.remove("hint-slot");
}

// ---------- tray ----------

/** Pixel size of one block when a piece is drawn in the tray. */
export function trayCellSize(piece) {
  const maxDim = Math.max(piece.width, piece.height, 3);
  return Math.min(90 / maxDim, 26);
}

/** Pixel size of one block when a piece is dragged over the board. */
export function dragCellSize() {
  return cellSize();
}

export function buildPieceElement(piece, blockPx, { animated = false } = {}) {
  const holder = document.createElement("div");
  holder.className = "piece" + (animated ? " piece-in" : "");
  holder.style.width = `${piece.width * blockPx}px`;
  holder.style.height = `${piece.height * blockPx}px`;

  for (const [r, c] of piece.cells) {
    const block = document.createElement("div");
    block.className = "piece-cell";
    block.style.width = `${blockPx - 2}px`;
    block.style.height = `${blockPx - 2}px`;
    block.style.left = `${c * blockPx}px`;
    block.style.top = `${r * blockPx}px`;
    block.style.background = piece.color;
    holder.appendChild(block);
  }
  return holder;
}

/**
 * Draws the three tray slots.
 * `onPointerDown(slot, event)` is called when a slot is grabbed.
 */
export function renderTray(tray, onPointerDown, { animate = false } = {}) {
  el.tray.innerHTML = "";

  tray.forEach((piece, slot) => {
    const slotEl = document.createElement("div");
    slotEl.className = "tray-slot";

    if (piece) {
      slotEl.appendChild(buildPieceElement(piece, trayCellSize(piece), { animated: animate }));
      slotEl.addEventListener("pointerdown", (event) => onPointerDown(slot, event));
    }
    el.tray.appendChild(slotEl);
  });
}

export function hideTraySlot(slot) {
  const slotEl = el.tray.children[slot];
  if (slotEl) slotEl.style.visibility = "hidden";
}

// ---------- stats ----------

export function renderScore(score) {
  el.score.textContent = score;
}

export function renderBest(best) {
  el.best.textContent = best;
}

export function renderHints(hintsLeft) {
  el.hintCount.textContent = hintsLeft;
  el.hintBtn.disabled = hintsLeft <= 0;
}

// ---------- overlay ----------

export function showGameOver({ score, isNewBest }) {
  el.finalScore.textContent = `Score: ${score}`;
  el.newBest.style.display = isNewBest ? "block" : "none";
  el.overlay.classList.add("show");
}

export function hideGameOver() {
  el.overlay.classList.remove("show");
}

export { FX };
