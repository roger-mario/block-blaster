/**
 * emitter.js — a minimal publish/subscribe helper.
 *
 * This is what keeps the modules independent: the Game announces what
 * happened ("a line cleared"), and the visual/audio modules listen.
 * Adding sound later means writing one new file that subscribes here —
 * no changes to the game logic at all.
 */

export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    // copy first, so a handler can safely unsubscribe during dispatch
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`Handler for "${event}" failed:`, err);
      }
    }
  }
}
