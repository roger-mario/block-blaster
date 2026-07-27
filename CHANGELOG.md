# Changelog

All notable changes to Block Drop. Newest first.

The version shown in the game comes from `APP_VERSION` in `js/config.js` —
bump that, add an entry here, and bump `CACHE_VERSION` in
`service-worker.js` so returning players get the new files.

---

## 0.4.1 — 2026-07-27

Three changes from playing 0.4.0. Still only about which pieces you get —
plus one new lifeline that buys you worse ones on purpose.

### Added

- **Challenge rounds.** Every twentieth tray, the dealer stops being the
  one for your level and becomes the one from the top of the ladder:
  generosity drops to its floor, and the free rescue gets stingier — half
  of the way to level 20's odds, not all of it, for the reason in the
  Joker notes below.

  The line it never crosses is solvability. Any tray dealt under challenge
  has its sequence guarantee forced to certain, so a challenge round is
  always hard *and* always playable to the end — a tray you have to think
  about, never a tray you can't play. Two smaller decisions: the first
  tray of a game is never one (no board yet, so nothing to make hard), and
  a Shuffle re-deals on the same terms, or a challenge would last exactly
  as long as it takes to press one button.

  It's announced with a badge. That isn't decoration — an unexplained bad
  hand reads as the game being unfair, and the same hand labelled reads as
  the game asking something of you.

- **🃏 Joker — a fourth lifeline, and the only one that makes the game
  harder.** Available up to level 5, once per game. Play it and every
  point doubles, while the dealer starts handing you the pieces level 20
  would get. It runs until you reach level 6, which is also when the
  button disappears.

  It ends there rather than lasting the game on purpose: a permanent
  doubling would turn every leaderboard score into a question of whether
  you remembered to press a button in the first two minutes, which isn't a
  skill. Scoped to the slow opening levels, it's a real decision about a
  real risk.

  Two details that matter more than they sound: the boost is applied
  *after* rounding, so "double points" is exactly double rather than
  `round(0.6) = 1` twice over; and playing it re-deals the tray you're
  holding, so you can't bank three gentle pieces at double value before
  the downside arrives. While it runs the button stays lit and pulsing
  instead of greying out like a spent lifeline — it's spent, but it is
  very much still doing something.

  **It took two goes to make it a gamble rather than a trap**, and both
  mistakes were only visible in simulation:

  - Dragging the *rescue* odds down with everything else made the opening
    **slower**, not harder — you climb the ladder on lines cleared, so
    halving how often a line-finisher turns up costs you tempo rather
    than demanding skill. 100 moves to reach level 6 against 90 without
    the Joker, while also scoring less: strictly worse in every
    direction. A challenge now only half-lands on that dial.
  - Dragging the *reward* pulls down took whole-board clears from 1.54 a
    game to 0.18. A sparse board is an opening-levels phenomenon, and the
    Joker covers exactly that window — so it wasn't adding difficulty, it
    was deleting the best moment in the game.

  With difficulty confined to the one dial it belongs on — how hard the
  dealer works to improve your board — the Joker measures **+16% median
  score** (41,040 against 35,258 over 50 games each), at the cost of most
  of your whole-board clears: harder pieces leave a messier board, and a
  messy board is never sweepable. That's a legible trade, which is what a
  gamble should be.

### Fixed

- **The opening was a flood of one- and two-cell pieces**, and the cause
  turned out to be a bug in the dealer's judgement rather than a taste in
  the curve.

  Board health rewards how much space is left. That's right for comparing
  two boards and quietly wrong for comparing two *pieces*: a 5-cell piece
  was charged five cells of "damage" for doing five cells of work while a
  single square was charged one. The dealer wasn't preferring small pieces
  because they're good — it was preferring them because of an accounting
  error, and the level-1 bias of +5 amplified it.

  `DEALER.substance` gives back a credit per cell placed, set just above
  `health.room` so the correction lands on the side of pieces that get
  something done. Alongside it the curve was rebalanced: the single square
  and the dominoes are much rarer, and the 2×2 and both 4-bars now arrive
  at level 1 so the opening has something substantial to draw instead of a
  third domino.

  Measured over real games:

  | At level 1 | 0.4.0 | 0.4.1 |
  |---|---|---|
  | pieces of 1–2 cells | 69% | **7%** |
  | average piece | 2.01 cells | **3.61 cells** |
  | single squares | 31% of draws | **0.6%** |

- Together with the challenge rounds this is a net *increase* in
  difficulty, not a softening — and more whole-board clears at the same
  time. Same 60-game auto-play harness as 0.4.0, same seeds:

  | | 0.4.0 | 0.4.1 |
  |---|---|---|
  | median moves per game | 818 | **677** |
  | median level reached | 16 | 15 |
  | perfect clears per game | 1.07 | **1.53** |
  | games that saw one | 48% | **67%** |

  The opening is quicker, the rest of the ladder bites harder, and the
  best moment in the game happens more often. Still zero dead trays, and
  every sampled tray playable to the end.

---

## 0.4.0 — 2026-07-27

One subject only: **which three pieces you get, and why**. Nothing else in
the game moved — no new visuals, no rules changes, no scoring changes.

The full reasoning is in the new **`DEALER-STRATEGY.md`**. Read that before
touching `js/dealer/`.

### Changed

- **There are no easy or hard pieces any more.** Every shape used to carry
  a `difficulty` rating, and the dealer's job was to roll the level's dice
  and hand out more of the hard ones as you climbed. That model is wrong
  in a way you can feel: a 5-bar is the best piece in the game when a row
  is three from complete and a disaster when your empty space is four
  separate pockets. Same piece, opposite value, and the only thing that
  changed was the board.

  So the board is now the primary input. Every unlocked shape is scored
  against the grid in front of you — where it can go, how healthy a board
  its best placement leaves behind, what it can clear, whether it moves
  you toward emptying the whole thing — and the level curve from
  `pieces.js` has been demoted to a background prior that nudges the mix
  for variety and pacing.

- **Difficulty is now how hard the dealer works for you, not what it's
  allowed to reach for.** A single `generosity` dial runs from 1.0 at
  level 1 to 0.12 at level 20. At the bottom the dealer actively hunts for
  the pieces that leave your board in the best shape; around level 10 it's
  indifferent; at the top it stops doing you favours. It is deliberately
  never as spiteful as it is generous — in a game with no rotation, a
  dealer that always hands over the single worst piece isn't difficult,
  it's rigged. The board is what gets harder, because the dealer stops
  tidying it for you.

- **The rescue dial is kept separate from the difficulty dial.** The
  clearing bonus never inverts, at any level, so a late board is hard to
  *manage* rather than hard to *escape*.

- **Trays are composed, not rolled.** The three slots are drawn one at a
  time, and after each pick the board is advanced to how it would look if
  that piece were played well — so the next slot is chosen against *that*.
  That single rule is where combos come from: the dealer can hand you a
  piece that sets a row up and a second piece that finishes it.

### Added

- **A whole-board clear is something the game now offers you.** The dealer
  works out which rows and columns would, if they cleared, empty the board
  outright. When that cover is small enough to be real, it prefers pieces
  that finish those exact lines — and pays a large bonus to any piece that
  can sweep the board in one move. The size of that nudge fades as you
  climb, so a perfect clear is handed to you early and earned late.

  Auto-playing 60 games with the solver, same seeds, before and after:

  | | 0.3.0 | 0.4.0 |
  |---|---|---|
  | games that saw a perfect clear | 5% | **48%** |
  | perfect clears per game | 0.05 | **1.07** |
  | median moves per game | 464 | 818 |
  | median lines cleared | 213 | 396 |
  | median level reached | 12 | 16 |

- **A tray you can't play out is now impossible at the levels that promise
  it.** The old check asked whether each piece fit the board as it stood —
  which misses the piece that fits today and has nowhere to go once the
  first one is down. The dealer now searches the tray for an order in
  which all three can actually be placed, and swaps slots until it finds
  one. The guarantee is level-scaled (certain early, about 58% at level
  20); the older "at least one piece fits" floor is still on at all 20
  levels, so a completely dead hand remains impossible.

- **13 new shapes**, taking the vocabulary from 26 to 39. A board-aware
  dealer gets *better* with more shapes, not worse — a bigger vocabulary
  means a better chance something in the pool is exactly what this board
  needs.

  - the eight **L/J tetrominoes** (`jay-*`, `hook-*`) — a 3-bar with a nub,
    the best "fill an awkward corner" piece there is, and the game somehow
    didn't have it
  - **`plus`**, for the cross-shaped pocket nothing else reaches
  - **`diag-2a/b`** and **`diag-3a/b`** — cells that don't even touch. Late,
    rare, and occasionally the only thing that fits two separated holes.

- **The dealer is its own component**, `js/dealer/`: `board.js` reads a
  grid, `placement.js` knows where things go, `evaluate.js` scores a shape
  against a board, `compose.js` builds the tray, `dials.js` holds the two
  difficulty knobs. Every one is a pure function over a plain array — no
  `Game`, no DOM — so a new dealer idea can be tested in seconds. This is
  the part of the game most likely to be rewritten again, and it's now
  shaped for that.

- 30 new tests covering the component, and a `DEALER-STRATEGY.md` that
  records what was considered and what was parked.

### Fixed

- 5-bars were quietly diluted by the bigger shape vocabulary; their weight
  was raised to keep them as common as they were. The test that guards
  this now measures against an even share rather than a fixed percentage,
  so it can't silently pass the next time shapes are added.

---

## 0.3.0 — 2026-07-27

Straight from player feedback.

### Changed

- **A whole new look on every level and every board clear.** The old split
  — blocks on a three-day calendar, background on your level — is gone.
  The calendar was the wrong hook: it changes the game while you *aren't*
  playing, so you never see it happen, and it has nothing to do with how
  you're doing.

  One cycle now, **20 looks** (`js/looks.js`), and each advance changes
  everything at once: the palette, the **shape** of the blocks, the
  surface they're made of, and the background. A small shift reads as a
  rendering glitch; the point is that you look up and the game is
  somewhere else. There's a test that fails a look which differs from its
  neighbour in fewer than three of those four.

- **Blocks are made of different things, but always rounded squares.**
  Six surfaces — `gloss`, `candy`, `gem`, `bubble`, `matte`, `neon` —
  change what a block appears to be *made of* without touching its
  silhouette.

  Varying the silhouette as well (hexagons, diamonds, capsules) was built
  during this release and pulled before shipping. It fought the clear
  animations, which draw rounded squares whatever the look — a hexagon
  board dissolving into square debris reads as a bug — and with the
  palette and the whole background already changing, it was one change too
  many rather than the one that sold it.

- **Twenty levels instead of ten**, and the rungs get further apart as you
  climb: 4 lines to reach level 2, 102 to get from 19 to 20. The first six
  levels are exactly where they were — the opening was never the problem.

- **Lifeline icons are emoji**: ⏪ Rewind and 🧹 Wipe. 🔀 Shuffle was
  already right and hasn't moved. Locked lifelines are no longer fully
  greyscaled either, which had turned them into unreadable smudges.

- The menu's **Look** section is gone. It reported information nobody
  needed.

### Added

- **Restart from the menu**, mid-game. You can tell a run is dead long
  before the game can.
- **A Leaderboard button on the Game Over screen**, next to Play Again.
  Finishing a game is exactly the moment you care where you placed, and
  the only thing on offer was starting another one.

### Fixed

- **Dragging is smooth again.** v0.2.0 put a half-second
  `transition` on every cell so a look change would glide. The drag
  preview *is* a `box-shadow`, so every square you dragged across took
  500ms to light up and another 500ms to fade — the gesture visibly
  smeared along behind your finger. The slow transitions now only exist
  for the length of an actual look swap. Measured: cell transition is
  `none` during play, `0.55s` during a swap.
- The dragged piece no longer carries a `filter: drop-shadow`, which was
  re-rasterising the whole group every frame it moved. The blocks inside
  carry their own `box-shadow` instead, which the compositor just moves.

### Removed

- `js/themes.js` and `js/sceneries.js`, replaced by `js/looks.js`.
- The three-day theme rotation, the "new look on your first visit today"
  notice that came with it, and the stored theme preference.

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
