import {
  applyNotation,
  checkersAt,
  createBoard,
  findPlayByNotation,
  formatPlay,
  initialBoard,
  parsePlayNotation,
  pointLabel,
} from '../index';

describe('formatting plays', () => {
  it('formats a simple play from the mover’s point of view', () => {
    expect(
      formatPlay('player1', [
        { from: 8, to: 5, die: 3, hit: false },
        { from: 6, to: 5, die: 1, hit: false },
      ]),
    ).toBe('8/5 6/5');
  });

  it('joins moves of the same checker', () => {
    expect(
      formatPlay('player1', [
        { from: 24, to: 21, die: 3, hit: false },
        { from: 21, to: 16, die: 5, hit: false },
      ]),
    ).toBe('24/16');
  });

  it('keeps hits visible', () => {
    expect(
      formatPlay('player1', [
        { from: 13, to: 10, die: 3, hit: true },
        { from: 10, to: 5, die: 5, hit: false },
      ]),
    ).toBe('13/10*/5');
  });

  it('groups repeated moves', () => {
    const move = { from: 8, to: 5, die: 3 as const, hit: false };
    expect(formatPlay('player1', [move, move])).toBe('8/5(2)');
  });

  it('uses player2’s own numbering', () => {
    expect(pointLabel('player2', 1)).toBe(24);
    expect(formatPlay('player2', [{ from: 1, to: 4, die: 3, hit: false }])).toBe('24/21');
  });

  it('describes a dance', () => {
    expect(formatPlay('player1', [])).toBe('No move');
  });
});

describe('parsing notation', () => {
  it('parses multipliers, hits, bar and off', () => {
    expect(parsePlayNotation('bar/22* 6/off(2)')).toEqual([
      { path: ['bar', 22], hits: [1] },
      { path: [6, 'off'], hits: [] },
      { path: [6, 'off'], hits: [] },
    ]);
  });

  it('rejects malformed moves', () => {
    expect(() => parsePlayNotation('13')).toThrow();
    expect(() => parsePlayNotation('13/30')).toThrow();
  });

  it('applies notation to a board', () => {
    const after = applyNotation(initialBoard(), 'player1', '8/5 6/5');
    expect(checkersAt(after, 5, 'player1')).toBe(2);
    expect(checkersAt(after, 8, 'player1')).toBe(2);
  });

  it('hits blots at the end of a move automatically', () => {
    const board = createBoard({ player1: { 13: 1 }, player2: { 10: 1 } });
    expect(applyNotation(board, 'player1', '13/10').bar.player2).toBe(1);
  });

  it('finds the matching legal play', () => {
    expect(findPlayByNotation(initialBoard(), 'player1', [6, 1], '13/7 8/7')).not.toBeNull();
    // 24/18 with a 6-1 is legal but 24/17 would need a 7 with two checkers... not a legal play.
    expect(findPlayByNotation(initialBoard(), 'player1', [6, 1], '24/15')).toBeNull();
  });
});
