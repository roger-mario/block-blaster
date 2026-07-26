# Block Drop

A block-puzzle game that runs in the browser, installs to your iPhone home
screen, and costs nothing to host. No Xcode, no Apple developer fee, no
build step.

---

## Running it locally

The code is split into ES modules, which browsers refuse to load from a
`file://` path. So **double-clicking `index.html` will show a blank page.**
Start a tiny local server instead:

```bash
cd blockdrop-web
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Any static server works — `npx serve`,
VS Code's Live Server extension, etc.)

On the live Vercel/Netlify URL this isn't an issue at all; it only affects
opening files directly off your disk.

---

## Deploying (one-time, ~10 minutes, free)

1. **GitHub** — create a free account and a new repo, e.g. `block-drop`.
   Upload this whole folder (keep the `js/` and `css/` subfolders intact).
2. **Vercel** — sign up at vercel.com with your GitHub account →
   **Add New Project** → pick the repo → **Deploy**. No configuration
   needed; it's a static site. You get a URL like `block-drop.vercel.app`.
3. From then on, **every push to the repo redeploys automatically** in
   about 30 seconds. Netlify works identically if you prefer it.

### Put it on your home screen

Open the URL in **Safari** on your iPhone → Share → **Add to Home Screen**.
It gets its own icon, opens full-screen with no browser chrome, and works
offline.

### Sharing with friends

Send them the link. That's the whole process — no TestFlight, no App Store
review, no per-device setup.

---

## How the code is organised

Everything is plain JavaScript modules — no framework, no bundler, no
`npm install`. Each file has one job:

```
index.html          structure only (~60 lines)
css/styles.css      all styling and keyframes
js/
  config.js         ← every tunable number lives here
  pieces.js         the shapes that can appear
  emitter.js        tiny publish/subscribe helper
  game.js           all the rules. Never touches the DOM.
  solver.js         works out a good move for the Hint button
  dom.js            element references and pixel geometry
  render.js         draws game state onto the page
  effects.js        animations, particles, screen shake
  input.js          drag and drop
  main.js           wiring — connects game events to visuals
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
  game.on("gameover", () => play("gameOver"));
}
```

Then one line in `main.js`: `attachSound(game);`

The same pattern covers achievements, statistics, daily challenges, and
analytics.

---

## Features

### Line-clear preview (while dragging)

As you drag a piece around, if dropping it there would complete a row or
column, the game shows you before you commit:

- every cell in the lines that would dissolve pulses gold
- the board gets a gold glow around its edge
- the piece under your finger glows too

Powered by `game.previewPlacement()`, which simulates the move on a copy of
the board without changing anything.

### Hint button — 3 per game

Tap 💡 in the header and the game highlights a good move: the target
squares pulse on the board and the matching tray piece lights up, for about
3 seconds. The counter ticks down and the button greys out at zero. A fresh
game restores all three.

`solver.js` tries every piece in every legal position and scores each one:

| Factor | Weight | Meaning |
|---|---|---|
| `linesCleared` | +1000 | clearing beats everything |
| `contact` | +12 | reward tucking pieces against walls/blocks |
| `holeCreated` | −25 | punish leaving unusable single cells |
| `rowProgress` | +2 | reward partial progress toward lines |

Change those weights in `solver.js` to make hints more aggressive or more
conservative.

### Placement feedback

Every single placement gets a small reward so there's always something
satisfying happening:

- blocks pop in as a **wave radiating from the centre** of the piece
- an expanding **ring** pulses outward in the piece's colour
- a small **+N** drifts upward
- a light haptic tap (on devices that support it)

Deliberately subtler than the line clear, so clears still feel like the
big moment.

### Line clears

1. Blocks flash white and swell
2. A bright bar rips along each completed line
3. Blocks shatter in sequence, rippling along the line
4. Coloured shards fly outward and fall with gravity
5. The points earned float up from the centre
6. Screen shake — gentle on a double, harder on a triple+
7. A badge announces "Double!", "Triple!", "COMBO x3"

### Combos

Clearing lines on consecutive placements builds a combo worth +50% per
step. One placement that clears nothing resets it. To go back to flat
scoring, set `comboBonusPerStep: 0` in `config.js`.

---

## Tuning

Almost everything is in `js/config.js`:

| Setting | Effect |
|---|---|
| `BOARD_SIZE` | grid dimensions (8 = classic) |
| `HINTS_PER_GAME` | how many hints you get |
| `COLORS` | the block palette |
| `SCORING` | points per cell, per line, combo bonus |
| `TIMING.clearStagger` | ripple speed along a clearing line |
| `TIMING.placeStagger` | ripple speed when placing |
| `TIMING.hintDuration` | how long a hint stays lit |
| `FX.shardsPerCell` | confetti density — lower if it feels sluggish |
| `FX.dragLift` | how far the piece floats above your finger |

Visual styling lives in `css/styles.css`, grouped by area with comments.

---

## Debugging

The game object is exposed on the page, so you can poke at it from the
browser console (or Safari's Web Inspector connected to your phone):

```js
blockdrop.game.board                      // inspect the grid
blockdrop.game.score                      // current score
blockdrop.findBestPlacement(blockdrop.game)  // ask the solver directly
blockdrop.game.reset()                    // start over
```

---

## Accessibility

Anyone with iOS **Reduce Motion** enabled automatically gets a calmer
version: no shards, no ripples, no screen shake, and static highlights
instead of pulsing ones. The gameplay and all the information conveyed by
the effects stay identical.

---

## Ideas for what's next

- **Sound effects** — one new module subscribing to the existing events
- **Rotating pieces** — tap a tray piece to rotate before dragging
- **Themes** — the CSS variables at the top of `styles.css` are already set
  up for it
- **Undo** — snapshot the board in `game.place()` before mutating
- **Daily challenge** — seed `randomPiece()` from the date
- **Online leaderboard** — needs a small backend; Vercel has free
  serverless functions
