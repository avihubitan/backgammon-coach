import {
  applyMove,
  canBearOffWith,
  checkersAt,
  createBoard,
  entryPoint,
  initialBoard,
  legalSingleMoves,
  singleMove,
} from '../index';

describe('single checker movement', () => {
  it('moves player1 toward the 1-point', () => {
    const move = singleMove(initialBoard(), 'player1', 13, 5);
    expect(move).toEqual({ from: 13, to: 8, die: 5, hit: false });
  });

  it('moves player2 toward the 24-point', () => {
    const move = singleMove(initialBoard(), 'player2', 12, 5);
    expect(move).toEqual({ from: 12, to: 17, die: 5, hit: false });
  });

  it('cannot land on a point the opponent holds with two or more checkers', () => {
    // 24 - 5 = 19, which player2 holds with five checkers.
    expect(singleMove(initialBoard(), 'player1', 24, 5)).toBeNull();
  });

  it('can land on an empty point or a point it already owns', () => {
    expect(singleMove(initialBoard(), 'player1', 24, 3)).not.toBeNull();
    expect(singleMove(initialBoard(), 'player1', 8, 2)).toEqual({ from: 8, to: 6, die: 2, hit: false });
  });

  it('hits a single opposing checker (a blot)', () => {
    const board = createBoard({ player1: { 13: 2 }, player2: { 10: 1 } });
    const move = singleMove(board, 'player1', 13, 3);
    expect(move).toEqual({ from: 13, to: 10, die: 3, hit: true });
    const after = applyMove(board, 'player1', move!);
    expect(checkersAt(after, 10, 'player1')).toBe(1);
    expect(checkersAt(after, 10, 'player2')).toBe(0);
    expect(after.bar.player2).toBe(1);
  });

  it('requires a checker on the source point', () => {
    expect(singleMove(initialBoard(), 'player1', 7, 1)).toBeNull();
  });
});

describe('the bar', () => {
  it('enters player1 checkers into the opponent home board (25 - die)', () => {
    expect(entryPoint('player1', 1)).toBe(24);
    expect(entryPoint('player1', 6)).toBe(19);
    expect(entryPoint('player2', 1)).toBe(1);
    expect(entryPoint('player2', 6)).toBe(6);
  });

  it('forces checkers on the bar to enter before anything else moves', () => {
    const board = createBoard({ player1: { 13: 2 }, bar: { player1: 1 } });
    expect(singleMove(board, 'player1', 13, 3)).toBeNull();
    expect(legalSingleMoves(board, 'player1', 3)).toEqual([{ from: 'bar', to: 22, die: 3, hit: false }]);
  });

  it('cannot enter on a blocked point', () => {
    const board = createBoard({ player1: { 13: 2 }, player2: { 22: 2 }, bar: { player1: 1 } });
    expect(legalSingleMoves(board, 'player1', 3)).toEqual([]);
  });

  it('can hit while entering', () => {
    const board = createBoard({ player2: { 22: 1 }, bar: { player1: 1 } });
    const [move] = legalSingleMoves(board, 'player1', 3);
    expect(move).toEqual({ from: 'bar', to: 22, die: 3, hit: true });
    expect(applyMove(board, 'player1', move).bar.player2).toBe(1);
  });
});

describe('bearing off', () => {
  it('is not allowed until every checker is home', () => {
    const board = createBoard({ player1: { 3: 2, 8: 1 } });
    expect(canBearOffWith(board, 'player1', 3, 3)).toBe(false);
  });

  it('bears off with an exact number', () => {
    const board = createBoard({ player1: { 3: 2, 5: 1 } });
    expect(singleMove(board, 'player1', 3, 3)).toEqual({ from: 3, to: 'off', die: 3, hit: false });
  });

  it('bears off from the highest point with a larger number', () => {
    const board = createBoard({ player1: { 2: 2, 4: 1 } });
    expect(singleMove(board, 'player1', 4, 6)).toEqual({ from: 4, to: 'off', die: 6, hit: false });
  });

  it('does not allow a larger number while checkers sit on higher points', () => {
    const board = createBoard({ player1: { 2: 2, 4: 1 } });
    expect(singleMove(board, 'player1', 2, 5)).toBeNull();
  });

  it('must move inside the home board when the number is smaller than the point', () => {
    const board = createBoard({ player1: { 6: 1, 1: 1 } });
    expect(singleMove(board, 'player1', 6, 4)).toEqual({ from: 6, to: 2, die: 4, hit: false });
  });

  it('works for player2 too', () => {
    const board = createBoard({ player2: { 24: 1, 20: 1 } });
    expect(singleMove(board, 'player2', 20, 6)).toEqual({ from: 20, to: 'off', die: 6, hit: false });
    expect(singleMove(board, 'player2', 24, 6)).toBeNull();
    expect(singleMove(board, 'player2', 24, 1)).toEqual({ from: 24, to: 'off', die: 1, hit: false });
  });

  it('increments the borne-off count', () => {
    const board = createBoard({ player1: { 1: 1 } });
    const after = applyMove(board, 'player1', { from: 1, to: 'off', die: 1, hit: false });
    expect(after.off.player1).toBe(1);
  });
});
