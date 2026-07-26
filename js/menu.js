/**
 * menu.js — the burger menu: leaderboard, stats, piece odds, version.
 *
 * Everything here is read-only reporting on state that lives elsewhere,
 * apart from the one input that sets your name. Opening the menu pauses
 * nothing; the board is simply covered.
 */

import { APP_VERSION, ASSISTS_PER_GAME } from "./config.js";
import { el } from "./dom.js";
import { MAX_LEVEL } from "./difficulty.js";
import { shapeOdds } from "./dealer.js";
import { getScores, getPlayer, setPlayer, submitScore, MAX_NAME_LENGTH } from "./leaderboard.js";

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
 */
export function recordResult() {
  el.overlayRank.textContent = "";
  el.overlayRank.style.display = "none";

  const name = getPlayer();
  if (!name || !game || game.score <= 0) return null;

  const result = submitScore(name, game.score, game.level);
  if (result) showRank(result);
  render();
  return result;
}

function showRank({ rank, improved }) {
  if (rank > 0 && improved) {
    el.overlayRank.textContent = `#${rank} on this device 🏆`;
  } else if (rank > 0) {
    el.overlayRank.textContent = `Your best is still #${rank}`;
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

function render() {
  renderPlayer();
  renderScores();
  renderStats();
  renderOdds();
}

function renderPlayer() {
  const name = getPlayer();
  el.nameInput.value = name;
  el.nameInput.maxLength = MAX_NAME_LENGTH;
  el.nameStatus.textContent = name ? `Saving scores as ${name}` : "Add a name to join the board";
}

function renderScores() {
  const entries = getScores();
  const me = getPlayer().toLowerCase();
  el.scoreList.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No scores yet — finish a game to get on the board.";
    el.scoreList.appendChild(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement("li");
    if (entry.name.toLowerCase() === me) row.classList.add("me");

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

function renderStats() {
  if (!game) return;
  const rows = [
    ["Level", `${game.level} of ${MAX_LEVEL}`],
    ["Score", game.score.toLocaleString()],
    ["Lines cleared", game.linesCleared],
    ["Pieces placed", game.stats.piecesPlaced],
    ["Best combo", game.stats.bestCombo > 0 ? `×${game.stats.bestCombo}` : "—"],
    ["Perfect clears", game.stats.perfectClears],
    ["Assists left", `${game.assistsLeft} of ${ASSISTS_PER_GAME}`],
  ];

  el.statList.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "stat-row";

    const name = document.createElement("span");
    name.textContent = label;

    const val = document.createElement("strong");
    val.textContent = String(value);

    row.append(name, val);
    el.statList.appendChild(row);
  }
}

/**
 * "What turns up at this level" — the same weights the dealer uses,
 * drawn as little shape previews so the curve is actually inspectable.
 */
function renderOdds() {
  if (!game) return;
  el.oddsLevel.textContent = `Level ${game.level}`;
  el.oddsList.replaceChildren();

  const odds = shapeOdds(game.level);
  const topShare = odds[0]?.share || 1;

  for (const { shape, share } of odds) {
    const row = document.createElement("div");
    row.className = "odds-row";

    row.appendChild(shapeThumb(shape));

    const bar = document.createElement("div");
    bar.className = "odds-bar";
    const fill = document.createElement("div");
    // scaled against the most common shape so the bars use the full width
    fill.style.width = `${Math.max(4, (share / topShare) * 100)}%`;
    bar.appendChild(fill);

    const pct = document.createElement("span");
    pct.className = "odds-pct";
    pct.textContent = `${(share * 100).toFixed(1)}%`;

    row.append(bar, pct);
    el.oddsList.appendChild(row);
  }
}

/** A tiny grid drawing of one shape. */
function shapeThumb(shape) {
  const width = Math.max(...shape.cells.map((c) => c[1])) + 1;
  const height = Math.max(...shape.cells.map((c) => c[0])) + 1;

  const thumb = document.createElement("div");
  thumb.className = "odds-thumb";
  thumb.style.gridTemplateColumns = `repeat(${width}, 5px)`;
  thumb.style.gridTemplateRows = `repeat(${height}, 5px)`;
  thumb.title = shape.name;

  const filled = new Set(shape.cells.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const dot = document.createElement("i");
      if (filled.has(`${r},${c}`)) dot.className = "on";
      thumb.appendChild(dot);
    }
  }
  return thumb;
}
