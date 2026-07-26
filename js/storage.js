/**
 * storage.js — localStorage that can't throw.
 *
 * Safari in private mode, and Node when the tests run, either don't have
 * localStorage or refuse to write to it. Everything funnels through here
 * so the rest of the code never has to care.
 */

const memory = new Map();

/**
 * The real store, or null if we should use the in-memory map instead.
 *
 * "Does `localStorage` exist" isn't enough of a test: Node defines a stub
 * object whose methods are missing unless you launch it with a storage
 * file, and reading through that would quietly bypass the fallback. So we
 * check that it actually behaves like a store, once, and cache the answer.
 */
let resolved;

function backing() {
  if (resolved !== undefined) return resolved;

  resolved = null;
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage &&
      typeof localStorage.getItem === "function" &&
      typeof localStorage.setItem === "function"
    ) {
      // a real write is the only honest proof it works
      const probe = "__blockdrop_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      resolved = localStorage;
    }
  } catch {
    resolved = null; // private mode, disabled storage, or a hostile stub
  }
  return resolved;
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

export function readString(key, fallback = "") {
  try {
    const store = backing();
    const raw = store ? store.getItem(key) : memory.get(key);
    return typeof raw === "string" ? raw : fallback;
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

/** Reads JSON, falling back on anything malformed rather than throwing. */
export function readJson(key, fallback = null) {
  const raw = readString(key, "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    write(key, JSON.stringify(value));
  } catch {
    /* circular or too large — nothing sensible to do but skip it */
  }
}

/** Forgets a key entirely. Tests use this to isolate from each other. */
export function remove(key) {
  memory.delete(key);
  try {
    backing()?.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}
