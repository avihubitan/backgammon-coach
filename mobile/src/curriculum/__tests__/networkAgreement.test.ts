import {
  ALL_ROLLS,
  applyMove,
  evaluateNetwork,
  getLegalPlays,
  installNetwork,
  loadDefaultNetwork,
  positionKey,
  rankByEquity,
  type BoardState,
  type DiceRoll,
  type Player,
} from '@/game';
import { boardFromSetup, goalMet, solutionMoves } from '@/features/lessons/engine/evaluate';

import { allLessons, sectionNumber, type CubeStep, type MoveStep } from '../index';

/**
 * Strategy lessons must agree with the trained network: a lesson never calls a
 * play correct that the AI considers a clear mistake, and every cube answer
 * matches the network's winning chances.
 */
const net = loadDefaultNetwork();
beforeAll(() => installNetwork(net));
afterAll(() => installNetwork(null));

/** Lessons from "Opening Moves" on teach judgement rather than mechanics. */
const FIRST_STRATEGY_SECTION = sectionNumber('openings');
const strategyLessons = allLessons.filter((lesson) => sectionNumber(lesson.sectionId) >= FIRST_STRATEGY_SECTION);

/** Equity a play may give up against the network's choice and still be taught as right. */
const MAX_LOSS = 0.1;

/** Win, gammon and cubeless equity for `player`, who is about to roll. */
function onRoll(board: BoardState, player: Player) {
  let win = 0;
  let equity = 0;
  for (const { dice, weight } of ALL_ROLLS) {
    let best = evaluateNetwork(net, board, player);
    let bestEquity = -Infinity;
    for (const play of getLegalPlays(board, player, dice)) {
      const evaluation = evaluateNetwork(net, play.board, player);
      if (evaluation.equity > bestEquity) {
        bestEquity = evaluation.equity;
        best = evaluation;
      }
    }
    win += best.win * weight;
    equity += best.equity * weight;
  }
  return { win: win / 36, equity: equity / 36 };
}

const moveSteps = strategyLessons.flatMap((lesson) =>
  lesson.steps.filter((step): step is MoveStep => step.kind === 'move').map((step) => [`${lesson.id}/${step.id}`, step] as const),
);
const cubeSteps = allLessons.flatMap((lesson) =>
  lesson.steps.filter((step): step is CubeStep => step.kind === 'cube').map((step) => [`${lesson.id}/${step.id}`, step] as const),
);

describe('strategy move steps', () => {
  it('exist', () => expect(moveSteps.length).toBeGreaterThan(15));

  it.each(moveSteps)('%s only accepts plays the network rates as good', (_id, step) => {
    const start = boardFromSetup(step.board);
    const ranked = rankByEquity(start, 'player1', step.board.dice as DiceRoll);
    const best = ranked[0].equity;
    const accepted = ranked.filter((entry) => goalMet(step.goal, start, entry.play.board, entry.play.moves));
    expect(accepted.length).toBeGreaterThan(0);
    for (const entry of accepted) expect(best - entry.equity).toBeLessThanOrEqual(MAX_LOSS);
    // The demonstrated solution is one of them.
    const end = solutionMoves(step, start).reduce((board, move) => applyMove(board, 'player1', move), start);
    expect(accepted.map((entry) => positionKey(entry.play.board))).toContain(positionKey(end));
  });
});

describe('cube steps', () => {
  it('exist', () => expect(cubeSteps.length).toBeGreaterThanOrEqual(8));

  it.each(cubeSteps)('%s matches the network', (_id, step) => {
    const board = boardFromSetup(step.board);
    if (step.decision === 'offer') {
      const { win, equity } = onRoll(board, 'player1');
      // A double needs a clear edge, unless gammons make the position "too good".
      const tooGood = equity >= 1;
      if (step.answer === 'double') {
        expect(win).toBeGreaterThanOrEqual(0.68);
        expect(tooGood).toBe(false);
      } else {
        expect(win < 0.68 || tooGood).toBe(true);
      }
    } else {
      // The opponent doubled and is on roll; the 25% rule decides.
      const takerWins = 1 - onRoll(board, 'player2').win;
      if (step.answer === 'take') expect(takerWins).toBeGreaterThanOrEqual(0.25);
      else expect(takerWins).toBeLessThan(0.25);
    }
  });
});
