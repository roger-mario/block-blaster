# Block Drop

**v0.1.0** — see [CHANGELOG.md](CHANGELOG.md)

A block-puzzle game that runs in the browser, installs to your iPhone home
screen, and costs nothing to host. No Xcode, no Apple developer fee, no
build step.

The version is stamped in the bottom-right corner of the page and at the
foot of the menu. It lives in one place — `APP_VERSION` in
`js/config.js` — so bump that and the service-worker cache name when you
ship.

---

## Running it locally

The code is split into ES modules, which browsers refuse to load from a
`file://` path. So **double-clicking `index.html` will show a blank page.**
Start a tiny local server instead:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Any static server works — `npx serve`,
VS Code's Live Server extension, etc.)

On the live Vercel/Netlify URL this isn't an issue at all; it only affects
opening files directly off your disk.

## Running the tests

The rules modules never touch the DOM, so they run straight under Node's
built-in test runner. No dependencies to install:

```bash
npm test
```

That covers the board rules, the difficulty ladder, the whole scoring
system, the three lifelines and what a drop is allowed to do.

---

## Going back a version

Every release is tagged, so any of them can be brought back:

```bash
git tag -l                 # v0.0.4, v0.1.0, …
```

- **In Vercel** — Deployments → pick the older build → **Instant
  Rollback**. The live URL points at it within seconds, and nothing in the
  repo changes.
- **In git** — `git revert -m 1 <merge-commit>` puts the previous version
  back as a new commit, which redeploys itself. To go back wholesale
  instead: `git checkout v0.0.4 -- .` on a branch, then push that.

---

## Deploying (one-time, ~10 minutes, free)

1. **GitHub** — create a free account and a new repo, e.g. `block-drop`.
   Upload this whole folder (keep the `js/` and `css/` subfolders intact).
2. **Vercel** — sign up at vercel.com with your GitHub account →
   **Add New Project** → pick the repo → **Deploy**. No configuration
   needed; it's a static site. You get a URL like `block-drop.vercel.app`.
3. From then on, **every push to the repo redeploys automatically** in
   about 30 seconds. Netlify works identically if you prefer it.

`package.json` exists only for the tests — there's no build script, so
Vercel serves the files exactly as they are.

### Put it on your home screen

Open the URL in **Safari** on your iPhone → Share → **Add to Home Screen**.
It gets its own icon, opens full-screen with no browser chrome, and works
offline.

---

## How the code is organised

Everything is plain JavaScript modules — no framework, no bundler, no
`npm install` needed to play. Each file has one job:

```
index.html          structure only
css/styles.css      all styling and keyframes
api/scores.js       the shared leaderboard (Vercel serverless function)
js/
  config.js         ← every tunable number lives here
  difficulty.js     the level 1→10 ladder (pure maths)
  scoring.js        every point the game awards (pure maths)
  pieces.js         the shapes and their appearance curves
  dealer.js         picks your next three, reading the board
  emitter.js        tiny publish/subscribe helper
  storage.js        localStorage that can't throw
  leaderboard.js    names and scores, shared board + local fallback
  game.js           all the rules. Never touches the DOM.
  solver.js         scores candidate moves (dev tool; see Debugging)
  dom.js            element references and pixel geometry
  render.js         draws game state onto the page
  effects.js        animations, particles, screen shake
  input.js          dragging a piece from the tray to the board
  menu.js           the burger menu panel
  main.js           wiring — connects game events to visuals
tests/              node --test suite, no dependencies
CHANGELOG.md        what changed in each version
service-worker.js   offline support + cache busting
```

### The important idea

`game.js` holds the rules and **emits events** describing what happened.
`main.js` listens and decides what the player sees:

```js
game.on("clear", (event) => {
  fx.playClearFx(event);          // particles, shake, floating score
  render.renderBoard(game.board); // redraw
});
```

This is what makes new features cheap. To add **sound**, you write one new
file that subscribes to the same events — and change nothing else:

```js
// js/sound.js
export function attachSound(game) {
  game.on("place", () => play("thud"));
  game.on("clear", ({ lines }) => play(lines > 1 ? "bigClear" : "clear"));
  game.on("levelup", () => play("fanfare"));
}
```

Then one line in `main.js`: `attachSound(game);`

The events available are `reset`, `place`, `clear`, `bonus`, `levelup`,
`comboBreak`, `score`, `tray`, `lifelines`, `undo`, `shuffle`, `wipe`,
`revive` and `gameover`.

---

## Features

### The screen

One column, and only the board flexes:

```
score · level · best      fixed height
progress bar
↩ 🔀 💥            ☰     the lifelines, fixed height
                          ← all the spare space ends up here,
[ board ]                    split above and below the board
                          ←
[ tray ]                  fixed height
```

The tray used to be `flex: 1`, which is what left a long dead strip along
the bottom of the screen: the pieces inside it are drawn at a fixed pixel
size, so the extra height was never used for anything. Now the tray and
everything above the board have fixed heights, `#board-wrap` takes what's
left, and the board sits centred in it. On a short screen the board shrinks
instead of colliding with the tray — that's the `calc(100dvh - 260px)`
term in its `width`.

### Placing a piece: drag it

Press a piece and drag it onto the board. That's the only gesture — there
is no tap-to-place, no mode to be in, and nothing to explain on screen.

- A press that never moves more than `FX.tapSlop` pixels (8 by default)
  isn't a shortcut for anything; it just puts the piece back.
- The landing spot is previewed live under the piece, and the whole line
  lights up when a drop would clear one.
- The drop is exact: where the piece's top-left corner sits is where it
  lands. Nothing snaps it somewhere you didn't aim.

#### Why dragging feels immediate

Dragging used to lag behind your finger. Four things fixed it, all in
`js/input.js` and `js/render.js`:

- The dragged piece moves with `transform`, not `left`/`top`. A transform
  is handled by the compositor, so following your finger costs no layout
  and no paint. Nothing transitions the transform — easing toward your
  finger is exactly what reads as lag.
- Pointer moves are batched into **one update per animation frame**. A
  120Hz screen delivers several moves per frame and each one used to do
  full DOM work.
- The landing preview is only redrawn when the piece crosses into a
  **different square**, not on every move.
- `clearPreview()` only touches the cells it actually marked, instead of
  sweeping all 64 squares every update.

Measured in the browser: 60 pointer moves that stay inside one square now
cause **2** class changes; eight moves that each cross a square cause
**31**. The old sweep-everything approach would have done at least 512.

The piece also no longer floats above a **mouse** cursor — that lift only
makes sense for a fingertip, which covers what it's holding.

### Difficulty: ten levels

Your level is driven by **total lines cleared**, not score — otherwise the
later multipliers would rocket you up the ladder without you playing any
better. Reaching a level changes two things at once:

| Level | Lines to reach | New arrivals | Points × |
|---|---|---|---|
| 1 | 0 | dot, dominoes, triples, corners | 0.60 |
| 2 | 4 | 2×2 square | 0.80 |
| 3 | 10 | 4-bars | 1.00 |
| 4 | 18 | **5-bars**, T-pieces | 1.25 |
| 5 | 28 | 2×3 rectangles | 1.50 |
| 6 | 40 | big L-pieces | 1.80 |
| 7 | 54 | S, Z and the 3×3 block | 2.20 |
| 8 | 70 | — | 2.60 |
| 9 | 88 | — | 3.00 |
| 10 | 108 | — | 3.50 |

The header shows the level and a bar filling toward the next one. The
multiplier itself isn't displayed — it's a number you can't act on, and
the level it comes from is right there.

#### Each shape has its own curve

A single "hardest shape allowed" number per level only ever grows the
grab-bag — you keep drawing single squares at level 10, and the pieces
that are actually fun stay buried. So every shape in `pieces.js` now owns
an appearance curve instead:

| Field | Meaning |
|---|---|
| `from` | first level it can appear at all |
| `peak` | level where it reaches full weight (it eases in before that) |
| `fade` | level it starts becoming rarer again |
| `floor` | how rare it gets once faded — never zero |
| `weight` | its pull relative to every other shape |

What that buys, measured over 20,000 draws per level in the tests:

- **Dots are no longer a flood.** Under 12% of level-1 draws, and they
  never dominate — but they never disappear either, because a single
  square is often the only way out of a tight board.
- **Dominoes and triples fade.** Everywhere at level 1, down past a
  quarter of their peak by level 10.
- **The 5-bars arrive at level 4 and stay generous** (`weight: 1.45`, the
  highest in the game). Half a row in one move is the most satisfying
  piece in the game and it was far too rare before.
- **S, Z and the 3×3 stay rare forever** — together under 20% of level-10
  draws. They're the pieces that wreck boards; they should be a spike in
  difficulty, not the background.
- Average piece size climbs smoothly from **2.4 cells at level 1 to 4.2 at
  level 10**.

The menu shows this live: **Pieces right now** draws every shape unlocked
at your level with its exact percentage, straight from the same weights
the dealer uses.

#### The dealer reads your board

`dealer.js` doesn't just roll the level's dice — it looks at the board you
actually have:

- **Nothing dead.** A tray where no piece fits anywhere isn't difficulty,
  it's a coin flip you lost. If the draw produces one, a slot is swapped
  for something playable. Over 39,000 dealt trays in simulation: zero
  dead hands.
- **A way to clean up.** If the roll says so and nothing you've been dealt
  can finish a line, a slot is swapped for one that can. The odds start
  at the level's `clearChance` (90% at level 1, 30% at level 10) and are
  pushed up by how full the board is — so at real pressure even level 10
  nearly always offers an out.
- **Variety.** Repeats within one tray are damped, so three of a kind is
  under 2% of deals.

This deliberately doesn't make the game *easier*, only fairer. Auto-playing
300 games with the solver, turning the rescue off entirely changes the
median game from 338 moves to 311 — skill still decides everything. What
it removes is the death you had no move against.

### The point system

| What you did | Reward |
|---|---|
| Placed a piece | 1 per cell |
| Cleared lines | 10 × lines² — a double is worth 4× a single, a triple 9× |
| Combo | +50% per consecutive clearing move, up to ×5.5 |
| **Cross clear** | +40 for taking out a row *and* a column in one move |
| **Perfect clear** | +300 for emptying the entire board |
| **Flawless tray** | +150 when all three pieces of one tray each clear a line |
| **Level up** | +50 × the level you reached |

Then **everything above is multiplied by the level multiplier**. The same
double-clear that pays 24 points at level 1 pays 140 at level 10, which is
what makes pushing deeper worth the harder pieces.

Each bonus announces itself with its own badge. Several can fire on one
move, so they queue up and play in sequence rather than overlapping.

### Lifelines: three of them, one use each

In the spirit of the quiz show. They are deliberately **not**
interchangeable — two of them only exist for part of the ladder, so *when*
you spend one matters as much as which:

| | Lifeline | What it does | When |
|---|---|---|---|
| ↩ | **Rewind** | takes back your last placement — board, tray, score, combo and level all go back exactly as they were | levels 1–5 |
| 🔀 | **Shuffle** | re-deals the pieces still in your tray | any level |
| 💥 | **Wipe** | clears every block off the board | level 5+ |

Rewind still only ever goes back **one step**: the game keeps a single
snapshot, taken at the start of each placement. Above level 5 it's gone
altogether — by then you're expected to live with your mistakes, and Wipe
has taken over as the way out.

Shuffle only refills the slots you haven't used, so shuffling with one
piece left hands you one piece, not a fresh three. It drops the rewind
snapshot as it goes: a new deal is a new position, and rewinding across it
would quietly undo the shuffle too.

Wipe scores nothing and doesn't move the ladder. It's a rescue, not a
clear.

**Locked buttons still do something.** Tapping a dark lifeline is how you
find out what's wrong with it — it answers with the reason ("Unlocks at
level 5", "Already used"). Spent ones stay on screen, crossed out, so you
can see what you've burned. The tooltip shows on hover, on keyboard focus,
and for a moment after a tap, because hover doesn't exist on a phone.

All three work from the **Game Over screen** too, where whichever ones you
have left are offered as a second chance — a wipe or a shuffle can pull
you out of a dead end, not just a rewind. The rules recompute the verdict
after every lifeline, so the overlay lifts by itself when one saves you.

Adding a fourth lifeline means adding an entry to `LIFELINES` in
`config.js` and a branch in `useLifeline()`; the buttons, the tooltips,
the locking and the rescue row all build themselves from that list.

### Line-clear preview

As you drag a piece around, if dropping it there would complete a row or
column, the game shows you
before you commit: every cell in the doomed lines pulses gold, the board
gets a gold glow, and the piece itself glows too.

### Placement feedback

Blocks pop in as a wave radiating from the centre of the piece, an
expanding ring pulses in the piece's colour, a small **+N** drifts upward,
and there's a light haptic tap on devices that support it. Deliberately
subtler than a line clear, so clears still feel like the big moment.

### Line clears

1. Blocks flash white and swell
2. A bright bar rips along each completed line
3. Blocks shatter in sequence, rippling along the line
4. Coloured shards fly outward and fall with gravity
5. The points earned float up from the centre
6. Screen shake — gentle on a double, harder on a triple+
7. A badge announces "Double!", "COMBO x3", "PERFECT CLEAR!"…

### The menu

The ☰ button opens the **leaderboard**, and under it a two-line reminder
of the rules. That's all.

It used to also carry a live stats table and a breakdown of the piece odds
at your level. Both were interesting to build; neither was anything you
could act on mid-game, and they pushed the board — the reason the panel
exists — off the top of the screen. `shapeOdds()` in `dealer.js` still
computes the odds and is still tested, if you want them back.

Escape, the ✕, or a tap on the backdrop closes it.

### Leaderboard

Type a name once — in the menu, or on the Game Over screen — and it's
remembered from then on. Every finished game is recorded silently and the
Game Over screen tells you where you landed. If you haven't set a name,
nothing is recorded and nothing nags you: the field simply sits on the
Game Over screen until you feel like using it.

Only your **personal best** is kept, so one person can't fill the whole
table with their last ten games.

#### Who's who

A name can't identify anyone on its own — two friends could both be
"Alex", and anyone could type your name to overwrite your score. Browsers
**cannot read a MAC address** or any other hardware identifier; that's
blocked for privacy and there's no way around it. So on first play the
game mints a random UUID, keeps it in `localStorage`, and keys the board
on that. Your name is just the label beside it, and changing it doesn't
split your row.

The trade-off: the id lives in one browser's storage. Play on your phone
and your laptop and you'll appear twice, and clearing site data starts you
fresh.

#### Online vs. on-device

The menu tells you which board you're looking at — a green **everyone**
badge for the shared one, a grey **this device** badge when it can't be
reached. The Game Over screen says `#3 worldwide` rather than
`#3 on this device` when it's live.

Scores are always written locally as well, so a dropped connection never
loses a game. If the shared board is unreachable — no database connected,
offline, opened from a `file://` path — the game falls back silently and
keeps playing.

#### Turning the shared board on

The code is written and deployed; it needs a database connected once:

1. Open your project on [vercel.com](https://vercel.com) → **Storage**
2. **Marketplace** → **Upstash for Redis** → create a free database
3. Connect it to this project, then redeploy

That injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which
`api/scores.js` picks up. Until then the route answers `503 online:false`
and every player just sees their own board — no errors, no broken screens.

`api/scores.js` talks to Upstash over its REST API with plain `fetch`, so
the project still has **zero runtime dependencies**. Two Redis keys:

| Key | Type | Holds |
|---|---|---|
| `blockdrop:scores` | sorted set | `playerId` → best score |
| `blockdrop:players` | hash | `playerId` → `{name, level, at}` |

A sorted set is Redis's version of a leaderboard, and `ZADD ... GT` only
ever *raises* a member's score — so a worse game can't overwrite your best
even if two devices submit at the same instant.

**On cheating:** there's no authentication, so a determined person can
POST any score they like. The server validates shape, caps the score and
clamps the level, but that's a sanity check, not a defence. For a board
shared with friends that's the right trade; anything better needs
accounts.

---

## Tuning

Almost everything is in `js/config.js`:

| Setting | Effect |
|---|---|
| `APP_VERSION` | the version shown on the page and in the menu |
| `BOARD_SIZE` | grid dimensions (8 = classic) |
| `LIFELINES` | the three lifelines: icon, label, and the levels each is available at |
| `LEVELS` | the difficulty ladder — thresholds, multipliers, `clearChance` |
| `COLORS` | the block palette |
| `SCORING` | per cell, per line, combo, and all four bonuses |
| `DEALER.rescuePower` | how fast a filling board earns you a way out |
| `DEALER.fitBoost` | preference for shapes that fit the board right now |
| `DEALER.crowdPenalty` | how hard duplicate shapes in one tray are damped |
| `LEADERBOARD_SIZE` | how many scores the table keeps |
| `FX.dragLift` | how far the piece sits above your finger (touch) |
| `FX.dragScale` | how much a picked-up piece swells |
| `FX.tapSlop` | how far a press may move before it becomes a drag |
| `FX.shardsPerCell` | confetti density — lower if it feels sluggish |
| `TIMING.badgeGap` | pause between stacked bonus badges |

**How often each shape appears is set in `js/pieces.js`**, on the shape
itself. To make 5-bars even more common, raise their `weight`; to bring
the 3×3 in earlier, lower its `from`. `shapeOdds(level)` in `dealer.js`
prints the resulting distribution — it's exported for exactly this.

Visual styling lives in `css/styles.css`, grouped by area with comments.

---

## Debugging

The game object is exposed on the page, so you can poke at it from the
browser console (or Safari's Web Inspector connected to your phone):

```js
blockdrop.game.board                         // inspect the grid
blockdrop.game.level                         // current level
blockdrop.game.stats                         // pieces placed, best combo…
blockdrop.game.lifelineStatuses()            // what's on offer, and why not
blockdrop.game.useLifeline("wipe")           // spend one from the console
blockdrop.findBestPlacement(blockdrop.game)  // ask the solver for a move
blockdrop.game.reset()                       // start over
```

---

## Accessibility

Anyone with **Reduce Motion** enabled automatically gets a calmer version:
no shards, no ripples, no screen shake, no board flashes, and static
highlights instead of pulsing ones. The gameplay and all the
information conveyed by the effects stay identical.

---

## Ideas for what's next

- **Sound effects** — one new module subscribing to the existing events
- **Rotating pieces** — a two-finger twist, or a long press mid-drag
- **Themes** — the CSS variables at the top of `styles.css` are ready
- **Daily challenge** — the `Game` constructor already takes an injectable
  `rng`, so seed it from the date
- **Missing icons** — `icon-192.png` and `icon-512.png` are referenced by
  `manifest.json` but aren't in the repo, so the home-screen install has
  no icon. The service worker no longer chokes on them, but they're still
  worth adding.
