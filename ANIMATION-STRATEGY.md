# Animation & engagement strategy

The plan for how Block Drop looks and how it keeps people coming back.
This file is the thinking; the code follows it, not the other way round.
Add ideas here first, then build.

---

## The one rule

**Quality, not quantity. Rotation, not randomness.**

An effect that fires every time becomes wallpaper. An effect that fires at
random feels arbitrary — you can't tell what you did to earn it. So every
visual in the game is on a **schedule or a rotation** the player can feel
the shape of, even if they never work out the rule.

Three questions for anything new:

1. **What did the player do to earn it?** If nothing, it's noise.
2. **How often will they see it?** If it's every clear, make it small.
3. **What's the tier above it?** There should always be something better.

---

## The five categories

Each one is a separate axis so they can be tuned — and extended —
independently.

| # | Category | Trigger | Rotates on | Where |
|---|---|---|---|---|
| 1 | Line clear | Clearing 1+ lines | Every clear, by tier | `celebrations.js` |
| 2 | Board clear | Emptying the whole board | Every board clear | `celebrations.js` |
| 3 | Scenery | — | **Level up · board clear** | `looks.js` |
| 4 | Block design | — | **Level up · board clear** | `looks.js` |
| 5 | Level up | Reaching a new level | Fixed, escalating | `effects.js` |

---

## 1. Line clear

The most-seen animation in the game, so most of them have to be *small*.
The job of the tiering is to make a big clear look **different**, not just
louder.

**Tiers**

| Lines | Feels like | Pool |
|---|---|---|
| 1 | a tidy little pop | `shatter` only |
| 2 | you did something | `shockwave`, `ember`, `cascade` |
| 3+ | you did something *rare* | + `prism`, `nova` |

A single line always looks the same on purpose: it's the baseline the
others are measured against. If every clear were a spectacle, none of them
would be.

**Rotation.** Consecutive multi-line clears cycle the pool rather than
repeating. Driven by a counter, not a random roll, so the same run of
clears always produces the same run of animations — that's what makes it
testable. Single-line clears deliberately **don't** advance the counter,
so a long tidy-up can't quietly decide which animation your next big clear
gets.

**Shipped:** `shatter`, `shockwave`, `ember`, `cascade`, `prism`, `nova`.

**Ideas not built yet**
- `magnet` — blocks snap together into one lump, then fire off as a unit
- `dissolve` — blocks pixelate away from the edges inward
- `chain` — for a combo: each clear detonates the next one visibly

---

## 2. Board clear

Emptying the board is the rarest thing that happens in a normal game and
should be the loudest moment in it. **Locked until level 2** — a beginner
who does it by accident on a nearly empty board hasn't earned it, and
spending the best animation on that cheapens it.

**Shipped:** `bloom`, `starburst`, `implode`, rotating. A board clear also advances the look, so the board you carry on with is a different colour from the one you cleared.

**Ideas not built yet**
- A held beat before it fires — a quarter-second of nothing reads as "wait
  for it"
- The score counter racing up rather than jumping
- A one-off badge that only ever appears here

---

## 3 & 4. The look — scenery *and* blocks

These used to be two categories on two clocks: the background moved with
your level, the blocks rotated on the calendar every three days. Both
ideas were wrong.

**The calendar was the mistake.** It changes the game while you *aren't*
playing, so you never see it happen, and it has nothing to do with how
you're doing. It's a notification, not a reward. Gone.

**A small change is worse than none.** Shifting the background a shade
reads as a rendering glitch. If a look is going to change it has to be
obvious — you look up and the game is somewhere else.

So there is one axis now, twenty **looks**, and each one changes
everything at once:

| Part | Range |
|---|---|
| Palette | seven colours, all different per look |
| Block surface | `gloss` `candy` `gem` `bubble` `matte` `neon` |
| Background | three drifting blobs, a haze, one of four motions |

**Blocks are always rounded squares.** Varying the silhouette too —
hexagons, diamonds, capsules — was built and then pulled. Two reasons
worth remembering before anyone tries it again:

- It fought the clear animations, which draw rounded squares whatever the
  look. A hexagon board dissolving into square debris reads as a bug.
- With the palette, the surface and the whole background already changing,
  the shape was one change too many rather than the one that sold it.

The surface still varies, which is enough to make a look feel *made of*
something different without touching the silhouette.

**What earns the next one — exactly two things:**

- levelling up
- clearing the whole board

`lookIndex = (level - 1) + boardClears`. Deriving it rather than storing
a counter means it can never drift out of step, and undo gets the right
look back for free. There is no picker and no setting: it's a reward for
progress, and a dropdown would turn it back into a settings screen.

**Rules for a new look**
- Nothing sharp in the background. Big blurs, soft radial falloff, and a
  vignette so no layer ever meets the screen edge with a line.
- Consecutive looks must repaint the blocks *and* the background, and
  move either the surface or the motion — there's a test for it.
- Don't reintroduce per-look block shapes without first changing what the
  clear animations draw.
- `transform` and `opacity` only in anything that runs per frame.

**Ideas not built yet**
- A held beat on the swap: freeze for 200ms, *then* cross-fade
- Looks that react to the board filling up rather than only to progress
- Seasonal one-offs that jump the queue in December
- Shape variation *including* matching debris in the clear animations —
  the only version of that idea worth building

---

## 5. Level up

The transition itself. Currently: a badge, a gold wash over the board, and
the whole look changing underneath — see above. Twenty levels now, and the
rungs get further apart as you climb, so a level up is worth more the
later it lands.

**Ideas not built yet**
- The new scenery wiping in from one edge rather than cross-fading
- A one-line preview of what just unlocked ("5-bars from here on")
- Level 20 getting its own unique, never-repeated moment

---

## Engagement, beyond animation

Animation is one lever. The others, roughly in order of value per hour of
work:

| Idea | Status | Why it works |
|---|---|---|
| A new look per level and per board clear | **shipped** | Visible, earned proof of progress |
| "New look" notice | **shipped** | Names the thing you just earned |
| Shared leaderboard | **shipped** | Someone else's number to beat |
| Sound | not built | The single biggest missing multiplier on every effect here |
| Daily challenge | not built | Same board for everyone; a reason to come back *today* |
| Streaks | not built | "3 days in a row" is the cheapest retention mechanic there is |
| Near-miss framing | not built | "12 points off your best" beats a bare score |

---

## House rules for building any of it

- **Reduce Motion is not optional.** Every effect is frozen or cut short
  under it, and the game must convey the same information without it.
- **`transform` and `opacity` only** in anything that runs per frame.
  Anything touching layout goes in a one-off, not a loop.
- **The picker lives in a pure module.** What plays is arithmetic with no
  DOM and no randomness, so it can be tested; only the drawing touches the
  page. That split is why adding an animation is two small edits.
- **Nothing new fires more than once a clear.** If two things want the
  same moment, they queue.
