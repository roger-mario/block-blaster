/**
 * dealer/compose.js — building a tray, and the promises it has to keep.
 *
 * Three slots, drawn one at a time rather than as three independent
 * lottery tickets. The trick that makes a tray feel designed rather than
 * rolled is in `composeTray`: after each pick, the board is advanced to
 * how it would look if that piece were played well, and the next slot is
 * chosen against *that*. It's what lets the dealer hand you a piece that
 * sets a row up and a second piece that finishes it.
 *
 * Everything here works in shapes, not pieces — colour is applied last,
 * in index.js.
 */

import { DEALER } from "../config.js";
import { levelConfig } from "../difficulty.js";
import { shapePoolFor, shapeWeightAt, weightedPick } from "../pieces.js";
import { fillRatio, lineCounts } from "./board.js";
import { playableInSomeOrder, shapeClearsLine, shapeFits } from "./placement.js";
import { evaluatePool } from "./evaluate.js";
import { evaluationBias, generosity, rescueChance, sequenceGuarantee } from "./dials.js";

/**
 * What one evaluated shape is worth in the draw.
 *
 *   flavour   the level curve from pieces.js, raised to a power below 1
 *             so it nudges the mix rather than deciding it
 *   bias      the board evaluation, exponentiated by generosity — this is
 *             the difficulty dial, and the only term that can go negative
 *   clear     clearing is always worth more, at every level. This one
 *             never inverts, however stingy the level
 *   sweep     …and finishing a line a whole-board clear needs is worth
 *             more still
 *   crowd     damps a shape already sitting in the tray
 */
function draftWeight(entry, { bias, help, repeats }) {
  if (!entry.fits) return 0;

  const flavour = Math.pow(Math.max(entry.flavour, 1e-6), DEALER.flavourPull);
  const evaluation = Math.exp(bias * entry.value);

  let clear = 1 + entry.bestLines * DEALER.clearPull * help;
  if (entry.bestLines >= 2) clear += DEALER.multiPull * help;
  if (entry.sweepHit) clear += DEALER.sweepPull * help;
  if (entry.perfect) clear += DEALER.perfectPull * help;

  const crowd = Math.pow(DEALER.crowdPenalty, repeats);

  return flavour * evaluation * clear * crowd;
}

/**
 * Draws `count` shapes for this board.
 *
 * Returns shapes in tray order. The guarantees in `guardTray` still have
 * to run over the result — they're separate because they're checked
 * against the *real* board, and the player is under no obligation to play
 * the line this function imagined.
 */
export function composeTray(count, { level, board, rng }) {
  const pool = shapePoolFor(level);
  const bias = evaluationBias(level);

  // how much the clearing bonuses are worth here: always something, so a
  // level 20 board is hard to manage rather than impossible to escape
  const help = DEALER.helpFloor + (1 - DEALER.helpFloor) * generosity(level);

  // one roll, before anything is drawn: does this tray owe you an out?
  const owesAnOut = rng() < rescueChance(level, fillRatio(board));

  const drawn = [];
  const used = new Map();
  let working = board;

  for (let slot = 0; slot < count; slot++) {
    const entries = evaluatePool(working, pool, { level });

    let candidates = entries.filter((entry) => entry.fits);
    if (candidates.length === 0) candidates = entries; // nothing fits at all

    // the first slot may be reserved for a piece that can finish a line
    if (slot === 0 && owesAnOut) {
      const resolvers = candidates.filter((entry) => entry.bestLines > 0);
      if (resolvers.length > 0) candidates = resolvers;
    }

    const weights = candidates.map((entry) =>
      draftWeight(entry, { bias, help, repeats: used.get(entry.shape.name) ?? 0 })
    );

    const pick = weightedPick(candidates, weights, rng) ?? candidates[0];
    drawn.push(pick.shape);
    used.set(pick.shape.name, (used.get(pick.shape.name) ?? 0) + 1);

    // look ahead: judge the next slot on the board this piece would leave
    if (pick.bestBoard) working = pick.bestBoard;
  }

  return drawn;
}

// ---------- the guarantees ----------

/**
 * A tray where nothing fits isn't a hard level, it's a lost coin flip.
 * On at all 20 levels.
 */
function ensureSomethingFits(shapes, { level, board, rng }) {
  if (!levelConfig(level).guaranteeFit) return shapes;
  if (shapes.some((shape) => shapeFits(board, shape.cells))) return shapes;

  const fitting = shapePoolFor(level).filter((shape) => shapeFits(board, shape.cells));
  if (fitting.length === 0) return shapes; // genuinely nothing fits — that's game over

  const replacement = weightedPick(
    fitting,
    fitting.map((shape) => shapeWeightAt(shape, level)),
    rng
  );
  if (replacement) shapes[shapes.length - 1] = replacement;
  return shapes;
}

/**
 * If the roll says so and nothing you've been dealt can finish a line,
 * swap a slot for one that can. The odds are the level's own, pushed up
 * by how full the board is, so at real pressure even level 20 nearly
 * always offers a way out.
 */
function ensureAWayOut(shapes, { level, board, rng }) {
  const counts = lineCounts(board);
  if (shapes.some((shape) => shapeClearsLine(board, shape.cells, counts))) return shapes;
  if (rng() > rescueChance(level, fillRatio(board))) return shapes;

  const clearing = shapePoolFor(level).filter((shape) =>
    shapeClearsLine(board, shape.cells, counts)
  );
  if (clearing.length === 0) return shapes; // no shape can finish a line right now

  const replacement = weightedPick(
    clearing,
    clearing.map((shape) => shapeWeightAt(shape, level)),
    rng
  );
  if (!replacement) return shapes;

  // overwrite the least useful slot rather than always the same one
  let worst = 0;
  for (let i = 1; i < shapes.length; i++) {
    if (!shapeFits(board, shapes[i].cells) && shapeFits(board, shapes[worst].cells)) worst = i;
  }
  shapes[worst] = replacement;
  return shapes;
}

/**
 * The new one: can the tray actually be played out, in some order?
 *
 * Checking each piece against the board as it stands isn't enough — the
 * third piece may have nowhere to go once the first two are down, and
 * that's a loss you had no move against. If no order works, slots are
 * swapped for the best-fitting alternatives until one does, biggest piece
 * first since it's the most likely blocker.
 *
 * Level-scaled: certain early, about 58% at level 20.
 */
function ensureSequencePlayable(shapes, { level, board, rng }) {
  if (rng() >= sequenceGuarantee(level)) return shapes;

  const cellsOf = (list) => list.map((shape) => shape.cells);
  if (playableInSomeOrder(board, cellsOf(shapes)).playable) return shapes;

  const alternatives = evaluatePool(board, shapePoolFor(level), { level })
    .filter((entry) => entry.fits)
    .sort((a, b) => b.value - a.value)
    .slice(0, DEALER.repairTries)
    .map((entry) => entry.shape);

  const bySizeDescending = shapes
    .map((shape, slot) => slot)
    .sort((a, b) => shapes[b].size - shapes[a].size);

  for (const slot of bySizeDescending) {
    for (const alternative of alternatives) {
      if (alternative === shapes[slot]) continue;
      const trial = shapes.slice();
      trial[slot] = alternative;
      if (playableInSomeOrder(board, cellsOf(trial)).playable) return trial;
    }
  }

  return shapes; // nothing helps — the board is the problem, not the tray
}

/**
 * Runs the three promises over a composed tray, in order. Sequence
 * playability goes last so it gets the final word.
 */
export function guardTray(shapes, options) {
  let guarded = shapes.slice();
  guarded = ensureSomethingFits(guarded, options);
  guarded = ensureAWayOut(guarded, options);
  guarded = ensureSequencePlayable(guarded, options);
  return guarded;
}
