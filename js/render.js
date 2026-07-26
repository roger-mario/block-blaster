/**
 * render.js — turns game state into what you see on screen.
 *
 * Deliberately "dumb": it draws whatever it's told to draw and holds no
 * game rules of its own.
 */

import { BOARD_SIZE, FX, TIMING, LIFELINES } from "./config.js";
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
 * Shows where the piece would land while you drag it.
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

// ---------- lifelines ----------

/**
 * Builds the three lifeline buttons, in the toolbar and again on the
 * Game Over screen — a wipe or a shuffle can pull you back out of a
 * dead end, so they have to be reachable from there too.
 *
 * Buttons are never given the `disabled` attribute. A locked lifeline
 * still has to be tappable, because tapping it is how you find out *why*
 * it's locked: `onUse` gets the id either way and answers with a badge.
 */
export function mountLifelines(onUse) {
  for (const bar of [el.lifelines, el.overlayLifelines]) {
    bar.replaceChildren();

    for (const spec of LIFELINES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lifeline";
      button.dataset.life = spec.id;

      const glyph = document.createElement("span");
      glyph.className = "glyph";
      glyph.textContent = spec.icon;

      const tip = document.createElement("span");
      tip.className = "tip";
      const name = document.createElement("b");
      name.textContent = spec.label;
      const why = document.createElement("i");
      why.textContent = spec.tip;
      tip.append(name, why);

      button.append(glyph, tip);

      // a tap fires the lifeline *and* shows its label, so the tooltip
      // isn't hover-only trivia on a phone
      button.addEventListener("pointerdown", () => peekTip(button));
      button.addEventListener("click", () => onUse(spec.id));

      bar.appendChild(button);
    }
  }
}

let peekTimer = null;
function peekTip(button) {
  clearTimeout(peekTimer);
  for (const other of document.querySelectorAll(".lifeline.peek")) {
    other.classList.remove("peek");
  }
  button.classList.add("peek");
  peekTimer = setTimeout(() => button.classList.remove("peek"), TIMING.tipDuration);
}

/** Paints every lifeline button from the game's own verdict. */
export function renderLifelines(statuses) {
  let anyAvailable = false;

  for (const status of statuses) {
    if (status.available) anyAvailable = true;

    for (const button of document.querySelectorAll(`.lifeline[data-life="${status.id}"]`)) {
      button.classList.toggle("used", status.used);
      button.classList.toggle("locked", !status.available && !status.used);
      // deliberately not `disabled` or `aria-disabled`: the button still
      // does something when it's locked — it tells you why — and the
      // reason is carried in the accessible name
      button.setAttribute("aria-label", `${status.label} — ${status.reason}`);

      const why = button.querySelector(".tip i");
      if (why) why.textContent = status.reason;
    }

    // The Game Over row is an offer, not a status display: a lifeline you
    // can't use there is just noise, so it isn't shown at all.
    const rescueBtn = el.overlayLifelines.querySelector(`[data-life="${status.id}"]`);
    if (rescueBtn) rescueBtn.hidden = !status.available;
  }

  // no point offering a second chance with nothing left in it
  el.rescue.classList.toggle("empty", !anyAvailable);
}

// ---------- tray ----------

/**
 * Pixel size of one block when a piece is drawn in the tray.
 *
 * The tray is a fixed height now, so the pieces are drawn a little larger
 * than they used to be — they're what you have to grab, and they were
 * swimming in their slots.
 */
export function trayCellSize(piece) {
  const maxDim = Math.max(piece.width, piece.height, 3);
  return Math.min(102 / maxDim, 30);
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

// ---------- stats ----------

export function renderScore(score) {
  el.score.textContent = score;
}

export function renderBest(best) {
  el.best.textContent = best;
}

/**
 * Level badge and the progress bar under the header.
 *
 * The score multiplier is deliberately not shown: it's a number the
 * player can't act on, and the level it comes from is right there.
 */
export function renderLevel(level, progress) {
  el.levelValue.textContent = level;
  el.levelBar.style.width = `${Math.round(progress * 100)}%`;
  el.levelBadge.classList.toggle("maxed", level >= MAX_LEVEL);
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
