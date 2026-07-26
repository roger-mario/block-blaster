# Changelog

All notable changes to Block Drop. Newest first.

The version shown in the game comes from `APP_VERSION` in `js/config.js` —
bump that, add an entry here, and bump `CACHE_VERSION` in
`service-worker.js` so returning players get the new files.

---

## 0.0.4 — 2026-07-26

### Added

- **Shared online leaderboard.** Scores now go to a leaderboard everyone
  playing the deployed game can see, not just your own device.
  - New serverless route `api/scores.js`, backed by Upstash Redis over its
    REST API with plain `fetch` — the project still has zero runtime
    dependencies.
  - Each browser mints a random UUID on first play and the board is keyed
    on that, so your best score is always kept and nobody can overwrite it
    by typing your name. (Browsers cannot read a MAC address or any other
    hardware id — that's blocked for privacy, so a stored UUID is the
    standard substitute.)
  - Redis `ZADD ... GT` means a stored score can only ever go up, even if
    two devices submit at the same moment.
  - The menu shows whether you're looking at the shared board
    (**everyone**) or the local one (**this device**), and the Game Over
    screen says `#3 worldwide` rather than `on this device` when it's live.
  - Falls back silently to the on-device board when the shared one can't
    be reached, and always writes locally as well, so nothing is lost to a
    dropped connection.

- `CHANGELOG.md` — this file.

### Changed

- **Dragging feels much faster.** The piece now tracks your finger
  without the lag it had:
  - The dragged piece moves with `transform` instead of `left`/`top`, so
    following your finger costs no layout or paint.
  - Pointer moves are batched into one update per animation frame rather
    than one per event — on a 120Hz screen that was several times the work
    per frame.
  - The board preview is only redrawn when the piece crosses into a
    different square, not on every pointer move.
  - `clearPreview()` now only touches the cells it actually marked instead
    of sweeping all 64 squares every update.
  - The board's position is measured once per drag instead of on every
    frame.
  - Pointer capture keeps a drag alive if your finger leaves the window.
- The piece no longer floats above a **mouse** cursor — that lift only
  makes sense for a fingertip. Touch lift reduced 70px → 58px.
- A picked-up piece pops in and sits slightly larger (`FX.dragScale`).
- Drag threshold reduced 10px → 8px, so a drag starts a touch sooner
  while taps still register as taps.

### Fixed

- The leaderboard's name-matching now uses the player id rather than the
  name, so renaming yourself no longer creates a second row.

---

## 0.0.3 — 2026-07-26

### Added

- **Burger menu** with four sections: leaderboard, this-game stats, a live
  "pieces right now" odds table, and how to play.
- **Leaderboard** (on-device at this point). Name asked once and
  remembered; every finished game recorded silently; personal best only.
- **Version stamp** in the corner of the page and in the menu.
- Per-game stats: pieces placed, best combo, perfect clears.

### Changed

- **Every shape now owns an appearance curve** (`from` / `peak` / `fade` /
  `floor` / `weight`) instead of levels having a single "hardest shape
  allowed" ceiling. A ceiling only grows the grab-bag, which is why single
  squares still turned up constantly at level 10 and the 5-bars almost
  never did.
  - Dots are under 12% of level-1 draws and never dominate.
  - 5-bars arrive at level 4 with the highest weight in the game.
  - S, Z and the 3×3 stay under 20% of draws even at level 10.
  - Average piece size grows 2.4 → 4.2 cells across the ladder.
- **New board-aware dealer** (`js/dealer.js`). It reads the board, not just
  the level: pieces that fit are strongly preferred, pieces that can finish
  a line right now more so, duplicates within a tray are damped, and a tray
  where nothing fits is never dealt. If nothing dealt can clear a line, one
  slot is swapped for one that can — odds set by level and raised by how
  full the board is.
  - This is fairness, not easy mode: over 300 auto-played games, disabling
    the rescue entirely moves the median game from 338 moves to 311.

### Fixed

- `storage.js` now feature-detects `localStorage` properly. Node ships a
  stub whose methods don't exist, which was silently bypassing the
  in-memory fallback.
- Deleted four dead duplicate source files at the repo root.

---

## 0.0.2 — 2026-07-26

### Added

- **Tap to place.** Tap a piece to pick it up, tap the board to drop it.
  Dragging still works exactly as before; the two are told apart by
  distance. A tap centres the piece on the square you touched and snaps to
  the nearest legal spot if that exact one won't fit.
- **Ten difficulty levels**, driven by total lines cleared rather than
  score, each with its own score multiplier (0.6× at level 1, 3.5× at
  level 10).
- **Bonus scoring**: cross clear, perfect clear, flawless tray, level-up.
  Multi-line clears scale with lines², combos add 50% a step up to ×5.5.
- **Undo**, sharing one pot of three assists with hints. Goes back exactly
  one move, and works from the Game Over screen.
- First test suite — 73 tests on Node's built-in runner, no dependencies.

### Fixed

- The service worker cached assets with `addAll()`, so a single missing
  file (the icons, which don't exist) threw away the entire offline
  install. Each asset is now cached individually.
- The Undo button's blue was losing a CSS specificity fight with the
  shared `#assists button` rule.

---

## 0.0.1

Initial version: 8×8 board, drag and drop, line clears, combos, hints,
particle effects and offline support.
