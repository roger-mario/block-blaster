/**
 * main.js — wiring.
 *
 * The game announces what happened; this file decides what the player
 * sees and hears in response. Adding a new feature (sound, achievements,
 * daily challenges) usually means writing a new module and subscribing
 * to the same events here.
 */

import { TIMING } from "./config.js";
import { Game } from "./game.js";
import { findBestPlacement } from "./solver.js";
import { el, buildBoardCells } from "./dom.js";
import * as render from "./render.js";
import * as fx from "./effects.js";
import { DragController } from "./input.js";

const game = new Game();

const drag = new DragController(game, {
  onDragStart: () => render.clearHint(),
  onCancel: () => drawTray(),
});

function drawTray(animate = false) {
  render.renderTray(game.tray, (slot, event) => drag.start(slot, event), { animate });
}

// ---------- game events ----------

game.on("reset", () => {
  fx.clearAllFx();
  render.clearPreview();
  render.clearHint();
  render.hideGameOver();
  render.renderBoard(game.board);
  render.renderHints(game.hintsLeft);
});

game.on("place", ({ piece, cells }) => {
  render.renderBoard(game.board);
  fx.playPlaceFx(cells, piece.color, cells.length);
});

game.on("clear", (event) => {
  fx.playClearFx(event);
  // let the flash cover the moment the real blocks disappear
  setTimeout(() => render.renderBoard(game.board), TIMING.boardSyncDelay);

  const label = fx.comboLabel(event);
  if (label) fx.showCombo(label);
});

game.on("score", ({ score, best, isNewBest, delta }) => {
  render.renderScore(score);
  render.renderBest(best);
  if (delta >= 10) fx.bumpScore();
  if (isNewBest) fx.bumpBest();
});

game.on("tray", ({ refilled }) => drawTray(refilled));

game.on("hint", (hint) => {
  render.showHint(hint, TIMING.hintDuration);
  render.renderHints(hint.hintsLeft);
  fx.buzz(10);
});

game.on("gameover", (result) => {
  // wait for any clear animation to finish before covering the board
  setTimeout(() => render.showGameOver(result), 700);
});

// ---------- controls ----------

el.hintBtn.addEventListener("click", () => {
  const hint = game.useHint(findBestPlacement);
  if (!hint) fx.showCombo("No moves left");
});

el.restartBtn.addEventListener("click", () => game.reset());

// redraw on rotate/resize so the pixel geometry stays correct
window.addEventListener("resize", () => {
  render.renderBoard(game.board);
  drawTray();
});

// ---------- boot ----------

buildBoardCells();
render.renderBoard(game.board);
render.renderScore(game.score);
render.renderBest(game.best);
render.renderHints(game.hintsLeft);
drawTray();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

// handy while developing — open the browser console and poke at these:
//   blockdrop.game.board          inspect the grid
//   blockdrop.findBestPlacement(blockdrop.game)   ask the solver directly
window.blockdrop = { game, findBestPlacement, render, fx };
window.game = game;
