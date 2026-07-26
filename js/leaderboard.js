/**
 * leaderboard.js — who's been playing, and how well.
 *
 * Scores live in localStorage on this device. That's a deliberate choice:
 * the whole game is a static site with no backend, so there's nowhere to
 * put a shared table without signing up for a database and wiring
 * credentials into the deploy.
 *
 * Everything a remote leaderboard would need is behind this module's four
 * functions, so swapping localStorage for `fetch("/api/scores")` later is
 * a change to this file and nothing else.
 *
 * The name is asked for once and remembered, so it never gets in the way
 * again. No name means the game just doesn't record — never a blocking
 * prompt.
 */

import { LEADERBOARD_KEY, PLAYER_KEY, LEADERBOARD_SIZE } from "./config.js";
import { readJson, writeJson, readString, write } from "./storage.js";

export const MAX_NAME_LENGTH = 14;

/**
 * Tidies a name: no control characters, no angle brackets, no runs of
 * whitespace, and short enough to fit the table.
 *
 * Names always reach the page through `textContent`, so this is about
 * keeping the layout sane rather than about escaping.
 */
export function cleanName(raw) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

// ---------- the remembered player ----------

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

// ---------- the table ----------

function normalise(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      name: cleanName(e.name),
      score: Number.isFinite(e.score) ? Math.max(0, Math.round(e.score)) : 0,
      level: Number.isFinite(e.level) ? e.level : 1,
      at: Number.isFinite(e.at) ? e.at : 0,
    }))
    .filter((e) => e.name.length > 0 && e.score > 0);
}

export function getScores() {
  return sortEntries(normalise(readJson(LEADERBOARD_KEY, [])));
}

function sortEntries(entries) {
  return entries.sort((a, b) => b.score - a.score || a.at - b.at);
}

/**
 * Records a result under `name`, keeping only that player's personal best
 * so one person can't fill the whole table with their last ten games.
 *
 * @returns {{rank:number, entries:Array, improved:boolean}|null}
 */
export function submitScore(name, score, level = 1, now = Date.now()) {
  const clean = cleanName(name);
  if (!clean || !Number.isFinite(score) || score <= 0) return null;

  const entries = getScores();
  const existing = entries.find((e) => e.name.toLowerCase() === clean.toLowerCase());

  let improved = true;
  if (existing) {
    if (score <= existing.score) {
      improved = false;
    } else {
      existing.score = Math.round(score);
      existing.level = level;
      existing.at = now;
    }
  } else {
    entries.push({ name: clean, score: Math.round(score), level, at: now });
  }

  const kept = sortEntries(entries).slice(0, LEADERBOARD_SIZE);
  writeJson(LEADERBOARD_KEY, kept);

  const rank = kept.findIndex((e) => e.name.toLowerCase() === clean.toLowerCase());
  return { rank: rank === -1 ? -1 : rank + 1, entries: kept, improved };
}

/** Where this score *would* land, without recording it. */
export function rankFor(score) {
  const entries = getScores();
  const better = entries.filter((e) => e.score >= score).length;
  return better + 1;
}

export function clearScores() {
  writeJson(LEADERBOARD_KEY, []);
}
