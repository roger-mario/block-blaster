/**
 * api/scores.js — the shared leaderboard.
 *
 * A Vercel serverless function. Vercel turns anything in /api into a
 * function automatically, so the rest of the project stays a static site
 * with no build step.
 *
 * Storage is Upstash Redis over its REST API, called with plain `fetch` —
 * no npm package, so the project still has zero runtime dependencies.
 * Two keys:
 *
 *   blockdrop:scores    sorted set, member = playerId, score = best score
 *   blockdrop:players   hash,       field  = playerId, value = {name, level, at}
 *
 * A sorted set is what Redis has instead of "leaderboard": ZADD with the GT
 * flag only ever raises a member's score, so a worse game can never
 * overwrite someone's best, even if two requests race.
 *
 * If the database env vars aren't set the route answers 503 with
 * `online: false`, which the client treats as "use the local board" rather
 * than as an error. That means the game works before you've connected a
 * database, and keeps working if it ever goes down.
 *
 * ---------------------------------------------------------------------------
 * SETUP (once, in the Vercel dashboard):
 *   Storage -> Marketplace -> Upstash for Redis -> create a free database
 *   and connect it to this project. That injects the two env vars below.
 * ---------------------------------------------------------------------------
 */

const SCORES_KEY = "blockdrop:scores";
const PLAYERS_KEY = "blockdrop:players";

const MAX_NAME_LENGTH = 14;
const MAX_ROWS = 25;
const MAX_SCORE = 10_000_000; // a sanity ceiling, not an anti-cheat measure
const MAX_LEVEL = 10;

// The Upstash Vercel integration sets KV_* names; a manual setup usually
// uses UPSTASH_*. Accept either so both paths work.
function credentials() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Runs a list of Redis commands in one round trip. */
async function pipeline(creds, commands) {
  const response = await fetch(`${creds.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`upstash responded ${response.status}`);
  }

  const results = await response.json();
  if (!Array.isArray(results)) throw new Error("unexpected pipeline response");

  return results.map((entry) => {
    if (entry && entry.error) throw new Error(entry.error);
    return entry ? entry.result : null;
  });
}

// ---------- validation ----------

/** Same rules as the client, applied again here — never trust the caller. */
export function cleanName(raw) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function validId(raw) {
  return typeof raw === "string" && /^[0-9a-f-]{8,64}$/i.test(raw);
}

export function validSubmission(body) {
  if (!body || typeof body !== "object") return null;

  const name = cleanName(body.name);
  const playerId = body.playerId;
  const score = Number(body.score);
  const level = Number(body.level);

  if (!name) return null;
  if (!validId(playerId)) return null;
  if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) return null;

  return {
    name,
    playerId,
    score: Math.round(score),
    level: Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(1, Math.round(level))) : 1,
  };
}

// ---------- reading ----------

/**
 * ZRANGE ... WITHSCORES comes back flat: [member, score, member, score, …].
 * HGETALL likewise: [field, value, field, value, …].
 */
function pairsToMap(flat) {
  const map = new Map();
  if (!Array.isArray(flat)) return map;
  for (let i = 0; i + 1 < flat.length; i += 2) map.set(flat[i], flat[i + 1]);
  return map;
}

export function buildBoard(rankedFlat, playersFlat) {
  const players = pairsToMap(playersFlat);
  const board = [];

  for (let i = 0; i + 1 < rankedFlat.length; i += 2) {
    const playerId = rankedFlat[i];
    const score = Number(rankedFlat[i + 1]);
    if (!Number.isFinite(score)) continue;

    let meta = {};
    try {
      meta = JSON.parse(players.get(playerId) ?? "{}") ?? {};
    } catch {
      meta = {}; // a corrupt record shouldn't take the whole board down
    }

    board.push({
      playerId,
      name: cleanName(meta.name) || "anon",
      score: Math.round(score),
      level: Number.isFinite(meta.level) ? meta.level : 1,
      at: Number.isFinite(meta.at) ? meta.at : 0,
    });
  }
  return board;
}

async function readBoard(creds, limit) {
  const [rankedFlat, playersFlat] = await pipeline(creds, [
    ["ZRANGE", SCORES_KEY, "0", String(limit - 1), "REV", "WITHSCORES"],
    ["HGETALL", PLAYERS_KEY],
  ]);
  return buildBoard(rankedFlat ?? [], playersFlat ?? []);
}

// ---------- handler ----------

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const creds = credentials();
  if (!creds) {
    // Not an error the player should ever see — the client falls back.
    return response.status(503).json({
      online: false,
      reason: "no database configured",
      scores: [],
    });
  }

  const limit = Math.min(MAX_ROWS, Math.max(1, Number(request.query?.limit) || MAX_ROWS));

  try {
    if (request.method === "GET") {
      return response.status(200).json({ online: true, scores: await readBoard(creds, limit) });
    }

    if (request.method === "POST") {
      const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      const entry = validSubmission(body);
      if (!entry) {
        return response.status(400).json({ online: true, error: "invalid submission" });
      }

      // What's already on record for this player?
      const [existingScore, existingMeta] = await pipeline(creds, [
        ["ZSCORE", SCORES_KEY, entry.playerId],
        ["HGET", PLAYERS_KEY, entry.playerId],
      ]);

      const previous = Number(existingScore);
      const improved = !Number.isFinite(previous) || entry.score > previous;

      let meta = {};
      try {
        meta = JSON.parse(existingMeta ?? "{}") ?? {};
      } catch {
        meta = {};
      }

      // The name always follows the latest submission, so renaming works.
      // The level belongs to their *best* run, so it only moves on an
      // improvement.
      const record = {
        name: entry.name,
        level: improved ? entry.level : (Number.isFinite(meta.level) ? meta.level : entry.level),
        at: improved ? Date.now() : (Number.isFinite(meta.at) ? meta.at : Date.now()),
      };

      // GT means this can only ever raise the stored score. Two devices
      // submitting at once can't clobber each other.
      const [, , rankedFlat, playersFlat] = await pipeline(creds, [
        ["ZADD", SCORES_KEY, "GT", String(entry.score), entry.playerId],
        ["HSET", PLAYERS_KEY, entry.playerId, JSON.stringify(record)],
        ["ZRANGE", SCORES_KEY, "0", String(limit - 1), "REV", "WITHSCORES"],
        ["HGETALL", PLAYERS_KEY],
      ]);

      const scores = buildBoard(rankedFlat ?? [], playersFlat ?? []);
      const rank = scores.findIndex((row) => row.playerId === entry.playerId);

      return response.status(200).json({
        online: true,
        improved,
        rank: rank === -1 ? -1 : rank + 1,
        scores,
      });
    }

    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ online: true, error: "method not allowed" });
  } catch (error) {
    // Treated as "offline" by the client, so a database wobble costs the
    // player nothing but the shared board.
    return response.status(502).json({
      online: false,
      reason: String(error?.message ?? error),
      scores: [],
    });
  }
}
