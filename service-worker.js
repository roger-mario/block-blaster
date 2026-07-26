/**
 * service-worker.js — offline support.
 *
 * Strategy: network-first, falling back to cache.
 * This matters for your workflow: after you push an update to GitHub and
 * Vercel redeploys, you'll get the new version immediately instead of a
 * stale cached one. Offline still works via the fallback.
 *
 * Bump CACHE_VERSION whenever you add or rename a file below.
 */

const CACHE_VERSION = "blockdrop-v0.1.0";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./css/styles.css",
  "./js/main.js",
  "./js/config.js",
  "./js/emitter.js",
  "./js/pieces.js",
  "./js/difficulty.js",
  "./js/scoring.js",
  "./js/storage.js",
  "./js/dealer.js",
  "./js/leaderboard.js",
  "./js/menu.js",
  "./js/game.js",
  "./js/solver.js",
  "./js/dom.js",
  "./js/render.js",
  "./js/effects.js",
  "./js/input.js",
];

self.addEventListener("install", (event) => {
  // cached one at a time: addAll() throws the whole install away if a
  // single file 404s, which would silently kill offline support.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // The leaderboard must never be served from cache — a stale board would
  // look like the live one. Let it go straight to the network; the client
  // already falls back to the on-device board if it fails.
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
