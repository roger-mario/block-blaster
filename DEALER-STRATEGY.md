# Dealer strategy

What decides the three pieces you're handed, and why.

Read this before touching anything in `js/dealer/`. It's the same kind of
document as `ANIMATION-STRATEGY.md`: the plan, not the code.

---

## The mistake we were making

Until 0.3.0 every shape carried a `difficulty` number and an appearance
curve, and the dealer's job was essentially "roll the level's dice". A
3×3 block was *hard*. A domino was *easy*. Climb the ladder and you get
more of the hard ones.

That model is wrong, and it's wrong in a way you can feel while playing.

**There is no such thing as a hard piece.** There are only pieces that
are hard *on the board in front of you*. A 5-bar is the best piece in the
game when you have a row that's three from complete and an open lane to
drop it into. The same 5-bar is a disaster on a board whose empty space
is four separate pockets. A single square is trivial filler on an open
board and the most valuable piece in the game when a row needs exactly
one cell.

Rating pieces in the abstract means the dealer is answering the wrong
question. The right question isn't *how hard is this shape*, it's **what
does this board need, and how much of that am I willing to give you right
now**.

The old dealer had started reaching for this — it boosted shapes that fit
and shapes that could finish a line — but those were two bolt-on
multipliers on top of a level-curve lottery. This release makes the board
the primary input and the level curve a background flavour.

---

## What actually matters

Watching a board, five things decide whether the next three pieces are a
good hand:

**1. Can I place all three?** Not "does each piece fit the board as it is
now" — that's the check we had, and it isn't enough. Piece B might fit
today's board and have nowhere to go once piece A is down. A tray you
can't play out in *some* order is a loss you had no move against. This is
the fairness floor, and it's checked by actually searching the sequence.

**2. Does the board get better or worse?** A board is healthy when it has
room, when the blocks that are on it are *concentrated into near-complete
lines* rather than smeared everywhere, when the empty space is one big
connected area instead of five pockets, and when there are no one-cell
holes. That's a number — `boardHealth()` — and it's the single most useful
thing the dealer can reason about. The best placement of a piece is the
one that leaves the highest health; the value of a piece is how good its
best placement is.

**3. Can I clear right now, and can I clear *more* than one?** Clearing is
the whole game. A piece that completes a line is worth more than one that
doesn't; a piece that completes two is worth much more than twice as much.

**4. Is the whole board in reach?** This is the moment the game is
actually about, and the old dealer had no concept of it. When the board is
sparse, the blocks that remain can usually be covered by a handful of rows
and columns — sweep them and the board is empty. The dealer computes that
cover (`sweepPlan()`) and, when it's small enough to be real, prefers
pieces that finish one of those exact lines. Perfect clears stop being an
accident you notice afterwards and become something the game hands you the
option to go for.

**5. Do I have choices?** A piece with one legal placement is a puzzle
with one answer. Flexibility — how many places a piece can go — is part of
its value, weighted lightly.

Note what is *not* on that list: the shape's name, its cell count, or a
hand-assigned difficulty rating.

---

## The two dials

Difficulty is not "worse pieces". Difficulty is **how hard the dealer
works on your behalf**, and it is separate from **how often it rescues
you**. Two dials, and they do different jobs.

### Generosity — how much the dealer helps you build

`generosity(level)` runs from **1.0 at level 1 to 0.12 at level 20**. It
becomes an exponent on the board evaluation:

```
weight ∝ flavour^0.5 · exp(k · value)      k = 5·(2·generosity − 1)
```

- **Level 1** (`k ≈ +5`) — the dealer is on your side. Among everything
  unlocked, it strongly prefers the pieces that leave your board in the
  best shape. The game feels generous because it is.
- **Level ~10** (`k ≈ 0`) — neutral. The board evaluation cancels out and
  the level's flavour curve decides. This is roughly where the old dealer
  sat all the time.
- **Level 20** (`k ≈ −1.6`, floored) — the dealer stops doing you favours.
  It leans toward pieces that are merely *fair* rather than *helpful*. It
  is deliberately clamped well short of true spite: in a game with no
  rotation, a dealer that always hands you the single worst piece isn't
  difficult, it's rigged.

The board is the thing that gets harder, and it gets harder because the
dealer stops tidying it for you.

### Rescue — how often you're handed a way out

This dial already existed and is unchanged in spirit: each level's
`clearChance` (90% at level 1, 25% at level 20), pushed up by how full
your board is. At real pressure even level 20 nearly always offers you a
line you can finish.

Keeping the two dials separate matters. Line-clearing pieces get an
explicit multiplier that **never inverts**, even at level 20 where the
generosity dial is negative. A late-game board should be hard to *manage*,
not hard to *escape*.

---

## How a tray is built

Three slots, drawn one at a time — not three independent lottery tickets.

1. **The board is read.** Health, line counts, the sweep plan.
2. **Every unlocked shape is evaluated against that board**: where it can
   go, the best health it can leave behind, how many lines it can clear,
   whether it finishes a sweep line, whether it can empty the board
   outright. Values are normalised across the candidates, so `k` means the
   same thing on every board.
3. **The first slot may be reserved as a resolver.** If the rescue roll
   passes and something can finish a line right now, the first slot is
   drawn from those.
4. **A piece is drawn** by the weighting above.
5. **The board is advanced.** Here's the part that makes trays feel
   designed: the next slot is evaluated against the board *as it would
   look after the piece just drawn is played well*. So the dealer can hand
   you a piece that sets a row up and a second piece that finishes it.
   Combos, doubles and sweeps come out of this one rule.
6. Repeat for the remaining slots.

Then three guarantees run over the finished tray, against the **real**
board (the player is under no obligation to play the line the dealer
imagined):

- **Something fits.** Unchanged, and still on at all 20 levels.
- **A way out.** Unchanged: the rescue roll.
- **Playable in sequence.** New. The tray is searched for an order in
  which all three pieces can actually be placed. If there isn't one, slots
  are swapped until there is. This guarantee is itself level-scaled —
  certain early, about 58% at level 20 — because at the top the *risk*
  that a tray boxes you in is part of the difficulty. The "something fits"
  floor still means you're never handed a completely dead hand.

  **Under challenge this guarantee is always certain.** That is the line
  between hard and hopeless, and it's the whole reason a challenge round
  is allowed to be as mean as it is. A tray you have to think about is a
  challenge; a tray you can't play is a coin flip you lost.

---

## Challenge rounds

*Added in 0.4.1.*

Every twentieth tray — one "round" is one tray of three — the dealer stops
being the dealer for your level and becomes the one from the top of the
ladder. Generosity drops to its floor, the free-rescue odds drop to level
20's, and the sequence guarantee is forced to certain.

Two details matter:

- **The first tray of a game is never one.** You have no board yet, so
  there is nothing to make hard — it would just be an arbitrary bad hand.
- **A Shuffle re-deals on the same terms.** Otherwise a challenge round is
  a challenge only until you press one button.

The round is announced (`challenge` event → a badge). That isn't
decoration: an unexplained bad hand reads as the game being unfair, and
the same hand labelled reads as the game asking something of you. Same
pieces, opposite feeling.

### Which dial a challenge is allowed to touch

This took two wrong answers to get right, and both were only visible in
simulation.

**It must not take the rescue away in full.** You climb the ladder on
*lines cleared*. Halve how often a line-finishing piece is on offer and
you have not made the game harder, you have made it slower — the first
build of the Joker measured 100 moves to reach level 6 against 90 without
it, while also scoring less. Strictly worse in every direction. A
challenge now lands on the rescue dial at `challengeRescueBite` strength
(half), never in full.

**It must not touch the reward pulls at all.** The clear, sweep and
whole-board bonuses in `compose.js` read the *level's* generosity, not the
challenged one. When they were challenged too, whole-board clears fell
from 1.54 a game to 0.18 — because a sparse board is an opening-levels
phenomenon and the Joker covers exactly that window. That isn't
difficulty; it's deleting the best moment in the game and calling it a
gamble.

What is left for a challenge to act on is the **evaluation bias** — how
hard the dealer works to hand you a piece that improves your board. That
is the right and only home for difficulty, which is the same conclusion
the two-dials section reaches from first principles. Worth remembering
that the principle was easy to state and still got implemented wrong
twice.

With difficulty confined there, the Joker is finally a real gamble rather
than a trap: **+16% median score**, at the cost of most of your
whole-board clears — the harder pieces leave a messier board, and a messy
board is never sweepable. That's a legible trade, which is what a gamble
should be.

## The Joker

*Added in 0.4.1.* A fourth lifeline, and the only one that makes the game
**harder**.

The opening levels are the slow ones — small pieces, a multiplier below 1,
and not much happening. The Joker trades that away: from the moment you
play it, every point doubles and the dealer treats you as though you were
at level 20. It runs until you climb out of the opening levels, which is
also when the button disappears.

Three decisions worth recording:

- **It ends at level 6 rather than lasting the game.** A permanent
  doubling would make every leaderboard score a question of whether you
  remembered to press a button in the first two minutes, which is not a
  skill. Scoped to the opening, it's a real decision about a real risk.
- **The boost is applied after rounding, not before.** Fold it in first
  and a 1-cell placement at level 1 is `round(0.6) = 1` either way — the
  button says "double points" and the score doesn't move. Multiplying the
  rounded number means doubled is exactly doubled.
- **It re-deals the tray you're holding.** Otherwise you'd bank three
  gentle pieces at double value before the downside arrived.

---

## The systematic bias that had to be fixed first

*0.4.1.* Board health rewards `room` — how much space is left. That is
correct for comparing two boards, and quietly wrong for comparing two
*pieces*: a 5-cell piece is charged five cells of "damage" for doing five
cells of work, while a single square is charged one. The dealer wasn't
preferring small pieces because small pieces are good. It was preferring
them because of an accounting error.

Measured over real games before the fix: **69% of the pieces dealt at
level 1 were one or two cells**, and the single square alone was 31% of
them — against a flavour weight that should have put it near 5%. The
evaluator was doing that, not the curve.

`DEALER.substance` gives back a credit per cell placed, set slightly above
`health.room` so the correction lands on the side of pieces that get
something done. With the curve rebalanced alongside it, level 1 went to
**7% one- and two-cell pieces** and an average of 3.6 cells.

The general lesson is worth keeping: when a metric is used to rank things
it wasn't designed to compare, check for a term that scales with the thing
being ranked. That is a bias, not a preference, and no amount of tuning
the weights around it will fix it.

## What the level curve is still for

`from`, `peak`, `fade`, `floor` and `weight` in `pieces.js` haven't gone
away, but they've been demoted from *the decision* to *a prior*, and they
enter the weighting raised to the power 0.5 so they nudge rather than
dictate. They're now about **pacing and variety**, not difficulty:

- `from` gates a shape until a level, so level 1 isn't handed a 3×3 block
  and the vocabulary of the game grows as you play. This is the one part
  of the old model that was doing real work.
- `weight` keeps the mix from collapsing onto whatever the evaluator likes
  most, so a level still has a recognisable texture.
- `difficulty` is a label for humans reading the table. Nothing reads it
  to make a decision.

---

## The shape vocabulary

More shapes make a board-aware dealer *better*, not worse — a bigger
vocabulary means a better chance that something in the pool is exactly
what the board needs. 0.4.0 adds 13:

| Added | Cells | Why |
|---|---|---|
| `hook-*`, `jay-*` (8) | 4 | The L/J tetrominoes. A 3-bar with a nub — the most useful "fill an awkward corner" piece there is, and the game didn't have it. |
| `plus` | 5 | Fills a cross-shaped pocket nothing else reaches. |
| `diag-2a/b` | 2 | Two cells that don't touch. Cheap, awkward, and occasionally the only thing that fits two separated holes. |
| `diag-3a/b` | 3 | The same idea, nastier. Late and rare. |

That's 39 shapes. The dealer's job is to know which of them this board
wants.

---

## Where it lives

```
js/dealer/
  index.js       the public API — dealTray()
  board.js       reading a grid: health, regions, sweep plan
  placement.js   where a shape can go, what happens when it does,
                 and whether a whole tray can be played out
  evaluate.js    scoring one shape against one board
  compose.js     building a tray slot by slot, and the guarantees
  dials.js       generosity, rescue, and what a challenge does to both
```

Every one of them is a pure function over a plain array-of-arrays board.
No `Game`, no DOM, no colours — colour is applied at the very end in
`index.js`. That's deliberate: this is the part of the game most likely to
be rewritten again, and it should always be possible to test a dealer idea
in `node --test` in a few seconds.

Tuning lives in `DEALER` in `js/config.js`, as everything else does.

---

## Ideas parked for later

Written down so the next pass doesn't have to rediscover them:

- **Look further ahead than one piece.** Step 5 advances the board by the
  drawn piece's single best placement. A two-ply search would compose
  better trays and cost more.
- **Model the player, not the optimum.** The advance step assumes perfect
  play. A dealer that assumed *plausible* play would compose kinder trays.
- **Streak awareness.** Three trays in a row with no clear is a distinct
  bad feeling that no per-tray rule can see.
- **Difficulty that reacts to the player**, not just the level — the
  `challenge` parameter added in 0.4.1 is exactly the right hook for this,
  and nothing yet drives it from how well you're actually doing.
- **A challenge round that reads the board before deciding how hard to
  be.** Right now it is the same strength whatever state you're in; a
  round that scaled itself to how much slack you have would be fairer at
  the extremes.
