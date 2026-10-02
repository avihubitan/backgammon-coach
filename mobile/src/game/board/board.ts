import {
  CHECKERS_PER_PLAYER,
  type BoardState,
  type PerPlayer,
  type Player,
  type PointNumber,
} from '../types';

export const opponentOf = (player: Player): Player =>
  player === 'player1' ? 'player2' : 'player1';

/** Sign used to store a player's checkers in `BoardState.points`. */
export const signOf = (player: Player): 1 | -1 => (player === 'player1' ? 1 : -1);

export function emptyBoard(): BoardState {
  return {
    points: new Array(25).fill(0),
    bar: { player1: 0, player2: 0 },
    off: { player1: 0, player2: 0 },
  };
}

/** Standard starting position. */
export function initialBoard(): BoardState {
  return createBoard({
    player1: { 24: 2, 13: 5, 8: 3, 6: 5 },
    player2: { 1: 2, 12: 5, 17: 3, 19: 5 },
  });
}

export interface BoardSpec {
  /** Absolute point number -> number of player1 checkers. */
  player1?: Record<number, number>;
  /** Absolute point number -> number of player2 checkers. */
  player2?: Record<number, number>;
  bar?: Partial<PerPlayer<number>>;
  off?: Partial<PerPlayer<number>>;
}

/**
 * Builds a board from a readable spec. Lessons often use simplified positions
 * with fewer than 15 checkers, so `off` defaults to 0 rather than being inferred.
 */
export function createBoard(spec: BoardSpec): BoardState {
  const board = emptyBoard();
  for (const player of ['player1', 'player2'] as const) {
    const placement = spec[player] ?? {};
    for (const [key, count] of Object.entries(placement)) {
      const point = Number(key);
      if (!Number.isInteger(point) || point < 1 || point > 24) {
        throw new Error(`Invalid point ${key} in board spec`);
      }
      if (count <= 0) continue;
      if (board.points[point] !== 0) {
        throw new Error(`Point ${point} cannot hold checkers of both players`);
      }
      board.points[point] = signOf(player) * count;
    }
  }
  board.bar = { player1: spec.bar?.player1 ?? 0, player2: spec.bar?.player2 ?? 0 };
  board.off = { player1: spec.off?.player1 ?? 0, player2: spec.off?.player2 ?? 0 };
  return board;
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    points: board.points.slice(),
    bar: { ...board.bar },
    off: { ...board.off },
  };
}

/** Number of `player`'s checkers on an absolute point. */
export function checkersAt(board: BoardState, point: PointNumber, player: Player): number {
  const value = board.points[point] ?? 0;
  return player === 'player1' ? Math.max(0, value) : Math.max(0, -value);
}

export function ownerAt(board: BoardState, point: PointNumber): Player | null {
  const value = board.points[point] ?? 0;
  if (value > 0) return 'player1';
  if (value < 0) return 'player2';
  return null;
}

export function countAt(board: BoardState, point: PointNumber): number {
  return Math.abs(board.points[point] ?? 0);
}

export function checkersOnBoard(board: BoardState, player: Player): number {
  let total = 0;
  for (let point = 1; point <= 24; point++) total += checkersAt(board, point, player);
  return total;
}

export function totalCheckers(board: BoardState, player: Player): number {
  return checkersOnBoard(board, player) + board.bar[player] + board.off[player];
}

/**
 * Distance (in pips) a checker on `point` still has to travel to bear off.
 * For player1 this equals the point number; for player2 it is 25 - point.
 */
export function pipDistance(player: Player, point: PointNumber): number {
  return player === 'player1' ? point : 25 - point;
}

/** Converts a distance-from-home (1..24, 25 = bar) back to an absolute point. */
export function pointAtDistance(player: Player, distance: number): PointNumber {
  return player === 'player1' ? distance : 25 - distance;
}

export function isHomePoint(player: Player, point: PointNumber): boolean {
  const distance = pipDistance(player, point);
  return distance >= 1 && distance <= 6;
}

/** Absolute point numbers of a player's home board, from the 1-point outward. */
export function homePoints(player: Player): PointNumber[] {
  return [1, 2, 3, 4, 5, 6].map((d) => pointAtDistance(player, d));
}

/** Total pips a player needs to bear off every checker. */
export function pipCount(board: BoardState, player: Player): number {
  let pips = board.bar[player] * 25;
  for (let point = 1; point <= 24; point++) {
    pips += checkersAt(board, point, player) * pipDistance(player, point);
  }
  return pips;
}

/** True when every checker the player still has in play is inside its home board. */
export function allCheckersHome(board: BoardState, player: Player): boolean {
  if (board.bar[player] > 0) return false;
  for (let point = 1; point <= 24; point++) {
    if (checkersAt(board, point, player) > 0 && !isHomePoint(player, point)) return false;
  }
  return true;
}

/** A blot is a single checker alone on a point. */
export function isBlot(board: BoardState, point: PointNumber, player: Player): boolean {
  return checkersAt(board, point, player) === 1;
}

/** A made point holds two or more of the player's checkers. */
export function isMadePoint(board: BoardState, point: PointNumber, player: Player): boolean {
  return checkersAt(board, point, player) >= 2;
}

export function blotPoints(board: BoardState, player: Player): PointNumber[] {
  const result: PointNumber[] = [];
  for (let point = 1; point <= 24; point++) {
    if (isBlot(board, point, player)) result.push(point);
  }
  return result;
}

export function madePoints(board: BoardState, player: Player): PointNumber[] {
  const result: PointNumber[] = [];
  for (let point = 1; point <= 24; point++) {
    if (isMadePoint(board, point, player)) result.push(point);
  }
  return result;
}

/** Whether the two players' checkers can still interact (otherwise it's a pure race). */
export function hasContact(board: BoardState): boolean {
  if (board.bar.player1 > 0 || board.bar.player2 > 0) return true;
  // player1's rearmost checker (highest point) vs player2's rearmost (lowest point).
  let p1Back = 0;
  let p2Back = 25;
  for (let point = 1; point <= 24; point++) {
    if (checkersAt(board, point, 'player1') > 0) p1Back = point;
  }
  for (let point = 24; point >= 1; point--) {
    if (checkersAt(board, point, 'player2') > 0) p2Back = point;
  }
  return p1Back > p2Back;
}

/** A stable string identity for a position (used for de-duplication and equality). */
export function positionKey(board: BoardState): string {
  return `${board.points.slice(1).join(',')}|${board.bar.player1},${board.bar.player2}|${board.off.player1},${board.off.player2}`;
}

export function boardsEqual(a: BoardState, b: BoardState): boolean {
  return positionKey(a) === positionKey(b);
}

/** Flips the board so player1 and player2 swap roles (useful for symmetric evaluation). */
export function mirrorBoard(board: BoardState): BoardState {
  const mirrored = emptyBoard();
  for (let point = 1; point <= 24; point++) {
    mirrored.points[25 - point] = -board.points[point];
  }
  mirrored.bar = { player1: board.bar.player2, player2: board.bar.player1 };
  mirrored.off = { player1: board.off.player2, player2: board.off.player1 };
  return mirrored;
}

/** Returns a list of problems with a board (empty when valid). */
export function validateBoard(board: BoardState): string[] {
  const problems: string[] = [];
  if (board.points.length !== 25) problems.push('points must have 25 entries');
  if (board.points[0] !== 0) problems.push('points[0] must be 0');
  for (const player of ['player1', 'player2'] as const) {
    if (board.bar[player] < 0 || board.off[player] < 0) problems.push(`${player} has negative bar/off`);
    const total = totalCheckers(board, player);
    if (total > CHECKERS_PER_PLAYER) problems.push(`${player} has ${total} checkers (max 15)`);
  }
  return problems;
}
