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
import {
  initScenery,
  applyLookFor,
  advanceLook,
  announceLook,
  onLookChange,
  currentLook,
} from "./scenery.js";
import { remapColour } from "./looks.js";

const game = new Game();

const input = new PlacementController(game, {
  onCancel: () => drawTray(),
});

function drawTray(animate = false) {
  render.renderTray(game.tray, (slot, event) => input.start(slot, event), { animate });
}

/**
 * Advances to the look this game state has earned and names it. Silent if
 * the cycle didn't actually move on.
 */
function swapLook() {
  const look = advanceLook(game.level, game.stats.perfectClears);
  if (look) setTimeout(() => announceLook(look), 800);
}

function drawLevel() {
  render.renderLevel(game.level, game.levelProgress);
}

// ---------- game events ----------

game.on("reset", () => {
  applyLookFor(game.level, game.stats.perfectClears);
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

game.on("bonus", ({ type, label, points }) => {
  fx.queueBadge(`${label} +${points}`, "bonus");

  // emptying the board gets its own animation on top of the line clear
  if (type === "perfect") {
    setTimeout(() => fx.playBoardClearFx(game.level), TIMING.boardSyncDelay + 120);
    // clearing the board earns the next look, same as levelling up
    setTimeout(swapLook, TIMING.boardSyncDelay + 420);
  }
});

game.on("levelup", ({ level }) => {
  drawLevel();
  fx.playLevelUpFx(level);
  // every level is a whole new look — see js/looks.js
  swapLook();
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

// Picking a theme mid-game restyles what's already down, not just what
// gets dealt next.
onLookChange(({ from, to }) => {
  game.recolour((colour) => remapColour(colour, from, to));
  render.renderBoard(game.board);
  drawTray();
});

el.restartBtn.addEventListener("click", () => game.reset());

// redraw on rotate/resize so the pixel geometry stays correct
window.addEventListener("resize", () => {
  render.renderBoard(game.board);
  drawTray();
});

// ---------- boot ----------

// The theme lands first: everything below reads the colours it sets, so
// painting it afterwards would show one frame of the wrong palette.
initScenery(game.level, game.stats.perfectClears);

buildBoardCells();
attachMenu(game);
renderGameOverName();
render.renderBoard(game.board);
render.renderScore(game.score);
render.renderBest(game.best);
drawLevel();
render.renderLifelines(game.lifelineStatuses());
drawTray();

/*
 * Offline support — but never on localhost.
 *
 * The worker caches every module, and during development that means an
 * edited file can keep serving its old version to a page that has already
 * loaded a newer one. The symptom is an import error or an effect that
 * silently does nothing, and it costs half an hour to work out. Live
 * deploys still get the worker; local ones never do.
 */
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

if ("serviceWorker" in navigator && !isLocal) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
} else if (isLocal && "serviceWorker" in navigator) {
  // clear out a worker registered by an earlier visit to this port
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
  }).catch(() => {});
}

// handy while developing — open the browser console and poke at these:
//   blockdrop.game.board          inspect the grid
//   blockdrop.findBestPlacement(blockdrop.game)   ask the solver for a move
window.blockdrop = { game, input, findBestPlacement, render, fx, currentLook };
window.game = game;
