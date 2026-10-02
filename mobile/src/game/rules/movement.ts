import {
  allCheckersHome,
  checkersAt,
  cloneBoard,
  opponentOf,
  pipDistance,
  pointAtDistance,
  signOf,
} from '../board/board';
import type {
  BoardState,
  CheckerMove,
  DieValue,
  MoveSource,
  MoveTarget,
  Player,
  PointNumber,
} from '../types';

/** Pip distance of a move source: the bar counts as 25. */
export function sourceDistance(player: Player, from: MoveSource): number {
  return from === 'bar' ? 25 : pipDistance(player, from);
}

/** The point a checker re-enters on from the bar with a given die. */
export function entryPoint(player: Player, die: DieValue): PointNumber {
  return pointAtDistance(player, 25 - die);
}

/**
 * Where a checker would land, ignoring legality. Returns 'off' when the move
 * carries the checker past its home board.
 */
export function rawTarget(player: Player, from: MoveSource, die: DieValue): MoveTarget {
  const distance = sourceDistance(player, from) - die;
  if (distance <= 0) return 'off';
  return pointAtDistance(player, distance);
}

/** A point is open for `player` unless the opponent holds it with two or more checkers. */
export function isPointOpen(board: BoardState, player: Player, point: PointNumber): boolean {
  return checkersAt(board, point, opponentOf(player)) < 2;
}

/**
 * Whether the checker on `from` may be borne off with `die`.
 * Exact numbers always work; larger numbers only work from the highest occupied point.
 */
export function canBearOffWith(
  board: BoardState,
  player: Player,
  from: PointNumber,
  die: DieValue,
): boolean {
  if (!allCheckersHome(board, player)) return false;
  if (checkersAt(board, from, player) === 0) return false;
  const distance = pipDistance(player, from);
  if (die === distance) return true;
  if (die < distance) return false;
  for (let d = distance + 1; d <= 6; d++) {
    if (checkersAt(board, pointAtDistance(player, d), player) > 0) return false;
  }
  return true;
}

/**
 * Builds the move for `from` + `die` if it is legal in isolation (ignoring the
 * whole-turn rules such as "use both dice"). Returns null when illegal.
 */
export function singleMove(
  board: BoardState,
  player: Player,
  from: MoveSource,
  die: DieValue,
): CheckerMove | null {
  if (from === 'bar') {
    if (board.bar[player] === 0) return null;
  } else {
    if (board.bar[player] > 0) return null; // must enter from the bar first
    if (checkersAt(board, from, player) === 0) return null;
  }
  const to = rawTarget(player, from, die);
  if (to === 'off') {
    if (from === 'bar') return null;
    return canBearOffWith(board, player, from, die) ? { from, to, die, hit: false } : null;
  }
  if (!isPointOpen(board, player, to)) return null;
  const hit = checkersAt(board, to, opponentOf(player)) === 1;
  return { from, to, die, hit };
}

/** All single-checker moves available for one die value. */
export function legalSingleMoves(board: BoardState, player: Player, die: DieValue): CheckerMove[] {
  if (board.bar[player] > 0) {
    const entry = singleMove(board, player, 'bar', die);
    return entry ? [entry] : [];
  }
  const moves: CheckerMove[] = [];
  // Iterate from the player's back checkers toward home for a natural ordering.
  for (let distance = 24; distance >= 1; distance--) {
    const from = pointAtDistance(player, distance);
    if (checkersAt(board, from, player) === 0) continue;
    const move = singleMove(board, player, from, die);
    if (move) moves.push(move);
  }
  return moves;
}

/** Mutates `board` by playing `move` for `player`. Used by search code for speed. */
export function applyMoveInPlace(board: BoardState, player: Player, move: CheckerMove): void {
  const sign = signOf(player);
  const opponent = opponentOf(player);
  if (move.from === 'bar') board.bar[player] -= 1;
  else board.points[move.from] -= sign;

  if (move.to === 'off') {
    board.off[player] += 1;
    return;
  }
  if (checkersAt(board, move.to, opponent) === 1) {
    board.points[move.to] = 0;
    board.bar[opponent] += 1;
  }
  board.points[move.to] += sign;
}

/** Returns a new board with `move` applied. */
export function applyMove(board: BoardState, player: Player, move: CheckerMove): BoardState {
  const next = cloneBoard(board);
  applyMoveInPlace(next, player, move);
  return next;
}

export function applyPlay(board: BoardState, player: Player, play: readonly CheckerMove[]): BoardState {
  const next = cloneBoard(board);
  for (const move of play) applyMoveInPlace(next, player, move);
  return next;
}

/** True once a player has no checkers left on the board or the bar. */
export function hasBorneOffAll(board: BoardState, player: Player): boolean {
  if (board.bar[player] > 0) return false;
  for (let point = 1; point <= 24; point++) {
    if (checkersAt(board, point, player) > 0) return false;
  }
  return true;
}

export function sameMove(a: CheckerMove, b: Pick<CheckerMove, 'from' | 'to' | 'die'>): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die;
}
