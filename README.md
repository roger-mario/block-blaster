# Block Drop

**v0.0.3**

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
system, the assist/undo budget and the tap-to-place geometry.

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
js/
  config.js         ← every tunable number lives here
  difficulty.js     the level 1→10 ladder (pure maths)
  scoring.js        every point the game awards (pure maths)
  pieces.js         the shapes and their appearance curves
  dealer.js         picks your next three, reading the board
  emitter.js        tiny publish/subscribe helper
  storage.js        localStorage that can't throw
  leaderboard.js    names and scores, kept on this device
  game.js           all the rules. Never touches the DOM.
  solver.js         works out a good move for the Hint button
  dom.js            element references and pixel geometry
  render.js         draws game state onto the page
  effects.js        animations, particles, screen shake
  input.js          drag *and* tap-to-place
  menu.js           the burger menu panel
  main.js           wiring — connects game events to visuals
tests/              node --test suite, no dependencies
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
`comboBreak`, `score`, `tray`, `hint`, `assists`, `undo` and `gameover`.

---

## Features

### Two ways to place a piece

**Drag** a piece exactly as before — or **tap** it once to pick it up and
tap the board to drop it. Both work at all times; you never have to
choose a mode.

- The two gestures are told apart by distance. A press that moves less
  than `FX.tapSlop` pixels (10 by default) is a tap; anything further
  turns into a drag halfway through, ghost and all.
- The tapped piece lifts and glows in the tray, and the board picks up a
  blue rim so it's obvious the game is waiting for you.
- A tap drops the piece **centred on the square you touched**. Fingers
  aren't precise, so if that exact spot doesn't fit, the game spirals
  outward up to `FX.snapRadius` squares and takes the nearest legal
  position instead. If nothing within reach works, the board flashes red
  and the piece stays in your hand.
- With a mouse, moving over the board previews the landing spot live.
- Tap the same piece again, tap anywhere outside the board, or press
  **Escape** to put it back.

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

The header shows the level, the current multiplier and a bar filling
toward the next level.

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

### Assists: three per game, hint *or* undo

You get **three assists a game, and you choose what to spend them on.**
Both buttons show the same number because they draw on the same pot.

**💡 Hint** highlights a good move: the target squares pulse on the board
and the matching tray piece lights up for about 3 seconds.

**↩ Undo** takes back your last placement — the board, the tray, the
score, the combo and the level all go back exactly as they were.

Undo deliberately only ever goes back **one step**. The game keeps a
single snapshot, taken at the start of each placement, and throws it away
the moment you use it. So you can rewind the move you just made, but never
unwind three moves in a row. Make another move and undo is available
again.

It also works on the **Game Over screen** — if a placement dead-ends you
and you still have an assist, "Undo last move" puts you back in the game.

`solver.js` powers the hints by trying every piece in every legal
position and scoring each one:

| Factor | Weight | Meaning |
|---|---|---|
| `linesCleared` | +1000 | clearing beats everything |
| `contact` | +12 | reward tucking pieces against walls/blocks |
| `holeCreated` | −25 | punish leaving unusable single cells |
| `rowProgress` | +2 | reward partial progress toward lines |

### Line-clear preview

As you move a piece around — dragging, or hovering with a selected piece —
if dropping it there would complete a row or column, the game shows you
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

The ☰ button opens a panel with four sections:

- **Leaderboard** — the top 10 on this device, your own row highlighted
- **This game** — level, score, lines, pieces placed, best combo, perfect
  clears, assists left
- **Pieces right now** — every shape unlocked at your level with its exact
  chance of being dealt
- **How to play** — including tap-to-place, which is otherwise easy to miss

Escape, the ✕, or a tap on the backdrop closes it.

### Leaderboard

Type a name once — in the menu, or on the Game Over screen — and it's
remembered from then on. Every finished game is recorded silently under
that name and the Game Over screen tells you where you landed. If you
haven't set a name, nothing is ever recorded and nothing ever nags you:
the field simply sits on the Game Over screen until you feel like using
it.

Only your **personal best** is kept, so one person can't fill the whole
table with their last ten games. Names are matched case-insensitively.

**Scores are stored on the device, not shared between devices or
players.** The game is a static site with no backend, so there's nowhere
to put a shared table without standing up a database and wiring
credentials into the deploy. Everything a remote leaderboard would need
sits behind the four functions in `js/leaderboard.js` — `getScores`,
`submitScore`, `getPlayer`, `setPlayer` — so making it global later means
pointing those at `fetch("/api/scores")` (Vercel serverless + a KV store)
and changing nothing else.

---

## Tuning

Almost everything is in `js/config.js`:

| Setting | Effect |
|---|---|
| `APP_VERSION` | the version shown on the page and in the menu |
| `BOARD_SIZE` | grid dimensions (8 = classic) |
| `ASSISTS_PER_GAME` | hints + undos you get per game |
| `LEVELS` | the difficulty ladder — thresholds, multipliers, `clearChance` |
| `COLORS` | the block palette |
| `SCORING` | per cell, per line, combo, and all four bonuses |
| `DEALER.rescuePower` | how fast a filling board earns you a way out |
| `DEALER.fitBoost` | preference for shapes that fit the board right now |
| `DEALER.crowdPenalty` | how hard duplicate shapes in one tray are damped |
| `LEADERBOARD_SIZE` | how many scores the table keeps |
| `FX.tapSlop` | how far a press may move and still count as a tap |
| `FX.snapRadius` | how forgiving tap-to-place is |
| `FX.shardsPerCell` | confetti density — lower if it feels sluggish |
| `FX.dragLift` | how far the piece floats above your finger |
| `TIMING.badgeGap` | pause between stacked bonus badges |

**How often each shape appears is set in `js/pieces.js`**, on the shape
itself. To make 5-bars even more common, raise their `weight`; to bring
the 3×3 in earlier, lower its `from`. Open the menu afterwards and the
"Pieces right now" table shows the result immediately.

Visual styling lives in `css/styles.css`, grouped by area with comments.

---

## Debugging

The game object is exposed on the page, so you can poke at it from the
browser console (or Safari's Web Inspector connected to your phone):

```js
blockdrop.game.board                         // inspect the grid
blockdrop.game.level                         // current level
blockdrop.game.stats                         // pieces placed, best combo…
blockdrop.game.assistsLeft                   // hints/undos remaining
blockdrop.input.selectedSlot                 // which piece is picked up
blockdrop.findBestPlacement(blockdrop.game)  // ask the solver directly
blockdrop.game.reset()                       // start over
```

---

## Accessibility

Anyone with **Reduce Motion** enabled automatically gets a calmer version:
no shards, no ripples, no screen shake, no floating selected piece, and
static highlights instead of pulsing ones. The gameplay and all the
information conveyed by the effects stay identical.

---

## Ideas for what's next

- **Sound effects** — one new module subscribing to the existing events
- **Rotating pieces** — a second tap on a selected piece could rotate it
- **Themes** — the CSS variables at the top of `styles.css` are ready
- **Daily challenge** — the `Game` constructor already takes an injectable
  `rng`, so seed it from the date
- **Shared leaderboard** — point the four functions in `leaderboard.js` at
  a Vercel serverless route backed by a KV store; the UI needs no changes
- **Missing icons** — `icon-192.png` and `icon-512.png` are referenced by
  `manifest.json` but aren't in the repo, so the home-screen install has
  no icon. The service worker no longer chokes on them, but they're still
  worth adding.
