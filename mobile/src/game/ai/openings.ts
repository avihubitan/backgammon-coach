import { initialBoard, positionKey } from '../board/board';
import type { DiceRoll } from '../dice/dice';
import { findPlayByNotation } from '../moves/notation';
import type { LegalPlay } from '../rules/plays';
import type { BoardState, Player } from '../types';

/**
 * Standard replies to every roll from the starting position, written from the
 * mover's point of view. These are the widely taught modern choices.
 */
export const OPENING_PLAYS: Record<string, string> = {
  '2-1': '13/11 6/5',
  '3-1': '8/5 6/5',
  '4-1': '24/23 13/9',
  '5-1': '24/23 13/8',
  '6-1': '13/7 8/7',
  '3-2': '24/21 13/11',
  '4-2': '8/4 6/4',
  '5-2': '13/8 13/11',
  '6-2': '24/18 13/11',
  '4-3': '24/20 13/10',
  '5-3': '8/3 6/3',
  '6-3': '24/18 13/10',
  '5-4': '24/20 13/8',
  '6-4': '24/18 13/9',
  '6-5': '24/13',
  '1-1': '8/7(2) 6/5(2)',
  '2-2': '13/11(2) 6/4(2)',
  '3-3': '8/5(2) 6/3(2)',
  '4-4': '24/20(2) 13/9(2)',
  '5-5': '13/3(2)',
  '6-6': '24/18(2) 13/7(2)',
};

export function rollKey(roll: DiceRoll): string {
  const [a, b] = roll[0] >= roll[1] ? roll : [roll[1], roll[0]];
  return `${a}-${b}`;
}

const START_KEY = positionKey(initialBoard());

/** The book play when `player`'s own checkers are still in the starting position. */
export function openingBookPlay(board: BoardState, player: Player, roll: DiceRoll): LegalPlay | null {
  if (!ownSideIsInitial(board, player)) return null;
  const notation = OPENING_PLAYS[rollKey(roll)];
  if (!notation) return null;
  return findPlayByNotation(board, player, roll, notation);
}

function ownSideIsInitial(board: BoardState, player: Player): boolean {
  if (positionKey(board) === START_KEY) return true;
  const start = initialBoard();
  for (let point = 1; point <= 24; point++) {
    const sign = player === 'player1' ? 1 : -1;
    const mine = Math.max(0, board.points[point] * sign);
    const expected = Math.max(0, start.points[point] * sign);
    if (mine !== expected) return false;
  }
  return board.bar[player] === 0 && board.off[player] === 0;
}
