import type { ChallengeStep, ChallengeGoal } from '@/curriculum';
import { challengeOutcomes } from '@/features/lessons/engine/evaluate';
import { createBoard, type BoardSpec, type DieValue, type Rng } from '@/game';

import { attempt, die, int, place, shuffled, total } from './shared';

/**
 * Mini-games: a few fixed rolls and one goal, played solo. Each is kept only
 * when it can be won and can also be lost, so it always takes some thought,
 * and it can be replayed as often as the learner likes.
 */

/** Positions a mini-game check may look at: anything bigger is skipped, so sessions open at once. */
export const SEARCH_BUDGET = 800;

function rollsOf(rng: Rng, count: number): [DieValue, DieValue][] {
  return Array.from({ length: count }, () => [die(rng), die(rng)]);
}

function challenge(
  id: string,
  spec: BoardSpec,
  rolls: [DieValue, DieValue][],
  goal: ChallengeGoal,
  text: { prompt: string; success: string; failure: string },
): ChallengeStep | null {
  const { solvable, failable } = challengeOutcomes(createBoard(spec), rolls, goal, SEARCH_BUDGET);
  if (!solvable || !failable) return null;
  return { id, kind: 'challenge', board: { position: spec }, rolls, goal, ...text };
}

/** Their checkers safely in their own home board, out of the way. */
const theirHome = (rng: Rng): Record<number, number> => ({ 19: int(rng, 3, 4), 20: int(rng, 2, 3), 21: 3, 22: 2 });

export function raceHome(rng: Rng, index: number): ChallengeStep | null {
  return attempt(40, () => {
    let player1: Record<number, number> = {};
    const outside = int(rng, 2, 3);
    for (let i = 0; i < outside; i++) player1 = place(player1, int(rng, 7, 15));
    for (let i = 0; i < int(rng, 4, 7); i++) player1 = place(player1, int(rng, 1, 6));
    const player2 = theirHome(rng);
    const rolls = rollsOf(rng, 2);
    return challenge(`home-${index}`, { player1, player2, off: { player1: 15 - total(player1), player2: 15 - total(player2) } }, rolls, { type: 'all-home' }, {
      prompt: `Bring every checker home in **${rolls.length} rolls**.`,
      success: 'All home! From here, every roll bears checkers off.',
      failure: 'Not quite. Bring your farthest checkers in first, and don’t spend pips inside your home board.',
    });
  });
}

export function escapeRun(rng: Rng, index: number): ChallengeStep | null {
  return attempt(30, () => {
    const rolls = rollsOf(rng, 2);
    // One back checker, close enough that the two rolls can carry it past their last checker.
    const reach = rolls.reduce((sum, [a, b]) => sum + (a === b ? 4 * a : a + b), 0);
    const back = int(rng, 19, 24);
    const theirLast = int(rng, Math.max(13, back - reach + 1), back - 2);
    if (theirLast >= back) return null;
    const player2: Record<number, number> = { [theirLast]: 2 };
    for (const point of shuffled(rng, [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]).slice(0, 3)) {
      if (point > theirLast && point !== back) player2[point] = (player2[point] ?? 0) + 2;
    }
    const player1: Record<number, number> = { [back]: 1, 13: int(rng, 4, 6), 6: int(rng, 4, 6) };
    if (player2[13] || player2[6]) return null;
    return challenge(`run-${index}`, { player1, player2 }, rolls, { type: 'escape' }, {
      prompt: 'Get your back checker past all of theirs in **2 rolls**.',
      success: 'You’re out! Nothing can trap you now, and it’s a race.',
      failure: 'Still stuck behind their checkers. Use your big numbers on the back checker first.',
    });
  });
}

export function wallRace(rng: Rng, index: number): ChallengeStep | null {
  return attempt(30, () => {
    const length = int(rng, 4, 5);
    const low = int(rng, 3, 5);
    const wall = Array.from({ length }, (_, i) => low + i);
    // All but two points of the wall made; for each gap, two builders one roll away from it.
    const gaps = shuffled(rng, wall).slice(0, 2);
    const rolls = rollsOf(rng, 2);
    if (rolls.some(([a, b]) => a === b)) return null;
    const player1: Record<number, number> = {};
    for (const point of wall) if (!gaps.includes(point)) player1[point] = 2;
    for (const [i, gap] of gaps.entries()) {
      for (const distance of rolls[i]) {
        const from = gap + distance;
        if (from > 15) return null;
        player1[from] = (player1[from] ?? 0) + 1;
      }
    }
    const player2: Record<number, number> = { [int(rng, 1, low - 1)]: 2, ...theirHome(rng) };
    if (Object.keys(player2).some((point) => player1[Number(point)])) return null;
    return challenge(`wall-race-${index}`, { player1, player2 }, rolls, { type: 'prime', length }, {
      prompt: `Build a wall **${length} points** long in **2 rolls**.`,
      success: 'There’s your wall! Their back checkers are boxed in.',
      failure: 'Not quite. Make new points right next to the ones you already have.',
    });
  });
}

export function huntBlots(rng: Rng, index: number): ChallengeStep | null {
  return attempt(60, () => {
    const player1: Record<number, number> = { 13: int(rng, 3, 5), 8: int(rng, 2, 3), 6: int(rng, 3, 5) };
    const player2: Record<number, number> = theirHome(rng);
    for (const point of shuffled(rng, [2, 3, 4, 5, 7, 9, 10, 11]).slice(0, 2)) {
      if (player1[point]) return null;
      player2[point] = 1;
    }
    const rolls = rollsOf(rng, 2);
    return challenge(`hunt-${index}`, { player1, player2 }, rolls, { type: 'hit', count: 2 }, {
      prompt: 'Hit **both** of their blots in **2 rolls**.',
      success: 'Both on the bar! They’ll spend their next turns just getting back in.',
      failure: 'One got away. Look for the numbers that land exactly on each blot.',
    });
  });
}
