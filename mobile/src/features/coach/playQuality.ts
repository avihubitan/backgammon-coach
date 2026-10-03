import type { FinishedGame } from '@/features/gameplay/gameModel';
import type { GameReview } from '@/game';

/**
 * Move quality: one number per game, from 0 to 100, for how close your moves
 * came to the coach's best move. 100 means you matched the coach every time.
 * In simulated games the beginner computer scores about 45, the intermediate
 * about 65 and the advanced one close to 100.
 */
export const QUALITY_SCALE = 0.08;
/** Fewer real decisions than this make a score too noisy to show. */
export const MIN_REVIEWED_MOVES = 5;
/** Games shown in the trend. */
export const TREND_LIMIT = 10;
/** Games needed before recent games are compared with earlier ones. */
export const MIN_TREND_GAMES = 4;
/** A smaller difference between the two halves reads as "about the same". */
export const STEADY_RANGE = 3;

export function moveQuality(review: GameReview): number | null {
  if (review.summary.movesReviewed < MIN_REVIEWED_MOVES) return null;
  return Math.round(100 * Math.exp(-review.summary.averageLoss / QUALITY_SCALE));
}

export type QualityBand = 'excellent' | 'strong' | 'solid' | 'developing' | 'learning';

const BANDS: { band: QualityBand; min: number; label: string }[] = [
  { band: 'excellent', min: 85, label: 'Excellent' },
  { band: 'strong', min: 70, label: 'Strong' },
  { band: 'solid', min: 55, label: 'Solid' },
  { band: 'developing', min: 40, label: 'Developing' },
  { band: 'learning', min: 0, label: 'Learning' },
];

export function qualityBand(score: number): { band: QualityBand; label: string } {
  const entry = BANDS.find((candidate) => score >= candidate.min) ?? BANDS[BANDS.length - 1];
  return { band: entry.band, label: entry.label };
}

export interface QualityPoint {
  id: string;
  finishedAt: string;
  quality: number;
  won: boolean;
}

export interface QualityTrend {
  /** Oldest first, at most TREND_LIMIT games. */
  points: QualityPoint[];
  latest: number | null;
  /** The best score among all the games kept on this device. */
  best: number | null;
  /** The recent half of the games against the earlier half, once there are enough. */
  compare: { games: number; recent: number; earlier: number; change: number } | null;
}

const mean = (points: QualityPoint[]) => points.reduce((sum, point) => sum + point.quality, 0) / points.length;

/** Every scored game, oldest first. */
function scoredGames(games: readonly FinishedGame[]): QualityPoint[] {
  const points: QualityPoint[] = [];
  for (const game of games) {
    const quality = game.review ? moveQuality(game.review) : null;
    if (quality !== null) points.push({ id: game.id, finishedAt: game.finishedAt, quality, won: game.playerWon });
  }
  return points.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

export function qualityTrend(games: readonly FinishedGame[], limit = TREND_LIMIT): QualityTrend {
  const all = scoredGames(games);
  const shown = all.slice(-limit);
  if (shown.length === 0) return { points: shown, latest: null, best: null, compare: null };
  const half = Math.floor(shown.length / 2);
  const recent = Math.round(mean(shown.slice(shown.length - half)));
  const earlier = Math.round(mean(shown.slice(0, half)));
  return {
    points: shown,
    latest: shown[shown.length - 1].quality,
    best: Math.max(...all.map((point) => point.quality)),
    compare: shown.length >= MIN_TREND_GAMES ? { games: half, recent, earlier, change: recent - earlier } : null,
  };
}

/** Earlier scored games needed before a score can count as a personal best. */
export const MIN_GAMES_FOR_BEST = 3;

/** True when this game beat the score of every earlier game (once there are a few to beat). */
export function isPersonalBest(games: readonly FinishedGame[], gameId: string): boolean {
  const all = scoredGames(games);
  const index = all.findIndex((point) => point.id === gameId);
  if (index < MIN_GAMES_FOR_BEST) return false;
  return all[index].quality > Math.max(...all.slice(0, index).map((point) => point.quality));
}

/** One honest sentence about the trend: the numbers, not a verdict. */
export function trendMessage(trend: QualityTrend): string | null {
  if (trend.points.length === 0) return null;
  if (!trend.compare) {
    const needed = MIN_TREND_GAMES - trend.points.length;
    return `Play ${needed} more game${needed === 1 ? '' : 's'} to see your trend.`;
  }
  const { games, recent, change } = trend.compare;
  const lead = `Your last ${games} games average ${recent}`;
  if (change >= STEADY_RANGE) return `${lead}, up ${change} on the ${games} before.`;
  if (change <= -STEADY_RANGE) return `${lead}, down ${-change} on the ${games} before.`;
  return `${lead}, about the same as the ${games} before.`;
}

/** Recent finished games still waiting for their background review. */
export function pendingReviews(games: readonly FinishedGame[], limit = TREND_LIMIT): number {
  return games.slice(0, limit).filter((game) => !game.review && game.history.length > 0).length;
}
