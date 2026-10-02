import {
  applyMove,
  countAt,
  initialBoard,
  ownerAt,
  type BoardState,
  type CheckerMove,
  type DieValue,
  type MoveSource,
  type MoveTarget,
  type Player,
} from '@/game';

/**
 * A short scripted opening that plays itself behind the welcome screen:
 * dice throws, a made point, a hit and a checker entering from the bar.
 */
export interface AttractTurn {
  player: Player;
  dice: [DieValue, DieValue];
  moves: { from: MoveSource; to: MoveTarget }[];
}

export const ATTRACT_SCRIPT: AttractTurn[] = [
  // Make the 5-point.
  { player: 'player1', dice: [3, 1], moves: [{ from: 8, to: 5 }, { from: 6, to: 5 }] },
  // The opponent brings two builders down, leaving blots.
  { player: 'player2', dice: [6, 4], moves: [{ from: 12, to: 18 }, { from: 12, to: 16 }] },
  // Hit!
  { player: 'player1', dice: [6, 2], moves: [{ from: 24, to: 18 }, { from: 13, to: 11 }] },
  // Back in from the bar.
  { player: 'player2', dice: [4, 3], moves: [{ from: 'bar', to: 3 }, { from: 16, to: 20 }] },
];

function distance(player: Player, from: MoveSource, to: MoveTarget): number {
  if (to === 'off') throw new Error('The attract script never bears off');
  if (player === 'player1') return (from === 'bar' ? 25 : from) - to;
  return to - (from === 'bar' ? 0 : from);
}

/** The board after each move of a scripted turn. */
export function playAttractTurn(board: BoardState, turn: AttractTurn): BoardState[] {
  const boards: BoardState[] = [];
  let current = board;
  const opponent: Player = turn.player === 'player1' ? 'player2' : 'player1';
  for (const { from, to } of turn.moves) {
    const hit = to !== 'off' && ownerAt(current, to) === opponent && countAt(current, to) === 1;
    const move: CheckerMove = { from, to, die: distance(turn.player, from, to) as DieValue, hit };
    current = applyMove(current, turn.player, move);
    boards.push(current);
  }
  return boards;
}

export function attractStart(): BoardState {
  return initialBoard();
}
