import type { MoveStep } from '@/curriculum';
import {
  blotPoints,
  createBoard,
  getLegalPlays,
  legalSingleMoves,
  type BoardSpec,
  type DieValue,
  type LegalPlay,
  type Rng,
} from '@/game';

import { attempt, die, diceText, int, notation } from './shared';

/**
 * "Find the hit": one number, both dice together, then entering from the bar.
 * Every position is checked: a hit must be possible, and some legal play
 * must miss it, so the learner really has to look.
 */

function base(rng: Rng): { player1: Record<number, number>; player2: Record<number, number> } {
  return {
    player1: { 13: int(rng, 3, 4), 8: int(rng, 2, 3), 6: int(rng, 4, 5) },
    player2: { 19: int(rng, 3, 5), 17: int(rng, 2, 3), 12: int(rng, 2, 4) },
  };
}

/** The tidiest hitting play: fewest of your own blots left behind. */
function tidiest(plays: LegalPlay[]): LegalPlay {
  return plays.reduce((best, play) =>
    blotPoints(play.board, 'player1').length < blotPoints(best.board, 'player1').length ? play : best,
  );
}

const hitsOn = (play: LegalPlay, point: number) => play.moves.some((move) => move.hit && move.to === point);

interface HitDraw {
  spec: BoardSpec;
  dice: [DieValue, DieValue];
  target: number;
}

/** The move step for a drawn position, or null when it isn't a real decision. */
function hitStep(draw: HitDraw, id: string, prompt: string, wrong: string, singleDieOnly: boolean): MoveStep | null {
  const board = createBoard(draw.spec);
  const plays = getLegalPlays(board, 'player1', draw.dice);
  const hitting = plays.filter((play) => hitsOn(play, draw.target));
  if (hitting.length === 0 || hitting.length === plays.length) return null;
  if (singleDieOnly) {
    // "Both dice" means neither number hits on its own.
    const single = draw.dice.some((value) => legalSingleMoves(board, 'player1', value).some((move) => move.hit));
    if (single) return null;
  }
  const solution = tidiest(hitting);
  const hit = solution.moves.find((move) => move.hit && move.to === draw.target)!;
  const from = hit.from === 'bar' ? 'the bar' : `the ${hit.from}-point`;
  return {
    id,
    kind: 'move',
    prompt,
    board: { position: draw.spec, dice: draw.dice },
    goal: { type: 'hit', point: draw.target },
    solution: notation(solution.moves),
    correct: `Hit! ${notation(solution.moves)}: the checker from ${from} lands right on their blot.`,
    wrong,
  };
}

/** A blot of theirs on your side, and room for your hitter `distance` behind it. */
function drawBlot(rng: Rng, distance: number): { spec: { player1: Record<number, number>; player2: Record<number, number> }; target: number } | null {
  const spec = base(rng);
  const target = int(rng, 2, 11);
  const hitter = target + distance;
  if (spec.player1[target] || spec.player2[target] || hitter > 24 || spec.player2[hitter]) return null;
  spec.player2[target] = 1;
  if (!spec.player1[hitter]) spec.player1[hitter] = 1;
  return { spec, target };
}

export function oneNumber(rng: Rng, index: number): MoveStep | null {
  return attempt(60, () => {
    const hitDie = die(rng);
    const other = die(rng);
    if (other === hitDie) return null;
    const drawn = drawBlot(rng, hitDie);
    if (!drawn) return null;
    return hitStep(
      { spec: drawn.spec, dice: [hitDie, other], target: drawn.target },
      `one-number-${index}`,
      `You rolled ${diceText(hitDie, other)}. Find the hit.`,
      `Their blot is on the ${drawn.target}-point. Which of your checkers is exactly ${hitDie} or ${other} pips away?`,
      false,
    );
  });
}

export function bothDice(rng: Rng, index: number): MoveStep | null {
  return attempt(80, () => {
    const a = die(rng);
    const b = die(rng);
    if (a === b) return null;
    const drawn = drawBlot(rng, a + b);
    if (!drawn) return null;
    return hitStep(
      { spec: drawn.spec, dice: [a, b], target: drawn.target },
      `both-dice-${index}`,
      `You rolled ${diceText(a, b)}. No single number hits, but together they do. Find the hit.`,
      `The blot on the ${drawn.target}-point is ${a + b} pips from your hitter: use the ${a} and the ${b} on the same checker.`,
      true,
    );
  });
}

export function fromBar(rng: Rng, index: number): MoveStep | null {
  return attempt(60, () => {
    const enterDie = die(rng);
    const other = die(rng);
    if (other === enterDie) return null;
    const target = 25 - enterDie;
    const player2: Record<number, number> = { 12: int(rng, 3, 4), 17: int(rng, 2, 3), [target]: 1 };
    // A few made points in their home board, so entering takes some thought.
    for (const point of [19, 20, 21, 22, 23, 24]) {
      if (point !== target && rng() < 0.4) player2[point] = 2;
    }
    const spec: BoardSpec = { player1: { 13: 4, 8: 3, 6: int(rng, 4, 5) }, player2, bar: { player1: 1 } };
    return hitStep(
      { spec, dice: [enterDie, other], target },
      `from-bar-${index}`,
      `You’re on the bar with ${diceText(enterDie, other)}. Enter **and** hit.`,
      `Enter first: a ${enterDie} comes in on the ${target}-point, right where their blot sits.`,
      false,
    );
  });
}
