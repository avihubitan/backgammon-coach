import {
  ALL_ROLLS,
  createBoard,
  findPlayByNotation,
  getLegalPlays,
  initialBoard,
  maxDiceUsable,
  requiredMoveCount,
  type DiceRoll,
} from '../index';
import { naivePlayKeys, samplePositions } from './helpers';

const keysOf = (plays: { key: string }[]) => new Set(plays.map((play) => play.key));

describe('using the dice', () => {
  it('offers the classic 3-1 opening (8/5 6/5)', () => {
    const plays = getLegalPlays(initialBoard(), 'player1', [3, 1]);
    expect(findPlayByNotation(initialBoard(), 'player1', [3, 1], '8/5 6/5')).not.toBeNull();
    expect(plays.every((play) => play.moves.length === 2)).toBe(true);
  });

  it('lets one checker use both numbers', () => {
    // 24/21/16 style: one checker moves 3 then 5.
    expect(findPlayByNotation(initialBoard(), 'player1', [5, 3], '24/16')).not.toBeNull();
  });

  it('must use both dice when possible, even if that forces a particular order', () => {
    // A lone checker on 24: the 6 is blocked from 24 (18 is held), but 5 then 6 works.
    const board = createBoard({ player1: { 24: 1 }, player2: { 18: 2 } });
    const plays = getLegalPlays(board, 'player1', [6, 5]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves.map((m) => [m.from, m.to, m.die])).toEqual([
      [24, 19, 5],
      [19, 13, 6],
    ]);
  });

  it('must play the larger die when only one die can be played', () => {
    // From 13: 6 lands on 7, 3 lands on 10, but both routes to 4 are blocked.
    const board = createBoard({ player1: { 13: 1 }, player2: { 4: 2 } });
    const plays = getLegalPlays(board, 'player1', [6, 3]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves).toEqual([{ from: 13, to: 7, die: 6, hit: false }]);
  });

  it('plays the smaller die when the larger cannot be played at all', () => {
    const board = createBoard({ player1: { 13: 1 }, player2: { 7: 2, 4: 2 } });
    const plays = getLegalPlays(board, 'player1', [6, 3]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves).toEqual([{ from: 13, to: 10, die: 3, hit: false }]);
  });

  it('returns a single empty play when nothing can move', () => {
    const board = createBoard({ player1: { 13: 2 }, player2: { 19: 2, 20: 2 }, bar: { player1: 1 } });
    const plays = getLegalPlays(board, 'player1', [6, 5]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves).toEqual([]);
    expect(requiredMoveCount(board, 'player1', [6, 5])).toBe(0);
  });
});

describe('doubles', () => {
  it('plays a double four times', () => {
    const plays = getLegalPlays(initialBoard(), 'player1', [6, 6]);
    expect(plays.every((play) => play.moves.length === 4)).toBe(true);
    expect(findPlayByNotation(initialBoard(), 'player1', [6, 6], '24/18(2) 13/7(2)')).not.toBeNull();
  });

  it('plays as many of the four moves as possible when blocked', () => {
    // A single checker on 13 with 5-5: 8 and 3 are open, but -2 is past home while not all home... (other checker keeps it out)
    const board = createBoard({ player1: { 13: 1, 20: 1 }, player2: { 15: 2 } });
    // The checker on 20 is blocked by 15 (20-5); the 13 checker can go 13/8/3 and then not further.
    expect(maxDiceUsable(board, 'player1', [5, 5, 5, 5])).toBe(2);
    const plays = getLegalPlays(board, 'player1', [5, 5]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves).toHaveLength(2);
  });
});

describe('the bar during a turn', () => {
  it('enters first, then plays the other die freely', () => {
    const board = createBoard({ player1: { 6: 2 }, bar: { player1: 1 } });
    const plays = getLegalPlays(board, 'player1', [4, 2]);
    expect(plays.length).toBeGreaterThan(0);
    for (const play of plays) {
      expect(play.moves[0].from).toBe('bar');
      expect(play.moves).toHaveLength(2);
    }
  });

  it('cannot use the second die if another checker is still stuck on the bar', () => {
    const board = createBoard({ player1: { 6: 2 }, player2: { 19: 2 }, bar: { player1: 2 } });
    const plays = getLegalPlays(board, 'player1', [6, 5]);
    expect(plays).toHaveLength(1);
    expect(plays[0].moves).toEqual([{ from: 'bar', to: 20, die: 5, hit: false }]);
  });
});

describe('bearing off during a turn', () => {
  it('allows bearing off the last checker without using the other die', () => {
    const board = createBoard({ player1: { 3: 1 } });
    const plays = getLegalPlays(board, 'player1', [6, 1]);
    const winningInOne = plays.find((play) => play.moves.length === 1);
    expect(winningInOne?.moves[0]).toEqual({ from: 3, to: 'off', die: 6, hit: false });
  });

  it('can only bear off after a checker comes home in the same turn', () => {
    const board = createBoard({ player1: { 8: 1, 2: 1 } });
    // 8/2 with the 6 brings the straggler home, then the 2 bears off from the 2-point.
    expect(findPlayByNotation(board, 'player1', [6, 2], '8/2 2/off')).not.toBeNull();
  });
});

describe('cross-check against a naive generator', () => {
  const samples = samplePositions(220, 11);

  it.each(samples.map((sample, index) => [index, sample] as const))(
    'position %i matches the reference implementation',
    (_index, { board, player, roll }) => {
      expect(keysOf(getLegalPlays(board, player, roll))).toEqual(naivePlayKeys(board, player, roll));
    },
  );

  it('matches for every roll from the starting position', () => {
    for (const { dice } of ALL_ROLLS) {
      const roll = dice as DiceRoll;
      expect(keysOf(getLegalPlays(initialBoard(), 'player1', roll))).toEqual(
        naivePlayKeys(initialBoard(), 'player1', roll),
      );
      expect(keysOf(getLegalPlays(initialBoard(), 'player2', roll))).toEqual(
        naivePlayKeys(initialBoard(), 'player2', roll),
      );
    }
  });
});
