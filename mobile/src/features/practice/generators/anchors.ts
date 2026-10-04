import type { MoveStep, TapStep } from '@/curriculum';
import { pointTargets } from '@/curriculum/builders';
import { createBoard, getLegalPlays, isMadePoint, type BoardSpec, type DieValue, type Rng } from '@/game';

import { attempt, die, diceText, int, notation, shuffled, theirPoint } from './shared';

/** Anchors: spot the one you have, then make one with your back checkers. */

const THEIR_HOME = [19, 20, 21, 22, 23, 24];

/** Their made points in their home board, kept off the points in `avoid`. */
function theirHome(rng: Rng, avoid: number[]): Record<number, number> {
  const player2: Record<number, number> = { 12: int(rng, 3, 4), 17: int(rng, 2, 3) };
  let made = 0;
  for (const point of shuffled(rng, THEIR_HOME)) {
    if (avoid.includes(point) || made >= 3) continue;
    player2[point] = int(rng, 2, 3);
    made++;
  }
  return player2;
}

export function spotAnchor(rng: Rng, index: number): TapStep | null {
  return attempt(30, () => {
    const anchor = THEIR_HOME[int(rng, 0, 5)];
    const blot = rng() < 0.6 ? THEIR_HOME.filter((point) => point !== anchor)[int(rng, 0, 4)] : null;
    const player1: Record<number, number> = { [anchor]: int(rng, 2, 3), 13: 4, 8: 3, 6: 4 };
    if (blot !== null) player1[blot] = 1;
    const player2 = theirHome(rng, blot === null ? [anchor] : [anchor, blot]);
    const spec: BoardSpec = { player1, player2 };
    const wrongCases = [{ targets: pointTargets(13, 8, 6), text: 'That point is on your side of the board. An anchor sits in their home board, top right.' }];
    if (blot !== null) wrongCases.push({ targets: pointTargets(blot), text: 'That checker is alone: a blot, not an anchor. An anchor needs two.' });
    return {
      id: `spot-${index}`,
      kind: 'tap',
      prompt: 'Tap your **anchor**.',
      board: { position: spec },
      answers: pointTargets(anchor),
      correct: `Yes: your anchor on the ${anchor}-point, their ${theirPoint(anchor)}-point. Nothing can hit those checkers.`,
      wrong: 'An anchor is two or more of your checkers in **their** home board, top right.',
      wrongCases,
    };
  });
}

export function makeAnchor(rng: Rng, index: number): MoveStep | null {
  return attempt(80, () => {
    const back = int(rng, 20, 24);
    const join = die(rng);
    const front = back - join;
    if (front < 19) return null;
    const other = die(rng);
    if (other === join) return null;
    const player1: Record<number, number> = { [back]: 1, [front]: 1, 13: 4, 8: 3, 6: int(rng, 3, 5) };
    const player2 = theirHome(rng, [back, front]);
    const spec: BoardSpec = { player1, player2 };
    const dice: [DieValue, DieValue] = [join, other];
    const plays = getLegalPlays(createBoard(spec), 'player1', dice);
    const anchorsMade = (board: ReturnType<typeof createBoard>) =>
      THEIR_HOME.filter((point) => isMadePoint(board, point, 'player1'));
    const making = plays.filter((play) => anchorsMade(play.board).includes(front));
    // Exactly one anchor to find, and a real choice: some play leaves the back checkers apart.
    const elsewhere = plays.some((play) => anchorsMade(play.board).some((point) => point !== front));
    if (making.length === 0 || making.length === plays.length || elsewhere) return null;
    return {
      id: `make-${index}`,
      kind: 'move',
      prompt: `You rolled ${diceText(join, other)}. Make an **anchor** with your back checkers.`,
      board: { position: spec, dice },
      goal: { type: 'make-point', point: front },
      solution: notation(making[0].moves),
      correct: `Anchored on the ${front}-point: your back checkers are safe together.`,
      wrong: `Your back checkers are on the ${back}- and ${front}-points. Which number brings one onto the other?`,
    };
  });
}
