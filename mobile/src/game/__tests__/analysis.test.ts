import {
  createBoard,
  explainDifference,
  findPlayByNotation,
  initialBoard,
  installNetwork,
  reviewGame,
  reviewMove,
  severityFor,
  type BoardState,
  type DiceRoll,
  type Player,
  type TurnRecord,
} from '../index';

beforeAll(() => installNetwork(null));

function turn(board: BoardState, roll: DiceRoll, notation: string, player: Player = 'player1'): TurnRecord {
  const play = findPlayByNotation(board, player, roll, notation);
  if (!play) throw new Error(`Illegal test play ${notation}`);
  return { player, roll, boardBefore: board, moves: play.moves };
}

/** Earlier (unreviewed) turns so the reviewed move is not treated as an opening move. */
const filler = (n: number): TurnRecord[] =>
  Array.from({ length: n }, () => ({ player: 'player1' as Player, roll: null, boardBefore: initialBoard(), moves: [] }));

describe('severity', () => {
  it('grades equity losses', () => {
    expect(severityFor(0, 1)).toBe('best');
    expect(severityFor(0.01, 2)).toBe('fine');
    expect(severityFor(0.04, 2)).toBe('inaccuracy');
    expect(severityFor(0.1, 3)).toBe('mistake');
    expect(severityFor(0.3, 9)).toBe('blunder');
  });
});

describe('move review', () => {
  it('recognises the best move', () => {
    const history = [turn(initialBoard(), [3, 1], '8/5 6/5')];
    const review = reviewMove(history, 0)!;
    expect(review.severity).toBe('best');
    expect(review.rank).toBe(1);
  });

  it('explains a missed point in the opening', () => {
    const history = [turn(initialBoard(), [3, 1], '24/23 13/10')];
    const review = reviewMove(history, 0)!;
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(review.severity);
    expect(review.category).toBe('opening');
    expect(review.explanation).toContain('8/5 6/5');
    expect(review.explanation).toMatch(/5-point/);
  });

  it('spots a missed hit', () => {
    const board = createBoard({
      player1: { 13: 4, 8: 3, 6: 5, 24: 2, 5: 1 },
      player2: { 9: 1, 19: 5, 17: 3, 12: 4, 1: 2 },
    });
    const history = [...filler(3), turn(board, [4, 1], '24/20 24/23')];
    const review = reviewMove(history, 3)!;
    expect(review.loss).toBeGreaterThan(0.02);
    expect(review.category).toBe('hitting');
    expect(review.headline).toBe('You missed a hit');
  });

  it('flags a needlessly risky play', () => {
    // Two loose checkers can be tucked safely onto the 6-point with 3-2.
    const board = createBoard({
      player1: { 13: 2, 9: 1, 8: 1, 6: 2 },
      player2: { 19: 3, 17: 3, 12: 3, 1: 2 },
    });
    const history = [...filler(3), turn(board, [3, 2], '13/10 13/11')];
    const review = reviewMove(history, 3)!;
    expect(review.severity).not.toBe('best');
    expect(review.best.length).toBe(2);
    expect(review.explanation.length).toBeGreaterThan(20);
  });

  it('uses racing language in a pure race', () => {
    const board = createBoard({ player1: { 10: 3, 9: 3, 4: 4 }, player2: { 15: 4, 20: 6 } });
    const history = [...filler(3), turn(board, [6, 5], '10/4 9/4')];
    const review = reviewMove(history, 3);
    // Either it was fine, or the explanation must talk about the race.
    if (review && review.severity !== 'best' && review.severity !== 'fine') {
      expect(review.category).toBe('racing');
    }
  });

  it('teaches bear-off efficiency', () => {
    const board = createBoard({ player1: { 6: 1, 5: 1, 1: 2 }, player2: { 20: 6 } });
    const played = findPlayByNotation(board, 'player1', [6, 5], '6/1 5/off')!.moves;
    const best = findPlayByNotation(board, 'player1', [6, 5], '6/off 5/off')!.moves;
    const explained = explainDifference(board, 'player1', played, best, false);
    expect(explained.category).toBe('bearing-off');
    expect(explained.headline).toMatch(/bear off more/);
    expect(explained.explanation).toContain('6/off 5/off');
  });

  it('explains a missed anchor', () => {
    const board = createBoard({
      player1: { 24: 1, 22: 1, 13: 5, 8: 3, 6: 5 },
      player2: { 1: 2, 12: 4, 17: 3, 18: 2, 19: 4 },
    });
    const played = findPlayByNotation(board, 'player1', [4, 2], '13/9 13/11')!.moves;
    const best = findPlayByNotation(board, 'player1', [4, 2], '24/22 13/9')!.moves;
    const explained = explainDifference(board, 'player1', played, best, false);
    expect(explained.headline).toBe('An anchor was available');
  });
});

describe('game review', () => {
  it('summarises a game and finds the focus area', () => {
    const history = [
      turn(initialBoard(), [3, 1], '24/23 13/10'),
      turn(initialBoard(), [4, 2], '8/4 6/4'),
    ];
    const review = reviewGame(history, 'player1');
    expect(review.summary.movesReviewed).toBe(2);
    expect(review.summary.bestMoves).toBeGreaterThanOrEqual(1);
    expect(review.moves[0].severity).not.toBe('best');
  });

  it('reviews cube decisions', () => {
    const hopeless = createBoard({ player1: { 20: 15 }, player2: { 24: 2 }, off: { player2: 13 } });
    const drop: TurnRecord = { player: 'player1', roll: null, boardBefore: hopeless, moves: [], cubeAction: 'drop' };
    const take: TurnRecord = { player: 'player1', roll: null, boardBefore: hopeless, moves: [], cubeAction: 'take' };
    expect(reviewGame([drop]).cube[0].correct).toBe(true);
    expect(reviewGame([take]).cube[0].correct).toBe(false);
    expect(reviewGame([take]).summary.focus).toBe('cube');
  });
});
