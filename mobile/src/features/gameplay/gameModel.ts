import type { GameAchievementStats } from '@/features/learning/achievements';
import {
  applyGameResult,
  createGame,
  matchWinner,
  newMatch,
  type AiLevel,
  type DieValue,
  type GameResult,
  type GameReview,
  type GameState,
  type MatchScore,
  type TurnRecord,
} from '@/game';

/**
 * Plain data describing games against the computer. The store persists it;
 * these helpers keep the rules for recording results out of React.
 */
export interface GameSettings {
  level: AiLevel;
  cubeEnabled: boolean;
  /** Points needed to win; 1 = a single game. */
  matchLength: number;
}

export interface ActiveGame {
  id: string;
  settings: GameSettings;
  state: GameState;
  match: MatchScore;
  startedAt: string;
  /** The most recent opening roll, for display. */
  openingRoll: { player1: DieValue; player2: DieValue } | null;
  /** Number of the game inside the match (1-based). */
  gameNumber: number;
  /** Coach hints asked for in this game (missing in games saved before hints). */
  hintsUsed?: number;
  /** Coach Watch checks shown in this game. */
  watchUsed?: number;
  /** History length when Coach Watch last stopped the player (spacing between stops). */
  watchLastPly?: number;
}

export interface FinishedGame {
  id: string;
  level: AiLevel;
  startedAt: string;
  finishedAt: string;
  result: GameResult;
  playerWon: boolean;
  history: TurnRecord[];
  /** Points the match was played to (1 = single game). */
  matchLength: number;
  /** The coach's review, computed the first time the game is reviewed. */
  review?: GameReview;
}

export interface GameStats extends GameAchievementStats {
  playedByLevel: Partial<Record<AiLevel, number>>;
  pointsWon: number;
  pointsLost: number;
}

export const emptyGameStats = (): GameStats => ({
  gamesPlayed: 0,
  gamesWon: 0,
  gammonsWon: 0,
  winsByLevel: {},
  playedByLevel: {},
  pointsWon: 0,
  pointsLost: 0,
});

export const MAX_HISTORY = 30;

export function startActiveGame(id: string, settings: GameSettings, now: string): ActiveGame {
  const match = newMatch(settings.matchLength > 1 ? settings.matchLength : null);
  return {
    id,
    settings,
    match,
    state: createGame({ cubeEnabled: settings.cubeEnabled, crawford: false }),
    startedAt: now,
    openingRoll: null,
    gameNumber: 1,
    hintsUsed: 0,
    watchUsed: 0,
    watchLastPly: undefined,
  };
}

/** Starts the next game of a match after the previous one ended. */
export function nextGameInMatch(active: ActiveGame): ActiveGame {
  return {
    ...active,
    state: createGame({ cubeEnabled: active.settings.cubeEnabled, crawford: active.match.crawfordGame }),
    openingRoll: null,
    gameNumber: active.gameNumber + 1,
    // Each game of a match gets its own hints and checks.
    hintsUsed: 0,
    watchUsed: 0,
    watchLastPly: undefined,
  };
}

export function recordGameStats(stats: GameStats, level: AiLevel, result: GameResult): GameStats {
  const won = result.winner === 'player1';
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: stats.gamesWon + (won ? 1 : 0),
    gammonsWon: stats.gammonsWon + (won && result.type !== 'single' && result.reason === 'bore-off' ? 1 : 0),
    winsByLevel: { ...stats.winsByLevel, [level]: (stats.winsByLevel[level] ?? 0) + (won ? 1 : 0) },
    playedByLevel: { ...stats.playedByLevel, [level]: (stats.playedByLevel[level] ?? 0) + 1 },
    pointsWon: stats.pointsWon + (won ? result.points : 0),
    pointsLost: stats.pointsLost + (won ? 0 : result.points),
  };
}

/** XP for finishing a game: more for wins and for tougher opponents. */
export function gameXp(level: AiLevel, result: GameResult): number {
  const won = result.winner === 'player1';
  if (!won) return result.reason === 'resigned' ? 3 : 10;
  const base = level === 'beginner' ? 20 : level === 'intermediate' ? 30 : 45;
  return Math.round(base * (result.type === 'single' ? 1 : result.type === 'gammon' ? 1.5 : 2));
}

export function applyResultToMatch(active: ActiveGame, result: GameResult): { match: MatchScore; matchOver: boolean } {
  const match = applyGameResult(active.match, result);
  return { match, matchOver: active.settings.matchLength <= 1 || matchWinner(match) !== null };
}
