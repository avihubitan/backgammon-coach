import type { GameResult, PerPlayer, Player } from '../types';

export interface MatchScore extends PerPlayer<number> {
  /** Points needed to win the match; null for an open-ended money session. */
  matchLength: number | null;
  /** Whether the next/current game is the Crawford game (no doubling allowed). */
  crawfordGame: boolean;
  /** Whether the Crawford game has already been assigned in this match. */
  crawfordUsed: boolean;
  gamesPlayed: number;
}

export function newMatch(matchLength: number | null = null): MatchScore {
  return {
    player1: 0,
    player2: 0,
    matchLength,
    crawfordGame: false,
    crawfordUsed: false,
    gamesPlayed: 0,
  };
}

export function matchWinner(score: MatchScore): Player | null {
  if (score.matchLength === null) return null;
  if (score.player1 >= score.matchLength) return 'player1';
  if (score.player2 >= score.matchLength) return 'player2';
  return null;
}

/**
 * Adds a finished game to the score and works out whether the next game is
 * the Crawford game (the first game after a player reaches match point).
 */
export function applyGameResult(score: MatchScore, result: GameResult): MatchScore {
  const next: MatchScore = {
    ...score,
    [result.winner]: score[result.winner] + result.points,
    crawfordGame: false,
    gamesPlayed: score.gamesPlayed + 1,
  };
  if (next.matchLength !== null && matchWinner(next) === null && !next.crawfordUsed) {
    const matchPoint = next.matchLength - 1;
    if (next.player1 === matchPoint || next.player2 === matchPoint) {
      next.crawfordGame = true;
      next.crawfordUsed = true;
    }
  }
  return next;
}
