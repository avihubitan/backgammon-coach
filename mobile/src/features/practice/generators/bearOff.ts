import type { ChallengeStep, MoveStep } from '@/curriculum';
import { challengeOutcomes } from '@/features/lessons/engine/evaluate';
import { createBoard, getLegalPlays, type BoardSpec, type BoardState, type DieValue, type Rng } from '@/game';

import { SEARCH_BUDGET } from './miniGames';
import { attempt, die, diceText, int, notation, place, total } from './shared';

/** Bearing off: take off the most checkers, then clear a whole board in a few rolls. */

/** Your checkers all home (`count` of them), theirs far away in their own home board. */
function homePosition(rng: Rng, count: number): BoardSpec {
  let player1: Record<number, number> = {};
  for (let i = 0; i < count; i++) player1 = place(player1, int(rng, 1, 6));
  const player2: Record<number, number> = { 19: int(rng, 2, 4), 20: int(rng, 2, 3), 22: 2 };
  return { player1, player2, off: { player1: 15 - count, player2: 15 - total(player2) } };
}

const offCount = (board: BoardState) => board.off.player1;

export function mostOff(rng: Rng, index: number): MoveStep | null {
  return attempt(60, () => {
    const spec = homePosition(rng, int(rng, 5, 10));
    const dice: [DieValue, DieValue] = [die(rng), die(rng)];
    if (dice[0] === dice[1]) return null;
    const start = createBoard(spec);
    const plays = getLegalPlays(start, 'player1', dice);
    const most = Math.max(...plays.map((play) => offCount(play.board)));
    const taken = most - start.off.player1;
    const best = plays.filter((play) => offCount(play.board) === most);
    if (taken < 1 || best.length === plays.length) return null;
    const words = taken === 1 ? 'one checker' : 'two checkers';
    return {
      id: `most-${index}`,
      kind: 'move',
      prompt: `You rolled ${diceText(dice[0], dice[1])}. Bear off as many checkers as you can.`,
      board: { position: spec, dice },
      goal: { type: 'bear-off', count: taken },
      solution: notation(best[0].moves),
      correct: `${taken === 1 ? 'One' : 'Two'} off: ${notation(best[0].moves)}. Every checker off is a step closer to winning.`,
      wrong: `This roll can take ${words} off. Use each number on a point it can bear off from.`,
    };
  });
}

export function clearBoard(rng: Rng, index: number): ChallengeStep | null {
  return attempt(40, () => {
    const count = int(rng, 4, 7);
    const spec = homePosition(rng, count);
    const rolls: [DieValue, DieValue][] = Array.from({ length: int(rng, 2, 3) }, () => [die(rng), die(rng)]);
    const { solvable, failable } = challengeOutcomes(createBoard(spec), rolls, { type: 'bear-off-all' }, SEARCH_BUDGET);
    if (!solvable || !failable) return null;
    return {
      id: `clear-${index}`,
      kind: 'challenge',
      prompt: `Bear off all **${count} checkers** in **${rolls.length} rolls**. Waste nothing!`,
      board: { position: spec },
      rolls,
      goal: { type: 'bear-off-all' },
      success: 'All off! Every number counted.',
      failure: 'Not quite. Take a checker off with every number you can, and clear your highest points first.',
    };
  });
}
