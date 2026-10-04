import type { ChoiceStep, MoveStep, TapStep } from '@/curriculum';
import { highlightPoints, pointTargets } from '@/curriculum/builders';
import { createBoard, getLegalPlays, isMadePoint, type BoardSpec, type BoardState, type DieValue, type Rng } from '@/game';

import { attempt, die, diceText, int, notation, numberOptions } from './shared';

/** Walls and primes: how long is the wall, where's the gap, and finishing the prime. */

/** The longest run of your made points in a row, and where it ends. */
export function longestWall(board: BoardState): { length: number; top: number } {
  let best = { length: 0, top: 0 };
  let run = 0;
  for (let point = 1; point <= 24; point++) {
    run = isMadePoint(board, point, 'player1') ? run + 1 : 0;
    if (run > best.length) best = { length: run, top: point };
  }
  return best;
}

/** Your wall over `points`, their checkers trapped behind it, and the rest of the armies kept clear of it. */
function wallPosition(rng: Rng, points: number[], extra: Record<number, number> = {}): BoardSpec | null {
  const low = Math.min(...points);
  const high = Math.max(...points);
  const player1: Record<number, number> = { ...extra };
  for (const point of points) player1[point] = (player1[point] ?? 0) + 2;
  // Spare checkers well clear of the wall, so they never lengthen it.
  const spare = high + 2 <= 15 ? int(rng, high + 2, 15) : null;
  let mine = Object.values(player1).reduce((a, b) => a + b, 0);
  if (spare !== null && mine < 15) player1[spare] = (player1[spare] ?? 0) + Math.min(3, 15 - mine);
  mine = Object.values(player1).reduce((a, b) => a + b, 0);
  if (mine > 15) return null;
  // Their checkers: one or two trapped behind the wall, the rest at home.
  const trapped = int(rng, 1, low - 1);
  if (trapped < 1 || player1[trapped]) return null;
  const player2: Record<number, number> = { [trapped]: int(rng, 1, 2), 19: int(rng, 3, 5), 21: int(rng, 2, 3), 23: 2 };
  for (const point of Object.keys(player2).map(Number)) if (player1[point]) return null;
  return { player1, player2 };
}

export function wallLength(rng: Rng, index: number): ChoiceStep | null {
  return attempt(40, () => {
    const length = int(rng, 3, 6);
    const low = int(rng, 2, 11 - length + 1);
    const points = Array.from({ length }, (_, i) => low + i);
    const spec = wallPosition(rng, points);
    if (!spec) return null;
    const wall = longestWall(createBoard(spec));
    if (wall.length !== length) return null;
    const high = low + length - 1;
    const explain = `${length} points in a row, from the ${high}-point down to the ${low}-point.`;
    return {
      id: `length-${index}`,
      kind: 'choice',
      prompt: 'How many points long is your wall?',
      board: { position: spec },
      options: numberOptions(
        rng,
        length,
        [length - 1, length + 1, length + 2],
        (value) => `${value} points`,
        (value) => (value === length ? `Right: ${explain}` : `Count the made points side by side: ${explain}`),
      ),
    };
  });
}

export function findGap(rng: Rng, index: number): TapStep | null {
  return attempt(40, () => {
    const length = int(rng, 6, 7);
    const low = int(rng, 2, 12 - length);
    const all = Array.from({ length }, (_, i) => low + i);
    const gap = all[int(rng, 1, length - 2)];
    const spec = wallPosition(rng, all.filter((point) => point !== gap));
    if (!spec) return null;
    const filled = createBoard({ ...spec, player1: { ...spec.player1, [gap]: 2 } });
    if (longestWall(createBoard(spec)).length >= 6 || longestWall(filled).length < 6) return null;
    return {
      id: `gap-${index}`,
      kind: 'tap',
      prompt: 'One point is missing from your wall. Tap the point that would give you a **full prime**.',
      board: { position: spec },
      answers: pointTargets(gap),
      correct: `Yes: the ${gap}-point closes the gap. Six or more points in a row: nothing gets past.`,
      wrong: 'That’s the {point}-point. Look for the hole in the middle of your wall.',
    };
  });
}

export function buildPrime(rng: Rng, index: number): MoveStep | null {
  return attempt(80, () => {
    const a = die(rng);
    const b = die(rng);
    if (a === b) return null;
    const low = int(rng, 2, 6);
    // Five points in a row; the sixth goes on top.
    const points = Array.from({ length: 5 }, (_, i) => low + i);
    const target = low + 5;
    const builders: Record<number, number> = {};
    for (const from of [target + a, target + b]) {
      if (from > 24 || points.includes(from)) return null;
      builders[from] = (builders[from] ?? 0) + 1;
    }
    const spec = wallPosition(rng, points, builders);
    if (!spec || spec.player2?.[target] || spec.player2?.[target + a] || spec.player2?.[target + b]) return null;
    const start = createBoard(spec);
    const dice: [DieValue, DieValue] = [a, b];
    const plays = getLegalPlays(start, 'player1', dice);
    const making = plays.filter((play) => isMadePoint(play.board, target, 'player1'));
    if (making.length === 0 || making.length === plays.length) return null;
    const solution = notation(making[0].moves);
    return {
      id: `build-${index}`,
      kind: 'move',
      prompt: `You rolled ${diceText(a, b)}. Make the **${target}-point** to complete a six-point prime.`,
      board: { position: spec, dice, highlights: [highlightPoints(points, 'gold')] },
      goal: { type: 'make-point', point: target },
      solution,
      correct: `Six points in a row, from ${target} down to ${low}: a full prime. Their checker can’t get past.`,
      wrong: `Bring two checkers onto the ${target}-point: one ${a} away and one ${b} away.`,
    };
  });
}
