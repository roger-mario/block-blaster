/**
 * leaderboard.js — who's been playing, and how well.
 *
 * Two boards behind one door:
 *
 *   online   api/scores.js, shared by everyone playing the deployed game
 *   local    localStorage, this device only
 *
 * The online one is tried first. If it can't be reached — no database
 * connected yet, offline, opened from a file:// path — the local board is
 * used instead and the game carries on without saying a word. Scores are
 * always written locally too, so nothing is ever lost to a flaky
 * connection.
 *
 * ## Identity
 *
 * A name alone can't identify anyone: two friends could both be "Alex", and
 * anyone could type your name to overwrite your score. Browsers can't read
 * a MAC address or any other hardware identifier — that's blocked for
 * privacy and there's no way around it — so on first play we mint a random
 * UUID, keep it in localStorage, and key the board on that. Your name is
 * just the label shown beside it, and you can change it whenever.
 *
 * The trade-off worth knowing: that id lives in one browser's storage. Play
 * on your phone and your laptop and you'll appear twice, and clearing site
 * data starts you fresh.
 */

import {
  LEADERBOARD_KEY,
  PLAYER_KEY,
  PLAYER_ID_KEY,
  LEADERBOARD_SIZE,
  LEADERBOARD_API,
} from "./config.js";
import { readJson, writeJson, readString, write } from "./storage.js";

export const MAX_NAME_LENGTH = 14;

/**
 * Tidies a name: no control characters, no angle brackets, no runs of
 * whitespace, and short enough to fit the table.
 *
 * Names always reach the page through `textContent`, so this is about
 * keeping the layout sane rather than about escaping. The server applies
 * the same rules again — a client-side check is a courtesy, not a control.
 */
export function cleanName(raw) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

// ---------- identity ----------

function mintId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* randomUUID needs a secure context; fall through */
  }
  // good enough for telling players apart, which is all this is for
  let id = "";
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

/** This browser's player id, created on first use and kept from then on. */
export function getPlayerId() {
  let id = readString(PLAYER_ID_KEY, "");
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) {
    id = mintId();
    write(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getPlayer() {
  return cleanName(readString(PLAYER_KEY, ""));
}

export function setPlayer(name) {
  const clean = cleanName(name);
  write(PLAYER_KEY, clean);
  return clean;
}

export function hasPlayer() {
  return getPlayer().length > 0;
}

// ---------- the local board ----------

function normalise(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      playerId: typeof e.playerId === "string" ? e.playerId : "",
      name: cleanName(e.name),
      score: Number.isFinite(e.score) ? Math.max(0, Math.round(e.score)) : 0,
      level: Number.isFinite(e.level) ? e.level : 1,
      at: Number.isFinite(e.at) ? e.at : 0,
    }))
    .filter((e) => e.name.length > 0 && e.score > 0);
}

function sortEntries(entries) {
  return entries.sort((a, b) => b.score - a.score || a.at - b.at);
}

export function localScores() {
  return sortEntries(normalise(readJson(LEADERBOARD_KEY, [])));
}

/**
 * Records a result on this device, keeping only a personal best so one
 * player can't fill the table with their last ten games.
 */
export function recordLocal(name, score, level = 1, now = Date.now()) {
  const clean = cleanName(name);
  if (!clean || !Number.isFinite(score) || score <= 0) return null;

  const playerId = getPlayerId();
  const entries = localScores();
  const existing = entries.find((e) =>
    e.playerId ? e.playerId === playerId : e.name.toLowerCase() === clean.toLowerCase()
  );

  let improved = true;
  if (existing) {
    if (score <= existing.score) {
      improved = false;
      existing.name = clean; // a rename still shows, even without a new best
      existing.playerId = playerId;
    } else {
      Object.assign(existing, { name: clean, score: Math.round(score), level, at: now, playerId });
    }
  } else {
    entries.push({ playerId, name: clean, score: Math.round(score), level, at: now });
  }

  const kept = sortEntries(entries).slice(0, LEADERBOARD_SIZE);
  writeJson(LEADERBOARD_KEY, kept);

  const rank = kept.findIndex((e) => e.playerId === playerId);
  return { rank: rank === -1 ? -1 : rank + 1, entries: kept, improved, online: false };
}

/** Where a score would land on the local board, without recording it. */
export function localRank(score) {
  return localScores().filter((e) => e.score >= score).length + 1;
}

export function clearLocal() {
  writeJson(LEADERBOARD_KEY, []);
}

// ---------- the online board ----------

/**
 * null  = haven't tried yet
 * true  = the shared board answered
 * false = it didn't, so we're on the local one
 */
let online = null;

export function isOnline() {
  return online;
}

/** Test seam: lets the suite drive the online/offline paths deterministically. */
export function _setOnline(value) {
  online = value;
}

async function callApi(options = {}) {
  if (typeof fetch !== "function") throw new Error("no fetch in this environment");

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), LEADERBOARD_API.timeoutMs)
    : null;

  try {
    const url = `${LEADERBOARD_API.endpoint}?limit=${LEADERBOARD_API.onlineSize}`;
    const response = await fetch(url, {
      ...options,
      signal: controller?.signal,
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });

    const data = await response.json().catch(() => null);
    // a 503 means "no database wired up yet" — expected, not a failure
    if (!data || data.online !== true) throw new Error(data?.reason ?? `http ${response.status}`);

    online = true;
    return data;
  } catch (error) {
    online = false;
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The board to show. Prefers the shared one, falls back to this device's.
 * @returns {Promise<{online: boolean, scores: Array}>}
 */
export async function loadBoard() {
  try {
    const data = await callApi({ method: "GET" });
    return { online: true, scores: normalise(data.scores) };
  } catch {
    return { online: false, scores: localScores() };
  }
}

/**
 * Records a finished game. Always writes locally; additionally submits to
 * the shared board when it's reachable.
 *
 * @returns {Promise<{online, rank, improved, scores}|null>}
 */
export async function recordScore(score, level = 1) {
  const name = getPlayer();
  if (!name || !Number.isFinite(score) || score <= 0) return null;

  const local = recordLocal(name, score, level);

  try {
    const data = await callApi({
      method: "POST",
      body: JSON.stringify({ playerId: getPlayerId(), name, score: Math.round(score), level }),
    });
    return {
      online: true,
      rank: data.rank ?? -1,
      improved: data.improved ?? true,
      scores: normalise(data.scores),
    };
  } catch {
    return local; // the shared board is unreachable; the local one still has it
  }
}
