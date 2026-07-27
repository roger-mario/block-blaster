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
| 3 | Scenery | — | **Level up** | `sceneries.js` |
| 4 | Block design | — | Theme (calendar) | `themes.js` |
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

**Shipped:** `bloom`, `starburst`, `implode`, rotating.

**Ideas not built yet**
- A held beat before it fires — a quarter-second of nothing reads as "wait
  for it"
- The score counter racing up rather than jumping
- A one-off badge that only ever appears here

---

## 3. Scenery

The background. **Changes on level up**, which is the point: it's the only
visual proof you're getting further than last time. Ten of them, one per
level, so reaching level 7 *looks* like level 7.

**Rules**
- Nothing sharp. No hard edges anywhere — big blurs, soft radial falloff,
  and a vignette so nothing ever meets the screen edge with a line.
- Motion is slow enough to be background. If you notice it moving while
  concentrating, it's too fast.
- `transform` and `opacity` only, so it stays on the compositor and costs
  nothing per frame.

**Not the player's choice.** Deliberately. It's a reward for progress; a
picker would turn it into a settings screen and throw away the reason it
exists.

**Ideas not built yet**
- Weather that reacts to the board filling up (haze thickening as you run
  out of room)
- A different scenery family per theme, so the calendar and the ladder
  compound

---

## 4. Block design

What the pieces themselves look like. Tied to the **theme**, which rotates
on the calendar — roughly twice a week, the same for everyone on the same
day.

Blocks vary on three axes:

| Axis | Range |
|---|---|
| Palette | seven colours per theme |
| Corner | soft to very round — never square |
| Surface | `gloss`, `gem`, `candy`, `bubble` |

The surface is what makes them feel like *objects* rather than coloured
rectangles: a gem has a bevel and a facet, a candy has a fat soft
highlight, a bubble has an off-centre specular dot.

**Ideas not built yet**
- Seasonal one-offs (a pumpkin set in October, snow in December)
- A block that reacts to being about to complete a line — a subtle lean
  toward the gap
- Rare "shiny" blocks worth extra, appearing a few times a game

---

## 5. Level up

The transition itself. Currently: a badge, a gold wash over the board, and
the scenery changing underneath.

**Ideas not built yet**
- The new scenery wiping in from one edge rather than cross-fading
- A one-line preview of what just unlocked ("5-bars from here on")
- Level 10 getting its own unique, never-repeated moment

---

## Engagement, beyond animation

Animation is one lever. The others, roughly in order of value per hour of
work:

| Idea | Status | Why it works |
|---|---|---|
| Theme rotation | **shipped** | A reason to open it on a day you weren't going to |
| Scenery per level | **shipped** | Visible proof of progress |
| "New look" notice | **shipped** | Rewards the return specifically |
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
