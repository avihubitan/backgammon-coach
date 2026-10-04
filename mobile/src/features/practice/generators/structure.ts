import type { MoveStep } from '@/curriculum';
import {
  blotPoints,
  createBoard,
  exposure,
  getLegalPlays,
  isMadePoint,
  type BoardSpec,
  type DieValue,
  type Rng,
} from '@/game';

import { attempt, die, diceText, int, notation } from './shared';

/** Making points and playing safe: the two everyday positional decisions. */

/** Their checkers: two back checkers in your home board (so blots there matter) and the rest at home. */
function attackers(rng: Rng): Record<number, number> {
  const player2: Record<number, number> = { 12: int(rng, 3, 4), 17: 3, 19: int(rng, 4, 5) };
  if (rng() < 0.6) player2[1] = 2;
  else Object.assign(player2, { 1: 1, 2: 1 });
  return player2;
}

export function makePoint(rng: Rng, index: number): MoveStep | null {
  return attempt(80, () => {
    const a = die(rng);
    const b = die(rng);
    if (a === b) return null;
    const target = [3, 4, 5, 7, 9][int(rng, 0, 4)];
    const player2 = attackers(rng);
    const player1: Record<number, number> = { 13: int(rng, 3, 4), 6: int(rng, 3, 5), 24: 2 };
    for (const from of [target + a, target + b]) {
      if (from > 24 || player2[from] || from === 24) return null;
      player1[from] = (player1[from] ?? 0) + 1;
    }
    if (player1[target] || player2[target]) return null;
    const spec: BoardSpec = { player1, player2 };
    const dice: [DieValue, DieValue] = [a, b];
    const plays = getLegalPlays(createBoard(spec), 'player1', dice);
    const making = plays.filter((play) => isMadePoint(play.board, target, 'player1'));
    if (making.length === 0 || making.length === plays.length) return null;
    const solution = notation(making[0].moves);
    return {
      id: `make-${index}`,
      kind: 'move',
      prompt: `You rolled ${diceText(a, b)}. Make your **${target}-point**.`,
      board: { position: spec, dice },
      goal: { type: 'make-point', point: target },
      solution,
      correct: `Point made: ${solution}. Two checkers together are safe, and they block their back checkers.`,
      wrong: `Bring two checkers onto the ${target}-point: one ${a} pips away and one ${b} pips away.`,
    };
  });
}

export function noBlots(rng: Rng, index: number): MoveStep | null {
  return attempt(80, () => {
    const dice: [DieValue, DieValue] = [die(rng), die(rng)];
    if (dice[0] === dice[1]) return null;
    const player2 = attackers(rng);
    const player1: Record<number, number> = { 13: int(rng, 2, 4), 8: int(rng, 2, 3), 6: int(rng, 3, 4) };
    // Two loose checkers within their reach.
    for (let loose = 0; loose < 2; loose++) {
      const point = int(rng, 3, 11);
      if (player1[point] || player2[point]) return null;
      player1[point] = 1;
    }
    const spec: BoardSpec = { player1, player2 };
    const start = createBoard(spec);
    if (exposure(start, 'player1').hittingRolls === 0) return null;
    const plays = getLegalPlays(start, 'player1', dice);
    const safe = plays.filter((play) => blotPoints(play.board, 'player1').length === 0);
    if (safe.length === 0 || safe.length === plays.length) return null;
    const solution = notation(safe[0].moves);
    return {
      id: `no-blots-${index}`,
      kind: 'move',
      prompt: `You rolled ${diceText(dice[0], dice[1])}. Play it safe: leave **no blots**.`,
      board: { position: spec, dice },
      goal: { type: 'safe' },
      solution,
      correct: `Safe: ${solution}. Every checker has a partner, so there’s nothing to hit.`,
      wrong: 'That still leaves a blot. Look for a play that pairs up every loose checker.',
    };
  });
}
