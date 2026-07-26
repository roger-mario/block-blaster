/**
 * render.js — turns game state into what you see on screen.
 *
 * Deliberately "dumb": it draws whatever it's told to draw and holds no
 * game rules of its own.
 */

import { BOARD_SIZE, FX, TIMING } from "./config.js";
import { el, cellEls, cellSize } from "./dom.js";
import { MAX_LEVEL } from "./difficulty.js";

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

// ---------- placement preview ----------

const PREVIEW_CLASSES = ["preview-ok", "preview-bad", "will-clear", "will-clear-new"];

/**
 * The cells the last preview actually marked.
 *
 * Sweeping all 64 squares to clear four classes each ran on every preview
 * update; remembering the handful we touched turns that into a few
 * operations, which is most of why dragging feels immediate now.
 */
let markedCells = [];

export function clearPreview() {
  for (const cell of markedCells) cell.classList.remove(...PREVIEW_CLASSES);
  markedCells.length = 0;
  el.board.classList.remove("clear-imminent");
}

function mark(cell, className) {
  cell.classList.add(className);
  markedCells.push(cell);
}

/**
 * Shows where the piece would land — used by both the drag and the
 * tap-to-place preview.
 *
 * When the placement would complete lines, every cell in those lines
 * lights up so you can see the clear coming before you commit.
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
      mark(cellEls[r][c], valid ? "preview-ok" : "preview-bad");
    }
  }

  if (!valid || preview.lines === 0) return;

  // highlight every line that would dissolve
  const inPiece = new Set(preview.cells.map(([r, c]) => `${r},${c}`));
  const markLine = (r, c) => {
    mark(cellEls[r][c], inPiece.has(`${r},${c}`) ? "will-clear-new" : "will-clear");
  };

  for (const r of preview.clearRows) for (let c = 0; c < BOARD_SIZE; c++) markLine(r, c);
  for (const c of preview.clearCols) for (let r = 0; r < BOARD_SIZE; r++) markLine(r, c);

  el.board.classList.add("clear-imminent");
}

/** Brief red pulse when a tap lands somewhere the piece can't go. */
let rejectTimer = null;
export function flashInvalidDrop() {
  el.board.classList.add("tap-reject");
  clearTimeout(rejectTimer);
  rejectTimer = setTimeout(() => el.board.classList.remove("tap-reject"), 260);
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
 * `onPointerDown(slot, event)` is called when a slot is pressed.
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

/** Lights up the tray slot the player tapped. Pass null to clear. */
export function markSelectedSlot(slot) {
  [...el.tray.children].forEach((slotEl, index) => {
    slotEl.classList.toggle("selected", index === slot);
  });
  el.app.classList.toggle("has-selection", slot !== null);
}

// ---------- stats ----------

export function renderScore(score) {
  el.score.textContent = score;
}

export function renderBest(best) {
  el.best.textContent = best;
}

/** Level badge, ×multiplier and the progress bar under the header. */
export function renderLevel(level, progress, multiplier) {
  el.levelValue.textContent = level;
  el.levelMult.textContent = `×${multiplier.toFixed(2).replace(/\.?0+$/, "")}`;
  el.levelBar.style.width = `${Math.round(progress * 100)}%`;
  el.levelBadge.classList.toggle("maxed", level >= MAX_LEVEL);
}

/**
 * Hints and undo share one pool of assists, so both buttons show the same
 * number — spend it whichever way you like.
 */
export function renderAssists(assistsLeft, canUndo) {
  el.hintCount.textContent = assistsLeft;
  el.undoCount.textContent = assistsLeft;
  el.hintBtn.disabled = assistsLeft <= 0;
  el.undoBtn.disabled = !canUndo;
  el.overlayUndoBtn.disabled = !canUndo;
  el.overlayUndoBtn.style.display = canUndo ? "" : "none";
}

// ---------- overlay ----------

export function showGameOver({ score, isNewBest, level }) {
  el.finalScore.textContent = `Score: ${score}`;
  el.finalLevel.textContent = `Reached level ${level}`;
  el.newBest.style.display = isNewBest ? "block" : "none";
  el.overlay.classList.add("show");
}

export function hideGameOver() {
  el.overlay.classList.remove("show");
}

export { FX, TIMING };
