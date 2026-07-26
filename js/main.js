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
import { PlacementController } from "./input.js";

const game = new Game();

const input = new PlacementController(game, {
  onDragStart: () => render.clearHint(),
  onCancel: () => drawTray(),
  onSelect: () => render.clearHint(),
  onReject: () => fx.buzz(20),
});

function drawTray(animate = false) {
  render.renderTray(game.tray, (slot, event) => input.start(slot, event), { animate });
  input.refreshSelection();
}

function drawLevel() {
  render.renderLevel(game.level, game.levelProgress, game.multiplier);
}

function drawAssists() {
  render.renderAssists(game.assistsLeft, game.canUndo());
}

// ---------- game events ----------

game.on("reset", () => {
  fx.clearAllFx();
  input.clearSelection();
  render.clearPreview();
  render.clearHint();
  render.hideGameOver();
  render.renderBoard(game.board);
  drawLevel();
  drawAssists();
});

game.on("place", ({ piece, cells, points }) => {
  render.renderBoard(game.board);
  fx.playPlaceFx(cells, piece.color, points);
});

game.on("clear", (event) => {
  fx.playClearFx(event);
  // let the flash cover the moment the real blocks disappear
  setTimeout(() => render.renderBoard(game.board), TIMING.boardSyncDelay);

  const label = fx.comboLabel(event);
  if (label) fx.queueBadge(label);
});

game.on("bonus", ({ label, points }) => {
  fx.queueBadge(`${label} +${points}`, "bonus");
});

game.on("levelup", ({ level }) => {
  drawLevel();
  fx.playLevelUpFx(level);
});

game.on("score", ({ score, best, isNewBest, delta }) => {
  render.renderScore(score);
  render.renderBest(best);
  drawLevel(); // the progress bar moves with every clear
  if (delta >= 10) fx.bumpScore();
  if (isNewBest) fx.bumpBest();
});

game.on("tray", ({ refilled }) => drawTray(refilled));

game.on("hint", (hint) => {
  render.showHint(hint, TIMING.hintDuration);
  fx.buzz(10);
});

game.on("assists", drawAssists);

game.on("undo", () => {
  input.clearSelection();
  fx.clearAllFx();
  render.clearPreview();
  render.clearHint();
  render.hideGameOver();
  render.renderBoard(game.board);
  render.renderScore(game.score);
  render.renderBest(game.best);
  drawLevel();
  fx.playUndoFx();
});

game.on("gameover", (result) => {
  // wait for any clear animation to finish before covering the board
  setTimeout(() => render.showGameOver(result), 700);
});

// ---------- controls ----------

el.hintBtn.addEventListener("click", () => {
  const hint = game.useHint(findBestPlacement);
  if (!hint) fx.queueBadge("No moves left");
});

const undo = () => {
  if (!game.undo()) fx.queueBadge("Nothing to undo");
};

el.undoBtn.addEventListener("click", undo);
el.overlayUndoBtn.addEventListener("click", undo);
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
drawLevel();
drawAssists();
drawTray();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

// handy while developing — open the browser console and poke at these:
//   blockdrop.game.board          inspect the grid
//   blockdrop.findBestPlacement(blockdrop.game)   ask the solver directly
window.blockdrop = { game, input, findBestPlacement, render, fx };
window.game = game;
