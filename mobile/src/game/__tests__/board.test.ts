import {
  allCheckersHome,
  blotPoints,
  checkersAt,
  createBoard,
  hasContact,
  initialBoard,
  isBlot,
  isMadePoint,
  madePoints,
  mirrorBoard,
  ownerAt,
  pipCount,
  positionKey,
  totalCheckers,
  validateBoard,
} from '../index';

describe('board setup', () => {
  it('creates the standard starting position', () => {
    const board = initialBoard();
    expect(checkersAt(board, 24, 'player1')).toBe(2);
    expect(checkersAt(board, 13, 'player1')).toBe(5);
    expect(checkersAt(board, 8, 'player1')).toBe(3);
    expect(checkersAt(board, 6, 'player1')).toBe(5);
    expect(checkersAt(board, 1, 'player2')).toBe(2);
    expect(checkersAt(board, 12, 'player2')).toBe(5);
    expect(checkersAt(board, 17, 'player2')).toBe(3);
    expect(checkersAt(board, 19, 'player2')).toBe(5);
    expect(totalCheckers(board, 'player1')).toBe(15);
    expect(totalCheckers(board, 'player2')).toBe(15);
    expect(validateBoard(board)).toEqual([]);
  });

  it('gives both players a pip count of 167 at the start', () => {
    const board = initialBoard();
    expect(pipCount(board, 'player1')).toBe(167);
    expect(pipCount(board, 'player2')).toBe(167);
  });

  it('counts the bar as 25 pips', () => {
    const board = createBoard({ player1: { 6: 1 }, bar: { player1: 1 } });
    expect(pipCount(board, 'player1')).toBe(31);
  });

  it('reports point ownership', () => {
    const board = initialBoard();
    expect(ownerAt(board, 6)).toBe('player1');
    expect(ownerAt(board, 19)).toBe('player2');
    expect(ownerAt(board, 7)).toBeNull();
  });

  it('rejects specs that put both colours on one point', () => {
    expect(() => createBoard({ player1: { 5: 1 }, player2: { 5: 1 } })).toThrow();
  });

  it('rejects invalid point numbers', () => {
    expect(() => createBoard({ player1: { 25: 1 } })).toThrow();
    expect(() => createBoard({ player1: { 0: 1 } })).toThrow();
  });

  it('flags boards with too many checkers', () => {
    const board = createBoard({ player1: { 6: 16 } });
    expect(validateBoard(board)).toHaveLength(1);
  });
});

describe('blots and points', () => {
  const board = createBoard({ player1: { 6: 2, 8: 1, 13: 1 }, player2: { 19: 1, 20: 3 } });

  it('identifies blots', () => {
    expect(isBlot(board, 8, 'player1')).toBe(true);
    expect(isBlot(board, 6, 'player1')).toBe(false);
    expect(blotPoints(board, 'player1')).toEqual([8, 13]);
    expect(blotPoints(board, 'player2')).toEqual([19]);
  });

  it('identifies made points', () => {
    expect(isMadePoint(board, 6, 'player1')).toBe(true);
    expect(madePoints(board, 'player2')).toEqual([20]);
  });
});

describe('home board and contact', () => {
  it('knows when all checkers are home', () => {
    expect(allCheckersHome(createBoard({ player1: { 1: 3, 6: 2 } }), 'player1')).toBe(true);
    expect(allCheckersHome(createBoard({ player1: { 1: 3, 7: 1 } }), 'player1')).toBe(false);
    expect(allCheckersHome(createBoard({ player1: { 1: 3 }, bar: { player1: 1 } }), 'player1')).toBe(false);
    expect(allCheckersHome(createBoard({ player2: { 19: 3, 24: 1 } }), 'player2')).toBe(true);
  });

  it('detects contact versus a pure race', () => {
    expect(hasContact(initialBoard())).toBe(true);
    expect(hasContact(createBoard({ player1: { 10: 2, 3: 4 }, player2: { 11: 2, 20: 5 } }))).toBe(false);
    expect(hasContact(createBoard({ player1: { 12: 1 }, player2: { 11: 1 } }))).toBe(true);
  });
});

describe('mirroring', () => {
  it('mirrors the starting position onto itself', () => {
    expect(positionKey(mirrorBoard(initialBoard()))).toBe(positionKey(initialBoard()));
  });

  it('swaps bar and borne-off checkers', () => {
    const board = createBoard({ player1: { 3: 1 }, bar: { player2: 2 }, off: { player1: 5 } });
    const mirrored = mirrorBoard(board);
    expect(checkersAt(mirrored, 22, 'player2')).toBe(1);
    expect(mirrored.bar.player1).toBe(2);
    expect(mirrored.off.player2).toBe(5);
  });
});
