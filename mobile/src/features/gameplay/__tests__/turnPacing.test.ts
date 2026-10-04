import {
  createGame,
  createGameFromPosition,
  currentLegalMoves,
  gameReducer,
  initialBoard,
  type GameState,
} from '@/game';

import { AI_PACE, aiStepDelay } from '../turnPacing';

/** The computer to play with `dice` from the opening position. */
function computerRolled(dice: [1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6]): GameState {
  const ready = createGameFromPosition(initialBoard(), 'player2', { cubeEnabled: false });
  return gameReducer(ready, { type: 'roll', dice });
}

const playFirstMove = (state: GameState, pick: (move: ReturnType<typeof currentLegalMoves>[number]) => boolean = () => true) =>
  gameReducer(state, { type: 'move', move: currentLegalMoves(state).find(pick)! });

describe('the computer’s pace', () => {
  it('hands the turn over with a short beat, then reads its dice before moving', () => {
    const ready = createGameFromPosition(initialBoard(), 'player2', { cubeEnabled: false });
    expect(aiStepDelay(ready, { planned: false, level: 'beginner' })).toBe(AI_PACE.roll);
    const rolled = computerRolled([6, 1]);
    expect(aiStepDelay(rolled, { planned: false, level: 'beginner' })).toBe(AI_PACE.think.beginner);
    expect(aiStepDelay(rolled, { planned: false, level: 'advanced' })).toBe(AI_PACE.think.advanced);
  });

  it('moves checker after checker, and ends once the last one has landed', () => {
    const one = playFirstMove(computerRolled([6, 1]), (move) => !move.hit);
    expect(aiStepDelay(one, { planned: true, level: 'beginner' })).toBe(AI_PACE.move);
    const two = playFirstMove(one, (move) => !move.hit);
    expect(aiStepDelay(two, { planned: true, level: 'beginner' })).toBe(AI_PACE.end);
  });

  it('lets a hit checker reach the bar before going on', () => {
    // One of the player's checkers left alone on point 20, three pips from the computer's 17.
    const board = initialBoard();
    const points = board.points.slice();
    points[13] -= 1;
    points[20] = 1;
    const blotted = { ...board, points };
    const state = gameReducer(createGameFromPosition(blotted, 'player2', { cubeEnabled: false }), { type: 'roll', dice: [4, 3] });
    const hitting = currentLegalMoves(state).find((move) => move.hit);
    expect(hitting).toBeDefined();
    const after = gameReducer(state, { type: 'move', move: hitting! });
    expect(aiStepDelay(after, { planned: true, level: 'intermediate' })).toBe(AI_PACE.afterHit);
  });

  it('answers a double after a moment', () => {
    const doubling: GameState = { ...createGame(), phase: 'doubling', doubleOfferedBy: 'player1' };
    expect(aiStepDelay(doubling, { planned: false, level: 'beginner' })).toBe(AI_PACE.cube);
  });

  // The whole turn, step by step: the computer used to take ~2.5 s for an
  // ordinary roll, most of it waiting with nothing moving.
  it('keeps an ordinary turn under two seconds and doubles under three', () => {
    const ordinary = AI_PACE.roll + AI_PACE.think.advanced + AI_PACE.move + AI_PACE.end;
    const doubles = AI_PACE.roll + AI_PACE.think.advanced + 3 * AI_PACE.move + AI_PACE.end;
    expect(ordinary).toBeLessThanOrEqual(2000);
    expect(doubles).toBeLessThanOrEqual(3000);
    // Never faster than a checker can fly (420 ms) or the dice can land (about 450 ms).
    expect(AI_PACE.move).toBeGreaterThan(420);
    expect(Math.min(...Object.values(AI_PACE.think))).toBeGreaterThan(450);
  });
});
