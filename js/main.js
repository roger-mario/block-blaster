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
import { attachMenu, recordResult, renderGameOverName } from "./menu.js";

const game = new Game();

const input = new PlacementController(game, {
  onCancel: () => drawTray(),
});

function drawTray(animate = false) {
  render.renderTray(game.tray, (slot, event) => input.start(slot, event), { animate });
}

function drawLevel() {
  render.renderLevel(game.level, game.levelProgress);
}

// ---------- game events ----------

game.on("reset", () => {
  fx.clearAllFx();
  input.cancel();
  render.hideGameOver();
  render.renderBoard(game.board);
  drawLevel();
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

game.on("lifelines", ({ statuses }) => render.renderLifelines(statuses));

// ---------- lifelines ----------

game.on("undo", () => {
  input.cancel();
  fx.clearAllFx();
  render.hideGameOver();
  render.renderBoard(game.board);
  render.renderScore(game.score);
  render.renderBest(game.best);
  drawLevel();
  fx.playUndoFx();
  fx.queueBadge("REWIND", "bonus");
});

game.on("shuffle", () => {
  input.cancel();
  fx.clearBadges();
  render.hideGameOver();
  fx.queueBadge("SHUFFLE", "bonus");
  fx.buzz(10);
});

game.on("wipe", ({ snapshot, cells }) => {
  input.cancel();
  fx.clearBadges();
  render.hideGameOver();
  fx.playWipeFx(cells, snapshot);
  // the real cells go dark behind the shatter, same as a line clear
  setTimeout(() => render.renderBoard(game.board), TIMING.boardSyncDelay);
  fx.queueBadge("BOARD WIPED", "bonus");
});

// a lifeline can pull you back out of a dead end
game.on("revive", () => render.hideGameOver());

game.on("gameover", (result) => {
  renderGameOverName();
  // Submitting goes over the network, so it isn't awaited — the overlay
  // shows immediately and the rank line fills itself in when it lands.
  recordResult();
  // wait for any clear animation to finish before covering the board
  setTimeout(() => render.showGameOver(result), 700);
});

// ---------- controls ----------

/**
 * A locked lifeline is still tappable — tapping it is how you learn why
 * it's locked, which beats a dead grey button that says nothing.
 */
render.mountLifelines((id) => {
  const status = game.lifelineStatus(id);
  if (!status.available) {
    fx.queueBadge(`${status.label}: ${status.reason}`);
    fx.buzz(20);
    return;
  }
  game.useLifeline(id);
});

el.restartBtn.addEventListener("click", () => game.reset());

// redraw on rotate/resize so the pixel geometry stays correct
window.addEventListener("resize", () => {
  render.renderBoard(game.board);
  drawTray();
});

// ---------- boot ----------

buildBoardCells();
attachMenu(game);
renderGameOverName();
render.renderBoard(game.board);
render.renderScore(game.score);
render.renderBest(game.best);
drawLevel();
render.renderLifelines(game.lifelineStatuses());
drawTray();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

// handy while developing — open the browser console and poke at these:
//   blockdrop.game.board          inspect the grid
//   blockdrop.findBestPlacement(blockdrop.game)   ask the solver for a move
window.blockdrop = { game, input, findBestPlacement, render, fx };
window.game = game;
