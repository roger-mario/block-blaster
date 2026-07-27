/**
 * menu.js — the burger menu: the leaderboard, and not much else.
 *
 * It used to carry a live stats table and a breakdown of the piece odds.
 * Both were interesting to build and neither was anything the player
 * could act on, so the menu is now the board, a short reminder of the
 * rules, and the version.
 *
 * Opening the menu pauses nothing; the board is simply covered.
 */

import { APP_VERSION } from "./config.js";
import { el } from "./dom.js";
import { THEME_ROTATION } from "./config.js";
import { activeTheme, daysUntilRotation } from "./themes.js";
import { sceneryForLevel } from "./sceneries.js";
import {
  loadBoard,
  recordScore,
  getPlayer,
  setPlayer,
  getPlayerId,
  MAX_NAME_LENGTH,
} from "./leaderboard.js";

let game = null;

export function attachMenu(gameInstance) {
  game = gameInstance;

  el.menuBtn.addEventListener("click", open);
  el.menuClose.addEventListener("click", close);
  el.menuBackdrop.addEventListener("click", close);

  el.nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveName(el.nameInput.value);
  });

  el.overlayNameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = saveName(el.overlayNameInput.value);
    if (name) recordResult();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.menu.classList.contains("show")) close();
  });

  el.version.textContent = `v${APP_VERSION}`;
  el.menuVersion.textContent = `Block Drop v${APP_VERSION}`;
}

// ---------- open / close ----------

export function open() {
  render();
  el.menu.classList.add("show");
}

export function close() {
  el.menu.classList.remove("show");
}

// ---------- the name ----------

function saveName(raw) {
  const name = setPlayer(raw);
  render();
  renderGameOverName();
  return name;
}

/**
 * Records the finished game under the remembered name.
 * Quietly does nothing if there isn't one — never a blocking prompt.
 *
 * Submitting happens over the network, so this is async — but nothing
 * waits on it. The Game Over screen is already up; the rank line fills in
 * a moment later.
 */
export async function recordResult() {
  el.overlayRank.textContent = "";
  el.overlayRank.style.display = "none";

  const name = getPlayer();
  if (!name || !game || game.score <= 0) return null;

  const result = await recordScore(game.score, game.level);
  if (result) showRank(result);
  await render();
  return result;
}

function showRank({ rank, improved, online }) {
  const where = online ? "worldwide" : "on this device";

  if (rank > 0 && improved) {
    el.overlayRank.textContent = `#${rank} ${where} 🏆`;
  } else if (rank > 0) {
    el.overlayRank.textContent = `Your best is still #${rank} ${where}`;
  } else {
    el.overlayRank.textContent = "";
  }
  el.overlayRank.style.display = el.overlayRank.textContent ? "block" : "none";
}

/** The game-over screen only asks for a name if there isn't one yet. */
export function renderGameOverName() {
  const known = getPlayer();
  el.overlayNameForm.style.display = known ? "none" : "flex";
  if (known) el.overlayNameInput.value = known;
}

// ---------- drawing the panel ----------

async function render() {
  renderThemes();
  renderPlayer();
  await renderScores();
}

function renderPlayer() {
  const name = getPlayer();
  el.nameInput.value = name;
  el.nameInput.maxLength = MAX_NAME_LENGTH;
  el.nameStatus.textContent = name ? `Saving scores as ${name}` : "Add a name to join the board";
}

async function renderScores() {
  el.scoreList.replaceChildren(loadingRow());
  el.boardScope.textContent = "";

  const { online, scores } = await loadBoard();
  const myId = getPlayerId();

  el.boardScope.textContent = online ? "everyone" : "this device";
  el.boardScope.classList.toggle("offline", !online);
  el.boardNote.textContent = online
    ? "Everyone playing the live game shares this board."
    : "Shared board unreachable — showing this device's scores.";

  el.scoreList.replaceChildren();

  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No scores yet — finish a game to get on the board.";
    el.scoreList.appendChild(empty);
    return;
  }

  scores.forEach((entry, index) => {
    const row = document.createElement("li");
    if (entry.playerId && entry.playerId === myId) row.classList.add("me");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `${index + 1}`;

    const who = document.createElement("span");
    who.className = "who";
    who.textContent = entry.name; // textContent, never innerHTML

    const lvl = document.createElement("span");
    lvl.className = "lvl";
    lvl.textContent = `lvl ${entry.level}`;

    const score = document.createElement("span");
    score.className = "pts";
    score.textContent = entry.score.toLocaleString();

    row.append(rank, who, lvl, score);
    el.scoreList.appendChild(row);
  });
}

/**
 * The Look section — a report, not a picker.
 *
 * Neither axis is the player's to choose, and that's the point: the theme
 * is a small event on a schedule and the scenery is a reward for getting
 * further. A dropdown would turn both into settings, and then nobody
 * would ever see the other nine.
 */
function renderThemes() {
  const theme = activeTheme();
  const days = daysUntilRotation();
  const scenery = sceneryForLevel(game?.level ?? 1);

  el.themeWhen.textContent = `${days} day${days === 1 ? "" : "s"} left`;
  el.themeStatus.textContent =
    `${theme.name} — ${theme.blurb}. A new look every ${THEME_ROTATION.periodDays} days, ` +
    `the same for everyone.`;
  el.sceneryStatus.textContent = scenery
    ? `Scenery: ${scenery.name}. The background changes every time you level up.`
    : "";
}

function loadingRow() {
  const row = document.createElement("li");
  row.className = "empty";
  row.textContent = "Loading…";
  return row;
}

