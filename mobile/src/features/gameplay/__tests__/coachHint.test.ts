import { createBoard, findPlayByNotation, initialBoard, installNetwork, playMove, startTurn } from '@/game';
import { useGameStore } from '@/state/gameStore';

import { coachHint, remainingHintMoves } from '../coachHint';
import { nextGameInMatch, startActiveGame } from '../gameModel';

beforeAll(() => installNetwork(null));

describe('coach hint', () => {
  it('suggests the best play for the roll, with the reason', () => {
    const hint = coachHint(startTurn(initialBoard(), 'player1', [3, 1]))!;
    expect(hint.notation).toBe('8/5 6/5');
    expect(hint.reason).toMatch(/5-point/);
  });

  it('says when a roll can only be played one way', () => {
    // One checker left, on the bar side of a closed board but for one point.
    const board = createBoard({ player1: { 2: 1 }, player2: { 19: 1 } });
    const hint = coachHint(startTurn(board, 'player1', [6, 5]))!;
    expect(hint.reason).toBe('It’s the only legal way to play this roll.');
  });

  it('follows the moves already played, and notices when they leave the coach’s play', () => {
    const turn = startTurn(initialBoard(), 'player1', [3, 1]);
    const hint = coachHint(turn)!;
    expect(remainingHintMoves(hint, [])).toEqual(hint.moves);
    const [first] = findPlayByNotation(initialBoard(), 'player1', [3, 1], '8/5 6/5')!.moves;
    expect(remainingHintMoves(hint, [first])).toHaveLength(1);
    const other = findPlayByNotation(initialBoard(), 'player1', [3, 1], '24/23 13/10')!.moves[0];
    expect(remainingHintMoves(hint, [other])).toBeNull();
  });

  it('is computed from the start of the turn even after a move', () => {
    const turn = startTurn(initialBoard(), 'player1', [3, 1]);
    const moved = playMove(turn, findPlayByNotation(initialBoard(), 'player1', [3, 1], '24/23 13/10')!.moves[0]);
    expect(coachHint(moved)!.notation).toBe('8/5 6/5');
  });
});

describe('hints per game', () => {
  it('counts hints in the active game, and starts each game of a match afresh', () => {
    const settings = { level: 'beginner' as const, matchLength: 3, cubeEnabled: false };
    useGameStore.setState({ active: startActiveGame('m1', settings, '2026-03-10T10:00:00.000Z') });
    useGameStore.getState().countHint();
    useGameStore.getState().countHint();
    expect(useGameStore.getState().active!.hintsUsed).toBe(2);
    expect(nextGameInMatch(useGameStore.getState().active!).hintsUsed).toBe(0);
  });
});
