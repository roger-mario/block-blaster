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

---

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
  index.js       the public API — dealTray(), and the two dials
  board.js       reading a grid: health, regions, sweep plan
  placement.js   where a shape can go, what happens when it does,
                 and whether a whole tray can be played out
  evaluate.js    scoring one shape against one board
  compose.js     building a tray slot by slot, and the guarantees
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
  generosity dial is the obvious place to hang it.
