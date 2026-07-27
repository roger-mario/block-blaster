# Changelog

All notable changes to Block Drop. Newest first.

The version shown in the game comes from `APP_VERSION` in `js/config.js` —
bump that, add an entry here, and bump `CACHE_VERSION` in
`service-worker.js` so returning players get the new files.

---

## 0.2.0 — 2026-07-27

The visual framework. Five separate animation categories, each on its own
rotation, all planned in [ANIMATION-STRATEGY.md](ANIMATION-STRATEGY.md) —
read that first; this is just what got built.

### Added

- **Line-clear animations, tiered and rotating** (`js/celebrations.js`).
  Six of them. A single line always gets the plain `shatter`, so the
  others have something to be measured against; a double unlocks
  `shockwave`, `ember` and `cascade`; a triple or better also unlocks
  `prism` and `nova`. Consecutive big clears cycle rather than repeat.
  A counter drives it, not a random roll, so the same run of clears always
  gives the same run of animations.

- **Board-clear animations** — `bloom`, `starburst`, `implode`, rotating.
  Emptying the whole board is the rarest thing in a game, so it gets its
  own category on top of the line clear. **Locked below level 2**: doing
  it by accident on a nearly empty board hasn't earned the best animation
  in the game.

- **Scenery that advances on level up** (`js/sceneries.js`). Ten
  backgrounds, one per level, so reaching level 7 *looks* like level 7 —
  the only visual proof you got further than last time. Cross-fades in,
  and announces itself.

- **Block surfaces** (`js/themes.js`). Blocks are made of something now,
  not just coloured: `gloss` (glass), `candy` (fat soft highlight), `gem`
  (cut facets) and `bubble` (specular dot and a lit rim). One per theme.

- `ANIMATION-STRATEGY.md` — the plan, the rules, and the ideas not built
  yet. Update it first, then build.

- **Rotating themes** (`js/themes.js`, `js/scenery.js`). Four looks, each
  with its own palette, corner shape and block surface, picked from the
  **calendar** — the same for everyone on the same day, holding for three
  days. A "new look" notice fires once per rotation.

### Changed

- **The tray and the toolbar sit with the board.** The tray used to be
  pinned to the bottom of the phone with a dead strip between it and the
  grid; now the toolbar, board and tray are one group, 8–10px apart, with
  the spare height split above and below them. A hairline above the
  toolbar marks off the play area.
- **No hard edges anywhere.** The scenery is masked with a soft radial
  falloff, overhangs the viewport so no blurred layer ever shows a
  boundary, and every blob has a second falloff of its own. Every theme's
  block corners were raised to at least 8px — Neon's used to be 2px.
- **The theme picker is gone.** The look is something the game does on a
  schedule and the scenery is a reward for progress; a picker turned both
  into settings, and then nobody would ever see the other nine. The menu
  reports what's on and when it changes instead.
- The dealer takes block colours from the active theme.

### Fixed

- A celebration that throws now falls back to the plain shatter instead of
  drawing nothing — a clear that skips its animation looks like the game
  missed a beat.
- The service worker no longer registers on localhost. It cached modules
  during development and served stale ones to a freshly loaded page, which
  cost an hour of chasing an effect that silently did nothing.

### Notes

- All of it is frozen or cut short under **Reduce Motion**: the scenery
  stops drifting but stays visible, every ring and ray is dropped, and the
  block animations run for a quarter of a second.

---

## 0.1.0 — 2026-07-26

A pass over everything the player actually touches: the assists are gone,
replaced by three one-shot lifelines, and the screen has been rebalanced
around the board.

**Rolling back:** the previous release is pinned on the
`release/v0.0.4` branch. Easiest route is Vercel → Deployments → the
0.0.4 build → **Instant Rollback**; see
[Going back a version](README.md#going-back-a-version) in the README for
the git routes.

### Added

- **Three lifelines, one use each per game** — in the spirit of the quiz
  show, and deliberately not interchangeable:
  - **↩ Rewind** takes back your last move. Levels 1–5 only; above that
    you live with your mistakes.
  - **🔀 Shuffle** re-deals the pieces still in your tray. Any level. It
    only refills the slots you haven't used, so shuffling with one piece
    left hands you one piece, not a fresh three.
  - **💥 Wipe** clears the whole board. Level 5 and up, where Rewind runs
    out and a filling board starts to bite. It scores nothing — it's a
    rescue, not a clear.
- Each lifeline is a single icon button with a tooltip that says what it
  does, and — once it's spent or locked — why you can't use it. The
  tooltip shows on hover, on keyboard focus, and for a moment after a tap,
  so it isn't hover-only trivia on a phone.
- A locked lifeline is still tappable: tapping it is how you find out
  what's wrong with it. Spent ones stay on screen, crossed out, so you can
  see what you've already burned.
- The Game Over screen offers whichever lifelines you have left as a
  **second chance** — a wipe or a shuffle can pull you back out of a dead
  end, not just a rewind.

### Changed

- **The layout is rebalanced.** The tray no longer stretches to fill the
  screen, which is what left that long dead strip along the bottom. It's a
  fixed height now, the header has more room to breathe, and the board
  takes the space that's left and sits centred in it. Tray pieces are drawn
  a little larger — they're what you have to grab.
- **Dragging is the only way to place a piece.** Tap-to-place and its
  on-screen instructions are gone; the gesture was never in any doubt.
- **The header shows the level, not the score multiplier.** The multiplier
  was a number you couldn't act on.
- **The menu is the leaderboard.** The live stats table and the
  piece-odds breakdown are gone, and "How to play" is two lines instead of
  a manual.

### Removed

- The three-assist pool, and the **hint** system with it. (`solver.js`
  stays — it's still reachable from the console as
  `blockdrop.findBestPlacement(blockdrop.game)`, and it's still tested.)
- `game.snapOrigin()` and `game.centerOrigin()`, the tap-to-place
  arithmetic, along with `FX.snapRadius`.

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
