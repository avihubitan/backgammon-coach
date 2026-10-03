import type { FinishedGame } from '@/features/gameplay/gameModel';
import type { GameReview } from '@/game';

import {
  isPersonalBest,
  MIN_REVIEWED_MOVES,
  moveQuality,
  pendingReviews,
  qualityBand,
  qualityTrend,
  trendMessage,
} from '../playQuality';

function review(averageLoss: number, movesReviewed = 20): GameReview {
  return {
    moves: [],
    cube: [],
    summary: {
      movesReviewed,
      bestMoves: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
      averageLoss,
      byCategory: {},
      focus: null,
      biggest: null,
    },
  };
}

let day = 0;
function game(quality: number | null, { won = false, moves = 20 } = {}): FinishedGame {
  day++;
  // Inverse of the quality formula, so tests can speak in scores.
  const loss = quality === null ? 0 : -0.08 * Math.log(Math.max(quality, 0.5) / 100);
  return {
    id: `g${day}`,
    level: 'beginner',
    startedAt: `2026-03-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    finishedAt: `2026-03-${String(day).padStart(2, '0')}T10:20:00.000Z`,
    result: { winner: won ? 'player1' : 'player2', type: 'single', cubeValue: 1, points: 1, reason: 'bore-off' },
    playerWon: won,
    history: [{ player: 'player1', roll: [3, 1], boardBefore: [] as never, moves: [] }],
    matchLength: 1,
    review: quality === null ? undefined : review(loss, moves),
  };
}

beforeEach(() => {
  day = 0;
});

describe('move quality', () => {
  it('is 100 when every move matched the coach', () => {
    expect(moveQuality(review(0))).toBe(100);
  });

  it('falls as more equity is given away', () => {
    const scores = [0.01, 0.03, 0.06, 0.12].map((loss) => moveQuality(review(loss))!);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(moveQuality(review(0.08))).toBe(37);
  });

  it('needs enough real decisions to mean something', () => {
    expect(moveQuality(review(0.02, MIN_REVIEWED_MOVES - 1))).toBeNull();
    expect(moveQuality(review(0.02, MIN_REVIEWED_MOVES))).not.toBeNull();
  });

  it('names a band for every score', () => {
    expect(qualityBand(100).label).toBe('Excellent');
    expect(qualityBand(85).band).toBe('excellent');
    expect(qualityBand(84).band).toBe('strong');
    expect(qualityBand(60).band).toBe('solid');
    expect(qualityBand(45).band).toBe('developing');
    expect(qualityBand(0).band).toBe('learning');
  });
});

describe('quality trend', () => {
  it('is empty without reviewed games', () => {
    const trend = qualityTrend([game(null), game(null)]);
    expect(trend).toEqual({ points: [], latest: null, best: null, compare: null });
    expect(trendMessage(trend)).toBeNull();
  });

  it('orders games oldest first and skips unreviewed and very short ones', () => {
    // The store keeps the newest game first.
    const games = [game(70), game(null), game(50, { moves: 2 }), game(40)].reverse();
    const trend = qualityTrend(games);
    expect(trend.points.map((point) => point.quality)).toEqual([70, 40]);
    expect(trend.latest).toBe(40);
    expect(trend.best).toBe(70);
  });

  it('asks for more games before comparing', () => {
    const trend = qualityTrend([game(50), game(60)]);
    expect(trend.compare).toBeNull();
    expect(trendMessage(trend)).toBe('Play 2 more games to see your trend.');
    expect(trendMessage(qualityTrend([game(50), game(60), game(55)]))).toBe('Play 1 more game to see your trend.');
  });

  it('compares the recent half with the earlier half', () => {
    const trend = qualityTrend([40, 44, 50, 60, 64, 70].map((quality) => game(quality)));
    expect(trend.compare).toEqual({ games: 3, recent: 65, earlier: 45, change: 20 });
    expect(trendMessage(trend)).toBe('Your last 3 games average 65, up 20 on the 3 before.');
  });

  it('leaves the middle game out of an odd number', () => {
    const trend = qualityTrend([50, 52, 90, 60, 62].map((quality) => game(quality)));
    expect(trend.compare).toEqual({ games: 2, recent: 61, earlier: 51, change: 10 });
  });

  it('reports a drop and a steady run in plain numbers', () => {
    expect(trendMessage(qualityTrend([70, 72, 60, 58].map((quality) => game(quality))))).toBe(
      'Your last 2 games average 59, down 12 on the 2 before.',
    );
    expect(trendMessage(qualityTrend([60, 62, 61, 63].map((quality) => game(quality))))).toBe(
      'Your last 2 games average 62, about the same as the 2 before.',
    );
  });

  it('shows the last ten games', () => {
    const trend = qualityTrend(Array.from({ length: 14 }, (_, index) => game(30 + index * 5)));
    expect(trend.points).toHaveLength(10);
    expect(trend.points[0].quality).toBe(50);
    expect(trend.latest).toBe(95);
  });

  it('keeps who won each game', () => {
    const trend = qualityTrend([game(50, { won: true }), game(60)]);
    expect(trend.points.map((point) => point.won)).toEqual([true, false]);
  });
});

describe('pending reviews', () => {
  it('counts recent games that still need a review', () => {
    const empty = { ...game(null), history: [] };
    expect(pendingReviews([game(null), game(50), game(null), empty])).toBe(2);
    expect(pendingReviews([game(null), game(null)], 1)).toBe(1);
  });
});

describe('personal best', () => {
  it('needs a few earlier games to beat', () => {
    const games = [game(40), game(50), game(60)];
    expect(isPersonalBest(games, 'g3')).toBe(false);
  });

  it('celebrates a score above every earlier one', () => {
    const games = [game(40), game(70), game(50), game(75), game(72)];
    expect(isPersonalBest(games, 'g4')).toBe(true);
    // Below an earlier best, or only a tie, is not a new best.
    expect(isPersonalBest(games, 'g5')).toBe(false);
    expect(isPersonalBest([game(60), game(60), game(60), game(60)], 'g4')).toBe(false);
  });

  it('ignores unscored games and unknown ids', () => {
    expect(isPersonalBest([game(40), game(null), game(50), game(45), game(90)], 'g5')).toBe(true);
    expect(isPersonalBest([game(40)], 'nope')).toBe(false);
  });

  it('counts the best across every stored game, not only the ones shown', () => {
    const trend = qualityTrend([game(99), ...Array.from({ length: 10 }, () => game(50))]);
    expect(trend.points).toHaveLength(10);
    expect(trend.best).toBe(99);
  });
});
