/**
 * pieces.js — the shapes that can appear in the tray.
 *
 * To add a new shape, just add another `shape([...])` entry to SHAPES.
 * "X" is a block, "." is empty.
 */

import { COLORS } from "./config.js";

function shape(rows) {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "X") cells.push([r, c]);
    });
  });
  return cells;
}

export const SHAPES = [
  shape(["X"]),
  shape(["XX"]),
  shape(["X", "X"]),
  shape(["XXX"]),
  shape(["X", "X", "X"]),
  shape(["XXXX"]),
  shape(["X", "X", "X", "X"]),
  shape(["XXXXX"]),
  shape(["X", "X", "X", "X", "X"]),
  shape(["XX", "XX"]),
  shape(["XXX", "XXX", "XXX"]),
  shape(["XXX", "XXX"]),
  shape(["XX", "XX", "XX"]),
  shape(["X.", "XX"]),
  shape([".X", "XX"]),
  shape(["XX", "X."]),
  shape(["XX", ".X"]),
  shape(["X..", "X..", "XXX"]),
  shape(["..X", "..X", "XXX"]),
  shape(["XXX", "X..", "X.."]),
  shape(["XXX", "..X", "..X"]),
  shape([".X.", "XXX"]),
  shape(["XXX", ".X."]),
  shape(["X.", "XX", "X."]),
  shape([".X", "XX", ".X"]),
  shape([".XX", "XX."]),
  shape(["XX.", ".XX"]),
];

let nextPieceId = 1;

/** Builds a piece object with its measured bounding box. */
export function makePiece(cells, color) {
  return {
    id: nextPieceId++,
    cells,
    color,
    width: Math.max(...cells.map((c) => c[1])) + 1,
    height: Math.max(...cells.map((c) => c[0])) + 1,
  };
}

export function randomPiece() {
  const cells = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return makePiece(cells, color);
}

export function randomTray(count) {
  return Array.from({ length: count }, () => randomPiece());
}
