import { checkersAt, isHomePoint, opponentOf } from '../board/board';
import type { BoardState, GameResult, Player, WinType } from '../types';
import { hasBorneOffAll } from './movement';

export const WIN_MULTIPLIER: Record<WinType, number> = { single: 1, gammon: 2, backgammon: 3 };

/** The player who has borne off every checker, if any. */
export function winnerOf(board: BoardState): Player | null {
  if (hasBorneOffAll(board, 'player1')) return 'player1';
  if (hasBorneOffAll(board, 'player2')) return 'player2';
  return null;
}

/**
 * How big a win is:
 * - backgammon: the loser bore off nothing and still has a checker on the bar
 *   or in the winner's home board
 * - gammon: the loser bore off nothing
 * - single: otherwise
 */
export function winTypeFor(board: BoardState, winner: Player): WinType {
  const loser = opponentOf(winner);
  if (board.off[loser] > 0) return 'single';
  if (board.bar[loser] > 0) return 'backgammon';
  for (let point = 1; point <= 24; point++) {
    if (isHomePoint(winner, point) && checkersAt(board, point, loser) > 0) return 'backgammon';
  }
  return 'gammon';
}

export interface ScoringOptions {
  /** Money-game Jacoby rule: gammons only count once the cube has been turned. */
  jacoby?: boolean;
}

export function resultForBearOff(
  board: BoardState,
  winner: Player,
  cubeValue: number,
  options: ScoringOptions = {},
): GameResult {
  let type = winTypeFor(board, winner);
  if (options.jacoby && cubeValue === 1) type = 'single';
  return {
    winner,
    type,
    cubeValue,
    points: cubeValue * WIN_MULTIPLIER[type],
    reason: 'bore-off',
  };
}
