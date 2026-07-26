/**
 * dom.js — the single place that knows about actual HTML elements.
 *
 * Everything visual imports its element references from here, so if you
 * restructure index.html you only have to fix one file.
 */

import { BOARD_SIZE } from "./config.js";

export const el = {
  app: document.getElementById("app"),
  board: document.getElementById("board"),
  fx: document.getElementById("fx"),
  tray: document.getElementById("tray"),
  score: document.getElementById("scoreEl"),
  best: document.getElementById("bestEl"),
  combo: document.getElementById("combo"),
  hintBtn: document.getElementById("hintBtn"),
  hintCount: document.getElementById("hintCount"),
  dragLayer: document.getElementById("dragLayer"),
  overlay: document.getElementById("overlay"),
  finalScore: document.getElementById("finalScore"),
  newBest: document.getElementById("newBest"),
  restartBtn: document.getElementById("restartBtn"),
};

export const CELL_INSET = 1.5; // must match the .cell margin in styles.css

/** cellEls[row][col] -> the <div> for that board square */
export const cellEls = [];

export function buildBoardCells() {
  cellEls.length = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const div = document.createElement("div");
      div.className = "cell";
      // insert before the fx layer so effects always draw on top
      el.board.insertBefore(div, el.fx);
      row.push(div);
    }
    cellEls.push(row);
  }
}

/** Size of one board square in CSS pixels. */
export function cellSize() {
  return el.board.clientWidth / BOARD_SIZE;
}

/** Top-left pixel position of a board square, relative to the board. */
export function cellPosition(row, col) {
  const size = cellSize();
  return {
    x: col * size + CELL_INSET,
    y: row * size + CELL_INSET,
    size: size - CELL_INSET * 2,
  };
}

/** Restarts a CSS animation that may already be running on an element. */
export function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // force reflow
  element.classList.add(className);
}
