/**
 * storage.js — localStorage that can't throw.
 *
 * Safari in private mode, and Node when the tests run, either don't have
 * localStorage or refuse to write to it. Everything funnels through here
 * so the rest of the code never has to care.
 */

const memory = new Map();

function backing() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* access itself can throw in locked-down browsers */
  }
  return null;
}

export function readNumber(key, fallback = 0) {
  try {
    const store = backing();
    const raw = store ? store.getItem(key) : memory.get(key);
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  memory.set(key, String(value));
  try {
    backing()?.setItem(key, String(value));
  } catch {
    /* quota or private mode — the in-memory copy still works this session */
  }
}
