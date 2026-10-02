import { chainMoves, finalSpots } from '../engine/moves';

const m = (from: number | 'bar', to: number | 'off', die = 1) => ({ from, to, die: die as 1, hit: false });

describe('move step helpers', () => {
  it('joins the hops of one checker into a single trip', () => {
    expect(chainMoves([m(13, 12), m(12, 6)])).toEqual([{ from: 13, to: 6 }]);
    expect(chainMoves([m(13, 7), m(8, 7)])).toEqual([
      { from: 13, to: 7 },
      { from: 8, to: 7 },
    ]);
    expect(chainMoves([m('bar', 20), m(20, 15), m(6, 'off')])).toEqual([
      { from: 'bar', to: 15 },
      { from: 6, to: 'off' },
    ]);
  });

  it('finds where checkers ended up, skipping stops in between', () => {
    expect(finalSpots([m(13, 10), m(10, 5)])).toEqual([5]);
    expect(finalSpots([m(13, 7), m(8, 7)])).toEqual([7]);
    expect(finalSpots([m(6, 'off'), m(5, 'off')])).toEqual(['off']);
  });
});
