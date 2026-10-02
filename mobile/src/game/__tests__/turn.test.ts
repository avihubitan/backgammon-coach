import {
  createBoard,
  getLegalPlays,
  initialBoard,
  isMoveLegalNow,
  isTurnComplete,
  legalMovesNow,
  movableSources,
  playMove,
  positionKey,
  startCustomTurn,
  startTurn,
  undoLastMove,
  type TurnState,
} from '../index';
import { samplePositions } from './helpers';

/** Every final position reachable by playing the turn one checker at a time. */
function stepwiseKeys(turn: TurnState, out = new Set<string>()): Set<string> {
  const moves = legalMovesNow(turn);
  if (moves.length === 0) {
    expect(isTurnComplete(turn)).toBe(true);
    out.add(positionKey(turn.board));
    return out;
  }
  for (const move of moves) stepwiseKeys(playMove(turn, move), out);
  return out;
}

describe('playing a turn one checker at a time', () => {
  it('requires both dice for a normal opening roll', () => {
    const turn = startTurn(initialBoard(), 'player1', [3, 1]);
    expect(turn.requiredMoves).toBe(2);
    expect(isTurnComplete(turn)).toBe(false);
    const afterOne = playMove(turn, { from: 8, to: 5, die: 3 });
    expect(isTurnComplete(afterOne)).toBe(false);
    const afterTwo = playMove(afterOne, { from: 6, to: 5, die: 1 });
    expect(isTurnComplete(afterTwo)).toBe(true);
    expect(legalMovesNow(afterTwo)).toEqual([]);
  });

  it('rejects illegal moves', () => {
    const turn = startTurn(initialBoard(), 'player1', [3, 1]);
    expect(isMoveLegalNow(turn, { from: 24, to: 19, die: 5 })).toBe(false);
    expect(() => playMove(turn, { from: 24, to: 19, die: 5 })).toThrow();
  });

  it('excludes a first move that would make the second die unplayable', () => {
    // Lone checker on 24, 18 held: moving 6 first is impossible, and the only
    // legal first move is the 5.
    const board = createBoard({ player1: { 24: 1 }, player2: { 18: 2 } });
    const turn = startTurn(board, 'player1', [6, 5]);
    expect(legalMovesNow(turn).map((m) => [m.from, m.to, m.die])).toEqual([[24, 19, 5]]);
  });

  it('applies the larger-die rule', () => {
    const board = createBoard({ player1: { 13: 1 }, player2: { 4: 2 } });
    const turn = startTurn(board, 'player1', [6, 3]);
    expect(turn.requiredMoves).toBe(1);
    expect(legalMovesNow(turn).map((m) => m.die)).toEqual([6]);
  });

  it('lets a player bear off the last checker immediately', () => {
    const board = createBoard({ player1: { 3: 1 } });
    const turn = startTurn(board, 'player1', [6, 1]);
    const after = playMove(turn, { from: 3, to: 'off', die: 6 });
    expect(isTurnComplete(after)).toBe(true);
  });

  it('can undo moves one at a time', () => {
    const turn = startTurn(initialBoard(), 'player1', [6, 5]);
    const one = playMove(turn, { from: 24, to: 18, die: 6 });
    const two = playMove(one, { from: 18, to: 13, die: 5 });
    const undone = undoLastMove(two);
    expect(positionKey(undone.board)).toBe(positionKey(one.board));
    expect(undone.remaining).toEqual([5]);
    expect(positionKey(undoLastMove(undone).board)).toBe(positionKey(initialBoard()));
  });

  it('lists movable sources for highlighting', () => {
    const board = createBoard({ player1: { 6: 2 }, bar: { player1: 1 } });
    expect(movableSources(startTurn(board, 'player1', [4, 2]))).toEqual(['bar']);
  });

  it('has no moves (and is complete) when the player is shut out', () => {
    const board = createBoard({ player1: { 13: 2 }, player2: { 19: 2, 20: 2 }, bar: { player1: 1 } });
    const turn = startTurn(board, 'player1', [6, 5]);
    expect(turn.requiredMoves).toBe(0);
    expect(isTurnComplete(turn)).toBe(true);
  });
});

describe('custom dice for lessons', () => {
  it('supports a single die', () => {
    const board = createBoard({ player1: { 13: 1 } });
    const turn = startCustomTurn(board, 'player1', [5]);
    expect(turn.requiredMoves).toBe(1);
    expect(legalMovesNow(turn)).toEqual([{ from: 13, to: 8, die: 5, hit: false }]);
    const done = playMove(turn, { from: 13, to: 8, die: 5 });
    expect(isTurnComplete(done)).toBe(true);
    expect(positionKey(undoLastMove(done).board)).toBe(positionKey(board));
  });

  it('does not apply the larger-die rule without a real roll', () => {
    const board = createBoard({ player1: { 13: 1 }, player2: { 4: 2 } });
    const turn = startCustomTurn(board, 'player1', [6, 3]);
    expect(legalMovesNow(turn).map((m) => m.die).sort()).toEqual([3, 6]);
  });
});

describe('step-by-step play agrees with whole-play generation', () => {
  const samples = samplePositions(70, 23);
  it.each(samples.map((sample, index) => [index, sample] as const))(
    'position %i',
    (_index, { board, player, roll }) => {
      const expected = new Set(getLegalPlays(board, player, roll).map((play) => play.key));
      expect(stepwiseKeys(startTurn(board, player, roll))).toEqual(expected);
    },
  );
});
