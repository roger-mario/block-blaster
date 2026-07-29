# Block Drop

**v0.4.2** — see [CHANGELOG.md](CHANGELOG.md) · how the visuals are planned: [ANIMATION-STRATEGY.md](ANIMATION-STRATEGY.md)

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
system, the four lifelines and what a drop is allowed to do.

---

## Going back a version

Every release is pinned on a `release/*` branch that is never moved again,
so any version can be brought back exactly as it shipped:

| Branch | Version |
|---|---|
| `release/v0.0.4` | the shared leaderboard release |
| `release/v0.1.0` | lifelines, drag-only placement, rebalanced layout |
| `release/v0.2.0` | the visual framework — animations, scenery, block surfaces |
| `release/v0.3.0` | 20 levels, a new look per level, smoother dragging |

Three ways back, easiest first:

- **In Vercel** — Deployments → pick the older build → **Instant
  Rollback**. The live URL points at it within seconds and nothing in the
  repo changes. This is the one to reach for if you just don't like a
  release.
- **Undo the release commit** — `git revert -m 1 <merge-commit>` on `main`
  puts the previous version back as a new commit, which redeploys itself.
  The history of both versions is kept.
- **Reset `main` wholesale** — `git checkout main && git reset --hard
  release/v0.0.4 && git push --force-with-lease`. Blunt, and it throws
  away the newer commits on `main`.

(The same points are tagged `v0.0.4` and `v0.1.0` locally. The tags aren't
on GitHub — this environment's git proxy rejects tag pushes — which is why
the branches exist.)

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
  difficulty.js     the level 1→20 ladder (pure maths)
  scoring.js        every point the game awards (pure maths)
  pieces.js         the shapes, and a level curve that flavours the mix
  dealer/           picks your next three by reading the board
    index.js        the public API — dealTray()
    board.js        reading a grid: health, regions, sweep plan
    placement.js    where a shape goes, and whether a tray can be played out
    evaluate.js     scoring one shape against one board
    compose.js      building a tray slot by slot, and the guarantees
    dials.js        the two knobs difficulty actually turns
  emitter.js        tiny publish/subscribe helper
  storage.js        localStorage that can't throw
  leaderboard.js    names and scores, shared board + local fallback
  looks.js          the 25 looks, and what earns the next one
  scenery.js        paints a look onto the page
  celebrations.js   which clear animation plays, and when
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
ANIMATION-STRATEGY.md  the visual plan — read before adding an effect
DEALER-STRATEGY.md  which pieces you get and why — read before touching js/dealer/
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

### The look, and what earns it

Twenty-five **looks**. Each one changes three things at once — the block
palette, the surface they're made of, and the background behind them:

| Part | Range |
|---|---|
| Palette | seven colours, all different per look |
| Surface | `gloss` `candy` `gem` `bubble` `matte` `neon` `prism` `pixel` |
| Background | three drifting blobs, a haze, one of four motions |

Twenty of them cover the ladder rung for rung. The last five — Aurora,
Pixel, Carnival, Vapor, Slime — sit past the top of it, because a
catalogue exactly as long as the ladder wrapped back to Midnight for
anyone who also cleared the board on the way up: their reward for a
perfect clear was the look they had started in. They're louder than the
twenty below on purpose.

**Blocks are always rounded squares** — one radius, set once in
`styles.css`. Per-look silhouettes were tried and pulled: they fought the
clear animations, which draw rounded squares whatever the look.

**Exactly two things move you to the next look:**

- levelling up
- clearing the whole board

`lookIndex = (level - 1) + boardClears`. It's derived rather than stored,
so it can't drift out of step with the game, and undo gets the right look
back for free.

There is **no picker**, deliberately. A look is a reward for progress; a
dropdown turns it into a settings screen, and then nobody ever sees the
other twenty-four. It used to rotate on the calendar instead — that was
worse, because it changed the game while you weren't playing, so you never
saw it happen.

When it swaps, the blocks already on the board are recoloured to the
matching slot in the new palette rather than left behind, and a pill names
the look you just earned.

#### Adding a look

One object in `js/looks.js` and nothing else:

```js
look("ice", "Ice", "Pale blue, cut sharp", "gem",
  { "--bg": "#0a1420", /* …the same keys every look sets… */ },
  ["#8ad8ff", /* …seven colours… */],
  { motion: "sway", blur: 70, haze: "radial-gradient(…)", tint: [/* three */] })
```

No CSS. Every colour in `styles.css` reads a custom property, and
`scenery.js` writes the look's values onto `:root`. Tests enforce that a
new look sets the same variables, carries a full palette, uses a known
surface, and **repaints both the blocks and the background** relative to
its neighbour — a look that's only a nudge fails the suite.

A new **surface** is the one thing that does need CSS: add it to
`SURFACES` in `looks.js` and write the matching
`:root[data-surface="…"] .cell.filled::before` rules. The surface is drawn
as an overlay on top of the block's own colour, so one rule works for
every palette. A test reads `styles.css` and fails if a listed surface has
no rules behind it, or if no look ever wears it.

### Clear animations

Three, and which one plays is decided by two rules in
`js/celebrations.js`:

| Rule | What it does |
|---|---|
| **Escalation** | A single line always gets the plain shatter. The louder animations are reserved for a double or better, so a big clear *looks* different rather than just bigger. |
| **Rotation** | Consecutive big clears cycle through the eligible animations instead of repeating one. |

| Animation | From | What it looks like |
|---|---|---|
| `shatter` | 1 line | Blocks flash white, swell and break into shards |
| `shockwave` | 2 lines | A ring blasts out of the centre and throws each block along its own line |
| `ember` | 2 lines | Blocks lift off the board, turn, and burn away upward |

The rotation is a **counter, not a random roll**, so a given sequence of
clears always produces the same sequence of animations — which is what
makes it testable. A run of single-line clears deliberately doesn't spin
the counter, so it can't quietly decide which animation your next double
gets.

Adding a fourth is one entry in `js/celebrations.js` and one `case` in
`js/effects.js`. Nothing else in the game has to know.

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

### Difficulty: twenty levels

Your level is driven by **total lines cleared**, not score — otherwise the
later multipliers would rocket you up the ladder without you playing any
better. Reaching a level changes two things at once:

| Level | Lines to reach | Step | Points × |
|---|---|---|---|
| 1 | 0 | — | 0.60 |
| 2 | 4 | 4 | 0.80 |
| 3 | 10 | 6 | 1.00 |
| 4 | 18 | 8 | 1.25 |
| 5 | 28 | 10 | 1.50 |
| 6 | 40 | 12 | 1.80 |
| 10 | 119 | 25 | 3.20 |
| 15 | 318 | 52 | 5.80 |
| 20 | 718 | 102 | 10.00 |

The rungs get further apart as you climb — 4 lines to reach level 2, 102
to get from 19 to 20. The first six levels are exactly where they always
were; the opening pace was never the problem, so all ten extra levels went
on the end.

The header shows the level and a bar filling toward the next one. The
multiplier itself isn't displayed — it's a number you can't act on, and
the level it comes from is right there.

#### There are no easy or hard pieces

This is the part 0.4.0 rewrote, and the reasoning is worth the paragraph.

Every shape used to carry a `difficulty` rating, and the dealer's job was
to roll the level's dice and hand out more of the hard ones as you climbed.
That model is wrong in a way you can feel while playing. A 5-bar is the
best piece in the game when a row is three from complete and a lane is
open for it; the same 5-bar is a disaster when your empty space is four
separate pockets. A single square is trivial filler on an open board and
the most valuable piece in the game when a row needs exactly one cell.

**A shape has no difficulty of its own. It only has a value on the board
in front of you.** So the dealer scores every unlocked shape against your
actual grid — where it can go, how healthy a board its best placement
leaves behind, how many lines it can finish, whether it moves you toward
emptying the whole thing, and how many choices it gives you.

The appearance curve in `pieces.js` didn't go away, but it's now a
*prior*, not the decision, and it enters the weighting raised to the power
0.5 so it nudges rather than dictates:

| Field | Meaning |
|---|---|
| `from` | first level it can appear at all — the one part still doing real work, so level 1 isn't handed a 3×3 |
| `peak` | level where it reaches full weight (it eases in before that) |
| `fade` | level it starts becoming rarer again |
| `floor` | how rare it gets once faded — never zero |
| `weight` | its pull relative to every other shape, so a level keeps a recognisable texture |
| `difficulty` | a label for humans reading the table. Nothing reads it to decide anything. |

There are **39 shapes**. A board-aware dealer gets better with a bigger
vocabulary, not worse — more shapes means a better chance that something
in the pool is exactly what this board needs.

#### Difficulty is how hard the dealer works for you

Not what it's allowed to reach for. Two dials, kept deliberately separate:

**Generosity** runs from 1.0 at level 1 to 0.12 at level 20 and becomes an
exponent on the board evaluation. At the bottom the dealer actively hunts
for the pieces that leave your board in the best shape. Around level 10
it's indifferent and the flavour curve decides. At the top it stops doing
you favours. It's never as spiteful as it is generous — in a game with no
rotation, always handing over the single worst piece isn't difficult, it's
a rigged deck. The board is what gets harder, because the dealer stops
tidying it for you.

**Rescue** is the level's `clearChance` (90% at level 1, 25% at level 20),
pushed toward certainty by how full your board is. The clearing bonus
never inverts however stingy the level gets, so a late board is hard to
*manage* rather than hard to *escape*.

#### A tray is composed, not rolled

The three slots are drawn one at a time, and after each pick the board is
advanced to how it would look if that piece were played *well* — so the
next slot is chosen against that. It's a small rule with a large effect:
the dealer can hand you a piece that sets a row up and a second piece that
finishes it. Combos, doubles and whole-board sweeps come out of it.

Then three promises are checked against the real board:

- **Something fits.** A tray where no piece can be placed isn't
  difficulty, it's a coin flip you lost. On at all 20 levels.
- **A way out.** If the roll says so and nothing you've been dealt can
  finish a line, a slot is swapped for one that can.
- **Playable in sequence.** *New in 0.4.0.* The old check asked whether
  each piece fit the board as it stood, which misses the piece that fits
  today and has nowhere to go once the first one is down. The tray is now
  searched for an order in which all three can actually be placed, and
  slots are swapped until one exists. Level-scaled: certain early, about
  58% at level 20, because at the top the risk of boxing yourself in is
  part of the difficulty.

#### Challenge rounds and the Joker

*Added in 0.4.1.* Both work the same way underneath — a `challenge` value
from 0 to 1 that drags the level's own dials down toward the top of the
ladder without changing the level. A challenge at level 2 is simply the
level-20 dealer paying an early visit.

**Every twentieth tray is a challenge round.** Generosity drops to its
floor and the free rescue gets stingier. The line it never crosses is
solvability: a challenged tray always has its sequence guarantee forced to
certain, so a challenge round is hard *and* playable to the end — a tray
you have to think about, never one you can't play. The first tray of a
game is never one (there's no board yet to make hard), and a Shuffle
re-deals on the same terms, or a challenge would last exactly as long as
it takes to press one button. It's announced with a badge: an unexplained
bad hand reads as unfairness, and the same hand labelled reads as the game
asking something of you.

**🃏 The Joker** is a fourth lifeline and the only one that makes the game
harder. Offered up to level 5, once per game: every point doubles, and the
dealer starts handing you level-20 pieces. It runs until you reach level
6, which is also when the button disappears — a permanent doubling would
turn every leaderboard score into a question of whether you pressed a
button in the first two minutes.

A note on where the difficulty sits. A challenge lands almost entirely on
the **generosity** dial and only partly on the **rescue** dial
(`DEALER.challengeRescueBite`). That's not a fudge — you climb the ladder
on lines cleared, so taking the free rescue away doesn't make the game
harder so much as *slower*. The first build of the Joker did exactly that
and measured 100 moves to reach level 6 against 90 without it: strictly
worse, in every direction. Difficulty belongs on the dial that decides how
much the dealer tidies up for you.

#### Clearing the whole board

The best moment in this kind of game, and until 0.4.0 it was an accident
you noticed afterwards. The dealer now works out which rows and columns
would, if they all cleared, empty the board outright. When that cover is
small enough to be real, it prefers pieces that finish those exact lines,
and pays a large bonus to anything that can sweep the board in one move.
The size of that nudge fades as you climb, so a perfect clear is handed to
you early and earned late.

Auto-playing 60 games with the solver, same seeds, before and after:

| | 0.3.0 | 0.4.0 |
|---|---|---|
| games that saw a perfect clear | 5% | **48%** |
| perfect clears per game | 0.05 | **1.07** |
| median moves per game | 464 | 818 |
| median lines cleared | 213 | 396 |
| median level reached | 12 | 16 |

Across 3,000 sampled trays on mid-game boards: zero dead hands, and every
one playable in some order.

**`DEALER-STRATEGY.md` is the long version** — what the dealer measures,
why, and which ideas were parked for the next pass. Read it before
touching `js/dealer/`.

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

### Lifelines: four of them, one use each

In the spirit of the quiz show. They are deliberately **not**
interchangeable — three of them only exist for part of the ladder, so
*when* you spend one matters as much as which:

| | Lifeline | What it does | When |
|---|---|---|---|
| ⏪ | **Rewind** | takes back your last placement — board, tray, score, combo and level all go back exactly as they were | levels 1–5 |
| 🔀 | **Shuffle** | re-deals the pieces still in your tray | any level |
| 🧹 | **Wipe** | clears every block off the board | level 5+ |
| 🃏 | **Joker** | doubles every point you score, and hands you level-20 pieces while it runs | levels 1–5 |

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

**The Joker is the odd one out — the only lifeline that makes the game
harder.** The opening levels are the slow ones: small pieces, a multiplier
below 1, a long way to the next rung. Play the Joker and you trade that
away. Every point doubles, and the dealer starts treating you as though
you were at the top of the ladder. It runs until you reach level 6, which
is also when the button disappears; a permanent doubling would turn every
leaderboard score into a question of whether you remembered to press a
button in the first two minutes.

Two details it would be easy to get wrong. The boost is applied *after*
rounding, so "double points" is exactly double rather than `round(0.6) = 1`
twice over. And playing it re-deals the tray you're holding, so you can't
bank three gentle pieces at double value before the downside arrives.
While it runs the button stays lit and pulsing rather than greying out
like a spent lifeline — it *is* spent, but it's very much still doing
something, and a grey button would say the opposite.

**Locked buttons still do something.** Tapping a dark lifeline is how you
find out what's wrong with it — it answers with the reason ("Unlocks at
level 5", "Already used"). Spent ones stay on screen, crossed out, so you
can see what you've burned. The tooltip shows on hover, on keyboard focus,
and for a moment after a tap, because hover doesn't exist on a phone.

**The Game Over screen offers exactly one of them: Wipe.** It used to
offer all four, and that was the wrong shape. A lifeline is a decision you
take with the board still in front of you — spending one is the point of
having it. Handing the unspent ones back at the end turns them into a
prompt you accept rather than a risk you took, and a Joker played from the
death screen is a doubling nobody gambled anything for. Wipe keeps the
exception because sweeping the board *is* the second chance: there is
nothing left to decide about it, and it scores nothing either way.

That's one flag, `rescue: true`, on the wipe entry in `LIFELINES` — the
rules refuse everything else once `over` is set, and the overlay row only
builds buttons for lifelines carrying the flag. The verdict is recomputed
after every lifeline, so the overlay lifts by itself when the wipe saves
you.

Adding a fifth lifeline means adding an entry to `LIFELINES` in
`config.js` and a branch in `useLifeline()`; the buttons, the tooltips,
the locking and the rescue row all build themselves from that list. The
Joker was added in 0.4.1 and needed exactly that, plus the scoring boost.

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
exists — off the top of the screen. `shapeOdds()` in `js/dealer/index.js` still
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
| `LIFELINES` | the four lifelines: icon, label, and the levels each is available at |
| `LEVELS` | the 20-rung ladder — thresholds, multipliers, `clearChance` |
| `COLORS` | the block palette |
| `SCORING` | per cell, per line, combo, and all four bonuses |
| `DEALER.generosityFloor` | how much the dealer still helps you at level 20 |
| `DEALER.biasStrength` | how hard full generosity leans toward helping you |
| `DEALER.spiteStrength` | …and how much more gently it ever leans the other way |
| `DEALER.rescuePower` | how fast a filling board earns you a way out |
| `DEALER.sequenceFloor` | odds the whole tray is guaranteed playable, at level 20 |
| `DEALER.perfectPull` | how hard it pushes a piece that could clear the whole board |
| `DEALER.substance` | credit per cell a piece places — stops the dealer favouring the smallest one |
| `DEALER.gauntletEvery` | trays between challenge rounds |
| `DEALER.jokerChallenge` | how much harder the Joker makes the dealer |
| `DEALER.challengeRescueBite` | how much of a challenge lands on the rescue dial rather than generosity |
| `SCORING.jokerBoost` | what the Joker multiplies your score by |
| `DEALER.crowdPenalty` | how hard duplicate shapes in one tray are damped |
| `LOOKS.swapMs` | how long a look change takes to cross-fade |
| `LEADERBOARD_SIZE` | how many scores the table keeps |
| `FX.dragLift` | how far the piece sits above your finger (touch) |
| `FX.dragScale` | how much a picked-up piece swells |
| `FX.tapSlop` | how far a press may move before it becomes a drag |
| `FX.shardsPerCell` | confetti density — lower if it feels sluggish |
| `TIMING.badgeGap` | pause between stacked bonus badges |

**Which shapes exist, and when they unlock, is set in `js/pieces.js`** on
the shape itself. To bring the 3×3 in earlier, lower its `from`; to give a
level a different texture, change `weight`. Since 0.4.0 that curve only
flavours the mix — what you're actually handed is decided by the board, in
`js/dealer/`. `shapeOdds(level)` prints the flavour distribution.

**To change how the dealer thinks**, start with `DEALER-STRATEGY.md`, then
`js/dealer/evaluate.js` (what a piece is worth) and `js/dealer/compose.js`
(how a tray is built). Both are pure functions over a plain board array,
so a new idea can be tried in `npm test` in a few seconds.

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
