import { createBoard, initialBoard, startCustomTurn, startTurn } from '@/game';

import { destinationsFrom, playMoves, resolveTap, usedDice } from '../moveInput';

describe('tap to move', () => {
  const opening = startTurn(initialBoard(), 'player1', [3, 1]);

  it('selects a movable checker', () => {
    expect(resolveTap(opening, null, 8)).toEqual({ kind: 'select', source: 8 });
  });

  it('moves the selected checker to a highlighted point', () => {
    const result = resolveTap(opening, 8, 5);
    expect(result).toEqual({ kind: 'move', moves: [{ from: 8, to: 5, die: 3, hit: false }] });
  });

  it('moves one checker by both dice in one tap', () => {
    const result = resolveTap(opening, 8, 4);
    expect(result.kind).toBe('move');
    if (result.kind === 'move') expect(result.moves.map((m) => m.to)).toEqual([7, 4]);
  });

  it('keeps the selection when tapping the same checker again', () => {
    expect(resolveTap(opening, 8, 8)).toEqual({ kind: 'ignore' });
  });

  it('switches selection to another movable checker', () => {
    expect(resolveTap(opening, 8, 13)).toEqual({ kind: 'select', source: 13 });
  });

  it('explains taps on the opponent’s checkers', () => {
    const result = resolveTap(opening, null, 19);
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/opponent/);
  });

  it('allows tapping a destination directly when only one checker can reach it', () => {
    const turn = startCustomTurn(createBoard({ player1: { 13: 1 } }), 'player1', [3]);
    expect(resolveTap(turn, null, 10)).toEqual({ kind: 'move', moves: [{ from: 13, to: 10, die: 3, hit: false }] });
  });

  it('reminds the player to enter from the bar first', () => {
    const turn = startTurn(createBoard({ player1: { 13: 2 }, bar: { player1: 1 } }), 'player1', [3, 1]);
    const result = resolveTap(turn, null, 13);
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/bar/);
    expect(resolveTap(turn, null, 'bar')).toEqual({ kind: 'select', source: 'bar' });
  });

  it('bears off with the exact die when several work', () => {
    const turn = startTurn(createBoard({ player1: { 3: 1, 1: 1 } }), 'player1', [5, 3]);
    const paths = destinationsFrom(turn, 3);
    expect(paths.get('off')).toEqual([{ from: 3, to: 'off', die: 3, hit: false }]);
  });

  it('ignores taps after the turn is complete', () => {
    const done = playMoves(opening, [
      { from: 8, to: 5, die: 3, hit: false },
      { from: 6, to: 5, die: 1, hit: false },
    ]);
    expect(resolveTap(done, null, 13)).toEqual({ kind: 'ignore' });
  });

  it('tracks used dice for display', () => {
    const one = playMoves(opening, [{ from: 8, to: 5, die: 3, hit: false }]);
    expect(usedDice(one)).toEqual([true, false]);
  });
});
